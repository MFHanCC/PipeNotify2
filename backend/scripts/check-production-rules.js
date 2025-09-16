#!/usr/bin/env node

/**
 * Check production rules and tenant mapping via Railway
 */

// Only load dotenv if not running with Railway
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

async function checkProductionRules() {
  console.log('🔍 Checking production rules and tenant mapping...');
  
  try {
    // Check environment
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found. Make sure you are connected to Railway.');
      process.exit(1);
    }
    
    console.log('✅ DATABASE_URL found');
    
    // Dynamic import of pg to handle ESM/CommonJS issues
    const { Pool } = require('pg');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Check all tenants
    const tenantsResult = await pool.query(`
      SELECT id, company_name, pipedrive_company_id, pipedrive_user_id, created_at
      FROM tenants 
      ORDER BY id
    `);
    
    console.log(`\\n🏢 Found ${tenantsResult.rows.length} tenants:`);
    tenantsResult.rows.forEach(tenant => {
      console.log(`  • Tenant ID: ${tenant.id}`);
      console.log(`    Company: ${tenant.company_name}`);
      console.log(`    Pipedrive Company ID: ${tenant.pipedrive_company_id}`);
      console.log(`    Pipedrive User ID: ${tenant.pipedrive_user_id}`);
      console.log(`    Created: ${tenant.created_at}`);
      console.log('');
    });
    
    // Check all rules with their webhooks
    const rulesResult = await pool.query(`
      SELECT r.id, r.name, r.event_type, r.enabled, r.tenant_id, r.created_at,
             cw.name as webhook_name, cw.webhook_url, cw.is_active
      FROM rules r
      LEFT JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      ORDER BY r.tenant_id, r.event_type
    `);
    
    console.log(`\\n📋 Found ${rulesResult.rows.length} total rules:`);
    rulesResult.rows.forEach(rule => {
      console.log(`  • Rule ID: ${rule.id} (Tenant: ${rule.tenant_id})`);
      console.log(`    Name: ${rule.name}`);
      console.log(`    Event Type: ${rule.event_type}`);
      console.log(`    Enabled: ${rule.enabled}`);
      console.log(`    Webhook: ${rule.webhook_name} (Active: ${rule.is_active})`);
      console.log('');
    });
    
    // Check specific event types
    const eventTypes = ['deal.won', 'deal.lost', 'deal.create', 'deal.change'];
    for (const eventType of eventTypes) {
      const eventRules = await pool.query(`
        SELECT r.*, cw.webhook_url, cw.name as webhook_name
        FROM rules r
        JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
        WHERE r.event_type = $1 
          AND r.enabled = true 
          AND cw.is_active = true
        ORDER BY r.tenant_id, r.priority ASC, r.created_at ASC
      `, [eventType]);
      
      console.log(`\\n🎯 Active rules for ${eventType}: ${eventRules.rows.length}`);
      eventRules.rows.forEach(rule => {
        console.log(`  • Tenant ${rule.tenant_id}: ${rule.name} → ${rule.webhook_name}`);
      });
    }
    
    await pool.end();
    console.log('\\n✅ Check completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProductionRules();