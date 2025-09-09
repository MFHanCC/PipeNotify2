const express = require('express');
const router = express.Router();
const { addNotificationJob } = require('../jobs/queue');

// POST /api/v1/webhook/pipedrive - Accept Pipedrive webhooks
router.post('/pipedrive', async (req, res) => {
  try {
    let webhookData = req.body;
    
    // Handle potential JSON parsing issues with control characters
    if (typeof webhookData === 'string') {
      try {
        // Clean control characters before parsing
        const cleanedData = webhookData.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        webhookData = JSON.parse(cleanedData);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError.message);
        console.error('Raw data:', webhookData.substring(0, 500));
        return res.status(400).json({
          error: 'Invalid JSON payload',
          message: 'Unable to parse webhook data'
        });
      }
    }
    
    // Log webhook received - full payload for debugging (safely handle control characters)
    console.log('🔔 PIPEDRIVE WEBHOOK RECEIVED:', {
      timestamp: new Date().toISOString(),
      event: webhookData.event,
      object: webhookData.object,
      userId: webhookData.user_id,
      companyId: webhookData.company_id,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'x-forwarded-for': req.headers['x-forwarded-for']
      }
    });
    
    // Log payload separately with control character handling
    try {
      const cleanPayload = JSON.stringify(webhookData, (key, value) => {
        if (typeof value === 'string') {
          return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        }
        return value;
      }, 2);
      console.log('📋 PAYLOAD:', cleanPayload);
    } catch (logError) {
      console.log('📋 PAYLOAD: [Unable to stringify safely]', Object.keys(webhookData));
    }

    // Validate webhook structure
    if (!webhookData.event || !webhookData.object) {
      return res.status(400).json({
        error: 'Invalid webhook payload',
        message: 'Missing required fields: event, object'
      });
    }

    // TODO: Add webhook signature validation for security
    
    // Enqueue webhook for processing via BullMQ
    const job = await addNotificationJob(webhookData, {
      priority: webhookData.event?.includes('won') ? 1 : 5, // Higher priority for won deals
      delay: 0 // Process immediately
    });

    res.status(200).json({
      message: 'Webhook received successfully',
      event: webhookData.event,
      timestamp: new Date().toISOString(),
      status: 'queued',
      jobId: job.id
    });

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