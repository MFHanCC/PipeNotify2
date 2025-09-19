#!/usr/bin/env node

/**
 * Temporary migration runner for Railway deployment
 * Runs the guaranteed delivery tables migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Running guaranteed delivery tables migration...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { 
      rejectUnauthorized: false,
      require: true 
    } : false
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '014_create_guaranteed_delivery_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('🎯 Created tables: notification_queue, delivery_log, monitoring_metrics');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();