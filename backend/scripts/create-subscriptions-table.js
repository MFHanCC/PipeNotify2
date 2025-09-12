#!/usr/bin/env node
/**
 * Create missing subscriptions table
 * Run via: railway run -- node backend/scripts/create-subscriptions-table.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function createSubscriptionsTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔧 Creating missing subscriptions table...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/006_create_subscriptions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running migration: 006_create_subscriptions.sql');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Subscriptions table created successfully');
    
    // Verify the table was created
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscriptions'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Verified: subscriptions table exists');
      
      // Check how many subscriptions were created
      const subscriptionCount = await pool.query('SELECT COUNT(*) as count FROM subscriptions');
      console.log(`📊 Created ${subscriptionCount.rows[0].count} free subscriptions for existing tenants`);
      
      // Show the subscriptions
      const subscriptions = await pool.query(`
        SELECT s.id, s.tenant_id, s.plan_tier, s.status, t.company_name
        FROM subscriptions s
        JOIN tenants t ON s.tenant_id = t.id
        ORDER BY s.tenant_id
      `);
      
      console.log('📋 Current subscriptions:');
      subscriptions.rows.forEach(sub => {
        console.log(`  Tenant ${sub.tenant_id} (${sub.company_name}): ${sub.plan_tier} plan (${sub.status})`);
      });
    } else {
      console.log('❌ Warning: subscriptions table was not created');
    }
    
  } catch (error) {
    console.error('❌ Error creating subscriptions table:', error);
    
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Table already exists, checking data...');
      
      try {
        const subscriptionCount = await pool.query('SELECT COUNT(*) as count FROM subscriptions');
        console.log(`📊 Found ${subscriptionCount.rows[0].count} existing subscriptions`);
      } catch (checkError) {
        console.error('❌ Error checking existing subscriptions:', checkError);
      }
    }
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  createSubscriptionsTable();
}

module.exports = { createSubscriptionsTable };