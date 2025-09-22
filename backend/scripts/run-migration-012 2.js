const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration012() {
  console.log('🔄 Running migration 012 to fix Add Default Rules...');
  
  try {
    // First check if the columns already exist
    console.log('🔍 Checking current rules table schema...');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rules' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current rules table columns:');
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });
    
    const hasIsDefault = columnsResult.rows.some(col => col.column_name === 'is_default');
    const hasRuleTemplateId = columnsResult.rows.some(col => col.column_name === 'rule_template_id');
    const hasAutoCreatedAt = columnsResult.rows.some(col => col.column_name === 'auto_created_at');
    const hasPlanTier = columnsResult.rows.some(col => col.column_name === 'plan_tier');
    
    console.log(`\n📊 Missing columns:`);
    console.log(`- is_default: ${hasIsDefault ? 'EXISTS' : 'MISSING'}`);
    console.log(`- rule_template_id: ${hasRuleTemplateId ? 'EXISTS' : 'MISSING'}`);
    console.log(`- auto_created_at: ${hasAutoCreatedAt ? 'EXISTS' : 'MISSING'}`);
    console.log(`- plan_tier: ${hasPlanTier ? 'EXISTS' : 'MISSING'}`);
    
    if (hasIsDefault && hasRuleTemplateId && hasAutoCreatedAt && hasPlanTier) {
      console.log('✅ All required columns already exist. Checking tables...');
    } else {
      console.log('🔧 Adding missing columns...');
      
      // Add columns individually to avoid conflicts
      if (!hasIsDefault) {
        await pool.query('ALTER TABLE rules ADD COLUMN is_default BOOLEAN DEFAULT false');
        console.log('✅ Added is_default column');
      }
      
      if (!hasRuleTemplateId) {
        await pool.query('ALTER TABLE rules ADD COLUMN rule_template_id VARCHAR(100)');
        console.log('✅ Added rule_template_id column');
      }
      
      if (!hasAutoCreatedAt) {
        await pool.query('ALTER TABLE rules ADD COLUMN auto_created_at TIMESTAMP WITH TIME ZONE');
        console.log('✅ Added auto_created_at column');
      }
      
      if (!hasPlanTier) {
        await pool.query('ALTER TABLE rules ADD COLUMN plan_tier VARCHAR(20)');
        console.log('✅ Added plan_tier column');
      }
    }
    
    // Check if rule_provisioning_log table exists
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'rule_provisioning_log'
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('🔧 Creating rule_provisioning_log table...');
      await pool.query(`
        CREATE TABLE rule_provisioning_log (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id),
          plan_tier VARCHAR(20) NOT NULL,
          rules_created INTEGER DEFAULT 0,
          provisioning_type VARCHAR(50) NOT NULL,
          from_plan VARCHAR(20),
          to_plan VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_rules JSONB DEFAULT '[]',
          errors JSONB DEFAULT '[]'
        )
      `);
      console.log('✅ Created rule_provisioning_log table');
    } else {
      console.log('✅ rule_provisioning_log table already exists');
    }
    
    // Add indexes
    console.log('🔧 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_rules_is_default ON rules(is_default)',
      'CREATE INDEX IF NOT EXISTS idx_rules_template_id ON rules(rule_template_id)',
      'CREATE INDEX IF NOT EXISTS idx_rules_plan_tier ON rules(plan_tier)',
      'CREATE INDEX IF NOT EXISTS idx_rules_tenant_default ON rules(tenant_id, is_default)',
      'CREATE INDEX IF NOT EXISTS idx_provisioning_log_tenant ON rule_provisioning_log(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_provisioning_log_created_at ON rule_provisioning_log(created_at)'
    ];
    
    for (const indexSql of indexes) {
      try {
        await pool.query(indexSql);
      } catch (error) {
        console.log(`⚠️ Index creation skipped: ${error.message}`);
      }
    }
    console.log('✅ Indexes created');
    
    // Test the is_default query
    console.log('🧪 Testing is_default query...');
    const testResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM rules 
      WHERE tenant_id = 1 AND is_default = true
    `);
    console.log(`✅ Query test successful: ${testResult.rows[0].count} default rules found`);
    
    console.log('🎉 Migration 012 completed successfully!');
    console.log('🔄 Add Default Rules functionality should now work properly.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration012();