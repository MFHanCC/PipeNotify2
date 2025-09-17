const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Run database migrations on production startup
const { runMigration } = require('./scripts/migrate');
const { fixPipedriveConnectionsTable } = require('./scripts/fix-pipedrive-connections');

// Initialize Sentry error tracking
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  console.log('📊 Sentry error tracking initialized');
} else {
  console.log('⚠️  Sentry DSN not configured - error tracking disabled');
}

const app = express();
const PORT = process.env.PORT || 8080;

// Sentry middleware (if properly configured)
// Note: Sentry handlers will be enabled when a valid SENTRY_DSN is provided

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:3000" : "'self'")],
    },
  },
}));

// CORS configuration for Railway backend + Vercel frontend
const allowedOrigins = [
  process.env.FRONTEND_URL, // Production frontend URL
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []), // Development only
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || 
        (origin && origin.includes('vercel.app'))) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Raw body preservation for webhook signature validation
app.use('/api/v1/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const adminTeamUpgradeRoutes = require('./routes/admin-team-upgrade');
const oauthRoutes = require('./routes/oauth');
const monitoringRoutes = require('./routes/monitoring');
const billingRoutes = require('./routes/billing');
const settingsRoutes = require('./routes/settings');
const templatesRoutes = require('./routes/templates');

// Import job processor to start worker
console.log('🔄 ATTEMPTING TO START BULLMQ WORKER...');
try {
  require('./jobs/processor');
  console.log('✅ BULLMQ WORKER LOADED SUCCESSFULLY');
} catch (workerError) {
  console.error('❌ FAILED TO LOAD BULLMQ WORKER:', workerError);
  console.error('Worker error details:', {
    message: workerError.message,
    code: workerError.code,
    stack: workerError.stack
  });
}

// Start delayed notification processor (cron job)
console.log('🔄 STARTING DELAYED NOTIFICATION PROCESSOR...');
try {
  require('./jobs/delayedNotificationProcessor');
  console.log('✅ DELAYED NOTIFICATION PROCESSOR STARTED');
} catch (cronError) {
  console.error('❌ FAILED TO START DELAYED NOTIFICATION PROCESSOR:', cronError);
  console.error('Cron error details:', {
    message: cronError.message,
    code: cronError.code,
    stack: cronError.stack
  });
}

// Start worker monitoring system
console.log('🔄 STARTING WORKER MONITORING...');
try {
  require('./jobs/workerMonitor');
  console.log('✅ WORKER MONITORING STARTED');
} catch (monitorError) {
  console.error('❌ FAILED TO START WORKER MONITORING:', monitorError);
  console.error('Monitor error details:', {
    message: monitorError.message,
    code: monitorError.code,
    stack: monitorError.stack
  });
}

// Start heartbeat monitoring system
console.log('🔄 STARTING HEARTBEAT MONITORING...');
try {
  require('./services/heartbeatMonitor');
  console.log('✅ HEARTBEAT MONITORING STARTED');
} catch (heartbeatError) {
  console.error('❌ FAILED TO START HEARTBEAT MONITORING:', heartbeatError);
  console.error('Heartbeat error details:', {
    message: heartbeatError.message,
    code: heartbeatError.code,
    stack: heartbeatError.stack
  });
}

// Start stalled deal monitoring system (daily cron job)
console.log('🔄 STARTING STALLED DEAL MONITORING...');
try {
  require('./jobs/stalledDealMonitor');
  console.log('✅ STALLED DEAL MONITORING STARTED - will run daily at 9 AM UTC');
} catch (stalledError) {
  console.error('❌ FAILED TO START STALLED DEAL MONITORING:', stalledError);
  console.error('Stalled deal monitor error details:', {
    message: stalledError.message,
    code: stalledError.code,
    stack: stalledError.stack
  });
}

// Mount routes
app.use('/api/v1/webhook', webhookRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin-team', adminTeamUpgradeRoutes);
app.use('/api/v1/oauth', oauthRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/templates', templatesRoutes);
app.use('/api/v1/analytics', require('./routes/analytics'));
app.use('/api/v1/health', require('./routes/health'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'pipenotify-backend'
  });
});

// API v1 routes placeholder
app.get('/api/v1/status', (req, res) => {
  res.json({
    message: 'Pipenotify Backend API v1',
    status: 'operational',
    features: [
      'OAuth 2.0 Authentication',
      'Webhook Management', 
      'Notification Rules',
      'Google Chat Integration',
      'Pipedrive API Integration'
    ]
  });
});

// OAuth callback placeholder
app.post('/api/v1/auth/callback', (req, res) => {
  res.json({
    message: 'OAuth callback endpoint ready',
    status: 'not_implemented',
    note: 'Will be implemented in Phase 3'
  });
});

// Webhook validation endpoint
app.post('/api/v1/webhooks/validate', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Webhook URL is required'
      });
    }

    // Basic URL validation
    try {
      new URL(url);
      if (!url.startsWith('https://chat.googleapis.com/v1/spaces/')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Google Chat webhook URL format'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format'
      });
    }

    // Test the webhook with a simple message
    try {
      const axios = require('axios');
      const testResponse = await axios.post(url, {
        text: '🧪 Webhook validation test from Pipenotify'
      }, { timeout: 5000 });

      res.json({
        success: true,
        message: 'Webhook validated successfully',
        valid: true
      });
    } catch (error) {
      console.error('Webhook validation failed:', error.message);
      res.status(400).json({
        success: false,
        message: 'Webhook validation failed - please check the URL and permissions',
        valid: false
      });
    }
    
  } catch (error) {
    console.error('Webhook validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during webhook validation'
    });
  }
});

