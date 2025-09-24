/**
 * Health Tracking Service
 * Records health metrics and trends for historical analysis
 */

const { pool } = require('./database');

/**
 * Health tracking configuration
 */
const HEALTH_TRACKING_CONFIG = {
  // How often to record health snapshots (15 minutes)
  RECORDING_INTERVAL_MS: 15 * 60 * 1000,
  
  // How long to keep historical data (90 days)
  RETENTION_DAYS: 90,
  
  // Thresholds for alerts
  CRITICAL_THRESHOLD: 70,
  WARNING_THRESHOLD: 85,
  
  // Trend analysis settings
  TREND_WINDOW_HOURS: 24,
  BASELINE_WINDOW_DAYS: 7
};

/**
 * Record a health status snapshot to the database
 */
async function recordHealthSnapshot(healthData) {
  try {
    const {
      overallStatus = 'unknown',
      databaseStatus = 'unknown',
      databaseLatency = null,
      queueStatus = 'unknown',
      queueBacklogSize = 0,
      queueProcessingRate = 0,
      selfHealingStatus = 'unknown',
      selfHealingIssuesFound = 0,
      selfHealingFixesApplied = 0,
      deliverySuccessRate = 100.0,
      responseTime = null,
      uptime = null
    } = healthData;

    // Calculate health score using database function
    const healthScoreResult = await pool.query(`
      SELECT calculate_health_score($1, $2, $3, $4, $5, $6) as health_score
    `, [
      databaseStatus,
      databaseLatency,
      queueStatus,
      queueBacklogSize,
      selfHealingStatus,
      deliverySuccessRate
    ]);

    const healthScore = healthScoreResult.rows[0].health_score;

    // Insert health snapshot
    const result = await pool.query(`
      INSERT INTO health_status_history (
        overall_status,
        health_score,
        database_status,
        database_latency_ms,
        queue_status,
        queue_backlog_size,
        queue_processing_rate,
        self_healing_status,
        self_healing_issues_found,
        self_healing_fixes_applied,
        delivery_success_rate,
        response_time_ms,
        uptime_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, timestamp, health_score
    `, [
      overallStatus,
      Math.round(healthScore || 0),
      databaseStatus,
      Math.round(databaseLatency || 0),
      queueStatus,
      Math.round(queueBacklogSize || 0),
      Math.round(queueProcessingRate || 0),
      selfHealingStatus,
      Math.round(selfHealingIssuesFound || 0),
      Math.round(selfHealingFixesApplied || 0),
      deliverySuccessRate,
      Math.round(responseTime || 0),
      Math.round(uptime || 0)
    ]);

    const snapshotId = result.rows[0].id;
    const timestamp = result.rows[0].timestamp;

    console.log(`📊 Health snapshot recorded: ID ${snapshotId}, Score: ${healthScore}, Status: ${overallStatus}`);

    // Check if we need to create alerts
    await checkAndCreateAlerts(healthScore, overallStatus, healthData, timestamp);

    // Record performance trends
    await recordPerformanceTrends(healthData, timestamp);

    return {
      id: snapshotId,
      healthScore,
      timestamp,
      alertsCreated: false // Will be updated by alert checking
    };

  } catch (error) {
    console.error('❌ Failed to record health snapshot:', error);
    throw error;
  }
}

/**
 * Check health metrics and create alerts if needed
 */
