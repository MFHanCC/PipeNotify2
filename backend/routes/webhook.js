const express = require('express');
const router = express.Router();
const { addNotificationJob } = require('../jobs/queue');
const { validatePipedriveSignature } = require('../middleware/webhookValidation');

// POST /api/v1/webhook/pipedrive - Accept Pipedrive webhooks  
router.post('/pipedrive', validatePipedriveSignature, async (req, res) => {
  console.log('🔥 WEBHOOK RECEIVED - Processing...');
  
  try {
    let webhookData = req.body;
    
    // Handle raw body from webhook signature validation middleware
    if (Buffer.isBuffer(webhookData)) {
      try {
        const bodyString = webhookData.toString('utf8');
        // Clean control characters before parsing
        const cleanedData = bodyString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        webhookData = JSON.parse(cleanedData);
        console.log('✅ Successfully parsed buffer body');
      } catch (parseError) {
        console.error('❌ JSON parsing error:', parseError.message);
        console.error('Raw data sample:', webhookData.toString().substring(0, 500));
        return res.status(400).json({
          error: 'Invalid JSON payload',
          message: 'Unable to parse webhook data'
        });
      }
    } else if (typeof webhookData === 'string') {
      console.log('Body is string, attempting to parse...');
      try {
        // Clean control characters before parsing
        const cleanedData = webhookData.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        webhookData = JSON.parse(cleanedData);
        console.log('✅ Successfully parsed string body');
      } catch (parseError) {
        console.error('❌ JSON parsing error:', parseError.message);
        console.error('Raw data sample:', webhookData.substring(0, 500));
        return res.status(400).json({
          error: 'Invalid JSON payload',
          message: 'Unable to parse webhook data'
        });
      }
    }
    
    // Basic webhook info (rate limit compliant)
    console.log('🔔 Processing:', webhookData.meta?.entity, webhookData.meta?.action, 'ID:', webhookData.data?.id);

    // Transform Pipedrive webhook format to internal format
    if (webhookData.meta && webhookData.data) {
      // This is a Pipedrive webhook - transform it
      const transformedData = {
        event: `${webhookData.meta.entity}.${webhookData.meta.action}`, // e.g., "deal.update", "person.create"
        object: {
          type: webhookData.meta.entity,
          id: webhookData.data.id,
          ...webhookData.data
        },
        user_id: parseInt(webhookData.meta.user_id),
        company_id: parseInt(webhookData.meta.company_id),
        user: {
          id: parseInt(webhookData.meta.user_id),
          name: 'Pipedrive User' // We don't get user name from webhook
        },
        company: {
          id: parseInt(webhookData.meta.company_id),
          name: 'Company'
        },
        timestamp: webhookData.meta.timestamp,
        previous: webhookData.previous || null,
        raw_meta: webhookData.meta
      };
      
      console.log('🔄 Transformed:', transformedData.event, 'ID:', transformedData.object.id);
      
      webhookData = transformedData;
    }

    // Transform deal status changes to specific events (deal.won, deal.lost)
    if ((webhookData.event === 'deal.update' || webhookData.event === 'deal.change') && webhookData.object?.status) {
      const status = webhookData.object.status.toLowerCase();
      if (status === 'won') {
        webhookData.event = 'deal.won';
        console.log('🎉 Transformed deal.change/update with status=won to deal.won event');
      } else if (status === 'lost') {
        webhookData.event = 'deal.lost';
        console.log('📉 Transformed deal.change/update with status=lost to deal.lost event');
      }
    }

    // Validate transformed webhook structure
    if (!webhookData.event || !webhookData.object) {
      console.error('❌ WEBHOOK VALIDATION FAILED:', {
        has_event: !!webhookData.event,
        has_object: !!webhookData.object,
        keys: Object.keys(webhookData)
      });
      return res.status(400).json({
        error: 'Invalid webhook payload',
        message: 'Missing required fields after transformation'
      });
    }

    // ✅ Webhook signature validation completed by middleware
    
    console.log('🚀 QUEUING JOB for', webhookData.event);
    
    // Enqueue webhook for processing via BullMQ
    try {
      const job = await addNotificationJob(webhookData, {
        priority: webhookData.event?.includes('won') ? 1 : 5, // Higher priority for won deals
        delay: 0 // Process immediately
      });

      console.log('✅ JOB QUEUED SUCCESSFULLY:', {
        jobId: job.id,
        event: webhookData.event,
        priority: webhookData.event?.includes('won') ? 1 : 5
      });

      res.status(200).json({
        message: 'Webhook received successfully',
        event: webhookData.event,
        timestamp: new Date().toISOString(),
        status: 'success',
        jobId: job.id
      });
    } catch (queueError) {
      console.error('❌ FAILED TO QUEUE JOB:', queueError);
      console.error('Queue error details:', {
        message: queueError.message,
        code: queueError.code,
        stack: queueError.stack
      });
      
      // 🚨 EMERGENCY FALLBACK: Process notification directly if queue fails
      console.log('🚨 ACTIVATING EMERGENCY NOTIFICATION FALLBACK');
      
      try {
        const { processNotificationDirect } = require('../services/notificationFallback');
        const fallbackResult = await processNotificationDirect(webhookData);
        
        if (fallbackResult.success && fallbackResult.notificationsSent > 0) {
          console.log(`✅ EMERGENCY FALLBACK SUCCESS: ${fallbackResult.notificationsSent} notifications sent`);
          
          return res.status(200).json({
            message: 'Webhook processed via emergency fallback',
            event: webhookData.event,
            timestamp: new Date().toISOString(),
            status: 'emergency_success',
            notificationsSent: fallbackResult.notificationsSent,
            processingTime: fallbackResult.processingTime
          });
        } else {
          console.log(`⚠️ EMERGENCY FALLBACK COMPLETED: ${fallbackResult.notificationsSent} notifications sent`);
          
          return res.status(200).json({
            message: 'Webhook processed via emergency fallback (no notifications)',
            event: webhookData.event,
            timestamp: new Date().toISOString(),
            status: 'emergency_no_notifications',
            reason: fallbackResult.error || 'No matching rules or webhooks'
          });
        }
        
      } catch (fallbackError) {
        console.error('❌ EMERGENCY FALLBACK ALSO FAILED:', fallbackError);
        
        // Even fallback failed - this is a critical system issue
        return res.status(200).json({
          message: 'Webhook received but both queue and fallback failed',
          event: webhookData.event,
          timestamp: new Date().toISOString(),
          status: 'critical_failure',
          queueError: queueError.message,
          fallbackError: fallbackError.message
        });
      }
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/webhook/health - Webhook endpoint health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    endpoint: 'webhook',
    timestamp: new Date().toISOString()
  });
});