// Dashboard stats placeholder
app.get('/api/v1/dashboard/stats', (req, res) => {
  res.json({
    totalNotifications: 0,
    successRate: 0,
    activeRules: 0,
    avgDeliveryTime: 0
  });
});

// Rules management placeholders
app.get('/api/v1/rules', (req, res) => {
  res.json([]);
});

app.get('/api/v1/logs', (req, res) => {
  res.json({ logs: [] });
});

// Integration activation endpoint
app.post('/api/v1/integration/activate', async (req, res) => {
  try {
    const { webhooks, templates, rules } = req.body;
    
    // Get tenant ID from JWT token
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    let tenantId = 1; // fallback
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded && decoded.tenantId) {
        tenantId = decoded.tenantId;
        console.log(`🔑 Using tenant ID ${tenantId} from JWT token`);
      }
    } catch (jwtError) {
      console.warn('⚠️ Could not decode JWT, using fallback tenant ID 1');
    }
    
    // Validate required data
    if (!webhooks || !templates || !rules || webhooks.length === 0 || templates.length === 0 || rules.length === 0) {
      return res.status(400).json({
        error: 'Missing required data',
        message: 'webhooks, templates, and rules are required'
      });
    }

    console.log('Integration activation requested:', {
      webhookCount: webhooks.length,
      templateCount: templates.length,
      ruleCount: rules.length,
      webhooks: webhooks.map(w => ({ name: w.name, valid: w.isValid })),
      templates: templates.map(t => t.id),
      rules: rules.map(r => ({ template: r.templateId, webhook: r.webhookId }))
    });

    // Import database functions
    const { createWebhook, createRule } = require('./services/database');
    const axios = require('axios');
    
    // tenantId is now set above from JWT token
    const savedWebhooks = [];
    const savedRules = [];

    // Step 1: Save Google Chat webhooks to database
    for (const webhook of webhooks) {
      if (webhook.isValid) {
        try {
          const savedWebhook = await createWebhook(tenantId, {
            name: webhook.name,
            webhook_url: webhook.url,
            description: `Google Chat webhook for ${webhook.name}`
          });
          savedWebhooks.push(savedWebhook);
          console.log('✅ Saved webhook:', savedWebhook.name);
        } catch (error) {
          console.error('❌ Failed to save webhook:', webhook.name, error.message);
        }
      }
    }

    // Step 2: Create notification rules
    for (const rule of rules) {
      try {
        const template = templates.find(t => t.id === rule.templateId);
        const webhook = savedWebhooks.find(w => w.id === rule.webhookId || w.name.includes(rule.webhookId));
        
        if (template && webhook) {
          // Map template IDs to correct event types
          let eventType = 'deal.updated'; // default
          if (template.id.includes('won')) eventType = 'deal.won';
          else if (template.id.includes('lost')) eventType = 'deal.lost';
          else if (template.id.includes('added') || template.id.includes('created')) eventType = 'deal.added';
          else if (template.id.includes('updated') || template.id.includes('change')) eventType = 'deal.updated';
          else if (template.id.includes('stage')) eventType = 'deal.updated';
          
          // For broader matching, also match deal.change events
          if (eventType === 'deal.updated') {
            eventType = 'deal.change'; // This matches what the webhook processor creates
          }
          
          console.log(`🎯 Creating rule for template "${template.name}" with event type: ${eventType}`);
          
          const savedRule = await createRule(tenantId, {
            name: `${template.name} → ${webhook.name}`,
            event_type: eventType,
            filters: rule.filters || {},
            target_webhook_id: webhook.id,
            template_mode: template.mode || 'simple',
            custom_template: template.customTemplate || null,
            enabled: true
          });
          savedRules.push(savedRule);
          console.log('✅ Created rule:', savedRule.name);
        }
      } catch (error) {
        console.error('❌ Failed to create rule:', error.message);
      }
    }

    // Step 3: Register Pipedrive webhook (if not already registered)
    try {
      const pipedriveToken = req.headers['x-pipedrive-token'] || process.env.PIPEDRIVE_API_TOKEN;
      
      if (pipedriveToken) {
        const webhookUrl = `https://pipenotify.up.railway.app/api/v1/webhook/pipedrive`;
        
        // Check if webhook already exists
        const existingWebhooks = await axios.get('https://api.pipedrive.com/v1/webhooks', {
          params: { api_token: pipedriveToken }
        });
        
        const existingWebhook = existingWebhooks.data.data?.find(w => 
          w.subscription_url === webhookUrl
        );
        
        if (!existingWebhook) {
          const webhookResponse = await axios.post('https://api.pipedrive.com/v1/webhooks', {
            subscription_url: webhookUrl,
            event_action: '*',
            event_object: 'deal'
          }, {
            params: { api_token: pipedriveToken }
          });
          
          console.log('✅ Pipedrive webhook registered:', webhookResponse.data);
        } else {
          console.log('✅ Pipedrive webhook already exists:', existingWebhook.id);
        }
      } else {
        console.log('⚠️ No Pipedrive token available - webhook not registered');
      }
    } catch (webhookError) {
      console.error('❌ Failed to register Pipedrive webhook:', webhookError.response?.data || webhookError.message);
    }

    res.json({
      success: true,
      message: 'Integration activated successfully',
      webhooks: {
        total: webhooks.length,
        saved: savedWebhooks.length,
        details: savedWebhooks.map(w => ({ id: w.id, name: w.name }))
      },
      rules: {
        total: rules.length,
        saved: savedRules.length,
        details: savedRules.map(r => ({ id: r.id, name: r.name, event_type: r.event_type }))
      },
      templates: templates.length,
      status: 'active',
      pipedriveWebhookUrl: 'https://pipenotify.up.railway.app/api/v1/webhook/pipedrive'
    });
    
  } catch (error) {
    console.error('Integration activation error:', error);
    res.status(500).json({
      error: 'Failed to activate integration',
      message: error.message
    });
  }
});

