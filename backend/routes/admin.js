const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getAllRules, createRule, updateRule, deleteRule, getLogs, getDashboardStats, getChatWebhooks, createChatWebhook } = require('../services/database');

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Apply authentication to all admin routes
router.use(authenticateToken);

// Rules management endpoints
// GET /api/v1/admin/rules - List all rules
router.get('/rules', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const tenantId = req.user.tenantId; // Get tenant ID from JWT token

    const result = await getAllRules(tenantId, limit, offset);

    res.json({
      ...result,
      page,
      has_more: offset + limit < result.total
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({
      error: 'Failed to fetch rules',
      message: error.message
    });
  }
});

// POST /api/v1/admin/rules - Create new rule
router.post('/rules', async (req, res) => {
  try {
    const { name, event_type, filters, target_webhook_id, template_mode, custom_template, enabled } = req.body;
    const tenantId = req.user.tenantId; // Get tenant ID from JWT token

    // Validate required fields
    if (!name || !event_type || !target_webhook_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'event_type', 'target_webhook_id']
      });
    }

    const newRule = await createRule(tenantId, {
      name,
      event_type,
      filters,
      target_webhook_id,
      template_mode,
      custom_template,
      enabled
    });

    res.status(201).json({
      message: 'Rule created successfully',
      rule: newRule
    });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({
      error: 'Failed to create rule',
      message: error.message
    });
  }
});

// PUT /api/v1/admin/rules/:id - Update rule
router.put('/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const tenantId = req.user.tenantId;
    const updates = req.body;

    const updatedRule = await updateRule(ruleId, tenantId, updates);

    res.json({
      message: 'Rule updated successfully',
      rule: updatedRule
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({
      error: 'Failed to update rule',
      message: error.message
    });
  }
});

// DELETE /api/v1/admin/rules/:id - Delete rule
router.delete('/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const tenantId = req.user.tenantId;

    const deletedRule = await deleteRule(ruleId, tenantId);

    res.json({
      message: 'Rule deleted successfully',
      rule: deletedRule
    });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({
      error: 'Failed to delete rule',
      message: error.message
    });
  }
});

// Logs management endpoints
// GET /api/v1/admin/logs - List logs with pagination
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const rule_id = req.query.rule_id;
    const status = req.query.status;
    const tenantId = req.user.tenantId; // Get tenant ID from JWT token

    const result = await getLogs(tenantId, { 
      limit, 
      offset, 
      rule_id, 
      status 
    });

    res.json({
      ...result,
      page
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

// GET /api/v1/admin/logs/:id - Get specific log details
router.get('/logs/:id', async (req, res) => {
  try {
    const logId = req.params.id;

    // TODO: Implement database query for specific log
    const mockLog = {
      id: logId,
      rule_id: 1,
      payload: { deal_id: 123, status: 'won', value: 5000 },
      status: 'success',
      error_message: null,
      created_at: new Date().toISOString(),
      response_time_ms: 245
    };

    res.json({ log: mockLog });
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({
      error: 'Failed to fetch log',
      message: error.message
    });
  }
});

// Dashboard stats endpoint
// GET /api/v1/admin/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // Get tenant ID from JWT token
    const dateRange = req.query.range || '7d';
    const stats = await getDashboardStats(tenantId, dateRange);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// Webhook management endpoints
// GET /api/v1/admin/webhooks - List chat webhooks
router.get('/webhooks', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const webhooks = await getChatWebhooks(tenantId);
    
    res.json({
      webhooks,
      total: webhooks.length
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({
      error: 'Failed to fetch webhooks',
      message: error.message
    });
  }
});

// POST /api/v1/admin/webhooks - Create new webhook
router.post('/webhooks', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, webhook_url, description } = req.body;

    // Validate required fields
    if (!name || !webhook_url) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'webhook_url']
      });
    }

    // Validate webhook URL format
    if (!webhook_url.includes('chat.googleapis.com')) {
      return res.status(400).json({
        error: 'Invalid webhook URL',
        message: 'Must be a Google Chat webhook URL'
      });
    }

    const newWebhook = await createChatWebhook(tenantId, {
      name,
      webhook_url,
      description
    });

    res.status(201).json({
      message: 'Webhook created successfully',
      webhook: newWebhook
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({
      error: 'Failed to create webhook',
      message: error.message
    });
  }
});

// Test rule endpoint
// POST /api/v1/admin/rules/:id/test - Send test notification
router.post('/rules/:id/test', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const tenantId = req.user.tenantId;

    // This would typically send a test notification
    // For now, return success
    res.json({
      message: 'Test notification sent successfully',
      rule_id: ruleId,
      sent_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      message: error.message
    });
  }
});

module.exports = router;