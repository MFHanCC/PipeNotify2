/**
 * Smart Tenant Resolution Service
 * Intelligently maps Pipedrive webhooks to the correct tenant
 * Handles auto-mapping, tenant consolidation, and smart fallbacks
 */

const { pool } = require('./database');

/**
 * Resolve the appropriate tenant for a Pipedrive webhook using multiple strategies and fallbacks.
 *
 * Attempts the following in order:
 * 1) direct mapping by webhookData.company_id,
 * 2) mapping by webhookData.user_id (and updates the tenant's company id),
 * 3) locating an active tenant suitable for mapping (and updates its company id),
 * 4) creating a new tenant for the company.
 * On errors it will attempt to return a fallback tenant; if none is available the function throws.
 *
 * @param {Object} webhookData - Pipedrive webhook payload. Expected to include `company_id` and/or `user_id`.
 * @returns {Promise<Object>} Resolves to an object with:
 *   - tenantId {number|string} The resolved tenant's id.
 *   - autoMapped {boolean} Whether the resolution involved creating or updating mappings.
 *   - strategy {string} One of 'direct_mapping', 'user_mapping_with_update', 'active_tenant_mapping', 'new_tenant_creation', or 'fallback'.
 *   - tenant {Object} The tenant row/object returned from the database.
 * @throws {Error} If resolution fails and no fallback tenant is available.
 */
async function resolveTenant(webhookData) {
  try {
    const companyId = webhookData.company_id;
    const userId = webhookData.user_id;
    
    console.log(`🧠 Smart tenant resolution for company_id: ${companyId}, user_id: ${userId}`);
    
    // Strategy 1: Direct company_id mapping (ideal case)
    const directMapping = await findTenantByCompanyId(companyId);
    if (directMapping) {
      console.log(`✅ Direct mapping found: tenant ${directMapping.id}`);
      return { 
        tenantId: directMapping.id, 
        autoMapped: false, 
        strategy: 'direct_mapping',
        tenant: directMapping
      };
    }
    
    // Strategy 2: User ID mapping with auto-update
    if (userId) {
      const userMapping = await findTenantByUserId(userId);
      if (userMapping) {
        console.log(`🔄 Found tenant ${userMapping.id} via user_id, auto-mapping company_id`);
        
        // Auto-map the company_id to this tenant
        await updateTenantCompanyId(userMapping.id, companyId);
        
        return { 
          tenantId: userMapping.id, 
          autoMapped: true, 
          strategy: 'user_mapping_with_update',
          tenant: userMapping
        };
      }
    }
    
    // Strategy 3: Find active tenant with rules/webhooks and auto-map
    const activeTenant = await findActiveTenantForMapping(companyId);
    if (activeTenant) {
      console.log(`🎯 Auto-mapping active tenant ${activeTenant.id} to company_id ${companyId}`);
      
      // Map this tenant to the company
      await updateTenantCompanyId(activeTenant.id, companyId);
      
      return { 
        tenantId: activeTenant.id, 
        autoMapped: true, 
        strategy: 'active_tenant_mapping',
        tenant: activeTenant
      };
    }
    
    // Strategy 4: Create new tenant for this company
    console.log(`🆕 Creating new tenant for company_id: ${companyId}`);
    const newTenant = await createTenantForCompany(companyId, webhookData);
    
    return { 
      tenantId: newTenant.id, 
      autoMapped: true, 
      strategy: 'new_tenant_creation',
      tenant: newTenant
    };
    
  } catch (error) {
    console.error('❌ Smart tenant resolution failed:', error);
    
    // Final fallback: Use first available tenant
    const fallbackTenant = await getFallbackTenant();
    if (fallbackTenant) {
      console.log(`🆘 Using fallback tenant: ${fallbackTenant.id}`);
      return { 
        tenantId: fallbackTenant.id, 
        autoMapped: false, 
        strategy: 'fallback',
        tenant: fallbackTenant
      };
    }
    
    throw new Error('No tenant could be resolved');
  }
}