// Temporary disable quiet hours endpoint (until main endpoint deploys)
router.post('/disable-quiet-hours', async (req, res) => {
  try {
    const { pool } = require('../services/database');
    
    const result = await pool.query(`DELETE FROM quiet_hours WHERE tenant_id = 1`);
    const delayedResult = await pool.query(`UPDATE delayed_notifications SET scheduled_for = NOW() WHERE sent_at IS NULL`);
    
    res.json({
      success: true,
      message: 'Quiet hours disabled',
      deleted: result.rowCount,
      updated_delayed: delayedResult.rowCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check tenant rules and webhooks
router.get('/check-tenant-rules', async (req, res) => {
  try {
    const { pool } = require('../services/database');
    
    // Get all tenants
    const tenants = await pool.query(`SELECT * FROM tenants ORDER BY id`);
    
    // Get rules for each tenant
    const tenantsWithRules = [];
    for (const tenant of tenants.rows) {
      const rules = await pool.query(`
        SELECT r.*, w.name as webhook_name, w.webhook_url 
        FROM rules r 
        LEFT JOIN chat_webhooks w ON r.target_webhook_id = w.id 
        WHERE r.tenant_id = $1
      `, [tenant.id]);
      
      const webhooks = await pool.query(`SELECT * FROM chat_webhooks WHERE tenant_id = $1`, [tenant.id]);
      
      tenantsWithRules.push({
        tenant_id: tenant.id,
        company_name: tenant.company_name,
        pipedrive_company_id: tenant.pipedrive_company_id,
        rules_count: rules.rows.length,
        webhooks_count: webhooks.rows.length,
        rules: rules.rows.map(r => ({
          id: r.id,
          name: r.name,
          event_type: r.event_type,
          enabled: r.enabled,
          webhook_name: r.webhook_name,
          webhook_url: r.webhook_url ? r.webhook_url.substring(0, 50) + '...' : null
        })),
        webhooks: webhooks.rows.map(w => ({
          id: w.id,
          name: w.name,
          webhook_url: w.webhook_url ? w.webhook_url.substring(0, 50) + '...' : null
        }))
      });
    }
    
    res.json({
      success: true,
      current_webhook_company_id: 13887824,
      mapped_to_tenant_id: 2,
      tenants: tenantsWithRules,
      issue: 'Check if rules exist for tenant_id 2 (your current webhook source)'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Copy rules and webhooks from tenant 1 to tenant 2 (temporary fix)
router.post('/copy-rules-to-tenant2', async (req, res) => {
  try {
    const { pool } = require('../services/database');
    
    // First, copy webhooks
    const webhooks = await pool.query(`
      INSERT INTO chat_webhooks (tenant_id, name, webhook_url, description, enabled, created_at)
      SELECT 2, name, webhook_url, description, enabled, NOW()
      FROM chat_webhooks 
      WHERE tenant_id = 1
      ON CONFLICT (tenant_id, name) DO NOTHING
      RETURNING *
    `);
    
    // Then copy rules
    const rules = await pool.query(`
      INSERT INTO rules (tenant_id, name, event_type, filters, target_webhook_id, template_mode, custom_template, enabled, created_at)
      SELECT 2, name, event_type, filters, 
             (SELECT id FROM chat_webhooks WHERE tenant_id = 2 AND name = (SELECT name FROM chat_webhooks WHERE id = r.target_webhook_id) LIMIT 1),
             template_mode, custom_template, enabled, NOW()
      FROM rules r
      WHERE tenant_id = 1
      ON CONFLICT (tenant_id, name) DO NOTHING
      RETURNING *
    `);
    
    res.json({
      success: true,
      message: 'Rules and webhooks copied to tenant 2',
      webhooks_copied: webhooks.rows.length,
      rules_copied: rules.rows.length,
      note: 'Your Pipedrive webhooks come from tenant 2, so rules needed to be copied there'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      note: 'This copies notification rules from tenant 1 to tenant 2 where your webhooks are coming from'
    });
  }
});

module.exports = router;