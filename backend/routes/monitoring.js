const express = require('express');
const router = express.Router();
const { Queue } = require('bullmq');
const { redisConfig } = require('../jobs/queue');

// Import monitoring services
const { 
  findStalledDeals, 
  processStalledDealMonitoring,
  runStalledDealMonitoring 
} = require('../jobs/stalledDealMonitor');

const { getRoutingStats, getRoutingSuggestions } = require('../services/channelRouter');
const { getFilterStats } = require('../services/ruleFilters');
const { pool, getWebhooks } = require('../services/database');
const { getDeliveryStats, getSystemHealth, processManualRecovery } = require('../services/guaranteedDelivery');
// const { runSelfHealing, runEmergencyHealing } = require('../services/selfHealing'); // Disabled for testing

// Create queue for stalled deal monitoring jobs
const stalledDealQueue = new Queue('stalled-deals', redisConfig);

/**
 * GET /api/v1/monitoring/stalled-deals/:tenantId
 * Get stalled deals for a specific tenant
 */
router.get('/stalled-deals/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }
    
    const stalledDeals = await findStalledDeals(tenantId);
    
    const breakdown = {
      critical: stalledDeals.filter(d => d.severity === 'critical').length,
      stale: stalledDeals.filter(d => d.severity === 'stale').length,
      warning: stalledDeals.filter(d => d.severity === 'warning').length
    };
    
    const totalValue = stalledDeals.reduce((sum, deal) => sum + deal.value, 0);
    
    res.json({
      tenant_id: tenantId,
      stalled_deals: stalledDeals,
      total_count: stalledDeals.length,
      breakdown,
      total_value: totalValue,
      currency: stalledDeals[0]?.currency || 'USD'
    });
    
  } catch (error) {
    console.error('Error getting stalled deals:', error);
    res.status(500).json({ error: 'Failed to get stalled deals' });
  }
});

/**
 * POST /api/v1/monitoring/stalled-deals/:tenantId/alert
 * Manually trigger stalled deal alerts for a tenant
 */
router.post('/stalled-deals/:tenantId/alert', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }
    
    // Add job to queue for processing
    const job = await stalledDealQueue.add('monitor-tenant', { tenantId });
    
    res.json({
      message: 'Stalled deal monitoring queued',
      job_id: job.id,
      tenant_id: tenantId
    });
    
  } catch (error) {
    console.error('Error queuing stalled deal monitoring:', error);
    res.status(500).json({ error: 'Failed to queue stalled deal monitoring' });
  }
});

/**
 * POST /api/v1/monitoring/stalled-deals/run-all
 * Manually trigger stalled deal monitoring for all tenants
 */
router.post('/stalled-deals/run-all', async (req, res) => {
  try {
    // Add job to queue for processing all tenants
    const job = await stalledDealQueue.add('monitor-all', {});
    
    res.json({
      message: 'Stalled deal monitoring queued for all tenants',
      job_id: job.id
    });
    
  } catch (error) {
    console.error('Error queuing stalled deal monitoring for all:', error);
    res.status(500).json({ error: 'Failed to queue stalled deal monitoring' });
  }
});

/**
 * GET /api/v1/monitoring/channel-routing/:tenantId
 * Get channel routing statistics
 */
router.get('/channel-routing/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const days = parseInt(req.query.days) || 30;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }
    
    const [routingStats, webhooks] = await Promise.all([
      getRoutingStats(tenantId, pool, days),
      getWebhooks(tenantId)
    ]);
    
    const suggestions = getRoutingSuggestions(webhooks);
    
    res.json({
      tenant_id: tenantId,
      period_days: days,
      routing_stats: routingStats,
      suggestions,
      total_webhooks: webhooks.filter(w => w.is_active).length
    });
    
  } catch (error) {
    console.error('Error getting channel routing stats:', error);
    res.status(500).json({ error: 'Failed to get channel routing statistics' });
  }
});

/**
 * GET /api/v1/monitoring/rule-filters/:tenantId
 * Get rule filtering statistics
 */
