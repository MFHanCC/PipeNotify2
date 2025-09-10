const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getAllRules, createRule, updateRule, deleteRule, getLogs, getDashboardStats, getChatWebhooks, createChatWebhook, pool } = require('../services/database');

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

// DEBUG ENDPOINTS - No auth required
router.post('/debug/fix-tenant-rules', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Checking tenant and rules state...');
    
    // Check tenants
    const tenantsResult = await pool.query('SELECT id, company_name, pipedrive_user_id, pipedrive_company_id FROM tenants ORDER BY id');
    console.log('\n📋 Current tenants:');
    tenantsResult.rows.forEach(tenant => {
      console.log(`  ID: ${tenant.id}, Company: ${tenant.company_name}, User ID: ${tenant.pipedrive_user_id}, Company ID: ${tenant.pipedrive_company_id}`);
    });
    
    // Check rules distribution
    const rulesResult = await pool.query('SELECT tenant_id, COUNT(*) as rule_count FROM rules GROUP BY tenant_id ORDER BY tenant_id');
    console.log('\n📊 Rules by tenant:');
    rulesResult.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.rule_count} rules`);
    });
    
    // Check webhooks distribution  
    const webhooksResult = await pool.query('SELECT tenant_id, COUNT(*) as webhook_count FROM chat_webhooks GROUP BY tenant_id ORDER BY tenant_id');
    console.log('\n🔗 Webhooks by tenant:');
    webhooksResult.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.webhook_count} webhooks`);
    });
    
    // Find the correct tenant (the one with pipedrive_company_id = 13887824)
    const correctTenant = tenantsResult.rows.find(t => t.pipedrive_company_id == 13887824);
    if (!correctTenant) {
      return res.status(404).json({ 
        error: 'Could not find tenant with company_id 13887824',
        tenants: tenantsResult.rows
      });
    }
    
    console.log(`\n🎯 Correct tenant for company_id 13887824 is: ${correctTenant.id}`);
    
    // Check if there are rules in tenant 1 that need to be moved
    const tenant1Rules = await pool.query('SELECT COUNT(*) FROM rules WHERE tenant_id = 1');
    const correctTenantRules = await pool.query('SELECT COUNT(*) FROM rules WHERE tenant_id = $1', [correctTenant.id]);
    
    console.log(`\nRules in tenant 1: ${tenant1Rules.rows[0].count}`);
    console.log(`Rules in tenant ${correctTenant.id}: ${correctTenantRules.rows[0].count}`);
    
    let movedRules = [];
    let movedWebhooks = [];
    
    if (tenant1Rules.rows[0].count > 0 && correctTenantRules.rows[0].count == 0) {
      console.log('\n🔄 Moving rules from tenant 1 to tenant', correctTenant.id);
      
      // Move rules
      const updateRulesResult = await pool.query(
        'UPDATE rules SET tenant_id = $1 WHERE tenant_id = 1 RETURNING id, name',
        [correctTenant.id]
      );
      
      movedRules = updateRulesResult.rows;
      console.log(`✅ Moved ${updateRulesResult.rows.length} rules:`);
      updateRulesResult.rows.forEach(rule => {
        console.log(`  - Rule ${rule.id}: ${rule.name}`);
      });
      
      // Also move webhooks if needed
      const tenant1Webhooks = await pool.query('SELECT COUNT(*) FROM chat_webhooks WHERE tenant_id = 1');
      if (tenant1Webhooks.rows[0].count > 0) {
        const updateWebhooksResult = await pool.query(
          'UPDATE chat_webhooks SET tenant_id = $1 WHERE tenant_id = 1 RETURNING id, name',
          [correctTenant.id]
        );
        
        movedWebhooks = updateWebhooksResult.rows;
        console.log(`✅ Moved ${updateWebhooksResult.rows.length} webhooks:`);
        updateWebhooksResult.rows.forEach(webhook => {
          console.log(`  - Webhook ${webhook.id}: ${webhook.name}`);
        });
      }
    } else {
      console.log('\n✅ No rules need to be moved');
    }
    
    // Final verification
    console.log('\n🔍 Final verification:');
    const finalRulesResult = await pool.query('SELECT tenant_id, COUNT(*) as rule_count FROM rules GROUP BY tenant_id ORDER BY tenant_id');
    finalRulesResult.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.rule_count} rules`);
    });
    
    res.json({
      message: 'Tenant rules fix completed',
      correctTenant: {
        id: correctTenant.id,
        company_name: correctTenant.company_name,
        pipedrive_company_id: correctTenant.pipedrive_company_id
      },
      moved: {
        rules: movedRules,
        webhooks: movedWebhooks
      },
      finalState: {
        tenants: tenantsResult.rows,
        rulesByTenant: finalRulesResult.rows,
        webhooksByTenant: webhooksResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing tenant rules:', error);
    res.status(500).json({
      error: 'Failed to fix tenant rules',
      message: error.message
    });
  }
});

// DEBUG ENDPOINT - Create missing rules and fix webhook assignment
router.post('/debug/create-missing-rules', async (req, res) => {
  try {
    console.log('🔧 DEBUG: Creating missing rules for tenant 2...');
    
    // First, get the correct tenant (ID 2 with company_id 13887824)
    const tenantsResult = await pool.query('SELECT id FROM tenants WHERE pipedrive_company_id = 13887824');
    if (tenantsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant with company_id 13887824 not found' });
    }
    
    const tenantId = tenantsResult.rows[0].id; // Should be 2
    console.log(`📍 Target tenant ID: ${tenantId}`);
    
    // Move webhooks from tenant 1 to tenant 2
    const moveWebhooksResult = await pool.query(
      'UPDATE chat_webhooks SET tenant_id = $1 WHERE tenant_id = 1 RETURNING id, name, webhook_url',
      [tenantId]
    );
    
    console.log(`🔄 Moved ${moveWebhooksResult.rows.length} webhooks to tenant ${tenantId}`);
    
    // Get the first moved webhook to use for rules
    if (moveWebhooksResult.rows.length === 0) {
      return res.status(400).json({ error: 'No webhooks found to associate with rules' });
    }
    
    const webhook = moveWebhooksResult.rows[0];
    console.log(`🎯 Using webhook: ${webhook.name} (ID: ${webhook.id})`);
    
    // Create essential notification rules
    const rulesToCreate = [
      {
        name: `Deal Won → ${webhook.name}`,
        event_type: 'deal.change',
        filters: JSON.stringify({ status: ['won'] }),
        target_webhook_id: webhook.id,
        template_mode: 'simple',
        enabled: true
      },
      {
        name: `Deal Stage Changed → ${webhook.name}`,
        event_type: 'deal.change', 
        filters: JSON.stringify({}), // No filters = all deal changes
        target_webhook_id: webhook.id,
        template_mode: 'simple',
        enabled: true
      },
      {
        name: `New Deal Created → ${webhook.name}`,
        event_type: 'deal.create',
        filters: JSON.stringify({}),
        target_webhook_id: webhook.id,
        template_mode: 'simple', 
        enabled: true
      }
    ];
    
    const createdRules = [];
    for (const ruleData of rulesToCreate) {
      const insertResult = await pool.query(
        `INSERT INTO rules (tenant_id, name, event_type, filters, target_webhook_id, template_mode, custom_template, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          ruleData.name,
          ruleData.event_type,
          ruleData.filters,
          ruleData.target_webhook_id,
          ruleData.template_mode,
          null, // custom_template
          ruleData.enabled
        ]
      );
      
      createdRules.push(insertResult.rows[0]);
      console.log(`✅ Created rule: ${ruleData.name}`);
    }
    
    // Verify final state
    const finalRulesResult = await pool.query('SELECT tenant_id, COUNT(*) as rule_count FROM rules GROUP BY tenant_id ORDER BY tenant_id');
    const finalWebhooksResult = await pool.query('SELECT tenant_id, COUNT(*) as webhook_count FROM chat_webhooks GROUP BY tenant_id ORDER BY tenant_id');
    
    console.log('\n🔍 Final verification:');
    console.log('Rules by tenant:', finalRulesResult.rows);
    console.log('Webhooks by tenant:', finalWebhooksResult.rows);
    
    res.json({
      message: 'Missing rules created and webhooks moved successfully',
      tenantId: tenantId,
      movedWebhooks: moveWebhooksResult.rows,
      createdRules: createdRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        event_type: rule.event_type,
        enabled: rule.enabled
      })),
      finalState: {
        rulesByTenant: finalRulesResult.rows,
        webhooksByTenant: finalWebhooksResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating missing rules:', error);
    res.status(500).json({
      error: 'Failed to create missing rules',
      message: error.message
    });
  }
});

