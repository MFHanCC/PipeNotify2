#!/usr/bin/env node

/**
 * Quick tenant mapping fix for notification issue
 * Production ready - uses environment variables
 */

// Only load dotenv if not running with Railway
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

async function quickTenantFix() {
  console.log('🔧 Quick tenant mapping fix...');
  
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found');
      process.exit(1);
    }
    
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
    
    // The webhook logs show company_id: 13887824 maps to tenant_id: 2
    // But user's rules are likely in tenant_id: 1
    // Solution: Map tenant 1 to handle company_id 13887824
    
    const pipedriveCompanyId = '13887824';
    
    // Check current mapping
    const currentMapping = await pool.query(`
      SELECT id, company_name, pipedrive_company_id 
      FROM tenants 
      WHERE pipedrive_company_id = $1 OR id IN (1, 2)
      ORDER BY id
    `, [pipedriveCompanyId]);
    
    console.log('\\n📋 Current tenant mapping:');
    currentMapping.rows.forEach(tenant => {
      console.log(`  • Tenant ${tenant.id}: ${tenant.company_name || 'No name'} (Pipedrive: ${tenant.pipedrive_company_id || 'None'})`);
    });
    
    // Check rules in each tenant
    const rulesCheck = await pool.query(`
      SELECT r.tenant_id, COUNT(*) as total, 
             COUNT(CASE WHEN r.enabled = true THEN 1 END) as enabled,
             STRING_AGG(CASE WHEN r.enabled = true THEN r.event_type END, ', ') as event_types
      FROM rules r
      WHERE r.tenant_id IN (1, 2)
      GROUP BY r.tenant_id
      ORDER BY r.tenant_id
    `);
    
    console.log('\\n📋 Rules by tenant:');
    rulesCheck.rows.forEach(rule => {
      console.log(`  • Tenant ${rule.tenant_id}: ${rule.enabled}/${rule.total} enabled (${rule.event_types || 'none'})`);
    });
    
    // Check webhooks in each tenant  
    const webhooksCheck = await pool.query(`
      SELECT cw.tenant_id, COUNT(*) as total,
             COUNT(CASE WHEN cw.is_active = true THEN 1 END) as active
      FROM chat_webhooks cw
      WHERE cw.tenant_id IN (1, 2)
      GROUP BY cw.tenant_id
      ORDER BY cw.tenant_id
    `);
    
    console.log('\\n🔗 Webhooks by tenant:');
    webhooksCheck.rows.forEach(webhook => {
      console.log(`  • Tenant ${webhook.tenant_id}: ${webhook.active}/${webhook.total} active`);
    });
    
    // Solution: Update tenant 1 to handle the Pipedrive company
    const tenant1Rules = rulesCheck.rows.find(r => r.tenant_id === 1);
    const tenant1Webhooks = webhooksCheck.rows.find(w => w.tenant_id === 1);
    
    if (tenant1Rules && tenant1Rules.enabled > 0 && tenant1Webhooks && tenant1Webhooks.active > 0) {
      console.log(`\\n💡 SOLUTION: Mapping tenant 1 to handle Pipedrive company ${pipedriveCompanyId}`);
      
      const updateResult = await pool.query(`
        UPDATE tenants 
        SET pipedrive_company_id = $1,
            company_name = COALESCE(company_name, 'Pipedrive Account'),
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [pipedriveCompanyId]);
      
      if (updateResult.rows.length > 0) {
        console.log(`✅ SUCCESS: Tenant 1 now handles Pipedrive company ${pipedriveCompanyId}`);
        console.log('   This should fix the notification delivery issue!');
      }
    } else {
      console.log('\\n⚠️ Cannot auto-fix: Missing rules or webhooks in tenant 1');
    }
    
    await pool.end();
    console.log('\\n✅ Fix completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

quickTenantFix();