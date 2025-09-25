const { Pool } = require('pg');
const cron = require('node-cron');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Plan-based retention configuration
const RETENTION_CONFIG = {
  free: 7,      // 7 days
  starter: 30,  // 30 days
  pro: 90,      // 90 days
  team: 365     // 1 year
};

/**
 * Clean up logs based on tenant plan retention limits
 */
async function cleanupLogs() {
  const startTime = Date.now();
  let totalCleaned = 0;

  try {
    console.log('🧹 Starting log cleanup job...');

    // Process each plan tier
    for (const [planTier, retentionDays] of Object.entries(RETENTION_CONFIG)) {
      try {
        // Delete logs older than retention period for this plan
        const result = await pool.query(`
          DELETE FROM logs 
          WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
          AND tenant_id IN (
            SELECT id FROM tenants WHERE plan_tier = $1
          )
        `, [planTier]);

        const cleanedCount = result.rowCount || 0;
        totalCleaned += cleanedCount;

        if (cleanedCount > 0) {
          console.log(`📊 Cleaned ${cleanedCount} logs for ${planTier} plan (${retentionDays} days retention)`);
        }
      } catch (error) {
        console.error(`❌ Error cleaning logs for ${planTier} plan:`, error.message);
      }
    }

    // Also clean up orphaned delivery attempts
    try {
      const orphanResult = await pool.query(`
        DELETE FROM delivery_attempts 
        WHERE log_id NOT IN (SELECT id FROM logs)
      `);

      const orphanCount = orphanResult.rowCount || 0;
      if (orphanCount > 0) {
        console.log(`🗑️  Cleaned ${orphanCount} orphaned delivery attempts`);
        totalCleaned += orphanCount;
      }
    } catch (error) {
      console.error('❌ Error cleaning orphaned delivery attempts:', error.message);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Log cleanup completed in ${duration}ms. Total records cleaned: ${totalCleaned}`);

    // Log cleanup stats to health monitoring
    if (totalCleaned > 0) {
      await recordCleanupStats(totalCleaned, duration);
    }

  } catch (error) {
    console.error('💥 Fatal error during log cleanup:', error);
  }
}

/**
 * Record cleanup statistics for monitoring
 */
async function recordCleanupStats(cleanedCount, duration) {
  try {
    // Insert into system_metrics if table exists
    await pool.query(`
      INSERT INTO system_metrics (metric_name, metric_value, metric_type, metadata, recorded_at)
      VALUES ('log_cleanup_records', $1, 'counter', $2, NOW())
      ON CONFLICT DO NOTHING
    `, [cleanedCount, JSON.stringify({ duration_ms: duration })]);
  } catch (error) {
    // Ignore if system_metrics table doesn't exist
    console.log('📊 Cleanup stats not recorded (system_metrics table not available)');
  }
}

/**
 * Get current log counts by plan for monitoring
 */
async function getLogStats() {
  try {
    const result = await pool.query(`
      SELECT 
        t.plan_tier,
        COUNT(l.id) as log_count,
        MIN(l.created_at) as oldest_log,
        MAX(l.created_at) as newest_log
      FROM tenants t
      LEFT JOIN logs l ON l.tenant_id = t.id
      GROUP BY t.plan_tier
      ORDER BY t.plan_tier
    `);

    console.log('📈 Current log statistics by plan:');
    result.rows.forEach(row => {
      console.log(`  ${row.plan_tier}: ${row.log_count} logs (oldest: ${row.oldest_log ? row.oldest_log.toISOString().split('T')[0] : 'none'})`);
    });

    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching log stats:', error.message);
    return [];
  }
}

// Schedule the cleanup job to run daily at 2:00 AM
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Scheduled log cleanup starting...');
    await cleanupLogs();
  });

  // Also schedule a weekly stats report
  cron.schedule('0 3 * * 0', async () => {
    console.log('📊 Weekly log statistics:');
    await getLogStats();
  });

  console.log('🕐 Log cleanup scheduler initialized:');
  console.log('  - Daily cleanup: 2:00 AM');
  console.log('  - Weekly stats: 3:00 AM Sundays');
  console.log('  - Retention: Free=7d, Starter=30d, Pro=90d, Team=365d');
} else {
  console.log('⏸️ Skipping log cleanup scheduler in test environment');
}

// Manual cleanup function for admin use
async function manualCleanup(dryRun = false) {
  if (dryRun) {
    console.log('🔍 DRY RUN - No logs will be deleted');
    
    // Show what would be deleted
    for (const [planTier, retentionDays] of Object.entries(RETENTION_CONFIG)) {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM logs 
        WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
        AND tenant_id IN (
          SELECT id FROM tenants WHERE plan_tier = $1
        )
      `, [planTier]);

      console.log(`  ${planTier} plan: ${result.rows[0].count} logs would be deleted`);
    }
  } else {
    await cleanupLogs();
  }
}

module.exports = {
  cleanupLogs,
  getLogStats,
  manualCleanup,
  RETENTION_CONFIG
};