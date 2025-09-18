#!/usr/bin/env node

const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

console.log('🚀 Starting database migration...');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false,
    require: true 
  } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to database');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Running schema migration...');
    
    // Execute schema
    await client.query(schemaSql);
    
    console.log('✅ Schema migration completed');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:', result.rows.length);
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check sample data
    try {
      const tenantCount = await client.query('SELECT COUNT(*) FROM tenants');
      const webhookCount = await client.query('SELECT COUNT(*) FROM chat_webhooks');
      const ruleCount = await client.query('SELECT COUNT(*) FROM rules');
      
      console.log('📝 Sample data counts:');
      console.log(`  - Tenants: ${tenantCount.rows[0].count}`);
      console.log(`  - Webhooks: ${webhookCount.rows[0].count}`);
      console.log(`  - Rules: ${ruleCount.rows[0].count}`);
    } catch (err) {
      console.log('ℹ️  Sample data counts not available (tables may exist without data)');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Database migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration error:', error);
    process.exit(1);
  });