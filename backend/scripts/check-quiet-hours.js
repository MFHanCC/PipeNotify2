#!/usr/bin/env node

/**
 * Check if quiet hours are configured and why notifications are being delayed
 */

require('dotenv').config();

async function checkQuietHours() {
  console.log('🔍 Checking quiet hours configuration...');
  
  try {
    const { pool } = require('../services/database');
    const { getQuietHours, isQuietTime } = require('../services/quietHours');
    
    // Check if quiet_hours table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'quiet_hours'
    `);
    
    console.log(`📊 quiet_hours table exists: ${tableCheck.rows.length > 0}`);
    
    if (tableCheck.rows.length > 0) {
      // Check for any records
      const allRecords = await pool.query(`
        SELECT * FROM quiet_hours ORDER BY tenant_id
      `);
      
      console.log(`📋 Total quiet hours records: ${allRecords.rows.length}`);
      
      if (allRecords.rows.length > 0) {
        console.log('🔍 All quiet hours records:');
        allRecords.rows.forEach(record => {
          console.log(`  Tenant ${record.tenant_id}: ${record.start_time}-${record.end_time} (${record.timezone}), weekends: ${record.weekends_enabled}`);
        });
      }
      
      // Specifically check tenant 1
      const tenant1Records = await pool.query(`
        SELECT * FROM quiet_hours WHERE tenant_id = 1
      `);
      
      console.log(`📋 Tenant 1 quiet hours records: ${tenant1Records.rows.length}`);
      
      if (tenant1Records.rows.length > 0) {
        console.log('🎯 Tenant 1 specific config:');
        console.log(JSON.stringify(tenant1Records.rows[0], null, 2));
      }
    }
    
    // Test the actual functions
    console.log('\n🧪 Testing quiet hours functions for tenant 1:');
    
    const config = await getQuietHours(1);
    console.log('📋 getQuietHours result:');
    console.log(JSON.stringify(config, null, 2));
    
    const quietCheck = await isQuietTime(1);
    console.log('\n🔇 isQuietTime result:');
    console.log(JSON.stringify(quietCheck, null, 2));
    
    // Check current time in various timezones
    const now = new Date();
    console.log(`\n⏰ Current time analysis:`);
    console.log(`  UTC: ${now.toISOString()}`);
    console.log(`  Local: ${now.toString()}`);
    console.log(`  UTC Hour: ${now.getUTCHours()}:${now.getUTCMinutes().toString().padStart(2, '0')}`);
    
    if (quietCheck.is_quiet) {
      console.log(`\n🚨 QUIET TIME ACTIVE:`);
      console.log(`  Reason: ${quietCheck.reason}`);
      console.log(`  Next allowed: ${quietCheck.next_allowed}`);
      console.log(`  Config: ${JSON.stringify(quietCheck.config, null, 2)}`);
    } else {
      console.log(`\n✅ NOT QUIET TIME - notifications should send immediately`);
    }
    
  } catch (error) {
    console.error('❌ Failed to check quiet hours:', error);
    console.error('Error details:', error.message);
  }
}

// Run the script
checkQuietHours().catch(console.error);