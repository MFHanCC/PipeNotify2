/**
 * Smart Tenant Resolution Service
 * Intelligently maps Pipedrive webhooks to the correct tenant
 * Handles auto-mapping, tenant consolidation, and smart fallbacks
 */

const { pool } = require('./database');

/**
 * Intelligent tenant resolution with auto-mapping and fallbacks
 * @param {Object} webhookData - Pipedrive webhook data
 * @returns {Object} { tenantId, autoMapped, strategy }
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
 * Find tenant by exact company_id match
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
 * Find tenant by user_id
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
 * Find an active tenant (has rules and webhooks) that can be mapped to this company
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
 * Update tenant with company_id mapping
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
 * Create new tenant for unknown company
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
 * Auto-provision basic setup for new tenant
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
 * Get fallback tenant (first tenant with any setup)
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
 * Consolidate duplicate tenants (administrative function)
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
 * Get tenant resolution statistics
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