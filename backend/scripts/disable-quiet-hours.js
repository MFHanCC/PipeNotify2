#!/usr/bin/env node

/**
 * Disable quiet hours for testing notifications immediately
 * This script temporarily disables quiet hours so notifications are sent immediately
 */

require('dotenv').config();

async function disableQuietHours() {
  console.log('🔧 Disabling quiet hours for immediate testing...');
  
  try {
    const { pool } = require('../services/database');
    
    // Check if quiet_hours table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'quiet_hours'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('✅ No quiet_hours table found - notifications will send immediately');
      return;
    }
    
    // Delete all quiet hours configurations to disable quiet hours
    const result = await pool.query(`
      DELETE FROM quiet_hours WHERE tenant_id = 1
    `);
    
    console.log(`✅ Deleted ${result.rowCount} quiet hours configurations for tenant 1`);
    console.log('🚀 Notifications will now be sent immediately!');
    
    // Also clean up any pending delayed notifications and send them immediately
    const delayedCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'delayed_notifications'
    `);
    
    if (delayedCheck.rows.length > 0) {
      const pendingNotifications = await pool.query(`
        SELECT COUNT(*) as count FROM delayed_notifications 
        WHERE sent_at IS NULL
      `);
      
      const pendingCount = parseInt(pendingNotifications.rows[0].count);
      console.log(`📬 Found ${pendingCount} delayed notifications pending`);
      
      if (pendingCount > 0) {
        // Update scheduled time to now so they process immediately
        const updateResult = await pool.query(`
          UPDATE delayed_notifications 
          SET scheduled_for = NOW() 
          WHERE sent_at IS NULL
        `);
        
        console.log(`⏰ Updated ${updateResult.rowCount} delayed notifications to send immediately`);
        console.log('📋 The delayed notification processor will pick them up within 5 minutes');
      }
    }
    
    console.log('\n🎯 Testing Instructions:');
    console.log('1. Go to Pipedrive and create/update deals');
    console.log('2. Notifications should now appear in Google Chat immediately');
    console.log('3. To re-enable quiet hours later, configure them in the frontend');
    
  } catch (error) {
    console.error('❌ Failed to disable quiet hours:', error);
    console.error('Error details:', error.message);
  }
}

// Run the script
disableQuietHours().catch(console.error);