async function checkAndCreateAlerts(healthScore, overallStatus, healthData, timestamp) {
  try {
    const alerts = [];

    // Check overall health score
    if (healthScore <= HEALTH_TRACKING_CONFIG.CRITICAL_THRESHOLD) {
      alerts.push({
        alert_type: 'health_score_critical',
        severity: 'critical',
        title: `System Health Critical: ${healthScore}%`,
        description: `Overall system health has dropped to ${healthScore}%, below critical threshold of ${HEALTH_TRACKING_CONFIG.CRITICAL_THRESHOLD}%`,
        component: 'overall',
        metric_name: 'health_score',
        current_value: healthScore,
        threshold_value: HEALTH_TRACKING_CONFIG.CRITICAL_THRESHOLD
      });
    } else if (healthScore <= HEALTH_TRACKING_CONFIG.WARNING_THRESHOLD) {
      alerts.push({
        alert_type: 'health_score_warning',
        severity: 'warning',
        title: `System Health Warning: ${healthScore}%`,
        description: `Overall system health has dropped to ${healthScore}%, below warning threshold of ${HEALTH_TRACKING_CONFIG.WARNING_THRESHOLD}%`,
        component: 'overall',
        metric_name: 'health_score',
        current_value: healthScore,
        threshold_value: HEALTH_TRACKING_CONFIG.WARNING_THRESHOLD
      });
    }

    // Check database latency
    if (healthData.databaseLatency && healthData.databaseLatency > 1000) {
      alerts.push({
        alert_type: 'database_latency_high',
        severity: healthData.databaseLatency > 2000 ? 'critical' : 'warning',
        title: `High Database Latency: ${healthData.databaseLatency}ms`,
        description: `Database response time is ${healthData.databaseLatency}ms, which may impact system performance`,
        component: 'database',
        metric_name: 'database_latency_ms',
        current_value: healthData.databaseLatency,
        threshold_value: 1000
      });
    }

    // Check queue backlog
    if (healthData.queueBacklogSize > 100) {
      alerts.push({
        alert_type: 'queue_backlog_high',
        severity: healthData.queueBacklogSize > 500 ? 'critical' : 'warning',
        title: `High Queue Backlog: ${healthData.queueBacklogSize} items`,
        description: `Notification queue has ${healthData.queueBacklogSize} pending items, which may cause delays`,
        component: 'queue',
        metric_name: 'queue_backlog_size',
        current_value: healthData.queueBacklogSize,
        threshold_value: 100
      });
    }

    // Check delivery success rate
    if (healthData.deliverySuccessRate < 95) {
      alerts.push({
        alert_type: 'delivery_success_low',
        severity: healthData.deliverySuccessRate < 85 ? 'critical' : 'warning',
        title: `Low Delivery Success Rate: ${healthData.deliverySuccessRate}%`,
        description: `Delivery success rate has dropped to ${healthData.deliverySuccessRate}%, below acceptable threshold`,
        component: 'delivery',
        metric_name: 'delivery_success_rate',
        current_value: healthData.deliverySuccessRate,
        threshold_value: 95
      });
    }

    // Insert alerts into database
    for (const alert of alerts) {
      await pool.query(`
        INSERT INTO health_alerts (
          alert_type, severity, title, description, component,
          metric_name, current_value, threshold_value
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        alert.alert_type,
        alert.severity,
        alert.title,
        alert.description,
        alert.component,
        alert.metric_name,
        alert.current_value,
        alert.threshold_value
      ]);

      console.log(`🚨 Health alert created: ${alert.severity} - ${alert.title}`);
    }

    return alerts.length;

  } catch (error) {
    console.error('❌ Failed to check and create alerts:', error);
    return 0;
  }
}

/**
 * Record performance trends for analysis
 */
async function recordPerformanceTrends(healthData, timestamp) {
  try {
    const trends = [];

    // Calculate trends for key metrics
    const metrics = [
      { category: 'database', name: 'latency_ms', value: healthData.databaseLatency, unit: 'ms' },
      { category: 'queue', name: 'backlog_size', value: healthData.queueBacklogSize, unit: 'items' },
      { category: 'queue', name: 'processing_rate', value: healthData.queueProcessingRate, unit: 'per_minute' },
      { category: 'delivery', name: 'success_rate', value: healthData.deliverySuccessRate, unit: 'percent' },
      { category: 'system', name: 'response_time_ms', value: healthData.responseTime, unit: 'ms' }
    ];

    for (const metric of metrics) {
      if (metric.value !== null && metric.value !== undefined) {
        // Get baseline value from last 7 days
        const baselineResult = await pool.query(`
          SELECT AVG(metric_value) as baseline_value
          FROM performance_trends 
          WHERE metric_category = $1 
            AND metric_name = $2 
            AND timestamp > NOW() - INTERVAL '${HEALTH_TRACKING_CONFIG.BASELINE_WINDOW_DAYS} days'
        `, [metric.category, metric.name]);

        const baselineValue = baselineResult.rows[0]?.baseline_value || metric.value;
        
        // Calculate trend direction
        let trendDirection = 'stable';
        let severityLevel = 'info';
        
        if (baselineValue > 0) {
          const percentChange = ((metric.value - baselineValue) / baselineValue) * 100;
          
          if (Math.abs(percentChange) > 20) {
            trendDirection = percentChange > 0 ? 'up' : 'down';
            
            // Determine severity based on metric type and direction
            if (metric.name.includes('latency') || metric.name.includes('backlog') || metric.name.includes('response_time')) {
              // For these metrics, "up" is bad
              severityLevel = (trendDirection === 'up' && percentChange > 50) ? 'warning' : 'info';
            } else if (metric.name.includes('success_rate')) {
              // For success rate, "down" is bad
              severityLevel = (trendDirection === 'down' && percentChange < -10) ? 'warning' : 'info';
            }
          }
        }

        // Insert trend record
        await pool.query(`
          INSERT INTO performance_trends (
            metric_category, metric_name, metric_value, metric_unit,
            baseline_value, trend_direction, severity_level,
            tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          metric.category,
          metric.name,
          metric.value,
          metric.unit,
          baselineValue,
          trendDirection,
          severityLevel,
          JSON.stringify({ recorded_by: 'health_tracker', version: '2.0' })
        ]);
      }
    }

    console.log(`📈 Performance trends recorded for ${trends.length} metrics`);

  } catch (error) {
    console.error('❌ Failed to record performance trends:', error);
  }
}

