const express = require('express');
const router = express.Router();
const { addNotificationJob } = require('../jobs/queue');
const { validatePipedriveSignature } = require('../middleware/webhookValidation');

// POST /api/v1/webhook/pipedrive - Accept Pipedrive webhooks  
router.post('/pipedrive', validatePipedriveSignature, async (req, res) => {
  console.log('🔥 WEBHOOK RECEIVED - FULL DEBUGGING');
  console.log('🔍 Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 Request body type:', typeof req.body);
  console.log('🔍 Request body length:', req.body ? req.body.length || 'no length' : 'null');
  
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
    
    // Basic webhook info (reduced logging for rate limit)
    console.log('🔔 WEBHOOK INFO:', {
      entity: webhookData.meta?.entity,
      action: webhookData.meta?.action,
      id: webhookData.data?.id,
      timestamp: new Date().toISOString()
    });

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
      
      console.log('🔄 TRANSFORMED PIPEDRIVE WEBHOOK:', {
        original_entity: webhookData.meta.entity,
        original_action: webhookData.meta.action,
        transformed_event: transformedData.event,
        object_id: transformedData.object.id
      });
      
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
        status: 'queued',
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

module.exports = router;