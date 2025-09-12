#!/usr/bin/env node

/**
 * Upgrade tenant to Team plan
 * Run via: railway run -- node scripts/upgrade-to-team.js
 */

const { pool } = require('../services/database');
const { getAvailablePlans } = require('../services/stripe');

async function upgradeToTeam() {
  try {
    console.log('🚀 Upgrading tenant to Team plan...');
    
    // Get the correct tenant (with company_id 13887824)
    const tenantsResult = await pool.query('SELECT id, company_name FROM tenants WHERE pipedrive_company_id = 13887824');
    if (tenantsResult.rows.length === 0) {
      console.error('❌ Tenant with company_id 13887824 not found');
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
    
    // Calculate Team plan period (1 year from now)
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    console.log(`📅 Setting Team plan valid from ${now.toISOString()} to ${oneYearFromNow.toISOString()}`);
    
    // Upgrade to Team plan
    const upgradeResult = await pool.query(`
      INSERT INTO subscriptions (tenant_id, plan_tier, status, current_period_start, current_period_end, monthly_notification_count)
      VALUES ($1, 'team', 'active', $2, $3, 0)
      ON CONFLICT (tenant_id) DO UPDATE SET
        plan_tier = 'team',
        status = 'active',
        current_period_start = $2,
        current_period_end = $3,
        monthly_notification_count = 0,
        updated_at = NOW()
      RETURNING *
    `, [tenant.id, now, oneYearFromNow]);
    
    const subscription = upgradeResult.rows[0];
    console.log('✅ Team plan activated successfully');
    
    // Get Team plan features for confirmation
    const plans = getAvailablePlans();
    const teamPlan = plans.team;
    
    console.log('📋 Updated subscription details:');
    console.log(`  - ID: ${subscription.id}`);
    console.log(`  - Plan: ${subscription.plan_tier}`);
    console.log(`  - Status: ${subscription.status}`);
    console.log(`  - Valid from: ${subscription.current_period_start}`);
    console.log(`  - Valid until: ${subscription.current_period_end}`);
    console.log(`  - Notifications used: ${subscription.monthly_notification_count}`);
    
    console.log('\n📦 Team plan features:');
    teamPlan.features.forEach(feature => console.log(`  • ${feature}`));
    
    console.log('\n📊 Team plan limits:');
    Object.entries(teamPlan.limits).forEach(([key, value]) => {
      console.log(`  • ${key}: ${value}`);
    });
    
    console.log('\n🎉 Enterprise customer setup complete! You now have access to all Team plan features.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error upgrading to Team plan:', error);
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
upgradeToTeam();