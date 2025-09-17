#!/usr/bin/env node

/**
 * Upgrade tenant 1 to Team plan
 * Run via: railway run -- node scripts/upgrade-tenant-1.js
 */

const { pool } = require('../services/database');

async function upgradeTenant1() {
  try {
    console.log('🚀 Upgrading tenant 1 to Team plan...');
    
    // Calculate Team plan period (1 year from now)
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    console.log(`📅 Setting Team plan valid from ${now.toISOString()} to ${oneYearFromNow.toISOString()}`);
    
    // Upgrade tenant 1 to Team plan
    const upgradeResult = await pool.query(`
      INSERT INTO subscriptions (tenant_id, plan_tier, status, current_period_start, current_period_end, monthly_notification_count)
      VALUES (1, 'team', 'active', $1, $2, 0)
      ON CONFLICT (tenant_id) DO UPDATE SET
        plan_tier = 'team',
        status = 'active',
        current_period_start = $1,
        current_period_end = $2,
        monthly_notification_count = 0,
        updated_at = NOW()
      RETURNING *
    `, [now, oneYearFromNow]);
    
    const subscription = upgradeResult.rows[0];
    console.log('✅ Team plan activated successfully for tenant 1');
    
    console.log('📋 Updated subscription details:');
    console.log(`  - Tenant ID: 1`);
    console.log(`  - Plan: ${subscription.plan_tier}`);
    console.log(`  - Status: ${subscription.status}`);
    console.log(`  - Valid from: ${subscription.current_period_start}`);
    console.log(`  - Valid until: ${subscription.current_period_end}`);
    
    console.log('\n🎉 Tenant 1 upgrade complete! User should now see Team plan features.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error upgrading tenant 1:', error);
    console.error('Stack trace:', error.stack);
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

// Run the upgrade
upgradeTenant1();