// Test notification endpoint
app.post('/api/v1/test/notification', async (req, res) => {
  try {
    const { templateId, webhookId, filters } = req.body;
    
    if (!templateId || !webhookId) {
      return res.status(400).json({
        success: false,
        message: 'templateId and webhookId are required'
      });
    }

    // Simulate a test notification
    console.log('Test notification requested:', {
      templateId,
      webhookId,
      filters: filters || 'none'
    });

    // For now, just return success
    res.json({
      success: true,
      message: `Test notification sent for template ${templateId}`,
      templateId,
      webhookId,
      status: 'sent'
    });
    
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
});

// Database connectivity test
app.get('/api/v1/debug/database', async (req, res) => {
  try {
    const { healthCheck, getRulesForEvent, getWebhooks } = require('./services/database');
    
    // Test basic connectivity
    const health = await healthCheck();
    
    // Test getting rules for tenant 1
    const rules = await getRulesForEvent(1, 'deal.*');
    
    // Test getting webhooks for tenant 1  
    const webhooks = await getWebhooks(1);
    
    res.json({
      database: health,
      rules: {
        count: rules.length,
        details: rules.map(r => ({ id: r.id, name: r.name, event_type: r.event_type, webhook_url: r.webhook_url?.substring(0, 50) + '...' }))
      },
      webhooks: {
        count: webhooks.length,
        details: webhooks.map(w => ({ id: w.id, name: w.name, webhook_url: w.webhook_url?.substring(0, 50) + '...' }))
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database test failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// Check recent webhook activity
app.get('/api/v1/debug/recent-webhooks', (req, res) => {
  // This is a simple in-memory log for debugging
  // In production, this would come from database
  res.json({
    message: 'Check Railway logs for recent webhook activity',
    instructions: [
      '1. Look for "🔔 PIPEDRIVE WEBHOOK RECEIVED" in Railway logs',
      '2. Look for "🚀 PROCESSING JOB" in Railway logs', 
      '3. If no webhooks received, Pipedrive may not be sending them',
      '4. If webhooks received but not processed, check BullMQ/Redis connection'
    ],
    testEndpoints: {
      'Test webhook processing': 'POST /api/v1/webhook/pipedrive',
      'Set Google Chat URL': 'POST /api/v1/test/set-chat-webhook',
      'Test full pipeline': 'POST /api/v1/test/webhook'
    }
  });
});

// Set Google Chat webhook URL for testing
app.post('/api/v1/test/set-chat-webhook', (req, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl || !webhookUrl.includes('chat.googleapis.com')) {
      return res.status(400).json({
        success: false,
        message: 'Valid Google Chat webhook URL is required'
      });
    }

    // Set environment variable for this session
    process.env.TEST_GOOGLE_CHAT_WEBHOOK = webhookUrl;
    
    console.log('✅ Test Google Chat webhook URL set:', webhookUrl.substring(0, 50) + '...');
    
    res.json({
      success: true,
      message: 'Google Chat webhook URL set for testing',
      webhookUrl: webhookUrl.substring(0, 50) + '...'
    });
    
  } catch (error) {
    console.error('Error setting test webhook URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set test webhook URL'
    });
  }
});

// Development: Create tenant record
app.post('/api/v1/dev/create-tenant', async (req, res) => {
  try {
    const { company_name, pipedrive_company_id, pipedrive_user_id } = req.body;
    
    console.log('🔧 DEV: Creating tenant record', { company_name, pipedrive_company_id, pipedrive_user_id });
    
    const { pool } = require('./services/database');
    const result = await pool.query(
      'INSERT INTO tenants (company_name, pipedrive_company_id, pipedrive_user_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [company_name, pipedrive_company_id, pipedrive_user_id]
    );
    
    console.log('✅ DEV: Tenant created successfully', result.rows[0]);
    
    res.json({
      success: true,
      tenant: result.rows[0],
      message: 'Tenant created successfully'
    });
  } catch (error) {
    console.error('❌ DEV: Failed to create tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual webhook registration endpoint
app.post('/api/v1/pipedrive/register-webhook', async (req, res) => {
  try {
    const { apiToken } = req.body;
    
    if (!apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Pipedrive API token is required'
      });
    }

    const axios = require('axios');
    const webhookUrl = `https://pipenotify.up.railway.app/api/v1/webhook/pipedrive`;
    
    // Register webhook for all deal events
    const response = await axios.post('https://api.pipedrive.com/v1/webhooks', {
      subscription_url: webhookUrl,
      event_action: '*',
      event_object: 'deal'
    }, {
      params: { api_token: apiToken }
    });
    
    console.log('✅ Pipedrive webhook registered manually:', response.data);
    
    res.json({
      success: true,
      message: 'Pipedrive webhook registered successfully',
      webhookUrl: webhookUrl,
      webhookId: response.data.data?.id,
      webhookData: response.data.data
    });
    
  } catch (error) {
    console.error('❌ Failed to register webhook:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to register webhook with Pipedrive',
      error: error.response?.data || error.message
    });
  }
});

// System status endpoint for debugging
app.get('/api/v1/debug/system-status', async (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    server: 'running',
    environment: process.env.NODE_ENV || 'development',
    database: { status: 'unknown', error: null },
    redis: { status: 'unknown', error: null },
    bullmq: { status: 'unknown', error: null },
    webhooks: { received: 0, processed: 0 },
    environment_vars: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      REDIS_URL: !!process.env.REDIS_URL,  
      PIPEDRIVE_API_TOKEN: !!process.env.PIPEDRIVE_API_TOKEN,
      NODE_ENV: process.env.NODE_ENV
    }
  };

  // Test database
  try {
    const { healthCheck } = require('./services/database');
    const dbHealth = await healthCheck();
    status.database.status = dbHealth.healthy ? 'connected' : 'failed';
    status.database.error = dbHealth.error || null;
  } catch (error) {
    status.database.status = 'error';
    status.database.error = error.message;
  }

  // Test Redis/BullMQ
  try {
    const { Queue } = require('bullmq');
    const { redisConfig } = require('./jobs/queue');
    const testQueue = new Queue('test', redisConfig);
    
    // Test by checking queue waiting jobs (this tests Redis connectivity)
    await testQueue.getWaiting();
    status.redis.status = 'connected';
    status.bullmq.status = 'running';
    await testQueue.close();
  } catch (error) {
    status.redis.status = 'failed';
    status.redis.error = error.message;
    status.bullmq.status = 'failed';
    status.bullmq.error = error.message;
  }

  res.json(status);
});

// Simple test endpoint that bypasses database and queues
app.post('/api/v1/test/direct-chat', async (req, res) => {
  try {
    const { webhookUrl, message } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'webhookUrl is required'
      });
    }

    const { defaultChatClient } = require('./services/chatClient');
    
    // Send directly to Google Chat without any queue or database
    const testMessage = message || '🚀 Direct test from Railway backend - notification system is working!';
    
    const result = await defaultChatClient.sendTextMessage(webhookUrl, testMessage);
    
    res.json({
      success: true,
      message: 'Direct notification sent successfully',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Direct chat test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send direct notification',
      error: error.message
    });
  }
});

