const express = require('express');
const router = express.Router();

// Import services
const { 
  getQuietHours, 
  setQuietHours, 
  isQuietTime,
  getNextAllowedTime 
} = require('../services/quietHours');

const { requireFeature } = require('../middleware/featureGating');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/v1/settings/quiet-hours
 * Get current quiet hours configuration for authenticated tenant
 */
router.get('/quiet-hours', requireFeature('quiet_hours'), async (req, res) => {
  try {
    const tenantId = req.tenant.id; // Get from JWT token
    
    const config = await getQuietHours(tenantId);
    
    res.json({
      success: true,
      quiet_hours: config
    });
    
  } catch (error) {
    console.error('Error getting quiet hours:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quiet hours configuration'
    });
  }
});

/**
 * POST /api/v1/settings/quiet-hours
 * Set quiet hours configuration for authenticated tenant
 */
router.post('/quiet-hours', requireFeature('quiet_hours'), async (req, res) => {
  try {
    const tenantId = req.tenant.id; // Get from JWT token
    
    const { timezone, start_time, end_time, weekends_enabled, holidays } = req.body;
    
    // Validate required fields
    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'start_time and end_time are required'
      });
    }
    
    const config = await setQuietHours(tenantId, {
      timezone,
      start_time,
      end_time,
      weekends_enabled,
      holidays
    });
    
    res.json({
      success: true,
      quiet_hours: config
    });
    
  } catch (error) {
    console.error('Error setting quiet hours:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set quiet hours configuration'
    });
  }
});

/**
 * GET /api/v1/settings/quiet-hours/status
 * Check if current time is within quiet hours for authenticated tenant
 */
router.get('/quiet-hours/status', requireFeature('quiet_hours'), async (req, res) => {
  try {
    const tenantId = req.tenant.id; // Get from JWT token
    
    const checkTime = req.query.time ? new Date(req.query.time) : new Date();
    const status = await isQuietTime(tenantId, checkTime);
    const nextAllowed = await getNextAllowedTime(tenantId, checkTime);
    
    res.json({
      success: true,
      is_quiet: status.is_quiet,
      reason: status.reason,
      check_time: checkTime.toISOString(),
      tenant_time: status.tenant_time,
      next_allowed: nextAllowed.next_allowed,
      delay_minutes: nextAllowed.delay_minutes
    });
    
  } catch (error) {
    console.error('Error checking quiet hours status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check quiet hours status'
    });
  }
});

/**
 * DELETE /api/v1/settings/quiet-hours
 * Remove quiet hours configuration for authenticated tenant (revert to default)
 */
router.delete('/quiet-hours', requireFeature('quiet_hours'), async (req, res) => {
  try {
    const tenantId = req.tenant.id; // Get from JWT token
    
    const { pool } = require('../services/database');
    
    // Delete configuration (will revert to defaults)
    await pool.query('DELETE FROM quiet_hours WHERE tenant_id = $1', [tenantId]);
    
    // Get the default configuration
    const config = await getQuietHours(tenantId);
    
    res.json({
      success: true,
      message: 'Quiet hours configuration removed',
      quiet_hours: config
    });
    
  } catch (error) {
    console.error('Error removing quiet hours:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove quiet hours configuration'
    });
  }
});

/**
 * GET /api/v1/settings/quiet-hours/:tenantId/delayed
 * Get pending delayed notifications for a tenant
 */
router.get('/quiet-hours/:tenantId/delayed', requireFeature('quiet_hours'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    const { pool } = require('../services/database');
    
    const result = await pool.query(`
      SELECT 
        id,
        scheduled_for,
        status,
        created_at,
        notification_data->>'rule_name' as rule_name,
        notification_data->>'webhook_data'->>'event' as event_type
      FROM delayed_notifications 
      WHERE tenant_id = $1 
        AND status = 'pending'
      ORDER BY scheduled_for ASC
    `, [tenantId]);
    
    res.json({
      success: true,
      delayed_notifications: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error getting delayed notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get delayed notifications'
    });
  }
});

/**
 * POST /api/v1/settings/quiet-hours/:tenantId/test
 * Test quiet hours configuration with sample times
 */
router.post('/quiet-hours/:tenantId/test', requireFeature('quiet_hours'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    const { test_times } = req.body;
    
    if (!test_times || !Array.isArray(test_times)) {
      return res.status(400).json({
        success: false,
        error: 'test_times array is required'
      });
    }
    
    const results = [];
    
    for (const testTime of test_times) {
      try {
        const checkTime = new Date(testTime);
        const status = await isQuietTime(tenantId, checkTime);
        const nextAllowed = await getNextAllowedTime(tenantId, checkTime);
        
        results.push({
          test_time: testTime,
          check_time_utc: checkTime.toISOString(),
          is_quiet: status.is_quiet,
          reason: status.reason,
          tenant_time: status.tenant_time,
          next_allowed: nextAllowed.next_allowed,
          delay_minutes: nextAllowed.delay_minutes
        });
      } catch (error) {
        results.push({
          test_time: testTime,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      test_results: results
    });
    
  } catch (error) {
    console.error('Error testing quiet hours:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test quiet hours configuration'
    });
  }
});

/**
 * GET /api/v1/settings/timezones
 * Get list of supported timezones
 */
router.get('/timezones', async (req, res) => {
  try {
    // Common timezones - in production you might want to use a more comprehensive list
    const commonTimezones = [
      'UTC',
      'America/New_York',
      'America/Chicago', 
      'America/Denver',
      'America/Los_Angeles',
      'America/Toronto',
      'America/Sao_Paulo',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Mumbai',
      'Asia/Dubai',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland'
    ];
    
    const timezones = commonTimezones.map(tz => {
      const date = new Date();
      const offset = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        timeZoneName: 'longOffset'
      }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || '';
      
      return {
        timezone: tz,
        display_name: `${tz.replace('_', ' ')} (${offset})`,
        offset
      };
    });
    
    res.json({
      success: true,
      timezones
    });
    
  } catch (error) {
    console.error('Error getting timezones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get timezones'
    });
  }
});

module.exports = router;