router.get('/rule-filters/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }
    
    const filterStats = await getFilterStats(tenantId, pool);
    
    res.json({
      tenant_id: tenantId,
      filter_stats: filterStats,
      total_rules: filterStats.length,
      total_notifications: filterStats.reduce((sum, r) => sum + r.notifications_last_30_days, 0),
      avg_success_rate: filterStats.length > 0 
        ? Math.round(filterStats.reduce((sum, r) => sum + r.success_rate, 0) / filterStats.length)
        : 0
    });
    
  } catch (error) {
    console.error('Error getting rule filter stats:', error);
    res.status(500).json({ error: 'Failed to get rule filter statistics' });
  }
});

/**
 * GET /api/v1/monitoring/dashboard/:tenantId
 * Get comprehensive monitoring dashboard data
 */
router.get('/dashboard/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const days = parseInt(req.query.days) || 30;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }
    
    // Get all monitoring data in parallel
    const [
      stalledDeals,
      routingStats,
      filterStats,
      webhooks
    ] = await Promise.all([
      findStalledDeals(tenantId),
      getRoutingStats(tenantId, pool, days),
      getFilterStats(tenantId, pool),
      getWebhooks(tenantId)
    ]);
    
    const suggestions = getRoutingSuggestions(webhooks);
    
    // Calculate summary metrics
    const summary = {
      stalled_deals: {
        total: stalledDeals.length,
        critical: stalledDeals.filter(d => d.severity === 'critical').length,
        stale: stalledDeals.filter(d => d.severity === 'stale').length,
        warning: stalledDeals.filter(d => d.severity === 'warning').length,
        total_value: stalledDeals.reduce((sum, deal) => sum + deal.value, 0)
      },
      channel_routing: {
        total_webhooks: webhooks.filter(w => w.is_active).length,
        total_notifications: routingStats.reduce((sum, r) => sum + r.notifications_sent, 0),
        avg_success_rate: routingStats.length > 0 
          ? Math.round(routingStats.reduce((sum, r) => sum + r.success_rate, 0) / routingStats.length)
          : 0,
        suggestions_count: suggestions.length
      },
      rule_filters: {
        total_rules: filterStats.length,
        total_notifications: filterStats.reduce((sum, r) => sum + r.notifications_last_30_days, 0),
        avg_success_rate: filterStats.length > 0 
          ? Math.round(filterStats.reduce((sum, r) => sum + r.success_rate, 0) / filterStats.length)
          : 0
      }
    };
    
    res.json({
      tenant_id: tenantId,
      period_days: days,
      summary,
      stalled_deals: stalledDeals,
      routing_stats: routingStats,
      routing_suggestions: suggestions,
      filter_stats: filterStats
    });
    
  } catch (error) {
    console.error('Error getting monitoring dashboard:', error);
    res.status(500).json({ error: 'Failed to get monitoring dashboard data' });
  }
});

/**
 * GUARANTEED DELIVERY SYSTEM MONITORING
 * Production-ready notification system observability
 */

