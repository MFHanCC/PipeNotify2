const express = require('express');
const router = express.Router();

// Import authentication and feature gating
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/featureGating');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/v1/analytics/metrics
 * Get notification metrics for the authenticated tenant
 */
router.get('/metrics', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const period = req.query.period || '7d'; // 1d, 7d, 30d, 90d
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const { pool } = require('../services/database');
    
    // Get overall metrics
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        AVG(CASE WHEN status = 'delivered' AND response_time IS NOT NULL 
            THEN response_time ELSE NULL END) as avg_response_time
      FROM logs 
      WHERE tenant_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
    `;
    
    const metricsResult = await pool.query(metricsQuery, [tenantId, startDate, now]);
    const metrics = metricsResult.rows[0];
    
    // Calculate success rate
    const totalSent = parseInt(metrics.total_sent) || 0;
    const successful = parseInt(metrics.successful) || 0;
    const successRate = totalSent > 0 ? successful / totalSent : 0;
    
    res.json({
      success: true,
      metrics: {
        total_sent: totalSent,
        successful: successful,
        failed: parseInt(metrics.failed) || 0,
        pending: parseInt(metrics.pending) || 0,
        success_rate: successRate,
        avg_response_time: parseFloat(metrics.avg_response_time) || 0
      }
    });
    
  } catch (error) {
    console.error('Error getting analytics metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics metrics'
    });
  }
});

/**
 * GET /api/v1/analytics/timeseries
 * Get time series data for charts
 */
router.get('/timeseries', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const period = req.query.period || '7d';
    
    // Calculate date range and grouping
    const now = new Date();
    let startDate = new Date();
    let dateFormat = 'YYYY-MM-DD'; // Default daily grouping
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        dateFormat = 'YYYY-MM-DD HH24:00'; // Hourly for 1 day
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        dateFormat = 'YYYY-MM-DD'; // Daily
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        dateFormat = 'YYYY-MM-DD'; // Daily
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        dateFormat = 'YYYY-MM-DD'; // Daily, could be weekly
        break;
    }

    const { pool } = require('../services/database');
    
    const timeSeriesQuery = `
      SELECT 
        TO_CHAR(created_at, '${dateFormat}') as date,
        COUNT(*) as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM logs 
      WHERE tenant_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY TO_CHAR(created_at, '${dateFormat}')
      ORDER BY date ASC
    `;
    
    const result = await pool.query(timeSeriesQuery, [tenantId, startDate, now]);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        date: row.date,
        sent: parseInt(row.sent),
        successful: parseInt(row.successful),
        failed: parseInt(row.failed)
      }))
    });
    
  } catch (error) {
    console.error('Error getting time series data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get time series data'
    });
  }
});

/**
 * GET /api/v1/analytics/rules
 * Get rule performance analytics
 */
router.get('/rules', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const period = req.query.period || '7d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const { pool } = require('../services/database');
    
    const rulesQuery = `
      SELECT 
        r.id as rule_id,
        r.name as rule_name,
        COUNT(l.id) as total_triggered,
        COUNT(l.id) FILTER (WHERE l.status = 'delivered') as successful,
        COUNT(l.id) FILTER (WHERE l.status = 'failed') as failed
      FROM rules r
      LEFT JOIN logs l ON r.id = l.rule_id 
        AND l.tenant_id = $1 
        AND l.created_at >= $2 
        AND l.created_at <= $3
      WHERE r.tenant_id = $1 
        AND r.is_active = true
      GROUP BY r.id, r.name
      HAVING COUNT(l.id) > 0
      ORDER BY total_triggered DESC
    `;
    
    const result = await pool.query(rulesQuery, [tenantId, startDate, now]);
    
    const rules = result.rows.map(row => {
      const totalTriggered = parseInt(row.total_triggered);
      const successful = parseInt(row.successful);
      const successRate = totalTriggered > 0 ? successful / totalTriggered : 0;
      
      return {
        rule_id: row.rule_id,
        rule_name: row.rule_name,
        total_triggered: totalTriggered,
        successful: successful,
        failed: parseInt(row.failed),
        success_rate: successRate
      };
    });
    
    res.json({
      success: true,
      rules: rules
    });
    
  } catch (error) {
    console.error('Error getting rule analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rule analytics'
    });
  }
});

/**
 * GET /api/v1/analytics/channels
 * Get channel performance analytics
 */
router.get('/channels', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const period = req.query.period || '7d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const { pool } = require('../services/database');
    
    const channelsQuery = `
      SELECT 
        w.name as channel_name,
        COUNT(l.id) as total_sent,
        COUNT(l.id) FILTER (WHERE l.status = 'delivered') as successful,
        COUNT(l.id) FILTER (WHERE l.status = 'failed') as failed,
        AVG(CASE WHEN l.status = 'delivered' AND l.response_time IS NOT NULL 
            THEN l.response_time ELSE NULL END) as avg_response_time
      FROM chat_webhooks w
      LEFT JOIN logs l ON w.id = l.webhook_id 
        AND l.tenant_id = $1 
        AND l.created_at >= $2 
        AND l.created_at <= $3
      WHERE w.tenant_id = $1 
        AND w.is_active = true
      GROUP BY w.id, w.name
      HAVING COUNT(l.id) > 0
      ORDER BY total_sent DESC
    `;
    
    const result = await pool.query(channelsQuery, [tenantId, startDate, now]);
    
    const channels = result.rows.map(row => {
      const totalSent = parseInt(row.total_sent);
      const successful = parseInt(row.successful);
      const successRate = totalSent > 0 ? successful / totalSent : 0;
      
      return {
        channel_name: row.channel_name,
        total_sent: totalSent,
        successful: successful,
        failed: parseInt(row.failed),
        success_rate: successRate,
        avg_response_time: parseFloat(row.avg_response_time) || 0
      };
    });
    
    res.json({
      success: true,
      channels: channels
    });
    
  } catch (error) {
    console.error('Error getting channel analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get channel analytics'
    });
  }
});

module.exports = router;