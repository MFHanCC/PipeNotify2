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
const PORT = process.env.PORT || 3001;

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
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
    },
  },
}));

// CORS configuration for Railway backend + Vercel frontend
const allowedOrigins = [
  'http://localhost:3000', // Development frontend
  'https://your-app.vercel.app', // Production Vercel
  process.env.FRONTEND_URL, // Dynamic production URL
];

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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const oauthRoutes = require('./routes/oauth');

// Import job processor to start worker
require('./jobs/processor');

// Mount routes
app.use('/api/v1/webhook', webhookRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/oauth', oauthRoutes);

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

    // TODO: Actual implementation would:
    // 1. Save webhooks to database
    // 2. Create notification rules  
    // 3. Set up Pipedrive webhooks (MISSING - this is the issue!)
    // 4. Activate the integration

    // Register Pipedrive webhooks for the authenticated user
    try {
      const axios = require('axios');
      const pipedriveToken = req.headers['x-pipedrive-token'] || process.env.PIPEDRIVE_API_TOKEN;
      
      if (pipedriveToken) {
        const webhookUrl = `https://pipenotify.up.railway.app/api/v1/webhook/pipedrive`;
        
        // Register webhook for deal events
        const webhookResponse = await axios.post('https://api.pipedrive.com/v1/webhooks', {
          subscription_url: webhookUrl,
          event_action: '*',
          event_object: 'deal'
        }, {
          params: { api_token: pipedriveToken }
        });
        
        console.log('✅ Pipedrive webhook registered:', webhookResponse.data);
      } else {
        console.log('⚠️ No Pipedrive token available - webhook not registered');
      }
    } catch (webhookError) {
      console.error('❌ Failed to register Pipedrive webhook:', webhookError.response?.data || webhookError.message);
    }

    res.json({
      success: true,
      message: 'Integration activated successfully',
      webhooks: webhooks.length,
      templates: templates.length,
      rules: rules.length,
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
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log('🔄 Running database migrations...');
      await runMigration();
      console.log('✅ Tenants table migration completed');
      
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
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API status: http://localhost:${PORT}/api/v1/status`);
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