/**
 * Retrieve the tenant that is explicitly mapped to a given Pipedrive company ID.
 *
 * Returns the earliest-created tenant row whose `pipedrive_company_id` exactly matches
 * the provided companyId, or `null` if no match is found or if `companyId` is falsy.
 *
 * @param {string|number} companyId - The Pipedrive company identifier to match.
 * @returns {Promise<Object|null>} The tenant row object or `null` when not found.
 */
async function findTenantByCompanyId(companyId) {
  if (!companyId) return null;
  
  const result = await pool.query(`
    SELECT * FROM tenants 
    WHERE pipedrive_company_id = $1 
    ORDER BY created_at ASC 
    LIMIT 1
  `, [companyId]);
  
  return result.rows[0] || null;
}

/**
 * Retrieve the earliest-created tenant matching a Pipedrive user ID.
 *
 * Returns the first tenant row where `pipedrive_user_id` equals the supplied `userId`,
 * ordered by `created_at` ascending. If `userId` is falsy or no tenant is found, returns `null`.
 *
 * @param {string|number} userId - Pipedrive user identifier to match.
 * @returns {Object|null} The tenant row object or `null` if none found.
 */
async function findTenantByUserId(userId) {
  if (!userId) return null;
  
  const result = await pool.query(`
    SELECT * FROM tenants 
    WHERE pipedrive_user_id = $1 
    ORDER BY created_at ASC 
    LIMIT 1
  `, [userId]);
  
  return result.rows[0] || null;
}

/**
 * Find an active tenant (has at least one enabled rule and one active webhook) eligible to be mapped to a company.
 *
 * Searches for a tenant that currently has no pipedrive_company_id (null or empty) and has >=1 enabled rule and >=1 active chat webhook.
 * Results are ordered to prefer older tenants and those with more rules/webhooks; returns the first matching tenant or null.
 *
 * @param {string|null|undefined} companyId - Pipedrive company id being mapped (used only conceptually; tenants returned will have no existing pipedrive_company_id).
 * @returns {Object|null} The tenant row suitable for mapping, or `null` if none found.
 */
async function findActiveTenantForMapping(companyId) {
  const result = await pool.query(`
    SELECT DISTINCT t.*, 
           COUNT(DISTINCT r.id) as rule_count, 
           COUNT(DISTINCT cw.id) as webhook_count
    FROM tenants t
    LEFT JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
    LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
    WHERE (t.pipedrive_company_id IS NULL OR t.pipedrive_company_id = '')
    GROUP BY t.id
    HAVING COUNT(DISTINCT r.id) > 0 AND COUNT(DISTINCT cw.id) > 0
    ORDER BY 
      t.created_at ASC,
      COUNT(DISTINCT r.id) DESC,
      COUNT(DISTINCT cw.id) DESC
    LIMIT 1
  `);
  
  return result.rows[0] || null;
}

/**
 * Associate a tenant record with a Pipedrive company ID.
 *
 * Updates the tenant's `pipedrive_company_id` and `updated_at` in the database.
 *
 * @param {string|number} tenantId - ID of the tenant to update.
 * @param {string|number} companyId - Pipedrive company ID to associate with the tenant.
 * @returns {Promise<void>} Resolves when the database update completes.
 */
async function updateTenantCompanyId(tenantId, companyId) {
  await pool.query(`
    UPDATE tenants 
    SET pipedrive_company_id = $1,
        updated_at = NOW()
    WHERE id = $2
  `, [companyId, tenantId]);
  
  console.log(`✅ Updated tenant ${tenantId} with company_id ${companyId}`);
}

