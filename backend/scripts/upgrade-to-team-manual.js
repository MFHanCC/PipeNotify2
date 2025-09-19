#!/usr/bin/env node

/**
 * Manual script to upgrade a specific tenant to Team plan
 * This can be run via Railway CLI to fix Team plan customers who aren't being detected correctly
 */

const { pool } = require('../services/database');
const { provisionDefaultRules } = require('../services/ruleProvisioning');

async function upgradeToTeam(identifier) {
  try {
    console.log(`🔍 Looking up tenant: ${identifier}`);
    
    // Find tenant by ID, company name, or pipedrive company ID
    let tenantQuery;
    let queryParams;
    
    if (!isNaN(identifier)) {
      // Numeric - could be tenant ID or pipedrive company ID
      tenantQuery = `
        SELECT id, company_name, pipedrive_company_id, pipedrive_user_name 
        FROM tenants 
        WHERE id = $1 OR pipedrive_company_id::text = $1
      `;
      queryParams = [identifier];
    } else {
      // String - search by company name
      tenantQuery = `
        SELECT id, company_name, pipedrive_company_id, pipedrive_user_name 
        FROM tenants 
        WHERE company_name ILIKE $1
      `;
      queryParams = [`%${identifier}%`];
    }
    
    const tenantResult = await pool.query(tenantQuery, queryParams);
    
    if (tenantResult.rows.length === 0) {
      console.log('❌ No tenant found matching:', identifier);
      return;
    }
    
    if (tenantResult.rows.length > 1) {
      console.log('⚠️  Multiple tenants found:');
      tenantResult.rows.forEach((tenant, index) => {
        console.log(`   ${index + 1}. ID: ${tenant.id}, Company: ${tenant.company_name}, PipedriveID: ${tenant.pipedrive_company_id}`);
      });
      console.log('Please be more specific with your search.');
      return;
    }
    
    const tenant = tenantResult.rows[0];
    const tenantId = tenant.id;
    
    console.log('✅ Found tenant:');
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Company: ${tenant.company_name}`);
    console.log(`   Pipedrive Company ID: ${tenant.pipedrive_company_id}`);
    console.log(`   User: ${tenant.pipedrive_user_name}`);
    
    // Check if subscriptions table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscriptions'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️  Subscriptions table does not exist. Creating subscription...');
      
      // For now, we'll just proceed with rule provisioning
      console.log('📋 Proceeding with rule provisioning for Team plan...');
      
    } else {
      console.log('📊 Updating subscription to Team plan...');
      
      // Create or update subscription
      await pool.query(`
        INSERT INTO subscriptions (
          tenant_id, plan_tier, status, 
          current_period_start, current_period_end,
          monthly_notification_count, created_at, updated_at
        ) VALUES (
          $1, 'team', 'active',
          NOW(), NOW() + INTERVAL '1 year',
          0, NOW(), NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          plan_tier = 'team',
          status = 'active',
          current_period_end = NOW() + INTERVAL '1 year',
          updated_at = NOW()
      `, [tenantId]);
      
      console.log('✅ Subscription updated to Team plan');
    }
    
    // Check current rules
    const currentRulesResult = await pool.query(`
      SELECT COUNT(*) as total_rules,
             COUNT(CASE WHEN is_default = true THEN 1 END) as default_rules
      FROM rules 
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const currentRules = currentRulesResult.rows[0];
    console.log(`📝 Current rules: ${currentRules.default_rules} default, ${currentRules.total_rules} total`);
    
    if (parseInt(currentRules.default_rules) < 10) {
      console.log('🔄 Need to provision Team plan rules (should have 10 default rules)');
      
      // Remove existing default rules
      const deleteResult = await pool.query(
        'DELETE FROM rules WHERE tenant_id = $1 AND is_default = true RETURNING id, name',
        [tenantId]
      );
      
      console.log(`🗑️  Removed ${deleteResult.rowCount} existing default rules`);
      
      // Provision Team plan rules
      const provisionResult = await provisionDefaultRules(tenantId, 'team', 'manual');
      
      if (provisionResult.success) {
        console.log(`🎉 Successfully provisioned ${provisionResult.rules_created} Team plan rules!`);
        console.log('📋 Rules created:');
        provisionResult.created_rules.forEach((rule, index) => {
          console.log(`   ${index + 1}. ${rule.name}`);
        });
      } else {
        console.log('❌ Rule provisioning failed:', provisionResult.error);
      }
    } else {
      console.log('✅ Already has sufficient default rules for Team plan');
    }
    
    console.log('\n🎯 UPGRADE COMPLETE!');
    console.log('The tenant should now have Team plan features and 10 default rules.');
    
  } catch (error) {
    console.error('❌ Error upgrading to Team plan:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node upgrade-to-team-manual.js <tenant_identifier>');
    console.log('');
    console.log('Examples:');
    console.log('  node upgrade-to-team-manual.js 1');
    console.log('  node upgrade-to-team-manual.js "Company Name"');
    console.log('  node upgrade-to-team-manual.js 13887824');
    console.log('');
    console.log('This script will:');
    console.log('1. Find the tenant by ID, company name, or Pipedrive company ID');
    console.log('2. Update their subscription to Team plan');
    console.log('3. Remove existing default rules');
    console.log('4. Provision 10 Team plan default rules');
    process.exit(1);
  }
  
  const identifier = args[0];
  
  try {
    await upgradeToTeam(identifier);
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