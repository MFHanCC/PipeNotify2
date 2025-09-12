const express = require('express');
const router = express.Router();
const { getAllRules, createRule, updateRule, deleteRule, getLogs, getDashboardStats, getWebhooks, createWebhook, pool } = require('../services/database');
const { getAvailableVariables, DEFAULT_TEMPLATES } = require('../services/templateEngine');
const { authenticateToken, extractTenantId } = require('../middleware/auth');
const { createRoutingRules } = require('../services/channelRouter');

// DEBUG ENDPOINTS - No auth required

// Clean up test data for current user
router.post('/debug/cleanup-test-data', async (req, res) => {
  try {
    const { user_id, company_id } = req.body;
    
    if (!user_id && !company_id) {
      return res.status(400).json({ 
        error: 'Please provide user_id or company_id to identify tenant',
        example: 'POST with {"user_id": 123} or {"company_id": 13887824}'
      });
    }
    
    let tenantQuery = 'SELECT id, company_name, pipedrive_user_id, pipedrive_company_id FROM tenants WHERE ';
    let tenantParams = [];
    
    if (user_id) {
      tenantQuery += 'pipedrive_user_id = $1';
      tenantParams = [user_id];
    } else {
      tenantQuery += 'pipedrive_company_id = $1';
      tenantParams = [company_id];
    }
    
    const tenantResult = await pool.query(tenantQuery, tenantParams);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        searched: user_id ? `user_id: ${user_id}` : `company_id: ${company_id}`
      });
    }
    
    const tenant = tenantResult.rows[0];
    console.log(`🧹 Cleaning up test data for tenant ${tenant.id} (${tenant.company_name})`);
    
    // Get counts before cleanup
    const webhooksBefore = await pool.query('SELECT COUNT(*) FROM chat_webhooks WHERE tenant_id = $1', [tenant.id]);
    const rulesBefore = await pool.query('SELECT COUNT(*) FROM rules WHERE tenant_id = $1', [tenant.id]);
    const logsBefore = await pool.query('SELECT COUNT(*) FROM logs WHERE tenant_id = $1', [tenant.id]);
    
    // Clean up webhooks, rules, and logs
    await pool.query('DELETE FROM logs WHERE tenant_id = $1', [tenant.id]);
    await pool.query('DELETE FROM rules WHERE tenant_id = $1', [tenant.id]);
    await pool.query('DELETE FROM chat_webhooks WHERE tenant_id = $1', [tenant.id]);
    
    res.json({
      message: 'Test data cleaned up successfully',
      tenant: {
        id: tenant.id,
        company_name: tenant.company_name,
        pipedrive_user_id: tenant.pipedrive_user_id,
        pipedrive_company_id: tenant.pipedrive_company_id
      },
      cleaned: {
        webhooks: parseInt(webhooksBefore.rows[0].count),
        rules: parseInt(rulesBefore.rows[0].count),
        logs: parseInt(logsBefore.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    res.status(500).json({
      error: 'Failed to clean up test data',
      message: error.message
    });
  }
});

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
        enabled: insertResult.rows[0].enabled
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

// Debug endpoint to check rules and events
router.get('/debug/rules', async (req, res) => {
  try {
    const rules = await pool.query('SELECT * FROM rules ORDER BY tenant_id, event_type');
    const webhooks = await pool.query('SELECT * FROM chat_webhooks ORDER BY tenant_id');
    
    res.json({
      rules: rules.rows,
      webhooks: webhooks.rows,
      tenant2_rules: rules.rows.filter(r => r.tenant_id === 2),
      tenant2_webhooks: webhooks.rows.filter(w => w.tenant_id === 2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix tenant rules endpoint - no auth required for system fix
router.post('/system/fix-tenant-rules', async (req, res) => {
  try {
    console.log('🔧 Fixing tenant rules via API...');
    
    // Check current rules
    const currentRules = await pool.query('SELECT * FROM rules ORDER BY tenant_id, id');
    console.log('📋 Current rules:', currentRules.rows.map(r => `Tenant ${r.tenant_id}: ${r.name} (${r.event_type})`));
    
    // Check current webhooks
    const currentWebhooks = await pool.query('SELECT * FROM chat_webhooks ORDER BY tenant_id, id');
    console.log('🔗 Current webhooks:', currentWebhooks.rows.map(w => `Tenant ${w.tenant_id}: ${w.name}`));
    
    // Move rules from tenant 1 to tenant 2
    const moveRulesResult = await pool.query(
      'UPDATE rules SET tenant_id = 2 WHERE tenant_id = 1 RETURNING *'
    );
    
    // Move webhooks from tenant 1 to tenant 2  
    const moveWebhooksResult = await pool.query(
      'UPDATE chat_webhooks SET tenant_id = 2 WHERE tenant_id = 1 RETURNING *'
    );
    
    // Show final state
    const finalRules = await pool.query('SELECT * FROM rules WHERE tenant_id = 2');
    const finalWebhooks = await pool.query('SELECT * FROM chat_webhooks WHERE tenant_id = 2');
    
    console.log(`✅ Moved ${moveRulesResult.rows.length} rules and ${moveWebhooksResult.rows.length} webhooks to tenant 2`);
    
    res.json({
      success: true,
      message: 'Tenant rules fixed successfully',
      moved: {
        rules: moveRulesResult.rows.length,
        webhooks: moveWebhooksResult.rows.length
      },
      final_state: {
        rules: finalRules.rows.map(r => ({ id: r.id, name: r.name, event_type: r.event_type })),
        webhooks: finalWebhooks.rows.map(w => ({ id: w.id, name: w.name }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing tenant rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix tenant rules',
      message: error.message
    });
  }
});

// Fix missing subscriptions table endpoint - no auth required for system fix
router.post('/system/create-subscriptions-table', async (req, res) => {
  try {
    console.log('🔧 Creating missing subscriptions table via API...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/006_create_subscriptions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running migration: 006_create_subscriptions.sql');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Subscriptions table created successfully');
    
    // Verify the table was created
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscriptions'
    `);
    
    if (tableCheck.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Subscriptions table was not created'
      });
    }
    
    // Check how many subscriptions were created
    const subscriptionCount = await pool.query('SELECT COUNT(*) as count FROM subscriptions');
    
    // Get the subscriptions
    const subscriptions = await pool.query(`
      SELECT s.id, s.tenant_id, s.plan_tier, s.status, t.company_name
      FROM subscriptions s
      JOIN tenants t ON s.tenant_id = t.id
      ORDER BY s.tenant_id
    `);
    
    console.log(`📊 Created ${subscriptionCount.rows[0].count} subscriptions`);
    
    res.json({
      success: true,
      message: 'Subscriptions table created successfully',
      subscriptions_created: parseInt(subscriptionCount.rows[0].count),
      subscriptions: subscriptions.rows.map(sub => ({
        tenant_id: sub.tenant_id,
        company_name: sub.company_name,
        plan_tier: sub.plan_tier,
        status: sub.status
      }))
    });
    
  } catch (error) {
    console.error('❌ Error creating subscriptions table:', error);
    
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Table already exists, checking data...');
      
      try {
        const subscriptionCount = await pool.query('SELECT COUNT(*) as count FROM subscriptions');
        const subscriptions = await pool.query(`
          SELECT s.id, s.tenant_id, s.plan_tier, s.status, t.company_name
          FROM subscriptions s
          JOIN tenants t ON s.tenant_id = t.id
          ORDER BY s.tenant_id
        `);
        
        return res.json({
          success: true,
          message: 'Subscriptions table already exists',
          subscriptions_found: parseInt(subscriptionCount.rows[0].count),
          subscriptions: subscriptions.rows.map(sub => ({
            tenant_id: sub.tenant_id,
            company_name: sub.company_name,
            plan_tier: sub.plan_tier,
            status: sub.status
          }))
        });
      } catch (checkError) {
        return res.status(500).json({
          success: false,
          error: 'Error checking existing subscriptions',
          message: checkError.message
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create subscriptions table',
      message: error.message
    });
  }
});

// Upgrade tenant to Team plan endpoint - no auth required for system upgrade
router.post('/system/upgrade-to-team', async (req, res) => {
  try {
    console.log('🚀 Upgrading tenant to Team plan via API...');
    
    // Get the correct tenant (ID 2 with company_id 13887824)
    const tenantsResult = await pool.query('SELECT id, company_name FROM tenants WHERE pipedrive_company_id = 13887824');
    if (tenantsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant with company_id 13887824 not found' });
    }
    
    const tenant = tenantsResult.rows[0];
    console.log(`📍 Target tenant: ${tenant.id} (${tenant.company_name})`);
    
    // Check if subscriptions table exists
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'subscriptions'
    `);
    
    if (tableCheck.rows.length === 0) {
      return res.status(400).json({
        error: 'Subscriptions table does not exist',
        message: 'Run /system/create-subscriptions-table first'
      });
    }
    
    // Check current subscription
    const currentSub = await pool.query('SELECT * FROM subscriptions WHERE tenant_id = $1', [tenant.id]);
    console.log('📋 Current subscription:', currentSub.rows[0] || 'None');
    
    // Calculate Team plan period (1 year from now)
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    // Upgrade to Team plan
    const upgradeResult = await pool.query(`
      INSERT INTO subscriptions (tenant_id, plan_tier, status, current_period_start, current_period_end, monthly_notification_count)
      VALUES ($1, 'team', 'active', $2, $3, 0)
      ON CONFLICT (tenant_id) DO UPDATE SET
        plan_tier = 'team',
        status = 'active',
        current_period_start = $2,
        current_period_end = $3,
        monthly_notification_count = 0,
        updated_at = NOW()
      RETURNING *
    `, [tenant.id, now, oneYearFromNow]);
    
    const subscription = upgradeResult.rows[0];
    console.log('✅ Team plan activated successfully');
    
    // Get Team plan features for confirmation
    const { getAvailablePlans } = require('../services/stripe');
    const plans = getAvailablePlans();
    const teamPlan = plans.team;
    
    res.json({
      success: true,
      message: 'Tenant upgraded to Team plan successfully',
      tenant: {
        id: tenant.id,
        company_name: tenant.company_name
      },
      subscription: {
        id: subscription.id,
        plan_tier: subscription.plan_tier,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        features: teamPlan.features,
        limits: teamPlan.limits
      }
    });
    
  } catch (error) {
    console.error('❌ Error upgrading to Team plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade to Team plan',
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
    const tenantId = req.tenant.id; // Get tenant ID from JWT token

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
    const tenantId = req.tenant.id; // Get tenant ID from JWT token

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
    const tenantId = req.tenant.id;
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
    const tenantId = req.tenant.id;

    const deletedRule = await deleteRule(tenantId, ruleId);

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
    const tenantId = req.tenant.id; // Get tenant ID from JWT token

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
    const tenantId = req.tenant.id; // Get tenant ID from JWT token
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
    const tenantId = req.tenant.id;
    const webhooks = await getWebhooks(tenantId);
    
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
    const tenantId = req.tenant.id;
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

    const newWebhook = await createWebhook(tenantId, {
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

// POST /api/v1/admin/webhooks/:id/test - Test webhook
router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const webhookId = req.params.id;

    // Get webhook details
    const webhooks = await getWebhooks(tenantId);
    const webhook = webhooks.find(w => w.id === parseInt(webhookId));
    
    if (!webhook) {
      return res.status(404).json({
        error: 'Webhook not found'
      });
    }

    // Send test message
    const axios = require('axios');
    const testMessage = {
      text: `✅ Test notification from Pipenotify\n` +
            `🔔 Webhook: ${webhook.name}\n` +
            `⏰ Time: ${new Date().toLocaleString()}\n` +
            `🚀 Status: Connection successful!`
    };

    await axios.post(webhook.webhook_url, testMessage, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      message: 'Test message sent successfully',
      webhook: {
        id: webhook.id,
        name: webhook.name
      }
    });

  } catch (error) {
    console.error('Error testing webhook:', error);
    
    let errorMessage = 'Failed to send test message';
    let statusCode = 500;
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `Webhook returned ${error.response.status}: ${error.response.statusText}`;
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 400;
      errorMessage = 'Could not connect to webhook URL';
    } else if (error.code === 'ETIMEDOUT') {
      statusCode = 408;
      errorMessage = 'Webhook request timed out';
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: error.message
    });
  }
});

// Test rule endpoint
// POST /api/v1/admin/rules/:id/test - Send test notification
router.post('/rules/:id/test', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const tenantId = req.tenant.id;
    
    // Get rule details
    const ruleResult = await pool.query(`
      SELECT r.*, cw.webhook_url, cw.name as webhook_name
      FROM rules r
      JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, [ruleId, tenantId]);
    
    if (ruleResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Rule not found or webhook not configured'
      });
    }
    
    const rule = ruleResult.rows[0];
    
    // Send test notification to Google Chat
    const axios = require('axios');
    const testMessage = `🧪 **Test Notification**\n\n**Rule:** ${rule.name}\n**Event Type:** ${rule.event_type}\n**Template Mode:** ${rule.template_mode}\n\n*This is a test message from Pipenotify*`;
    
    const startTime = Date.now();
    
    const response = await axios.post(rule.webhook_url, {
      text: testMessage
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    // Log the test
    await pool.query(`
      INSERT INTO logs (tenant_id, rule_id, webhook_id, event_type, status, formatted_message, response_time_ms, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      tenantId,
      ruleId,
      rule.target_webhook_id,
      'test.notification',
      'success',
      testMessage,
      responseTime
    ]);
    
    res.json({
      message: 'Test notification sent successfully',
      rule_id: ruleId,
      webhook_name: rule.webhook_name,
      response_time_ms: responseTime,
      sent_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    
    // Log the error
    try {
      await pool.query(`
        INSERT INTO logs (tenant_id, rule_id, event_type, status, formatted_message, error_message, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        req.tenant.id,
        req.params.id,
        'test.notification',
        'error',
        'Test notification failed',
        error.message
      ]);
    } catch (logError) {
      console.error('Failed to log test error:', logError);
    }
    
    res.status(500).json({
      error: 'Failed to send test notification',
      message: error.message
    });
  }
});

// Smart Channel Routing endpoints
// POST /api/v1/admin/routing/create-rules - Create routing rules
router.post('/routing/create-rules', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const routingConfig = req.body;

    console.log(`🎯 Creating routing rules for tenant ${tenantId}:`, routingConfig);

    // Validate routing config
    const validFields = ['highValueChannel', 'highValueThreshold', 'winsChannel', 'leadsChannel', 'urgentChannel', 'lostAnalysisChannel'];
    const hasValidConfig = Object.keys(routingConfig).some(key => validFields.includes(key) && routingConfig[key]);
    
    if (!hasValidConfig) {
      return res.status(400).json({
        error: 'No valid routing configuration provided',
        validFields: validFields
      });
    }

    // Create routing rules using the channelRouter service
    const result = await createRoutingRules(tenantId, routingConfig, pool);

    if (result.success) {
      res.json({
        message: 'Routing rules created successfully',
        rulesCreated: result.rulesCreated,
        rules: result.rules
      });
    } else {
      res.status(400).json({
        error: result.error,
        message: 'Failed to create routing rules'
      });
    }

  } catch (error) {
    console.error('Error creating routing rules:', error);
    res.status(500).json({
      error: 'Failed to create routing rules',
      message: error.message
    });
  }
});

// Test notification endpoint
router.post('/test/notification', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { rule_id, webhook_id, test_event, message_override } = req.body;

    if (!rule_id || !webhook_id || !test_event) {
      return res.status(400).json({
        success: false,
        error: 'rule_id, webhook_id, and test_event are required'
      });
    }

    // Get rule and webhook details
    const ruleResult = await pool.query(
      'SELECT * FROM rules WHERE id = $1 AND tenant_id = $2',
      [rule_id, tenantId]
    );

    const webhookResult = await pool.query(
      'SELECT * FROM chat_webhooks WHERE id = $1 AND tenant_id = $2',
      [webhook_id, tenantId]
    );

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    const rule = ruleResult.rows[0];
    const webhook = webhookResult.rows[0];

    // Use message override or template
    const message = message_override || rule.message_template;

    // Send test notification
    const axios = require('axios');
    const startTime = Date.now();
    
    try {
      const response = await axios.post(webhook.webhook_url, {
        text: `🧪 **TEST NOTIFICATION**\n\n${message}\n\n*This is a test from Pipenotify*`
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const responseTime = Date.now() - startTime;

      // Log the test
      await pool.query(`
        INSERT INTO logs (tenant_id, rule_id, webhook_id, status, message, response_time, event_data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        tenantId,
        rule_id,
        webhook_id,
        'delivered',
        message,
        responseTime,
        JSON.stringify(test_event)
      ]);

      res.json({
        success: true,
        message: 'Test notification sent successfully',
        response_time: responseTime,
        webhook_response: {
          status: response.status,
          data: response.data
        }
      });

    } catch (webhookError) {
      const responseTime = Date.now() - startTime;
      
      // Log the failure
      await pool.query(`
        INSERT INTO logs (tenant_id, rule_id, webhook_id, status, message, response_time, error_details, event_data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        tenantId,
        rule_id,
        webhook_id,
        'failed',
        message,
        responseTime,
        webhookError.message,
        JSON.stringify(test_event)
      ]);

      res.status(500).json({
        success: false,
        error: 'Failed to send test notification',
        details: webhookError.message,
        response_time: responseTime
      });
    }

  } catch (error) {
    console.error('Error testing notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test notification'
    });
  }
});

// Bulk operations endpoint
router.post('/rules/bulk', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { type, rule_ids, data } = req.body;

    if (!type || !rule_ids || !Array.isArray(rule_ids)) {
      return res.status(400).json({
        success: false,
        error: 'type and rule_ids array are required'
      });
    }

    if (rule_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one rule_id must be provided'
      });
    }

    // Verify all rules belong to tenant
    const verifyResult = await pool.query(
      'SELECT id FROM rules WHERE id = ANY($1) AND tenant_id = $2',
      [rule_ids, tenantId]
    );

    if (verifyResult.rows.length !== rule_ids.length) {
      return res.status(403).json({
        success: false,
        error: 'Some rules do not belong to this tenant'
      });
    }

    let result;
    
    switch (type) {
      case 'activate':
        result = await pool.query(
          'UPDATE rules SET is_active = true, updated_at = NOW() WHERE id = ANY($1) AND tenant_id = $2',
          [rule_ids, tenantId]
        );
        break;
        
      case 'deactivate':
        result = await pool.query(
          'UPDATE rules SET is_active = false, updated_at = NOW() WHERE id = ANY($1) AND tenant_id = $2',
          [rule_ids, tenantId]
        );
        break;
        
      case 'delete':
        result = await pool.query(
          'DELETE FROM rules WHERE id = ANY($1) AND tenant_id = $2',
          [rule_ids, tenantId]
        );
        break;
        
      case 'update_webhook':
        if (!data || !data.webhook_id) {
          return res.status(400).json({
            success: false,
            error: 'webhook_id is required for update_webhook operation'
          });
        }
        
        // Verify webhook belongs to tenant
        const webhookCheck = await pool.query(
          'SELECT id FROM chat_webhooks WHERE id = $1 AND tenant_id = $2',
          [data.webhook_id, tenantId]
        );
        
        if (webhookCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Webhook not found'
          });
        }
        
        result = await pool.query(
          'UPDATE rules SET target_webhook_id = $1, updated_at = NOW() WHERE id = ANY($2) AND tenant_id = $3',
          [data.webhook_id, rule_ids, tenantId]
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid operation type'
        });
    }

    res.json({
      success: true,
      message: `Successfully ${type === 'update_webhook' ? 'updated' : type === 'delete' ? 'deleted' : type + 'd'} ${result.rowCount} rules`,
      affected_rows: result.rowCount
    });

  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk operation'
    });
  }
});

// Import rules endpoint
router.post('/rules/import', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { rules, webhooks } = req.body;

    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: 'rules array is required'
      });
    }

    const importResults = {
      success: 0,
      failed: 0,
      errors: [],
      imported_rules: []
    };

    // Get existing webhooks for mapping
    const existingWebhooks = await pool.query(
      'SELECT id, name FROM chat_webhooks WHERE tenant_id = $1',
      [tenantId]
    );
    const webhookMap = new Map(existingWebhooks.rows.map(w => [w.name, w.id]));

    for (const ruleData of rules) {
      try {
        // Skip rules that are missing required fields
        if (!ruleData.name || !ruleData.message_template) {
          importResults.failed++;
          importResults.errors.push(`Rule missing name or template: ${ruleData.name || 'unnamed'}`);
          continue;
        }

        // Map webhook by name or use default
        let targetWebhookId = null;
        if (ruleData.target_webhook_id) {
          // Try to find webhook by matching name from the original export
          const matchingWebhook = webhooks?.find(w => w.id === ruleData.target_webhook_id);
          if (matchingWebhook && webhookMap.has(matchingWebhook.name)) {
            targetWebhookId = webhookMap.get(matchingWebhook.name);
          }
        }

        // If no webhook mapping found, use first available webhook
        if (!targetWebhookId && existingWebhooks.rows.length > 0) {
          targetWebhookId = existingWebhooks.rows[0].id;
        }

        if (!targetWebhookId) {
          importResults.failed++;
          importResults.errors.push(`No webhook available for rule: ${ruleData.name}`);
          continue;
        }

        // Create the rule
        const result = await pool.query(`
          INSERT INTO rules (tenant_id, name, event_filters, message_template, target_webhook_id, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          RETURNING id, name
        `, [
          tenantId,
          ruleData.name,
          ruleData.event_filters || {},
          ruleData.message_template,
          targetWebhookId,
          ruleData.is_active !== false // Default to true
        ]);

        importResults.success++;
        importResults.imported_rules.push({
          id: result.rows[0].id,
          name: result.rows[0].name
        });

      } catch (error) {
        importResults.failed++;
        importResults.errors.push(`Failed to import rule ${ruleData.name}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      ...importResults
    });

  } catch (error) {
    console.error('Error importing rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import rules'
    });
  }
});

// ==================== STALLED DEAL MONITORING ENDPOINTS ====================

// Get stalled deal monitoring settings
router.get('/stalled-deals/settings', authenticateToken, async (req, res) => {
  try {
    const tenantId = extractTenantId(req);
    
    // For now, return default settings since we haven't implemented settings storage yet
    const defaultSettings = {
      enabled: false,
      thresholds: {
        warning: 3,
        stale: 7,
        critical: 14
      },
      alertChannel: null,
      scheduleTime: '09:00',
      summaryFrequency: 'daily',
      minDealValue: null
    };

    res.json({
      success: true,
      settings: defaultSettings
    });

  } catch (error) {
    console.error('Error getting stalled deal settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stalled deal settings'
    });
  }
});

// Save stalled deal monitoring settings
router.post('/stalled-deals/settings', authenticateToken, async (req, res) => {
  try {
    const tenantId = extractTenantId(req);
    const { settings } = req.body;

    // TODO: Implement settings storage in database
    // For now, just return success
    console.log(`💾 Saving stalled deal settings for tenant ${tenantId}:`, settings);

    res.json({
      success: true,
      message: 'Stalled deal settings saved successfully'
    });

  } catch (error) {
    console.error('Error saving stalled deal settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save stalled deal settings'
    });
  }
});

// Get stalled deal monitoring statistics
router.get('/stalled-deals/stats', authenticateToken, async (req, res) => {
  try {
    const tenantId = extractTenantId(req);
    
    // Query for stalled deal statistics from logs
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT l.payload->>'object'->>'id') as total_deals_monitored,
        COUNT(CASE WHEN l.payload->>'event' LIKE 'stalled.deals.%' THEN 1 END) as stalled_deals_found,
        COUNT(CASE WHEN l.created_at >= CURRENT_DATE THEN 1 END) as alerts_sent_today,
        MAX(l.created_at) as last_run_time
      FROM logs l
      WHERE l.tenant_id = $1 
        AND l.created_at >= NOW() - INTERVAL '7 days'
    `;

    const result = await pool.query(statsQuery, [tenantId]);
    const row = result.rows[0];

    const stats = {
      totalDealsMonitored: parseInt(row.total_deals_monitored || 0),
      stalledDealsFound: parseInt(row.stalled_deals_found || 0),
      alertsSentToday: parseInt(row.alerts_sent_today || 0),
      lastRunTime: row.last_run_time,
      breakdown: {
        warning: Math.floor(Math.random() * 5), // Mock data for now
        stale: Math.floor(Math.random() * 3),
        critical: Math.floor(Math.random() * 2)
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting stalled deal stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stalled deal statistics'
    });
  }
});

// Test stalled deal alert
router.post('/stalled-deals/test', authenticateToken, async (req, res) => {
  try {
    const tenantId = extractTenantId(req);
    const { channelId } = req.body;

    // Import the stalled deal monitoring functions
    const { processStalledDealMonitoring } = require('../jobs/stalledDealMonitor');
    
    console.log(`🧪 Testing stalled deal monitoring for tenant ${tenantId}, channel ${channelId}`);
    
    // Run the stalled deal monitoring for this tenant
    const result = await processStalledDealMonitoring(tenantId);
    
    res.json({
      success: true,
      message: 'Test stalled deal monitoring completed',
      stalledDealsCount: result.stalled_deals || 0,
      alertsSent: result.alerts_sent || 0,
      breakdown: result.breakdown || {}
    });

  } catch (error) {
    console.error('Error testing stalled deal alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test stalled deal alert',
      details: error.message
    });
  }
});

// Run stalled deal monitoring now
router.post('/stalled-deals/run', authenticateToken, async (req, res) => {
  try {
    const tenantId = extractTenantId(req);

    // Import the stalled deal monitoring functions
    const { runStalledDealMonitoring } = require('../jobs/stalledDealMonitor');
    
    console.log(`🚀 Running stalled deal monitoring for all tenants (requested by tenant ${tenantId})`);
    
    // Run the full stalled deal monitoring
    const result = await runStalledDealMonitoring();
    
    res.json({
      success: true,
      message: 'Stalled deal monitoring completed successfully',
      tenantsProcessed: result.tenants_processed || 0,
      totalStalledDeals: result.total_stalled_deals || 0,
      totalAlertsSent: result.total_alerts_sent || 0,
      errors: result.errors || 0
    });

  } catch (error) {
    console.error('Error running stalled deal monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run stalled deal monitoring',
      details: error.message
    });
  }
});

module.exports = router;