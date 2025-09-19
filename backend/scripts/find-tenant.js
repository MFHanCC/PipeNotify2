#!/usr/bin/env node

/**
 * Find tenant ID by company name or user details
 */

const { pool } = require('../services/database');

async function findTenant(searchTerm) {
  try {
    console.log(`🔍 Searching for tenant: "${searchTerm}"`);
    
    const result = await pool.query(`
      SELECT id, company_name, pipedrive_company_id, pipedrive_user_id, 
             pipedrive_user_name, created_at 
      FROM tenants 
      WHERE 
        company_name ILIKE $1 OR 
        pipedrive_user_name ILIKE $1 OR
        pipedrive_company_id::text = $2 OR
        id::text = $2
      ORDER BY created_at DESC
    `, [`%${searchTerm}%`, searchTerm]);
    
    if (result.rows.length === 0) {
      console.log('❌ No tenants found matching search criteria');
      return;
    }
    
    console.log(`\n📋 Found ${result.rows.length} tenant(s):`);
    console.log('='.repeat(80));
    
    result.rows.forEach((tenant, index) => {
      console.log(`${index + 1}. Tenant ID: ${tenant.id}`);
      console.log(`   Company: ${tenant.company_name}`);
      console.log(`   Pipedrive Company ID: ${tenant.pipedrive_company_id}`);
      console.log(`   User: ${tenant.pipedrive_user_name} (ID: ${tenant.pipedrive_user_id})`);
      console.log(`   Created: ${tenant.created_at}`);
      console.log('');
    });
    
    // If only one result, show additional details
    if (result.rows.length === 1) {
      const tenantId = result.rows[0].id;
      
      // Check rules count
      const rulesResult = await pool.query(`
        SELECT COUNT(*) as total_rules,
               COUNT(CASE WHEN is_default = true THEN 1 END) as default_rules
        FROM rules 
        WHERE tenant_id = $1
      `, [tenantId]);
      
      const rules = rulesResult.rows[0];
      console.log(`📝 Rules: ${rules.default_rules} default rules, ${rules.total_rules} total rules`);
      
      // Check subscription
      const subResult = await pool.query(`
        SELECT plan_tier, status FROM subscriptions WHERE tenant_id = $1
      `, [tenantId]);
      
      if (subResult.rows.length > 0) {
        const sub = subResult.rows[0];
        console.log(`💳 Subscription: ${sub.plan_tier} tier (${sub.status})`);
      } else {
        console.log('💳 Subscription: No subscription record (should auto-detect)');
      }
    }
    
  } catch (error) {
    console.error('❌ Error finding tenant:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node find-tenant.js <search_term>');
    console.log('');
    console.log('Examples:');
    console.log('  node find-tenant.js "Company Name"');
    console.log('  node find-tenant.js "John Doe"');
    console.log('  node find-tenant.js 13887824');
    console.log('  node find-tenant.js 1');
    process.exit(1);
  }
  
  const searchTerm = args.join(' ');
  
  try {
    await findTenant(searchTerm);
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