/**
 * Create a new tenant record for an unknown Pipedrive company and provision defaults.
 *
 * Inserts a tenant using information derived from the provided webhook payload (falls back
 * to sensible defaults when fields are missing), then triggers automatic provisioning
 * for the newly created tenant.
 *
 * @param {string|number} companyId - Pipedrive company identifier to associate with the new tenant.
 * @param {Object} webhookData - Raw webhook payload from Pipedrive; used to extract company and user metadata.
 * @returns {Object} The newly inserted tenant row as returned by the database.
 */
async function createTenantForCompany(companyId, webhookData) {
  const companyName = webhookData.company?.name || `Company ${companyId}`;
  const userId = webhookData.user_id;
  const userName = webhookData.user?.name || 'Unknown User';
  
  const result = await pool.query(`
    INSERT INTO tenants (
      company_name, 
      pipedrive_company_id, 
      pipedrive_user_id, 
      pipedrive_user_name,
      created_at
    ) 
    VALUES ($1, $2, $3, $4, NOW()) 
    RETURNING *
  `, [companyName, companyId, userId, userName]);
  
  const newTenant = result.rows[0];
  console.log(`✅ Created new tenant ${newTenant.id} for company ${companyId}`);
  
  // Auto-provision default setup for new tenant
  await autoProvisionTenant(newTenant.id);
  
  return newTenant;
}

/**
 * Ensure a newly created tenant has a minimal operational state.
 *
 * Checks whether the tenant already has rules or chat webhooks; if neither exist,
 * the function is a no-op for now (placeholder for creating default rules/webhooks).
 * This is a best-effort, non-throwing operation: errors are caught and logged but
 * not rethrown.
 *
 * @param {number|string} tenantId - ID of the tenant to provision.
 * @returns {Promise<void>} Resolves when provisioning check (and any side effects) complete.
 */
