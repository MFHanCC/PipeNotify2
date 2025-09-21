const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  const migrationsDir = path.join(__dirname, '../migrations');
  
  try {
    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📋 Found ${files.length} migration files`);
    
    for (const file of files) {
      console.log(`🔄 Running migration: ${file}`);
      
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`✅ Migration completed: ${file}`);
      } catch (error) {
        console.log(`⚠️ Migration failed: ${file} - ${error.message}`);
        // Continue with other migrations
      }
    }
    
    console.log('🎉 All migrations processed');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();