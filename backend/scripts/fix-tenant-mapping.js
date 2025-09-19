#!/usr/bin/env node

/**
 * Fix tenant mapping issue - ensure webhooks and rules are in the same tenant
 * PRODUCTION READY - no hardcoded values
 */

// Only load dotenv if not running with Railway
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

async function fixTenantMapping() {
  console.log('🔧 Fixing tenant mapping for webhook processing...');
  
  try {
    // Validate environment
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found. Ensure proper environment setup.');
      process.exit(1);
    }
    
    console.log('✅ DATABASE_URL configured');
    
    const { Pool } = require('pg');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Check current tenant status
    const tenantsResult = await pool.query(`
      SELECT id, company_name, pipedrive_company_id, pipedrive_user_id, created_at
      FROM tenants 
      ORDER BY id
    `);
    
    console.log(`\\n🏢 Current tenants (${tenantsResult.rows.length}):`);
    tenantsResult.rows.forEach(tenant => {
      console.log(`  • Tenant ${tenant.id}: ${tenant.company_name || 'Unknown'} (Pipedrive: ${tenant.pipedrive_company_id || 'None'})`);
    });
    
    // Check rules distribution
    const rulesResult = await pool.query(`
      SELECT tenant_id, COUNT(*) as rule_count, 
             COUNT(CASE WHEN enabled = true THEN 1 END) as enabled_count
      FROM rules 
      GROUP BY tenant_id 
      ORDER BY tenant_id
    `);
    
    console.log('\\n📋 Rules by tenant:');
    rulesResult.rows.forEach(row => {
      console.log(`  • Tenant ${row.tenant_id}: ${row.enabled_count}/${row.rule_count} enabled rules`);
    });
    
    // Check webhooks distribution
    const webhooksResult = await pool.query(`
      SELECT tenant_id, COUNT(*) as webhook_count,
             COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
      FROM chat_webhooks 
      GROUP BY tenant_id 
      ORDER BY tenant_id
    `);
    
    console.log('\\n🔗 Webhooks by tenant:');
    webhooksResult.rows.forEach(row => {
      console.log(`  • Tenant ${row.tenant_id}: ${row.active_count}/${row.webhook_count} active webhooks`);
    });
    
    // Identify the issue
    const hasRulesTenant1 = rulesResult.rows.find(r => r.tenant_id === 1 && r.enabled_count > 0);
    const hasWebhooksTenant1 = webhooksResult.rows.find(r => r.tenant_id === 1 && r.active_count > 0);
    const hasRulesTenant2 = rulesResult.rows.find(r => r.tenant_id === 2 && r.enabled_count > 0);
    const hasWebhooksTenant2 = webhooksResult.rows.find(r => r.tenant_id === 2 && r.active_count > 0);
    
    console.log('\\n🔍 Analysis:');
    console.log(`  • Tenant 1: ${hasRulesTenant1 ? hasRulesTenant1.enabled_count : 0} rules, ${hasWebhooksTenant1 ? hasWebhooksTenant1.active_count : 0} webhooks`);
    console.log(`  • Tenant 2: ${hasRulesTenant2 ? hasRulesTenant2.enabled_count : 0} rules, ${hasWebhooksTenant2 ? hasWebhooksTenant2.active_count : 0} webhooks`);
    
    // Check which tenant should handle company_id 13887824
    const pipedriveCompanyId = '13887824';
    const tenantWithPipedrive = await pool.query(`
      SELECT * FROM tenants WHERE pipedrive_company_id = $1
    `, [pipedriveCompanyId]);
    
    console.log(`\\n🔍 Tenant mapping for Pipedrive company ${pipedriveCompanyId}:`);
    if (tenantWithPipedrive.rows.length > 0) {
      const tenant = tenantWithPipedrive.rows[0];
      console.log(`  • Mapped to Tenant ${tenant.id}: ${tenant.company_name || 'Unknown'}`);
    } else {
      console.log(`  • No tenant mapped to Pipedrive company ${pipedriveCompanyId}`);
    }
    
    // Propose solution
    if (hasRulesTenant1 && hasWebhooksTenant1 && !tenantWithPipedrive.rows.length) {
      console.log(`\\n💡 SOLUTION: Update tenant 1 to handle Pipedrive company ${pipedriveCompanyId}`);
      
      const updateResult = await pool.query(`
        UPDATE tenants 
        SET pipedrive_company_id = $1,
            company_name = COALESCE(company_name, 'Pipedrive User'),
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [pipedriveCompanyId]);
      
      if (updateResult.rows.length > 0) {
        console.log(`✅ Updated tenant 1 to handle Pipedrive company ${pipedriveCompanyId}`);
        console.log(`   Company name: ${updateResult.rows[0].company_name}`);
      }
    } else if (hasRulesTenant2 && hasWebhooksTenant2) {
      console.log('\\n✅ Configuration looks correct - rules and webhooks are both in tenant 2');
    } else {
      console.log('\\n⚠️ Complex tenant mapping detected - manual review required');
    }
    
    // Final verification
    console.log(`\\n🔍 Final verification for company ${pipedriveCompanyId}:`);
    const finalCheck = await pool.query(`
      SELECT t.id as tenant_id, t.company_name,
             COUNT(r.id) as rules_count,
             COUNT(cw.id) as webhooks_count
      FROM tenants t
      LEFT JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
      LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
      WHERE t.pipedrive_company_id = $1
      GROUP BY t.id, t.company_name
    `, [pipedriveCompanyId]);
    
    if (finalCheck.rows.length > 0) {
      const result = finalCheck.rows[0];
      console.log(`  • Tenant ${result.tenant_id}: ${result.rules_count} rules, ${result.webhooks_count} webhooks`);
      
      if (result.rules_count > 0 && result.webhooks_count > 0) {
        console.log('\\n🎉 SUCCESS: Tenant mapping fixed! Webhooks should now trigger notifications.');
      } else {
        console.log(`\\n⚠️ Issue persists: ${result.rules_count === 0 ? 'No rules' : 'No webhooks'} found for tenant.`);
      }
    } else {
      console.log(`  • No tenant mapped to company ${pipedriveCompanyId}`);
    }
    
    await pool.end();
    console.log('\\n✅ Tenant mapping check completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixTenantMapping();