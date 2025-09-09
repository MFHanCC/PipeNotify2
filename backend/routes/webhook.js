const express = require('express');
const router = express.Router();
const { addNotificationJob } = require('../jobs/queue');

// POST /api/v1/webhook/pipedrive - Accept Pipedrive webhooks
router.post('/pipedrive', async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Log webhook received - full payload for debugging
    console.log('Pipedrive webhook received:', {
      timestamp: new Date().toISOString(),
      fullPayload: JSON.stringify(webhookData, null, 2),
      headers: req.headers,
      event: webhookData.event,
      object: webhookData.object,
      userId: webhookData.user_id,
      companyId: webhookData.company_id
    });

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