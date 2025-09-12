#!/usr/bin/env node
/**
 * Fix missing notification rules for tenant 2
 * Run via: railway run -- node scripts/fix-tenant-2-rules.js
 */

const { Pool } = require('pg');

async function fixTenant2Rules() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Checking tenant 2 current state...');
    
    // Check existing webhooks for tenant 2
    const webhooksResult = await pool.query(
      'SELECT id, name, is_active, created_at FROM chat_webhooks WHERE tenant_id = 2'
    );
    
    console.log('📋 Tenant 2 webhooks:', webhooksResult.rows);
    
    if (webhooksResult.rows.length === 0) {
      console.log('❌ No webhooks found for tenant 2. Cannot create rules without webhooks.');
      return;
    }
    
    const activeWebhooks = webhooksResult.rows.filter(w => w.is_active);
    if (activeWebhooks.length === 0) {
      console.log('❌ No active webhooks found for tenant 2. Activating first webhook...');
      await pool.query(
        'UPDATE chat_webhooks SET is_active = true WHERE tenant_id = 2 AND id = $1',
        [webhooksResult.rows[0].id]
      );
      console.log('✅ Activated webhook:', webhooksResult.rows[0].name);
    }
    
    // Check existing rules for tenant 2
    const rulesResult = await pool.query(`
      SELECT r.id, r.name, r.event_type, r.enabled, cw.name as webhook_name
      FROM rules r
      LEFT JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.tenant_id = 2
    `);
    
    console.log('📋 Tenant 2 current rules:', rulesResult.rows);
    
    if (rulesResult.rows.length > 0) {
      console.log('✅ Tenant 2 already has rules. Checking if they are enabled...');
      
      const enabledRules = rulesResult.rows.filter(r => r.enabled);
      if (enabledRules.length === 0) {
        console.log('⚠️ All rules are disabled. Enabling them...');
        await pool.query(
          'UPDATE rules SET enabled = true WHERE tenant_id = 2'
        );
        console.log('✅ Enabled all existing rules for tenant 2');
      } else {
        console.log('✅ Tenant 2 has', enabledRules.length, 'enabled rules');
      }
      return;
    }
    
    // Create default rules for tenant 2
    console.log('🏗️ Creating default rules for tenant 2...');
    
    const targetWebhookId = activeWebhooks[0]?.id || webhooksResult.rows[0].id;
    
    // Create comprehensive deal events rule
    const dealRuleResult = await pool.query(`
      INSERT INTO rules (tenant_id, name, event_type, filters, target_webhook_id, template_mode, enabled, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name
    `, [
      2,
      'All Deal Events - Default Rule',
      'deal.*',
      '{}',
      targetWebhookId,
      'simple',
      true,
      1
    ]);
    
    console.log('✅ Created deal events rule:', dealRuleResult.rows[0]);
    
    // Create person events rule
    const personRuleResult = await pool.query(`
      INSERT INTO rules (tenant_id, name, event_type, filters, target_webhook_id, template_mode, enabled, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name
    `, [
      2,
      'Person Events - Default Rule',
      'person.*',
      '{}',
      targetWebhookId,
      'simple',
      true,
      2
    ]);
    
    console.log('✅ Created person events rule:', personRuleResult.rows[0]);
    
    // Verify final state
    console.log('\n🎯 Final verification:');
    const finalRules = await pool.query(`
      SELECT r.id, r.name, r.event_type, r.enabled, r.priority, cw.name as webhook_name
      FROM rules r
      JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.tenant_id = 2
      ORDER BY r.priority
    `);
    
    console.log('📋 Tenant 2 rules after creation:', finalRules.rows);
    console.log('\n🚀 Tenant 2 should now receive notifications for all deal and person events!');
    
  } catch (error) {
    console.error('❌ Error fixing tenant 2 rules:', error);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  fixTenant2Rules();
}

module.exports = { fixTenant2Rules };