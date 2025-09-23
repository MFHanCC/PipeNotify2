#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔗 Connecting to database...');
        
        // Read the migration file
        const migrationPath = path.join(__dirname, 'migrations/012_add_default_rules_support.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Running migration 012...');
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 012 completed successfully!');
        
        // Verify the column was added
        const checkResult = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'rules' AND column_name = 'is_default'
        `);
        
        if (checkResult.rows.length > 0) {
            console.log('✅ Verified: is_default column exists:', checkResult.rows[0]);
        } else {
            console.log('❌ Column verification failed');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();