// Direct test endpoint to send webhook through processing pipeline
app.post('/api/v1/test/webhook', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'webhookUrl is required'
      });
    }

    // Import dependencies for testing
    const { addNotificationJob } = require('./jobs/queue');
    const { defaultChatClient } = require('./services/chatClient');

    // First, test direct Google Chat connectivity
    console.log('Testing direct Google Chat webhook...');
    const directTest = await defaultChatClient.testWebhook(webhookUrl);
    
    if (!directTest.success) {
      return res.status(400).json({
        success: false,
        message: 'Google Chat webhook test failed',
        error: directTest.error
      });
    }

    // Create test webhook data that matches Pipedrive format
    const testWebhookData = {
      event: 'deal.updated',
      object: {
        id: 123,
        type: 'deal',
        name: 'Test Deal - Notification System',
        value: 1000,
        currency: 'USD',
        status: 'open',
        stage_id: 1
      },
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      },
      user_id: 1,
      company_id: 1,
      company: {
        id: 1,
        name: 'Test Company'
      },
      timestamp: new Date().toISOString()
    };

    // Test through the full pipeline
    console.log('Testing full notification pipeline...');
    const job = await addNotificationJob(testWebhookData, {
      priority: 1,
      delay: 0
    });

    res.json({
      success: true,
      message: 'Test webhook sent through full pipeline',
      directTest: directTest,
      jobId: job.id,
      testData: testWebhookData
    });
    
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test webhook',
      error: error.message
    });
  }
});

