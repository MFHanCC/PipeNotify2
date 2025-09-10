#!/usr/bin/env node

// Fix tenant/rules mismatch - move rules from tenant 1 to tenant 2
// This addresses the issue where onboarding created rules for tenant 1
// but webhooks are processed for tenant 2

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'pass'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'pipenotify_dev'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixTenantRules() {
  try {
    console.log('🔍 Checking current tenant and rules state...');
    
    // Check tenants
    const tenantsResult = await pool.query('SELECT id, company_name, pipedrive_user_id, pipedrive_company_id FROM tenants ORDER BY id');
    console.log('\n📋 Current tenants:');
    tenantsResult.rows.forEach(tenant => {
      console.log(`  ID: ${tenant.id}, Company: ${tenant.company_name}, User ID: ${tenant.pipedrive_user_id}, Company ID: ${tenant.pipedrive_company_id}`);
    });
    
    // Check rules distribution
    const rulesResult = await pool.query('SELECT tenant_id, COUNT(*) as rule_count FROM rules GROUP BY tenant_id ORDER BY tenant_id');
    console.log('\n📊 Rules by tenant:');
    rulesResult.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.rule_count} rules`);
    });
    
    // Check webhooks distribution  
    const webhooksResult = await pool.query('SELECT tenant_id, COUNT(*) as webhook_count FROM chat_webhooks GROUP BY tenant_id ORDER BY tenant_id');
    console.log('\n🔗 Webhooks by tenant:');
    webhooksResult.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.webhook_count} webhooks`);
    });
    
    // Find the correct tenant (the one with pipedrive_company_id = 13887824)
    const correctTenant = tenantsResult.rows.find(t => t.pipedrive_company_id == 13887824);
    if (!correctTenant) {
      console.log('❌ Could not find tenant with company_id 13887824');
      return;
    }
    
    console.log(`\n🎯 Correct tenant for company_id 13887824 is: ${correctTenant.id}`);
    
    // Check if there are rules in tenant 1 that need to be moved
    const tenant1Rules = await pool.query('SELECT COUNT(*) FROM rules WHERE tenant_id = 1');
    const correctTenantRules = await pool.query('SELECT COUNT(*) FROM rules WHERE tenant_id = $1', [correctTenant.id]);
    
    console.log(`\nRules in tenant 1: ${tenant1Rules.rows[0].count}`);
    console.log(`Rules in tenant ${correctTenant.id}: ${correctTenantRules.rows[0].count}`);
    
    if (tenant1Rules.rows[0].count > 0 && correctTenantRules.rows[0].count == 0) {
      console.log('\n🔄 Moving rules from tenant 1 to tenant', correctTenant.id);
      
      // Move rules
      const updateRulesResult = await pool.query(
        'UPDATE rules SET tenant_id = $1 WHERE tenant_id = 1 RETURNING id, name',
        [correctTenant.id]
      );
      
      console.log(`✅ Moved ${updateRulesResult.rows.length} rules:`);
      updateRulesResult.rows.forEach(rule => {
        console.log(`  - Rule ${rule.id}: ${rule.name}`);
      });
      
      // Also move webhooks if needed
      const tenant1Webhooks = await pool.query('SELECT COUNT(*) FROM chat_webhooks WHERE tenant_id = 1');
      if (tenant1Webhooks.rows[0].count > 0) {
        const updateWebhooksResult = await pool.query(
          'UPDATE chat_webhooks SET tenant_id = $1 WHERE tenant_id = 1 RETURNING id, name',
          [correctTenant.id]
        );
        
        console.log(`✅ Moved ${updateWebhooksResult.rows.length} webhooks:`);
        updateWebhooksResult.rows.forEach(webhook => {
          console.log(`  - Webhook ${webhook.id}: ${webhook.name}`);
        });
      }
    } else {
      console.log('\n✅ No rules need to be moved');
    }
    
    // Final verification
    console.log('\n🔍 Final verification:');
    const finalRulesResult = await pool.query('SELECT tenant_id, COUNT(*) as rule_count FROM rules GROUP BY tenant_id ORDER BY tenant_id');
    finalRulesResult.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.rule_count} rules`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing tenant rules:', error);
  } finally {
    await pool.end();
  }
}

fixTenantRules();