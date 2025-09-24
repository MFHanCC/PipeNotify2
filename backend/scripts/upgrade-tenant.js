const { pool } = require('../services/database');

async function upgradeTenant() {
  try {
    // First, get all tenants
    console.log('📋 Current tenants:');
    const tenants = await pool.query(`
      SELECT id, company_name, pipedrive_user_id, subscription_tier, created_at
      FROM tenants 
      ORDER BY created_at DESC
    `);
    
    console.table(tenants.rows);
    
    if (tenants.rows.length === 0) {
      console.log('❌ No tenants found. You need to complete OAuth flow first.');
      return;
    }
    
    // Upgrade the most recent tenant to Team
    const tenantId = tenants.rows[0].id;
    console.log(`\n🚀 Upgrading tenant ${tenantId} to Team plan...`);
    
    const result = await pool.query(`
      UPDATE tenants 
      SET 
        subscription_tier = 'team',
        subscription_start_date = NOW()
      WHERE id = $1
      RETURNING id, company_name, subscription_tier, subscription_start_date
    `, [tenantId]);
    
    console.log('✅ Successfully upgraded to Team plan!');
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

upgradeTenant();