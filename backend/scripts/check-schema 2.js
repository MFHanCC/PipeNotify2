const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkSchema() {
  console.log('🔍 Checking database schema...');
  
  try {
    // Check if is_default column exists in rules table
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'rules' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Rules table columns:');
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });
    
    // Check if rule_provisioning_log table exists
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%provisioning%'
    `);
    
    console.log('\n📋 Provisioning-related tables:');
    tablesResult.rows.forEach(table => {
      console.log(`- ${table.table_name}`);
    });
    
    // Test a simple query on rules table
    const rulesCount = await pool.query('SELECT COUNT(*) as count FROM rules');
    console.log(`\n📊 Current rules count: ${rulesCount.rows[0].count}`);
    
    // Try to test the specific query that's failing
    try {
      const testQuery = await pool.query(`
        SELECT COUNT(*) as total_rules
        FROM rules 
        WHERE tenant_id = 1 AND is_default = true
      `);
      console.log(`✅ is_default column query works: ${testQuery.rows[0].total_rules} default rules`);
    } catch (error) {
      console.log(`❌ is_default column query failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();