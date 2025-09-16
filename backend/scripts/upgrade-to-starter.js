#!/usr/bin/env node

/**
 * Upgrade tenant to Starter plan for testing
 * Run via: node scripts/upgrade-to-starter.js
 */

const { pool } = require('../services/database');

async function upgradeToStarter() {
  try {
    console.log('🚀 Upgrading tenant to Starter plan...');
    
    // Get the first tenant (or you can specify your tenant ID)
    const tenantsResult = await pool.query('SELECT id, company_name FROM tenants ORDER BY id LIMIT 1');
    if (tenantsResult.rows.length === 0) {
      console.error('❌ No tenants found');
      process.exit(1);
    }
    
    const tenant = tenantsResult.rows[0];
    console.log(`📍 Target tenant: ${tenant.id} (${tenant.company_name})`);
    
    // Check current subscription
    const currentSub = await pool.query('SELECT * FROM subscriptions WHERE tenant_id = $1', [tenant.id]);
    if (currentSub.rows.length > 0) {
      console.log('📋 Current subscription:', {
        plan_tier: currentSub.rows[0].plan_tier,
        status: currentSub.rows[0].status
      });
    } else {
      console.log('📋 No existing subscription found');
    }
    
    // Calculate Starter plan period (1 month from now)
    const now = new Date();
    const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    console.log(`📅 Setting Starter plan valid from ${now.toISOString()} to ${oneMonthFromNow.toISOString()}`);
    
    // Upgrade to Starter plan
    const upgradeResult = await pool.query(`
      INSERT INTO subscriptions (tenant_id, plan_tier, status, current_period_start, current_period_end, monthly_notification_count)
      VALUES ($1, 'starter', 'active', $2, $3, 0)
      ON CONFLICT (tenant_id) DO UPDATE SET
        plan_tier = 'starter',
        status = 'active',
        current_period_start = $2,
        current_period_end = $3,
        monthly_notification_count = 0,
        updated_at = NOW()
      RETURNING *
    `, [tenant.id, now, oneMonthFromNow]);
    
    const subscription = upgradeResult.rows[0];
    console.log('✅ Starter plan activated successfully');
    
    console.log('📋 Updated subscription details:');
    console.log(`  - ID: ${subscription.id}`);
    console.log(`  - Plan: ${subscription.plan_tier}`);
    console.log(`  - Status: ${subscription.status}`);
    console.log(`  - Valid from: ${subscription.current_period_start}`);
    console.log(`  - Valid until: ${subscription.current_period_end}`);
    console.log(`  - Notifications used: ${subscription.monthly_notification_count}`);
    
    console.log('\n📦 Starter plan features:');
    console.log('  • Deal Won notifications');
    console.log('  • Deal Lost notifications');
    console.log('  • New Deal notifications');
    console.log('  • Deal Updated notifications ⭐');
    console.log('  • Value filtering ⭐');
    console.log('  • Enhanced formatting ⭐');
    console.log('  • Stage filtering ⭐');
    console.log('  • Activity notifications ⭐');
    console.log('  • Usage analytics ⭐');
    
    console.log('\n📊 Starter plan limits:');
    console.log('  • webhooks: 3');
    console.log('  • rules: 10');
    console.log('  • notifications: 1000/month');
    console.log('  • log_retention_days: 30');
    
    console.log('\n🎉 Starter plan setup complete! Refresh your dashboard to see new features.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error upgrading to Starter plan:', error);
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
upgradeToStarter();