/**
 * Get health history for a specific time range
 */
async function getHealthHistory(hours = 24, limit = 100) {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        overall_status,
        health_score,
        database_status,
        database_latency_ms,
        queue_status,
        queue_backlog_size,
        queue_processing_rate,
        self_healing_status,
        self_healing_issues_found,
        self_healing_fixes_applied,
        delivery_success_rate,
        response_time_ms,
        uptime_seconds,
        timestamp
      FROM health_status_history 
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);

    return result.rows;

  } catch (error) {
    console.error('❌ Failed to get health history:', error);
    throw error;
  }
}

/**
 * Get performance trends for analysis
 */
async function getPerformanceTrends(category = null, hours = 24, limit = 500) {
  try {
    let query = `
      SELECT 
        metric_category,
        metric_name,
        metric_value,
        metric_unit,
        baseline_value,
        trend_direction,
        severity_level,
        timestamp
      FROM performance_trends 
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      query += ` AND metric_category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;

  } catch (error) {
    console.error('❌ Failed to get performance trends:', error);
    throw error;
  }
}

/**
 * Get recent health alerts
 */
async function getHealthAlerts(acknowledged = null, resolved = null, limit = 50) {
  try {
    let query = `
      SELECT 
        id,
        alert_type,
        severity,
        title,
        description,
        component,
        metric_name,
        current_value,
        threshold_value,
        acknowledged,
        acknowledged_by,
        acknowledged_at,
        resolved,
        resolved_at,
        created_at
      FROM health_alerts 
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (acknowledged !== null) {
      query += ` AND acknowledged = $${paramIndex}`;
      params.push(acknowledged);
      paramIndex++;
    }
    
    if (resolved !== null) {
      query += ` AND resolved = $${paramIndex}`;
      params.push(resolved);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;

  } catch (error) {
    console.error('❌ Failed to get health alerts:', error);
    throw error;
  }
}

/**
 * Clean up old health data based on retention policy
 */
async function cleanupOldData() {
  try {
    const retentionDays = HEALTH_TRACKING_CONFIG.RETENTION_DAYS;
    
    // Clean up old health history
    const healthCleanup = await pool.query(`
      DELETE FROM health_status_history 
      WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
    `);
    
    // Clean up old performance trends
    const trendsCleanup = await pool.query(`
      DELETE FROM performance_trends 
      WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
    `);
    
    // Clean up resolved alerts older than 30 days
    const alertsCleanup = await pool.query(`
      DELETE FROM health_alerts 
      WHERE resolved = true 
        AND resolved_at < NOW() - INTERVAL '30 days'
    `);

    console.log(`🧹 Health data cleanup completed:
      - Health history: ${healthCleanup.rowCount} records removed
      - Performance trends: ${trendsCleanup.rowCount} records removed  
      - Resolved alerts: ${alertsCleanup.rowCount} records removed`);

    return {
      healthHistoryRemoved: healthCleanup.rowCount,
      performanceTrendsRemoved: trendsCleanup.rowCount,
      alertsRemoved: alertsCleanup.rowCount
    };

  } catch (error) {
    console.error('❌ Failed to cleanup old health data:', error);
    throw error;
  }
}

/**
 * Start automatic health tracking
 */
function startHealthTracking() {
  console.log('📊 Starting automatic health tracking...');
  console.log(`⏰ Recording health snapshots every ${HEALTH_TRACKING_CONFIG.RECORDING_INTERVAL_MS / 60000} minutes`);
  
  // Record initial snapshot
  recordHealthSnapshotFromSources().catch(error => {
    console.error('❌ Initial health snapshot failed:', error);
  });

  // Schedule regular snapshots
  setInterval(async () => {
    try {
      await recordHealthSnapshotFromSources();
    } catch (error) {
      console.error('❌ Scheduled health snapshot failed:', error);
    }
  }, HEALTH_TRACKING_CONFIG.RECORDING_INTERVAL_MS);

  // Schedule daily cleanup
  setInterval(async () => {
    try {
      await cleanupOldData();
    } catch (error) {
      console.error('❌ Health data cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000); // Once per day
}

/**
 * Basic system health check
 */
async function checkBasicSystemHealth() {
  try {
    // Test database connection
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;
    
    return {
      healthy: dbLatency < 1000,
      dbLatency,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Gather health data from various sources and record snapshot
 */
async function recordHealthSnapshotFromSources() {
  try {
    // Import services (avoid circular dependencies)
    const { runSelfHealing } = require('./selfHealing');
    const { getDeliveryStats } = require('./guaranteedDelivery');

    // Gather health data from multiple sources
    const [selfHealingResult, deliveryStats] = await Promise.all([
      runSelfHealing().catch(error => ({
        healthy: false,
        error: error.message,
        issues: [],
        autoFixes: []
      })),
      getDeliveryStats(1).catch(error => ({
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0
      }))
    ]);

    // Simple system health check
    const systemHealth = await checkBasicSystemHealth().catch(error => ({
      healthy: false,
      error: error.message
    }));

    // Get database latency
    const dbStartTime = Date.now();
    await pool.query('SELECT 1');
    const databaseLatency = Date.now() - dbStartTime;

    // Get queue stats
    const queueStats = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
      FROM notification_queue 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    const queueBacklogSize = parseInt(queueStats.rows[0]?.pending_count || 0);
    const queueFailedCount = parseInt(queueStats.rows[0]?.failed_count || 0);

    // Calculate delivery success rate
    const totalDeliveries = deliveryStats.totalDeliveries || 0;
    const successfulDeliveries = deliveryStats.successfulDeliveries || 0;
    const deliverySuccessRate = totalDeliveries > 0 
      ? (successfulDeliveries / totalDeliveries) * 100 
      : 100;

    // Determine queue status
    let queueStatus = 'healthy';
    if (queueFailedCount > 10 || queueBacklogSize > 50) queueStatus = 'degraded';
    if (queueFailedCount > 50 || queueBacklogSize > 200) queueStatus = 'error';

    // Determine overall status
    let overallStatus = 'healthy';
    if (!systemHealth.healthy || !selfHealingResult.healthy || queueStatus === 'error') {
      overallStatus = 'unhealthy';
    } else if (queueStatus === 'degraded' || deliverySuccessRate < 95) {
      overallStatus = 'degraded';
    }

    // Record the snapshot
    const healthData = {
      overallStatus,
      databaseStatus: 'connected',
      databaseLatency,
      queueStatus,
      queueBacklogSize,
      queueProcessingRate: Math.round(successfulDeliveries / 1), // per hour
      selfHealingStatus: selfHealingResult.healthy ? 'active' : 'inactive',
      selfHealingIssuesFound: selfHealingResult.issues?.length || 0,
      selfHealingFixesApplied: selfHealingResult.autoFixes?.length || 0,
      deliverySuccessRate: parseFloat(deliverySuccessRate.toFixed(2)),
      responseTime: databaseLatency,
      uptime: Math.round(process.uptime())
    };

    return await recordHealthSnapshot(healthData);

  } catch (error) {
    console.error('❌ Failed to record health snapshot from sources:', error);
    
    // Record error state
    const errorHealthData = {
      overallStatus: 'unhealthy',
      databaseStatus: 'error',
      queueStatus: 'error',
      selfHealingStatus: 'error',
      deliverySuccessRate: 0
    };
    
    return await recordHealthSnapshot(errorHealthData);
  }
}

module.exports = {
  recordHealthSnapshot,
  getHealthHistory,
  getPerformanceTrends,
  getHealthAlerts,
  startHealthTracking,
  cleanupOldData,
  HEALTH_TRACKING_CONFIG
};