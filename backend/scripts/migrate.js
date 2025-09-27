const fs = require('fs');
const path = require('path');
const { getDbPool, healthCheck } = require('../services/database');

async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  // Use production-grade health check from database service
  console.log('🔍 Performing database health check...');
  const isHealthy = await healthCheck();
  
  if (!isHealthy) {
    console.log('⚠️ Database health check failed, skipping migrations');
    console.log('💡 Run migrations manually later with: node backend/scripts/migrate.js');
    process.exit(0);
  }
  
  console.log('✅ Database is ready for migrations');
  const pool = getDbPool();
  
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
        // Retry individual migrations if they fail due to connection issues
        let migrationSuccess = false;
        let retryAttempts = 0;
        const maxRetries = 3;
        
        while (!migrationSuccess && retryAttempts < maxRetries) {
          retryAttempts++;
          try {
            await pool.query(sql);
            migrationSuccess = true;
            console.log(`✅ Migration completed: ${file}`);
          } catch (migrationError) {
            if ((migrationError.message.includes('ECONNREFUSED') || migrationError.message.includes('ECONNRESET')) && retryAttempts < maxRetries) {
              console.log(`⚠️ Migration ${file} failed (attempt ${retryAttempts}), retrying...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              console.log(`⚠️ Migration failed: ${file} - ${migrationError.message}`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Migration failed: ${file} - ${error.message}`);
        // Continue with other migrations
      }
    }
    
    console.log('🎉 All migrations processed');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  }
}

runMigrations();