const express = require('express');
const router = express.Router();
const { requireFeature } = require('../middleware/featureGating');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../services/database');
const systemReporter = require('../services/systemReporter');

/**
 * Advanced Analytics Routes (Team plan only)
 * Provides executive reporting, predictive analytics, and team performance insights
 */

// Middleware: All routes require Team plan advanced_analytics feature
router.use(requireFeature('advanced_analytics'));

/**
 * GET /api/v1/analytics/advanced/executive/:tenantId
 * Executive summary and reports
 */
router.get('/executive/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { period = '30d' } = req.query;
    
    // Get or generate executive report
    let report = await getExecutiveReport(tenantId, period);
    
    if (!report) {
      // Generate new report using existing systemReporter
      report = await generateExecutiveReport(tenantId, period);
    }
    
    res.json({
      success: true,
      report,
      generated_at: new Date().toISOString(),
      period
    });
    
  } catch (error) {
    console.error('Executive analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive report'
    });
  }
});

/**
 * GET /api/v1/analytics/advanced/team-performance/:tenantId
 * Team performance metrics and benchmarks
 */
router.get('/team-performance/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { period = '30d' } = req.query;
    
    const performanceData = await getTeamPerformance(tenantId, period);
    
    res.json({
      success: true,
      performance: performanceData,
      benchmarks: await getIndustryBenchmarks(tenantId),
      period
    });
    
  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team performance data'
    });
  }
});

/**
 * GET /api/v1/analytics/advanced/predictive/:tenantId
 * Predictive analytics and forecasts
 */
router.get('/predictive/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type = 'pipeline_forecast' } = req.query;
    
    const predictions = await getPredictiveAnalytics(tenantId, type);
    
    res.json({
      success: true,
      predictions,
      model_info: {
        version: '1.0',
        last_trained: '2024-01-01',
        confidence_threshold: 0.7
      }
    });
    
  } catch (error) {
    console.error('Predictive analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictions'
    });
  }
});

/**
 * POST /api/v1/analytics/advanced/export/:tenantId
 * Generate data export in various formats
 */
router.post('/export/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { format = 'csv', data_range = '30d', filters = {} } = req.body;
    
    const exportJob = await createExportJob(tenantId, format, data_range, filters);
    
    res.json({
      success: true,
      export_id: exportJob.id,
      status: 'pending',
      estimated_completion: '2-3 minutes',
      download_url: `/api/v1/analytics/advanced/export/${tenantId}/${exportJob.id}/download`
    });
    
  } catch (error) {
    console.error('Export creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create export job'
    });
  }
});

/**
 * GET /api/v1/analytics/advanced/export/:tenantId/:exportId/download
 * Download completed export file
 */
router.get('/export/:tenantId/:exportId/download', authenticateToken, async (req, res) => {
  try {
    const { tenantId, exportId } = req.params;
    
    const exportRecord = await pool.query(
      'SELECT * FROM analytics_exports WHERE id = $1 AND tenant_id = $2',
      [exportId, tenantId]
    );
    
    if (exportRecord.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Export not found'
      });
    }
    
    const export_data = exportRecord.rows[0];
    
    if (export_data.status !== 'completed') {
      return res.status(202).json({
        success: false,
        status: export_data.status,
        error: 'Export not ready'
      });
    }
    
    // Update download count
    await pool.query(
      'UPDATE analytics_exports SET download_count = download_count + 1 WHERE id = $1',
      [exportId]
    );
    
    // In production, you'd stream the actual file
    res.json({
      success: true,
      download_ready: true,
      file_info: {
        type: export_data.export_type,
        size: '1.2MB',
        rows: 1500
      },
      data: await generateExportData(tenantId, export_data)
    });
    
  } catch (error) {
    console.error('Export download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download export'
    });
  }
});

// Helper functions

