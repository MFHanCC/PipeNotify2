const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../services/database');

const router = express.Router();

// Emergency migration endpoint - for guaranteed delivery tables
router.post('/emergency', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY: Running database migration...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Executing schema...');
    
    // Execute schema
    await pool.query(schemaSql);
    
    console.log('✅ Schema migration completed');
    
    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:', result.rows.length);
    
    // Check sample data
    const tenantCount = await pool.query('SELECT COUNT(*) FROM tenants');
    const webhookCount = await pool.query('SELECT COUNT(*) FROM chat_webhooks');
    const ruleCount = await pool.query('SELECT COUNT(*) FROM rules');
    
    res.json({
      success: true,
      message: 'Database migration completed successfully',
      tables: result.rows.map(row => row.table_name),
      counts: {
        tenants: parseInt(tenantCount.rows[0].count),
        webhooks: parseInt(webhookCount.rows[0].count),
        rules: parseInt(ruleCount.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;