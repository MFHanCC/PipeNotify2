#!/usr/bin/env node

const { pool } = require('../services/database');

async function fixTenantRules() {
  try {
    console.log('🔧 Fixing tenant rules...');
    
    // Check current rules
    const currentRules = await pool.query('SELECT * FROM rules ORDER BY tenant_id, id');
    console.log('📋 Current rules:');
    currentRules.rows.forEach(rule => {
      console.log(`  - Tenant ${rule.tenant_id}: Rule ${rule.id} - ${rule.name} (${rule.event_type})`);
    });
    
    // Check current webhooks
    const currentWebhooks = await pool.query('SELECT * FROM chat_webhooks ORDER BY tenant_id, id');
    console.log('🔗 Current webhooks:');
    currentWebhooks.rows.forEach(webhook => {
      console.log(`  - Tenant ${webhook.tenant_id}: Webhook ${webhook.id} - ${webhook.name}`);
    });
    
    // Move rules from tenant 1 to tenant 2
    const moveRulesResult = await pool.query(
      'UPDATE rules SET tenant_id = 2 WHERE tenant_id = 1 RETURNING *'
    );
    
    if (moveRulesResult.rows.length > 0) {
      console.log(`✅ Moved ${moveRulesResult.rows.length} rules to tenant 2:`);
      moveRulesResult.rows.forEach(rule => {
        console.log(`  - Rule ${rule.id}: ${rule.name} (${rule.event_type})`);
      });
    } else {
      console.log('ℹ️ No rules to move from tenant 1 to tenant 2');
    }
    
    // Move webhooks from tenant 1 to tenant 2
    const moveWebhooksResult = await pool.query(
      'UPDATE chat_webhooks SET tenant_id = 2 WHERE tenant_id = 1 RETURNING *'
    );
    
    if (moveWebhooksResult.rows.length > 0) {
      console.log(`✅ Moved ${moveWebhooksResult.rows.length} webhooks to tenant 2:`);
      moveWebhooksResult.rows.forEach(webhook => {
        console.log(`  - Webhook ${webhook.id}: ${webhook.name}`);
      });
    } else {
      console.log('ℹ️ No webhooks to move from tenant 1 to tenant 2');
    }
    
    // Show final state
    const finalRules = await pool.query('SELECT * FROM rules WHERE tenant_id = 2');
    console.log(`\n🎯 Final state: ${finalRules.rows.length} rules for tenant 2:`);
    finalRules.rows.forEach(rule => {
      console.log(`  - ${rule.name} (${rule.event_type}) → webhook ${rule.target_webhook_id}`);
    });
    
    console.log('\n✅ Tenant rules fixed! Try creating a deal in Pipedrive now.');
    
  } catch (error) {
    console.error('❌ Error fixing tenant rules:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixTenantRules();
}

module.exports = { fixTenantRules };
