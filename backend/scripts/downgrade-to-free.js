#!/usr/bin/env node

/**
 * Downgrade tenant back to Free plan
 * Run via: node scripts/downgrade-to-free.js
 */

const { pool } = require('../services/database');

async function downgradeToFree() {
  try {
    console.log('⬇️ Downgrading tenant to Free plan...');
    
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
    
    // Remove subscription (which defaults to free plan)
    await pool.query('DELETE FROM subscriptions WHERE tenant_id = $1', [tenant.id]);
    
    console.log('✅ Subscription removed - tenant is now on Free plan');
    
    console.log('\n📦 Free plan features:');
    console.log('  • Deal Won notifications');
    console.log('  • Deal Lost notifications');
    console.log('  • New Deal notifications');
    console.log('  • Basic rule customization (name, target, template only)');
    
    console.log('\n📊 Free plan limits:');
    console.log('  • webhooks: 1');
    console.log('  • rules: 3');
    console.log('  • notifications: 100/month');
    console.log('  • log_retention_days: 7');
    console.log('  • advanced_rules: 0');
    
    console.log('\n💸 Back to Free plan! Refresh your dashboard to see the restrictions.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error downgrading to Free plan:', error);
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

// Run the downgrade
downgradeToFree();