async function autoProvisionTenant(tenantId) {
  try {
    console.log(`🔧 Auto-provisioning tenant ${tenantId}`);
    
    // Check if tenant already has rules/webhooks
    const existingSetup = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM rules WHERE tenant_id = $1) as rule_count,
        (SELECT COUNT(*) FROM chat_webhooks WHERE tenant_id = $1) as webhook_count
    `, [tenantId]);
    
    const { rule_count, webhook_count } = existingSetup.rows[0];
    
    if (rule_count > 0 || webhook_count > 0) {
      console.log(`⏭️ Tenant ${tenantId} already has setup (${rule_count} rules, ${webhook_count} webhooks)`);
      return;
    }
    
    // TODO: Add default rule provisioning here if needed
    // For now, just log that the tenant is ready for setup
    console.log(`📋 Tenant ${tenantId} ready for user configuration`);
    
  } catch (error) {
    console.error(`❌ Failed to auto-provision tenant ${tenantId}:`, error);
  }
}

/**
 * Retrieve a fallback tenant that has any existing setup.
 *
 * Looks up and returns the earliest-created tenant that either has at least one enabled rule
 * or at least one active chat webhook. Returns the tenant row object or `null` if none found.
 *
 * @returns {Object|null} The tenant row (database record) to use as a fallback, or `null` if no suitable tenant exists.
 */
async function getFallbackTenant() {
  const result = await pool.query(`
    SELECT t.*
    FROM tenants t
    WHERE EXISTS (
      SELECT 1 FROM rules r WHERE r.tenant_id = t.id AND r.enabled = true
    ) OR EXISTS (
      SELECT 1 FROM chat_webhooks cw WHERE cw.tenant_id = t.id AND cw.is_active = true
    )
    ORDER BY t.created_at ASC
    LIMIT 1
  `);
  
  return result.rows[0] || null;
}

/**
 * Consolidate tenants that share the same `pipedrive_company_id` by merging duplicates into a single kept tenant.
 *
 * Scans the tenants table for groups with the same non-empty `pipedrive_company_id`. For each group it:
 * - selects the oldest tenant (by created_at) to keep,
 * - reassigns related rows (rules, chat_webhooks, logs) from each duplicate tenant to the kept tenant,
 * - deletes the merged duplicate tenant rows.
 *
 * This is an administrative, destructive operation: merged tenants are deleted and their related data is reassigned.
 *
 * @return {Promise<number>} The number of duplicate tenant groups that were processed.
 * @throws {Error} If a database error or other failure occurs during consolidation.
 */
async function consolidateDuplicateTenants() {
  try {
    console.log('🔧 Starting tenant consolidation...');
    
    // Find tenants with same company_id
    const duplicates = await pool.query(`
      SELECT pipedrive_company_id, COUNT(*) as count, ARRAY_AGG(id ORDER BY created_at ASC) as tenant_ids
      FROM tenants 
      WHERE pipedrive_company_id IS NOT NULL AND pipedrive_company_id != ''
      GROUP BY pipedrive_company_id
      HAVING COUNT(*) > 1
    `);
    
    for (const duplicate of duplicates.rows) {
      const [keepTenantId, ...mergeTenantIds] = duplicate.tenant_ids;
      
      console.log(`🔄 Consolidating tenants for company ${duplicate.pipedrive_company_id}: keeping ${keepTenantId}, merging ${mergeTenantIds.join(', ')}`);
      
      // Move rules and webhooks to the kept tenant
      for (const mergeTenantId of mergeTenantIds) {
        await pool.query(`UPDATE rules SET tenant_id = $1 WHERE tenant_id = $2`, [keepTenantId, mergeTenantId]);
        await pool.query(`UPDATE chat_webhooks SET tenant_id = $1 WHERE tenant_id = $2`, [keepTenantId, mergeTenantId]);
        await pool.query(`UPDATE logs SET tenant_id = $1 WHERE tenant_id = $2`, [keepTenantId, mergeTenantId]);
        
        // Delete the merged tenant
        await pool.query(`DELETE FROM tenants WHERE id = $1`, [mergeTenantId]);
      }
    }
    
    console.log(`✅ Consolidated ${duplicates.rows.length} duplicate tenant groups`);
    return duplicates.rows.length;
    
  } catch (error) {
    console.error('❌ Tenant consolidation failed:', error);
    throw error;
  }
}

/**
 * Retrieve numeric statistics about tenants and their setup.
 *
 * Returns an object with aggregated counts and a timestamp:
 * - total_tenants {number} — total number of tenant rows.
 * - mapped_tenants {number} — tenants with a non-empty `pipedrive_company_id`.
 * - unmapped_tenants {number} — tenants with a null or empty `pipedrive_company_id`.
 * - active_tenants {number} — tenants that have at least one enabled rule and at least one active chat webhook.
 * - timestamp {string} — ISO 8601 timestamp for when the stats were generated.
 *
 * On failure the function logs the error and returns null.
 *
 * @returns {Promise<{ total_tenants: number, mapped_tenants: number, unmapped_tenants: number, active_tenants: number, timestamp: string } | null>}
 */
async function getTenantStats() {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_tenants,
        COUNT(CASE WHEN pipedrive_company_id IS NOT NULL AND pipedrive_company_id != '' THEN 1 END) as mapped_tenants,
        COUNT(CASE WHEN pipedrive_company_id IS NULL OR pipedrive_company_id = '' THEN 1 END) as unmapped_tenants
      FROM tenants
    `);
    
    const activeStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT t.id) as active_tenants
      FROM tenants t
      WHERE EXISTS (SELECT 1 FROM rules r WHERE r.tenant_id = t.id AND r.enabled = true)
        AND EXISTS (SELECT 1 FROM chat_webhooks cw WHERE cw.tenant_id = t.id AND cw.is_active = true)
    `);
    
    return {
      ...stats.rows[0],
      active_tenants: parseInt(activeStats.rows[0].active_tenants),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to get tenant stats:', error);
    return null;
  }
}

module.exports = {
  resolveTenant,
  consolidateDuplicateTenants,
  getTenantStats,
  updateTenantCompanyId,
  autoProvisionTenant
};