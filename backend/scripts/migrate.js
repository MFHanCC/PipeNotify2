const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Starting database migration...');
    
    // Add missing columns to tenants table
    await pool.query(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS pipedrive_user_id INTEGER,
      ADD COLUMN IF NOT EXISTS pipedrive_user_name TEXT;
    `);
    
    console.log('✅ Added pipedrive_user_id and pipedrive_user_name columns');

    // Add unique constraint if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE tenants 
        ADD CONSTRAINT tenants_pipedrive_user_id_key UNIQUE (pipedrive_user_id);
      `);
      console.log('✅ Added unique constraint on pipedrive_user_id');
    } catch (error) {
      if (error.code === '23505' || error.message.includes('already exists')) {
        console.log('ℹ️  Unique constraint already exists');
      } else {
        throw error;
      }
    }

    // Add index if it doesn't exist
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tenants_pipedrive_user_id ON tenants(pipedrive_user_id);
    `);
    console.log('✅ Added index on pipedrive_user_id');

    // Verify columns exist
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' 
      AND column_name IN ('pipedrive_user_id', 'pipedrive_user_name')
      ORDER BY column_name;
    `);
    
    console.log('📊 Verified columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Check for and create missing delayed_notifications table
    console.log('🔍 Checking for delayed_notifications table...');
    
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('delayed_notifications', 'quiet_hours')
    `);
    
    const existingTables = tableCheck.rows.map(r => r.table_name);
    
    if (!existingTables.includes('delayed_notifications') || !existingTables.includes('quiet_hours')) {
      console.log('📋 Creating missing quiet hours tables...');
      
      const migrationPath = path.join(__dirname, '../migrations/007_create_quiet_hours.sql');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      
      await pool.query(migration);
      console.log('✅ Created quiet_hours and delayed_notifications tables');
    } else {
      console.log('ℹ️  quiet_hours and delayed_notifications tables already exist');
    }

    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };