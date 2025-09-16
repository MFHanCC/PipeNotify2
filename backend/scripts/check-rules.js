#!/usr/bin/env node

/**
 * Check what rules exist in the database
 */

const { pool } = require('../services/database');

async function checkRules() {
  try {
    console.log('🔍 Checking rules in database...');
    
    // Get all enabled rules
    const rulesResult = await pool.query(`
      SELECT r.id, r.name, r.event_type, r.enabled, r.tenant_id, r.created_at,
             cw.name as webhook_name, cw.webhook_url
      FROM rules r
      LEFT JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.enabled = true
      ORDER BY r.tenant_id, r.event_type;
    `);
    
    console.log(`\n📋 Found ${rulesResult.rows.length} enabled rules:`);
    rulesResult.rows.forEach(rule => {
      console.log(`  • ID: ${rule.id}`);
      console.log(`    Name: ${rule.name}`);
      console.log(`    Event Type: ${rule.event_type}`);
      console.log(`    Tenant ID: ${rule.tenant_id}`);
      console.log(`    Webhook: ${rule.webhook_name}`);
      console.log(`    Created: ${rule.created_at}`);
      console.log('');
    });
    
    // Check tenants
    const tenantsResult = await pool.query('SELECT id, company_name, pipedrive_company_id FROM tenants ORDER BY id;');
    console.log(`\n🏢 Found ${tenantsResult.rows.length} tenants:`);
    tenantsResult.rows.forEach(tenant => {
      console.log(`  • ID: ${tenant.id}, Company: ${tenant.company_name}, Pipedrive ID: ${tenant.pipedrive_company_id}`);
    });
    
    // Check webhooks
    const webhooksResult = await pool.query('SELECT id, name, is_active, tenant_id FROM chat_webhooks ORDER BY tenant_id;');
    console.log(`\n🔗 Found ${webhooksResult.rows.length} webhooks:`);
    webhooksResult.rows.forEach(webhook => {
      console.log(`  • ID: ${webhook.id}, Name: ${webhook.name}, Active: ${webhook.is_active}, Tenant: ${webhook.tenant_id}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error checking rules:', error);
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await pool.end();
    } catch (closeError) {
      console.error('Warning: Error closing database connection:', closeError.message);
    }
  }
}

// Run the check
checkRules();