// Complete notification flow diagnostic endpoint
app.post('/api/v1/test/notification-flow', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'webhookUrl is required'
      });
    }

    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: Database connectivity
    console.log('🔍 Testing database connectivity...');
    try {
      const { healthCheck, getRulesForEvent, getWebhooks } = require('./services/database');
      const dbHealth = await healthCheck();
      
      results.tests.push({
        name: 'Database Connectivity',
        status: dbHealth.healthy ? 'PASS' : 'FAIL',
        details: dbHealth
      });

      if (dbHealth.healthy) {
        // Check rules and webhooks for tenant 1
        const rules = await getRulesForEvent(1, 'deal.*');
        const webhooks = await getWebhooks(1);
        
        results.tests.push({
          name: 'Rules and Webhooks',
          status: (rules.length > 0 && webhooks.length > 0) ? 'PASS' : 'FAIL',
          details: {
            rulesCount: rules.length,
            webhooksCount: webhooks.length,
            rules: rules.map(r => ({ id: r.id, name: r.name, event_type: r.event_type })),
            webhooks: webhooks.map(w => ({ id: w.id, name: w.name }))
          }
        });
      }
    } catch (dbError) {
      results.tests.push({
        name: 'Database Connectivity',
        status: 'FAIL',
        error: dbError.message
      });
    }

    // Test 2: Redis/Queue connectivity
    console.log('🔍 Testing Redis/Queue connectivity...');
    try {
      const { getQueueInfo } = require('./jobs/queue');
      const queueInfo = await getQueueInfo();
      
      results.tests.push({
        name: 'Redis/Queue Connectivity',
        status: queueInfo.connected ? 'PASS' : 'FAIL',
        details: queueInfo
      });
    } catch (queueError) {
      results.tests.push({
        name: 'Redis/Queue Connectivity',
        status: 'FAIL',
        error: queueError.message
      });
    }

    // Test 3: Worker status
    console.log('🔍 Testing worker status...');
    try {
      const { notificationWorker } = require('./jobs/processor');
      
      if (notificationWorker) {
        // Test worker connection by getting waiting jobs
        const waitingJobs = await notificationWorker.getWaiting();
        const activeJobs = await notificationWorker.getActive();
        
        results.tests.push({
          name: 'Worker Status',
          status: 'PASS',
          details: {
            workerExists: true,
            waitingJobs: waitingJobs.length,
            activeJobs: activeJobs.length
          }
        });
      } else {
        results.tests.push({
          name: 'Worker Status',
          status: 'FAIL',
          details: { workerExists: false, error: 'Worker instance not found' }
        });
      }
    } catch (workerError) {
      results.tests.push({
        name: 'Worker Status',
        status: 'FAIL',
        error: workerError.message
      });
    }

    // Test 4: Direct Google Chat test
    console.log('🔍 Testing direct Google Chat...');
    try {
      const { defaultChatClient } = require('./services/chatClient');
      const directResult = await defaultChatClient.sendTextMessage(
        webhookUrl,
        `🧪 Direct test notification - ${new Date().toISOString()}`
      );
      
      results.tests.push({
        name: 'Direct Google Chat',
        status: 'PASS',
        details: directResult
      });
    } catch (chatError) {
      results.tests.push({
        name: 'Direct Google Chat',
        status: 'FAIL',
        error: chatError.message
      });
    }

    // Test 5: End-to-end job processing
    console.log('🔍 Testing end-to-end job processing...');
    try {
      const { addNotificationJob } = require('./jobs/queue');
      
      const testWebhookData = {
        event: 'deal.updated',
        object: {
          id: 999,
          type: 'deal',
          title: 'E2E Test Deal',
          value: 2000,
          currency: 'USD'
        },
        user_id: 1,
        company_id: 1,
        timestamp: new Date().toISOString()
      };

      const job = await addNotificationJob(testWebhookData, {
        priority: 1,
        delay: 0
      });

      // Wait 5 seconds for processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const jobState = await job.getState();
      let jobResult = null;
      
      if (jobState === 'completed') {
        jobResult = await job.returnvalue;
      }
      
      results.tests.push({
        name: 'End-to-End Job Processing',
        status: jobState === 'completed' ? 'PASS' : 'PARTIAL',
        details: {
          jobId: job.id,
          jobState,
          jobResult,
          processingTime: '5 seconds waited'
        }
      });
    } catch (e2eError) {
      results.tests.push({
        name: 'End-to-End Job Processing',
        status: 'FAIL',
        error: e2eError.message
      });
    }

    // Summary
    const passCount = results.tests.filter(t => t.status === 'PASS').length;
    const totalTests = results.tests.length;
    
    results.summary = {
      totalTests,
      passed: passCount,
      failed: totalTests - passCount,
      overallStatus: passCount === totalTests ? 'ALL_PASS' : 'ISSUES_FOUND'
    };

    console.log(`🎯 Notification flow test complete: ${passCount}/${totalTests} tests passed`);

    res.json({
      success: true,
      message: 'Notification flow diagnostic complete',
      results
    });
    
  } catch (error) {
    console.error('Notification flow test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run notification flow test',
      error: error.message
    });
  }
});

