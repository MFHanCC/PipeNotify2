const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection with enhanced Railway support and retry logic
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 20000, // Increased for Railway startup
  idleTimeoutMillis: 30000,
  max: 3, // Reduced for migrations
  keepAlive: true,
  // Enhanced Railway startup resilience
  retryDelay: 2000,
  maxRetries: 5
});

async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  // Wait for database to be ready with exponential backoff
  let dbReady = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!dbReady && attempts < maxAttempts) {
    attempts++;
    try {
      console.log(`🔍 Database readiness check ${attempts}/${maxAttempts}...`);
      await pool.query('SELECT 1');
      dbReady = true;
      console.log('✅ Database is ready for migrations');
    } catch (error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) {
        const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 10000); // Cap at 10s
        console.log(`⏳ Database not ready, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('❌ Database connection error:', error.message);
        break;
      }
    }
  }
  
  if (!dbReady) {
    console.log('⚠️ Database not ready after maximum attempts, continuing anyway...');
  }
  
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
  } finally {
    await pool.end();
  }
}

runMigrations();