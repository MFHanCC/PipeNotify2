#!/usr/bin/env node

const { pool } = require('../services/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔍 Checking for delayed_notifications table...');
    
    // Check if table already exists
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'delayed_notifications'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ delayed_notifications table already exists');
      return;
    }
    
    console.log('📋 Table missing, running migration 007_create_quiet_hours.sql...');
    
    // Read and execute migration
    const migrationPath = path.join(__dirname, '../migrations/007_create_quiet_hours.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migration);
    console.log('✅ Migration completed successfully');
    
    // Verify table was created
    const verifyResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('delayed_notifications', 'quiet_hours')
    `);
    
    console.log('📊 Tables created:', verifyResult.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };