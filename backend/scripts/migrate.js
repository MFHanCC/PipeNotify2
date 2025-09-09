const { Pool } = require('pg');
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

    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };