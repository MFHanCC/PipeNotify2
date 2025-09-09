const { Pool } = require('pg');
require('dotenv').config();

async function fixPipedriveConnectionsTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Fixing pipedrive_connections table...');
    
    // First, check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pipedrive_connections'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      // Create the table if it doesn't exist
      console.log('📦 Creating pipedrive_connections table...');
      await pool.query(`
        CREATE TABLE pipedrive_connections (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          api_domain TEXT NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT pipedrive_connections_tenant_id_unique UNIQUE (tenant_id)
        );
      `);
      console.log('✅ Created pipedrive_connections table');
    } else {
      console.log('📋 Table exists, checking/adding missing columns...');
      
      // Add missing columns if they don't exist
      const columnsToAdd = [
        { name: 'access_token', type: 'TEXT NOT NULL' },
        { name: 'refresh_token', type: 'TEXT NOT NULL' },
        { name: 'api_domain', type: 'TEXT NOT NULL' },
        { name: 'expires_at', type: 'TIMESTAMP WITH TIME ZONE NOT NULL' },
        { name: 'connected_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
        { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' }
      ];

      for (const column of columnsToAdd) {
        try {
          await pool.query(`
            ALTER TABLE pipedrive_connections 
            ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};
          `);
          console.log(`✅ Added/verified column: ${column.name}`);
        } catch (error) {
          console.log(`ℹ️  Column ${column.name} may already exist: ${error.message}`);
        }
      }
    }

    // Add indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pipedrive_connections_tenant_id 
      ON pipedrive_connections(tenant_id);
    `);
    console.log('✅ Added index on tenant_id');

    // Verify the table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'pipedrive_connections' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Final table structure:');
    columns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    console.log('🎉 Pipedrive connections table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixPipedriveConnectionsTable();
}

module.exports = { fixPipedriveConnectionsTable };