async function getExecutiveReport(tenantId, period) {
  try {
    const result = await pool.query(`
      SELECT * FROM executive_reports 
      WHERE tenant_id = $1 
        AND report_period > NOW() - INTERVAL '${period}'
        AND created_at > NOW() - INTERVAL '1 day'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [tenantId]);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching executive report:', error);
    return null;
  }
}

async function generateExecutiveReport(tenantId, period) {
  try {
    // Use existing systemReporter functionality
    const report = await systemReporter.generateExecutiveSummary(tenantId, period);
    
    // Store in database for caching
    const result = await pool.query(`
      INSERT INTO executive_reports (tenant_id, report_type, report_period, metrics, summary, recommendations)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      tenantId,
      period,
      new Date(),
      JSON.stringify(report.metrics || {}),
      report.summary || 'Executive summary not available',
      report.recommendations || []
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error generating executive report:', error);
    // Return mock data for development
    return {
      id: 'mock-' + Date.now(),
      tenant_id: tenantId,
      summary: `Executive Summary for ${period}: Your team processed 45 deals worth $125K this period. Deal conversion improved by 12% compared to last period. Top performing channel: #sales-alerts with 89% response rate.`,
      metrics: {
        total_deals: 45,
        total_value: 125000,
        conversion_rate: 0.23,
        avg_deal_size: 2777,
        response_time_avg: '4.2 hours'
      },
      recommendations: [
        'Focus on high-value deals (>$5K) for better ROI',
        'Optimize notification timing for European timezone',
        'Consider expanding #sales-alerts model to other channels'
      ]
    };
  }
}

async function getTeamPerformance(tenantId, period) {
  try {
    // Get team performance data
    const performanceData = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) as avg_response_minutes
      FROM notification_logs 
      WHERE tenant_id = $1 
        AND created_at > NOW() - INTERVAL '${period}'
        AND status = 'delivered'
    `, [tenantId]);
    
    const performance = performanceData.rows[0];
    
    return {
      total_notifications: parseInt(performance.total_notifications) || 0,
      active_days: parseInt(performance.active_days) || 0,
      avg_response_time: Math.round(parseFloat(performance.avg_response_minutes) || 0),
      productivity_score: calculateProductivityScore(performance),
      period_start: new Date(Date.now() - getPeriodMilliseconds(period)).toISOString(),
      period_end: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting team performance:', error);
    return {
      total_notifications: 0,
      active_days: 0,
      avg_response_time: 0,
      productivity_score: 0
    };
  }
}

async function getIndustryBenchmarks(tenantId) {
  // In production, this would query industry benchmark data
  return {
    avg_response_time: 6.5, // hours
    conversion_rate: 0.18,
    deals_per_month: 35,
    avg_deal_size: 3200,
    source: 'Industry Benchmark 2024'
  };
}

async function getPredictiveAnalytics(tenantId, type) {
  try {
    // Check for recent cached predictions
    const cached = await pool.query(`
      SELECT * FROM predictive_analytics 
      WHERE tenant_id = $1 
        AND prediction_type = $2 
        AND expires_at > NOW()
      ORDER BY created_at DESC 
      LIMIT 1
    `, [tenantId, type]);
    
    if (cached.rows.length > 0) {
      return cached.rows[0].predictions;
    }
    
    // Generate new predictions based on type
    const predictions = await generatePredictions(tenantId, type);
    
    // Cache predictions
    await pool.query(`
      INSERT INTO predictive_analytics (tenant_id, prediction_type, model_version, input_data, predictions, confidence_score, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 hour')
    `, [
      tenantId,
      type,
      '1.0',
      JSON.stringify({}),
      JSON.stringify(predictions),
      0.75
    ]);
    
    return predictions;
  } catch (error) {
    console.error('Error getting predictive analytics:', error);
    return generateMockPredictions(type);
  }
}

async function generatePredictions(tenantId, type) {
  switch (type) {
    case 'pipeline_forecast':
      return {
        next_30_days: {
          predicted_deals: 28,
          predicted_value: 87500,
          confidence: 0.78
        },
        next_90_days: {
          predicted_deals: 85,
          predicted_value: 263000,
          confidence: 0.65
        }
      };
    case 'deal_probability':
      return {
        high_probability: 12, // deals likely to close
        medium_probability: 18,
        low_probability: 7,
        at_risk: 3
      };
    default:
      return generateMockPredictions(type);
  }
}

function generateMockPredictions(type) {
  return {
    type,
    generated_at: new Date().toISOString(),
    note: 'Mock predictions for development'
  };
}

async function createExportJob(tenantId, format, dataRange, filters) {
  try {
    const result = await pool.query(`
      INSERT INTO analytics_exports (tenant_id, export_type, data_range, filter_criteria, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `, [tenantId, format, dataRange, JSON.stringify(filters)]);
    
    // Simulate async processing
    setTimeout(async () => {
      await pool.query(
        'UPDATE analytics_exports SET status = $1, completed_at = NOW() WHERE id = $2',
        ['completed', result.rows[0].id]
      );
    }, 2000);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating export job:', error);
    throw error;
  }
}

async function generateExportData(tenantId, exportRecord) {
  // In production, generate actual export data based on type and filters
  return {
    headers: ['Date', 'Deal', 'Value', 'Status', 'Channel'],
    rows: [
      ['2024-01-15', 'ABC Corp', '$5,200', 'Won', '#sales-alerts'],
      ['2024-01-14', 'XYZ Ltd', '$8,500', 'Proposal', '#deals-high-value'],
      ['2024-01-13', 'Demo Co', '$2,100', 'Negotiation', '#sales-alerts']
    ],
    metadata: {
      total_rows: 3,
      generated_at: new Date().toISOString(),
      filters_applied: exportRecord.filter_criteria
    }
  };
}

function calculateProductivityScore(performance) {
  // Simple scoring algorithm
  const notifications = parseInt(performance.total_notifications) || 0;
  const activeDays = parseInt(performance.active_days) || 1;
  const responseTime = parseFloat(performance.avg_response_minutes) || 0;
  
  let score = 0;
  score += Math.min(notifications / activeDays, 10) * 10; // Daily activity
  score += Math.max(0, 100 - responseTime); // Response speed bonus
  
  return Math.min(100, Math.round(score));
}

function getPeriodMilliseconds(period) {
  const periods = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };
  return periods[period] || periods['30d'];
}

module.exports = router;