// Sentry error handler (configured when valid DSN is provided)

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  // Don't send error details in production unless it's already been handled
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Internal Server Error',
    message: isDevelopment ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Server variable for graceful shutdown
let server;

// Run database migration in production
async function startServer() {
  // Test database connectivity first
  console.log('🔄 TESTING DATABASE CONNECTION...');
  try {
    const { healthCheck } = require('./services/database');
    const dbHealth = await healthCheck();
    if (dbHealth.healthy) {
      console.log('✅ DATABASE CONNECTION SUCCESSFUL');
    } else {
      console.error('❌ DATABASE CONNECTION FAILED:', dbHealth.error);
    }
  } catch (dbError) {
    console.error('❌ DATABASE TEST FAILED:', dbError.message);
  }

  if (process.env.NODE_ENV === 'production') {
    try {
      console.log('🔄 Running database migrations...');
      await runMigration();
      console.log('✅ Tenants table migration completed');
      console.log('📋 Migration includes delayed_notifications table creation');
      
      await fixPipedriveConnectionsTable();
      console.log('✅ Pipedrive connections table migration completed');
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      // Continue startup even if migration fails (in case columns already exist)
    }
  }
  
  // Start server
  server = app.listen(PORT, () => {
    console.log(`🚀 Pipenotify Backend running on port ${PORT}`);
    
    // Use Railway public URL in production, localhost in development
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
    
    console.log(`📊 Health check: ${baseUrl}/health`);
    console.log(`🔗 API status: ${baseUrl}/api/v1/status`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
    }
  });

  // Keep server alive
  server.on('error', (error) => {
    console.error('Server error:', error);
  });
}

// Start the server
startServer().catch(console.error);

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;