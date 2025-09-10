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

module.exports = router;