// GET /api/v1/monitoring/delivery/health - System health check
router.get('/delivery/health', async (req, res) => {
  try {
    const health = await getSystemHealth();
    
    res.json({
      status: health.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (error) {
    console.error('❌ Delivery health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/monitoring/delivery/stats - Delivery statistics
router.get('/delivery/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await getDeliveryStats(hours);
    
    res.json({
      timeRange: `${hours} hours`,
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error) {
    console.error('❌ Delivery stats fetch failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/monitoring/delivery/queue-status - Current queue status
router.get('/delivery/queue-status', async (req, res) => {
  try {
    const queueStats = await pool.query(`
      SELECT 
        status,
        tier,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM notification_queue 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status, tier
      ORDER BY status, tier
    `);

    const recentErrors = await pool.query(`
      SELECT 
        id,
        delivery_id,
        status,
        tier,
        error_message,
        retry_count,
        created_at,
        scheduled_for
      FROM notification_queue 
      WHERE status = 'failed' 
        AND created_at > NOW() - INTERVAL '6 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      timestamp: new Date().toISOString(),
      queueStats: queueStats.rows,
      recentErrors: recentErrors.rows
    });
  } catch (error) {
    console.error('❌ Queue status fetch failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/monitoring/delivery/logs - Recent delivery attempts
router.get('/delivery/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;
    const tier = req.query.tier;
    
    let query = `
      SELECT 
        id,
        delivery_id,
        event_type,
        company_id,
        tenant_id,
        status,
        tier,
        result_data,
        processing_time_ms,
        created_at
      FROM delivery_log 
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (tier) {
      query += ` AND tier = $${paramIndex}`;
      params.push(tier);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const logs = await pool.query(query, params);
    
    res.json({
      timestamp: new Date().toISOString(),
      filters: { status, tier, limit },
      logs: logs.rows
    });
  } catch (error) {
    console.error('❌ Delivery log fetch failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/v1/monitoring/delivery/manual-recovery - Trigger manual recovery
router.post('/delivery/manual-recovery', async (req, res) => {
  try {
    const { deliveryId, force } = req.body;
    
    if (!deliveryId) {
      return res.status(400).json({
        error: 'Missing required field: deliveryId'
      });
    }
    
    const result = await processManualRecovery(deliveryId, { force });
    
    res.json({
      timestamp: new Date().toISOString(),
      deliveryId,
      ...result
    });
  } catch (error) {
    console.error('❌ Manual recovery failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/v1/monitoring/delivery/retry-failed - Retry all failed notifications
router.post('/delivery/retry-failed', async (req, res) => {
  try {
    const { olderThanHours = 1, limit = 100 } = req.body;
    
    // Get failed notifications to retry
    const failedNotifications = await pool.query(`
      SELECT id, delivery_id, webhook_data, retry_count
      FROM notification_queue 
      WHERE status = 'failed'
        AND created_at < NOW() - INTERVAL '${olderThanHours} hours'
        AND retry_count < 5
      ORDER BY created_at ASC
      LIMIT $1
    `, [limit]);

    if (failedNotifications.rows.length === 0) {
      return res.json({
        message: 'No failed notifications found to retry',
        retried: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Reset them to pending status for retry
    const retryResult = await pool.query(`
      UPDATE notification_queue 
      SET status = 'pending', 
          scheduled_for = NOW(),
          retry_count = retry_count + 1
      WHERE id = ANY($1)
      RETURNING id
    `, [failedNotifications.rows.map(n => n.id)]);

    console.log(`🔄 Retrying ${retryResult.rowCount} failed notifications`);

    res.json({
      message: 'Failed notifications queued for retry',
      retried: retryResult.rowCount,
      notifications: failedNotifications.rows.map(n => ({
        id: n.id,
        deliveryId: n.delivery_id,
        retryCount: n.retry_count + 1
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Retry failed notifications error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * SELF-HEALING SYSTEM ENDPOINTS
 * Automatic system health monitoring and repair
 */

// POST /api/v1/monitoring/self-healing/run - Run health check and auto-fixes (DISABLED)
router.post('/self-healing/run', async (req, res) => {
  try {
    res.status(503).json({ message: 'Self-healing system temporarily disabled' });
    return;
    // const result = await runSelfHealing();
    
    res.json({
      message: 'Self-healing health check completed',
      ...result
    });
  } catch (error) {
    console.error('❌ Self-healing run failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/v1/monitoring/self-healing/emergency - Run emergency healing (DISABLED)
router.post('/self-healing/emergency', async (req, res) => {
  try {
    res.status(503).json({ message: 'Emergency self-healing system temporarily disabled' });
    return;
    // const result = await runEmergencyHealing();
    
    res.json({
      message: 'Emergency self-healing completed',
      ...result
    });
  } catch (error) {
    console.error('❌ Emergency self-healing failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * COMPREHENSIVE MONITORING DASHBOARD
 * Unified view of all system health metrics
 */

// GET /api/v1/monitoring/comprehensive-dashboard - Complete system overview
router.get('/comprehensive-dashboard', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    
    console.log(`🎯 Generating comprehensive monitoring dashboard for last ${hours} hours`);
    
    // Run all monitoring checks in parallel for maximum efficiency
    const [
      systemHealth,
      deliveryStats,
      queueStatus,
      selfHealingCheck,
      recentLogs,
      tenantOverview
    ] = await Promise.all([
      // System health from guaranteed delivery
      getSystemHealth().catch(error => ({ 
        healthy: false, 
        error: error.message,
        timestamp: new Date().toISOString() 
      })),
      
      // Delivery statistics
      getDeliveryStats(hours).catch(error => ({
        error: error.message,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0
      })),
      
      // Queue status
      pool.query(`
        SELECT 
          status,
          tier,
          COUNT(*) as count,
          MIN(created_at) as oldest,
          MAX(created_at) as newest
        FROM notification_queue 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY status, tier
        ORDER BY status, tier
      `).then(result => result.rows).catch(error => ({
        error: error.message,
        queueStats: []
      })),
      
      // Self-healing status
      Promise.resolve({ healthy: false, error: 'Self-healing disabled' }).catch(error => ({
        healthy: false,
        error: error.message,
        issues: [],
        autoFixes: [],
        manualActionRequired: []
      })),
      
      // Recent delivery logs summary
      pool.query(`
        SELECT 
          status,
          tier,
          COUNT(*) as count,
          AVG(processing_time_ms) as avg_time,
          MAX(processing_time_ms) as max_time,
          MIN(processing_time_ms) as min_time
        FROM delivery_log 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY status, tier
        ORDER BY status, tier
      `).then(result => result.rows).catch(error => ({
        error: error.message,
        logSummary: []
      })),
      
      // Tenant overview
      pool.query(`
        SELECT 
          COUNT(*) as total_tenants,
          COUNT(CASE WHEN pipedrive_company_id IS NOT NULL THEN 1 END) as mapped_tenants,
          COUNT(CASE WHEN pipedrive_company_id IS NULL THEN 1 END) as unmapped_tenants
        FROM tenants
      `).then(result => result.rows[0]).catch(error => ({
        error: error.message,
        total_tenants: 0,
        mapped_tenants: 0,
        unmapped_tenants: 0
      }))
    ]);

    // Calculate overall system health score
    let healthScore = 100;
    let healthIssues = [];
    
    // Delivery system health (40% weight)
    if (!systemHealth.healthy) {
      healthScore -= 40;
      healthIssues.push('Delivery system unhealthy');
    } else if (deliveryStats.error) {
      healthScore -= 20;
      healthIssues.push('Delivery stats unavailable');
    } else {
      const successRate = deliveryStats.totalDeliveries > 0 
        ? (deliveryStats.successfulDeliveries / deliveryStats.totalDeliveries) * 100 
        : 100;
      
      if (successRate < 95) {
        healthScore -= (95 - successRate) * 0.5; // Penalty based on success rate
        healthIssues.push(`Low delivery success rate: ${successRate.toFixed(1)}%`);
      }
    }
    
    // Self-healing system health (30% weight)
    if (!selfHealingCheck.healthy) {
      healthScore -= 30;
      healthIssues.push('Self-healing system issues detected');
    }
    
    // Critical issues from self-healing (additional penalty)
    const criticalIssues = selfHealingCheck.issues?.filter(i => i.severity === 'critical') || [];
    healthScore -= criticalIssues.length * 10;
    
    // Queue health (20% weight)
    const failedQueueItems = Array.isArray(queueStatus) 
      ? queueStatus.find(q => q.status === 'failed')?.count || 0 
      : 0;
    
    if (failedQueueItems > 50) {
      healthScore -= 20;
      healthIssues.push(`High number of failed queue items: ${failedQueueItems}`);
    } else if (failedQueueItems > 10) {
      healthScore -= 10;
      healthIssues.push(`Moderate number of failed queue items: ${failedQueueItems}`);
    }
    
    // Tenant mapping health (10% weight)
    if (tenantOverview.unmapped_tenants > 0) {
      healthScore -= Math.min(tenantOverview.unmapped_tenants * 2, 10);
      healthIssues.push(`${tenantOverview.unmapped_tenants} unmapped tenants`);
    }
    
    // Ensure health score doesn't go below 0
    healthScore = Math.max(0, Math.round(healthScore));
    
    // Determine overall status
    let overallStatus = 'healthy';
    if (healthScore < 70) {
      overallStatus = 'critical';
    } else if (healthScore < 90) {
      overallStatus = 'degraded';
    }
    
    // Build comprehensive response
    const dashboard = {
      timestamp: new Date().toISOString(),
      timeRange: `${hours} hours`,
      
      // Overall system status
      overall: {
        status: overallStatus,
        healthScore: healthScore,
        issues: healthIssues
      },
      
      // Core metrics
      metrics: {
        delivery: {
          healthy: systemHealth.healthy,
          totalDeliveries: deliveryStats.totalDeliveries || 0,
          successfulDeliveries: deliveryStats.successfulDeliveries || 0,
          failedDeliveries: deliveryStats.failedDeliveries || 0,
          successRate: deliveryStats.totalDeliveries > 0 
            ? ((deliveryStats.successfulDeliveries / deliveryStats.totalDeliveries) * 100).toFixed(2)
            : '100.00',
          avgProcessingTime: deliveryStats.avgProcessingTime || 0
        },
        
        queue: {
          items: Array.isArray(queueStatus) ? queueStatus : [],
          totalPending: Array.isArray(queueStatus) 
            ? queueStatus.filter(q => q.status === 'pending').reduce((sum, q) => sum + parseInt(q.count), 0)
            : 0,
          totalFailed: Array.isArray(queueStatus)
            ? queueStatus.filter(q => q.status === 'failed').reduce((sum, q) => sum + parseInt(q.count), 0) 
            : 0
        },
        
        tenants: {
          total: parseInt(tenantOverview.total_tenants),
          mapped: parseInt(tenantOverview.mapped_tenants),
          unmapped: parseInt(tenantOverview.unmapped_tenants),
          mappingHealth: tenantOverview.total_tenants > 0 
            ? ((tenantOverview.mapped_tenants / tenantOverview.total_tenants) * 100).toFixed(1)
            : '100.0'
        }
      },
      
      // Self-healing status
      selfHealing: {
        healthy: selfHealingCheck.healthy,
        lastCheck: selfHealingCheck.timestamp,
        autoFixesApplied: selfHealingCheck.autoFixes?.length || 0,
        criticalIssues: criticalIssues.length,
        warningIssues: selfHealingCheck.issues?.filter(i => i.severity === 'warning').length || 0,
        manualActionsRequired: selfHealingCheck.manualActionRequired?.length || 0,
        recentFixes: selfHealingCheck.autoFixes?.slice(0, 5) || []
      },
      
      // Performance metrics
      performance: {
        deliveryLogs: Array.isArray(recentLogs) ? recentLogs : [],
        averageProcessingTime: Array.isArray(recentLogs) && recentLogs.length > 0
          ? Math.round(recentLogs.reduce((sum, log) => sum + (parseFloat(log.avg_time) || 0), 0) / recentLogs.length)
          : 0
      },
      
      // Quick actions available
      actions: {
        retryFailed: failedQueueItems > 0,
        runEmergencyHealing: false, // Disabled
        manualRecovery: selfHealingCheck.manualActionRequired?.length > 0
      },
      
      // Detailed data for drill-down
      details: {
        systemHealth,
        deliveryStats,
        queueStatus: Array.isArray(queueStatus) ? queueStatus : [],
        selfHealingReport: selfHealingCheck,
        recentLogs: Array.isArray(recentLogs) ? recentLogs : []
      }
    };
    
    console.log(`✅ Comprehensive dashboard generated - Health Score: ${healthScore}%, Status: ${overallStatus}`);
    
    res.json(dashboard);
    
  } catch (error) {
    console.error('❌ Comprehensive dashboard generation failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
      message: 'Failed to generate comprehensive monitoring dashboard'
    });
  }
});

module.exports = router;