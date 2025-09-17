#!/usr/bin/env node

/**
 * Debug script to check subscription tier detection and rule provisioning
 * This helps diagnose why Team plan users are getting only 3 rules instead of 10
 */

const { pool } = require('../services/database');
const { getSubscription } = require('../services/stripe');
const { provisionDefaultRules, getProvisioningStatus } = require('../services/ruleProvisioning');

async function debugSubscription(tenantId) {
  try {
    console.log(`🔍 Debugging subscription for tenant ID: ${tenantId}`);
    console.log('='.repeat(60));

    // 1. Check tenant details
    console.log('\n📋 1. Tenant Details:');
    const tenantResult = await pool.query(`
      SELECT id, company_name, pipedrive_company_id, pipedrive_user_id, 
             pipedrive_user_name, created_at 
      FROM tenants 
      WHERE id = $1
    `, [tenantId]);

    if (tenantResult.rows.length === 0) {
      console.log('❌ Tenant not found!');
      return;
    }

    const tenant = tenantResult.rows[0];
    console.log(`   Company: ${tenant.company_name}`);
    console.log(`   Pipedrive Company ID: ${tenant.pipedrive_company_id}`);
    console.log(`   Pipedrive User ID: ${tenant.pipedrive_user_id}`);
    console.log(`   User Name: ${tenant.pipedrive_user_name}`);
    console.log(`   Created: ${tenant.created_at}`);

    // 2. Check subscription table existence
    console.log('\n📊 2. Subscription Table Check:');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscriptions'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️  Subscriptions table does not exist');
      console.log('   This means subscription detection relies on enterprise customer logic');
    } else {
      console.log('✅ Subscriptions table exists');
      
      // Check if there's a subscription record
      const subResult = await pool.query(`
        SELECT * FROM subscriptions WHERE tenant_id = $1
      `, [tenantId]);
      
      if (subResult.rows.length === 0) {
        console.log('📝 No subscription record found for this tenant');
      } else {
        const sub = subResult.rows[0];
        console.log(`   Plan Tier: ${sub.plan_tier}`);
        console.log(`   Status: ${sub.status}`);
        console.log(`   Stripe Customer ID: ${sub.stripe_customer_id || 'None'}`);
        console.log(`   Created: ${sub.created_at}`);
      }
    }

    // 3. Test getSubscription function
    console.log('\n🎯 3. Subscription Detection Test:');
    try {
      const subscription = await getSubscription(tenantId);
      console.log(`   Detected Plan Tier: ${subscription.plan_tier}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Monthly Notification Count: ${subscription.monthly_notification_count}`);
      
      // Check if this matches the enterprise customer ID
      if (tenant.pipedrive_company_id == 13887824) {
        console.log('🚀 This IS the enterprise customer (company_id 13887824)');
        console.log('   Should automatically get Team plan features');
      } else {
        console.log(`🔍 This is NOT the enterprise customer (company_id: ${tenant.pipedrive_company_id})`);
        console.log('   Will use regular subscription logic');
      }
      
    } catch (error) {
      console.log(`❌ Error getting subscription: ${error.message}`);
    }

    // 4. Check current rules
    console.log('\n📝 4. Current Default Rules:');
    const rulesResult = await pool.query(`
      SELECT id, name, event_type, enabled, is_default, plan_tier, 
             created_at, auto_created_at
      FROM rules 
      WHERE tenant_id = $1 AND is_default = true
      ORDER BY priority ASC
    `, [tenantId]);

    console.log(`   Found ${rulesResult.rows.length} default rules:`);
    rulesResult.rows.forEach((rule, index) => {
      console.log(`   ${index + 1}. ${rule.name} (${rule.event_type}) - ${rule.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`      Plan Tier: ${rule.plan_tier || 'Not set'}`);
      console.log(`      Created: ${rule.auto_created_at || rule.created_at}`);
    });

    // 5. Get provisioning status
    console.log('\n📊 5. Provisioning Status:');
    try {
      const status = await getProvisioningStatus(tenantId);
      console.log(`   Current Plan: ${status.current_plan}`);
      console.log(`   Default Rules Count: ${status.default_rules_count}`);
      console.log(`   Available Rules Count: ${status.available_rules_count}`);
      console.log(`   Needs Provisioning: ${status.needs_provisioning}`);
      
      if (status.provisioning_history && status.provisioning_history.length > 0) {
        console.log('\n   Recent Provisioning History:');
        status.provisioning_history.slice(0, 3).forEach((entry, index) => {
          console.log(`   ${index + 1}. ${entry.provisioning_type} - ${entry.rules_created} rules created`);
          console.log(`      Plan: ${entry.plan_tier}, Date: ${entry.created_at}`);
        });
      }
    } catch (error) {
      console.log(`❌ Error getting provisioning status: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 DIAGNOSIS:');
    
    if (tenant.pipedrive_company_id == 13887824) {
      console.log('✅ This tenant should automatically get Team plan (enterprise customer)');
    } else {
      console.log('📋 This tenant needs proper subscription setup for Team plan');
    }
    
    if (rulesResult.rows.length < 10) {
      console.log(`⚠️  Tenant has only ${rulesResult.rows.length} rules but should have 10 for Team plan`);
      console.log('💡 Recommendation: Run rule re-provisioning for correct tier');
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

async function reprovisionRules(tenantId, planTier) {
  try {
    console.log(`\n🔄 Re-provisioning rules for tenant ${tenantId} as ${planTier} tier...`);
    
    // Remove existing default rules first
    const deleteResult = await pool.query(
      'DELETE FROM rules WHERE tenant_id = $1 AND is_default = true RETURNING id, name',
      [tenantId]
    );
    
    console.log(`🗑️  Removed ${deleteResult.rowCount} existing default rules`);
    
    // Provision new rules
    const result = await provisionDefaultRules(tenantId, planTier, 'manual');
    
    if (result.success) {
      console.log(`✅ Successfully provisioned ${result.rules_created} rules for ${planTier} tier`);
      console.log('📋 Rules created:');
      result.created_rules.forEach((rule, index) => {
        console.log(`   ${index + 1}. ${rule.name} (${rule.event_type})`);
      });
    } else {
      console.log(`❌ Rule provisioning failed: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error re-provisioning rules:', error);
    return { success: false, error: error.message };
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node debug-subscription.js <tenant_id> [reprovision_tier]');
    console.log('');
    console.log('Examples:');
    console.log('  node debug-subscription.js 1                    # Debug tenant 1');
    console.log('  node debug-subscription.js 1 team              # Debug and reprovision as team');
    console.log('  node debug-subscription.js 1 pro               # Debug and reprovision as pro');
    process.exit(1);
  }
  
  const tenantId = parseInt(args[0]);
  const reprovisionTier = args[1];
  
  if (isNaN(tenantId)) {
    console.error('❌ Invalid tenant ID. Must be a number.');
    process.exit(1);
  }
  
  try {
    await debugSubscription(tenantId);
    
    if (reprovisionTier) {
      const validTiers = ['free', 'starter', 'pro', 'team'];
      if (!validTiers.includes(reprovisionTier)) {
        console.error(`❌ Invalid tier: ${reprovisionTier}. Valid tiers: ${validTiers.join(', ')}`);
        process.exit(1);
      }
      
      await reprovisionRules(tenantId, reprovisionTier);
    }
    
  } catch (error) {
    console.error('❌ Script execution error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}