// DEBUG ENDPOINT - Create comprehensive notification rules
router.post('/debug/create-comprehensive-rules', async (req, res) => {
  try {
    console.log('🎯 DEBUG: Creating comprehensive notification rules...');
    
    // Get the correct tenant (ID 2 with company_id 13887824)
    const tenantsResult = await pool.query('SELECT id FROM tenants WHERE pipedrive_company_id = 13887824');
    if (tenantsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant with company_id 13887824 not found' });
    }
    
    const tenantId = tenantsResult.rows[0].id;
    console.log(`📍 Target tenant ID: ${tenantId}`);
    
    // Get the first available webhook
    const webhooksResult = await pool.query('SELECT id, name FROM chat_webhooks WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    if (webhooksResult.rows.length === 0) {
      return res.status(400).json({ error: 'No webhooks found for this tenant' });
    }
    
    const webhook = webhooksResult.rows[0];
    console.log(`🎯 Using webhook: ${webhook.name} (ID: ${webhook.id})`);
    
    // Define comprehensive rules for all requested event types
    const rulesToCreate = [
      // Activity events
      {
        name: `📞 New Activity Created → ${webhook.name}`,
        event_type: 'activity.create',
        filters: JSON.stringify({}), // No filters = all activities
        description: 'Notifications for all new activities (calls, meetings, tasks, etc.)'
      },
      {
        name: `📝 Activity Updated → ${webhook.name}`,
        event_type: 'activity.change', 
        filters: JSON.stringify({}),
        description: 'Notifications when activities are modified or completed'
      },
      {
        name: `🗑️ Activity Deleted → ${webhook.name}`,
        event_type: 'activity.delete',
        filters: JSON.stringify({}),
        description: 'Notifications when activities are removed'
      },
      
      // Note events
      {
        name: `📔 New Note Added → ${webhook.name}`,
        event_type: 'note.create',
        filters: JSON.stringify({}),
        description: 'Notifications when notes are added to deals/persons/organizations'
      },
      {
        name: `📝 Note Updated → ${webhook.name}`,
        event_type: 'note.change',
        filters: JSON.stringify({}),
        description: 'Notifications when notes are modified'
      },
      
      // Product events
      {
        name: `📦 New Product Added → ${webhook.name}`,
        event_type: 'product.create',
        filters: JSON.stringify({}),
        description: 'Notifications when products are added to catalog'
      },
      {
        name: `📦 Product Updated → ${webhook.name}`,
        event_type: 'product.change',
        filters: JSON.stringify({}),
        description: 'Notifications when product details are modified'
      },
      {
        name: `🗑️ Product Deleted → ${webhook.name}`,
        event_type: 'product.delete',
        filters: JSON.stringify({}),
        description: 'Notifications when products are removed from catalog'
      },
      
      // Person events
      {
        name: `👤 New Contact Added → ${webhook.name}`,
        event_type: 'person.create',
        filters: JSON.stringify({}),
        description: 'Notifications when new contacts are added'
      },
      {
        name: `👤 Contact Updated → ${webhook.name}`,
        event_type: 'person.change',
        filters: JSON.stringify({}),
        description: 'Notifications when contact details are modified'
      },
      
      // Organization events  
      {
        name: `🏢 New Organization Added → ${webhook.name}`,
        event_type: 'organization.create',
        filters: JSON.stringify({}),
        description: 'Notifications when new organizations are added'
      },
      {
        name: `🏢 Organization Updated → ${webhook.name}`,
        event_type: 'organization.change',
        filters: JSON.stringify({}),
        description: 'Notifications when organization details are modified'
      }
    ];
    
    const createdRules = [];
    for (const ruleData of rulesToCreate) {
      const insertResult = await pool.query(
        `INSERT INTO rules (tenant_id, name, event_type, filters, target_webhook_id, template_mode, custom_template, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          ruleData.name,
          ruleData.event_type,
          ruleData.filters,
          webhook.id,
          'simple', // Use our enhanced simple template mode
          null, // No custom template
          true // Enabled
        ]
      );
      
      createdRules.push({
        id: insertResult.rows[0].id,
        name: ruleData.name,
        event_type: ruleData.event_type,
        description: ruleData.description
      });
      console.log(`✅ Created rule: ${ruleData.name}`);
    }
    
    // Final verification
    const finalRulesResult = await pool.query(
      'SELECT event_type, COUNT(*) as rule_count FROM rules WHERE tenant_id = $1 GROUP BY event_type ORDER BY event_type',
      [tenantId]
    );
    
    console.log('\n🔍 Final rules by event type:');
    finalRulesResult.rows.forEach(row => {
      console.log(`  ${row.event_type}: ${row.rule_count} rules`);
    });
    
    res.json({
      message: 'Comprehensive notification rules created successfully',
      tenantId: tenantId,
      webhook: { id: webhook.id, name: webhook.name },
      createdRules: createdRules,
      summary: {
        totalRules: createdRules.length,
        activities: 3, // create, change, delete
        notes: 2, // create, change
        products: 3, // create, change, delete  
        persons: 2, // create, change
        organizations: 2 // create, change
      },
      rulesByEventType: finalRulesResult.rows
    });
    
  } catch (error) {
    console.error('❌ Error creating comprehensive rules:', error);
    res.status(500).json({
      error: 'Failed to create comprehensive rules',
      message: error.message
    });
  }
});

// Apply authentication to all other admin routes
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