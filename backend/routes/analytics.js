const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Import authentication and feature gating
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/featureGating');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Apply authentication to all routes
router.use(authenticateToken);

// Helper function to parse date range
const parseDateRange = (range) => {
  const now = new Date();
  let startDate;
  
  switch (range) {
    case '1d':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  return { startDate, endDate: now };
};

// Helper function to generate mock data for demonstration
const generateMockAnalytics = (tenantId, range) => {
  const { startDate, endDate } = parseDateRange(range);
  const days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
  
  // Generate time series data
  const timeSeriesData = [];
  for (let i = 0; i < Math.min(days, 30); i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const baseSuccess = Math.floor(Math.random() * 50) + 20;
    const baseFailure = Math.floor(Math.random() * 5) + 1;
    
    timeSeriesData.push({
      timestamp: date.toISOString(),
      success: baseSuccess,
      failure: baseFailure,
      responseTime: Math.floor(Math.random() * 2000) + 500
    });
  }
  
  // Calculate totals
  const totalSuccess = timeSeriesData.reduce((sum, day) => sum + day.success, 0);
  const totalFailure = timeSeriesData.reduce((sum, day) => sum + day.failure, 0);
  const totalNotifications = totalSuccess + totalFailure;
  const successRate = totalNotifications > 0 ? (totalSuccess / totalNotifications) * 100 : 0;
  const failureRate = totalNotifications > 0 ? (totalFailure / totalNotifications) * 100 : 0;
  const avgResponseTime = timeSeriesData.length > 0 
    ? timeSeriesData.reduce((sum, day) => sum + day.responseTime, 0) / timeSeriesData.length
    : 0;
  
  // Generate top performing rules
  const ruleNames = [
    'Deal Value > $10K Alert',
    'Stage Changed to Won',
    'High Priority Deal Created',
    'Deal Lost Analysis',
    'Weekly Pipeline Review'
  ];
  
  const topPerformingRules = ruleNames.slice(0, 3).map((name, index) => {
    const successCount = Math.floor(Math.random() * 100) + 50;
    const failureCount = Math.floor(Math.random() * 5) + 1;
    return {
      id: `rule_${index + 1}`,
      name,
      successCount,
      failureCount,
      successRate: (successCount / (successCount + failureCount)) * 100
    };
  }).sort((a, b) => b.successRate - a.successRate);
  
  // Generate rule effectiveness data
  const ruleEffectiveness = ruleNames.map((name, index) => {
    const triggersToday = Math.floor(Math.random() * 20) + 5;
    const successRate = Math.random() * 20 + 80; // 80-100%
    const trends = ['up', 'down', 'stable'];
    
    return {
      ruleId: `rule_${index + 1}`,
      ruleName: name,
      triggersToday,
      successRate,
      avgResponseTime: Math.floor(Math.random() * 2000) + 500,
      trend: trends[Math.floor(Math.random() * trends.length)]
    };
  });
  
  // Generate channel performance data
  const channelNames = [
    'Sales Team General',
    'Deal Alerts',
    'Management Dashboard',
    'Executive Reports'
  ];
  
  const channelPerformance = channelNames.map((name, index) => {
    const successCount = Math.floor(Math.random() * 80) + 40;
    const failureCount = Math.floor(Math.random() * 8) + 2;
    
    return {
      channelName: name,
      successCount,
      failureCount,
      avgResponseTime: Math.floor(Math.random() * 1500) + 400
    };
  });
  
  return {
    totalNotifications,
    successRate,
    failureRate,
    avgResponseTime,
    topPerformingRules,
    timeSeriesData,
    ruleEffectiveness,
    channelPerformance
  };
};

// GET /api/v1/analytics/dashboard/:tenantId - Get comprehensive analytics data
router.get('/dashboard/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const range = req.query.range || '7d';
    
    // Verify tenant access - convert tenantId to number for comparison
    if (req.tenant.id !== parseInt(tenantId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // For now, return mock data for demonstration
    // In production, this would query the actual database
    const analyticsData = generateMockAnalytics(tenantId, range);
    
    res.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

// GET /api/v1/analytics/rules/:tenantId - Get rule-specific analytics
router.get('/rules/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const range = req.query.range || '7d';
    const { startDate, endDate } = parseDateRange(range);
    
    // Verify tenant access - convert tenantId to number for comparison
    if (req.tenant.id !== parseInt(tenantId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Query rule performance from logs table
    const query = `
      SELECT 
        r.id as rule_id,
        r.name as rule_name,
        COUNT(l.id) as total_triggers,
        COUNT(CASE WHEN l.status = 'delivered' THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN l.status = 'failed' THEN 1 END) as failed_deliveries,
        AVG(CASE WHEN l.response_time IS NOT NULL THEN l.response_time END) as avg_response_time
      FROM rules r
      LEFT JOIN logs l ON l.rule_id = r.id 
        AND l.timestamp >= $1 
        AND l.timestamp <= $2
      WHERE r.tenant_id = $3
      GROUP BY r.id, r.name
      ORDER BY successful_deliveries DESC
    `;
    
    const result = await pool.query(query, [startDate, endDate, tenantId]);
    
    const ruleAnalytics = result.rows.map(row => ({
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      totalTriggers: parseInt(row.total_triggers),
      successfulDeliveries: parseInt(row.successful_deliveries),
      failedDeliveries: parseInt(row.failed_deliveries),
      successRate: row.total_triggers > 0 
        ? (row.successful_deliveries / row.total_triggers) * 100 
        : 0,
      avgResponseTime: row.avg_response_time ? Math.round(row.avg_response_time) : null
    }));
    
    res.json({ rules: ruleAnalytics });
  } catch (error) {
    console.error('Error fetching rule analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch rule analytics',
      message: error.message
    });
  }
});

// GET /api/v1/analytics/channels/:tenantId - Get channel-specific analytics
router.get('/channels/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const range = req.query.range || '7d';
    const { startDate, endDate } = parseDateRange(range);
    
    // Verify tenant access - convert tenantId to number for comparison
    if (req.tenant.id !== parseInt(tenantId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Query channel performance from logs table
    const query = `
      SELECT 
        w.name as channel_name,
        COUNT(l.id) as total_deliveries,
        COUNT(CASE WHEN l.status = 'delivered' THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN l.status = 'failed' THEN 1 END) as failed_deliveries,
        AVG(CASE WHEN l.response_time IS NOT NULL THEN l.response_time END) as avg_response_time
      FROM chat_webhooks w
      LEFT JOIN logs l ON l.webhook_id = w.id 
        AND l.timestamp >= $1 
        AND l.timestamp <= $2
      WHERE w.tenant_id = $3
      GROUP BY w.id, w.name
      ORDER BY successful_deliveries DESC
    `;
    
    const result = await pool.query(query, [startDate, endDate, tenantId]);
    
    const channelAnalytics = result.rows.map(row => ({
      channelName: row.channel_name,
      totalDeliveries: parseInt(row.total_deliveries),
      successfulDeliveries: parseInt(row.successful_deliveries),
      failedDeliveries: parseInt(row.failed_deliveries),
      successRate: row.total_deliveries > 0 
        ? (row.successful_deliveries / row.total_deliveries) * 100 
        : 0,
      avgResponseTime: row.avg_response_time ? Math.round(row.avg_response_time) : null
    }));
    
    res.json({ channels: channelAnalytics });
  } catch (error) {
    console.error('Error fetching channel analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch channel analytics',
      message: error.message
    });
  }
});

// GET /api/v1/analytics/timeline/:tenantId - Get time-series data
router.get('/timeline/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const range = req.query.range || '7d';
    const { startDate, endDate } = parseDateRange(range);
    
    // Verify tenant access - convert tenantId to number for comparison
    if (req.tenant.id !== parseInt(tenantId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Determine interval based on range
    let interval = '1 hour';
    if (range === '30d' || range === '90d') {
      interval = '1 day';
    } else if (range === '7d') {
      interval = '6 hours';
    }
    
    // Query time-series data from logs table
    const query = `
      SELECT 
        DATE_TRUNC($1, l.timestamp) as time_bucket,
        COUNT(CASE WHEN l.status = 'delivered' THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN l.status = 'failed' THEN 1 END) as failed_deliveries,
        AVG(CASE WHEN l.response_time IS NOT NULL THEN l.response_time END) as avg_response_time
      FROM logs l
      WHERE l.tenant_id = $2 
        AND l.timestamp >= $3 
        AND l.timestamp <= $4
      GROUP BY time_bucket
      ORDER BY time_bucket
    `;
    
    const result = await pool.query(query, [interval, tenantId, startDate, endDate]);
    
    const timelineData = result.rows.map(row => ({
      timestamp: row.time_bucket,
      success: parseInt(row.successful_deliveries),
      failure: parseInt(row.failed_deliveries),
      responseTime: row.avg_response_time ? Math.round(row.avg_response_time) : 0
    }));
    
    res.json({ timeline: timelineData });
  } catch (error) {
    console.error('Error fetching timeline analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch timeline analytics',
      message: error.message
    });
  }
});

// GET /api/v1/analytics/summary/:tenantId - Get summary statistics
router.get('/summary/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const range = req.query.range || '7d';
    const { startDate, endDate } = parseDateRange(range);
    
    // Verify tenant access - convert tenantId to number for comparison
    if (req.tenant.id !== parseInt(tenantId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Query summary statistics
    const query = `
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_deliveries,
        AVG(CASE WHEN response_time IS NOT NULL THEN response_time END) as avg_response_time,
        MIN(timestamp) as first_notification,
        MAX(timestamp) as last_notification
      FROM logs
      WHERE tenant_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
    `;
    
    const result = await pool.query(query, [tenantId, startDate, endDate]);
    const row = result.rows[0];
    
    const totalNotifications = parseInt(row.total_notifications);
    const successfulDeliveries = parseInt(row.successful_deliveries);
    const failedDeliveries = parseInt(row.failed_deliveries);
    
    const summary = {
      totalNotifications,
      successfulDeliveries,
      failedDeliveries,
      successRate: totalNotifications > 0 ? (successfulDeliveries / totalNotifications) * 100 : 0,
      failureRate: totalNotifications > 0 ? (failedDeliveries / totalNotifications) * 100 : 0,
      avgResponseTime: row.avg_response_time ? Math.round(row.avg_response_time) : null,
      firstNotification: row.first_notification,
      lastNotification: row.last_notification,
      dateRange: { startDate, endDate }
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching summary analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch summary analytics',
      message: error.message
    });
  }
});

module.exports = router;