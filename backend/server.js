const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

// Database migration functions - only available in development
let runMigration = null;
let fixPipedriveConnectionsTable = null;

// Only load migration scripts in development (they're removed from production)
if (process.env.NODE_ENV === 'development') {
  try {
    ({ runMigration } = require('./scripts/migrate'));
    ({ fixPipedriveConnectionsTable } = require('./scripts/fix-pipedrive-connections'));
    console.log('📋 Migration scripts loaded for development');
  } catch (error) {
    console.log('⚠️ Migration scripts not found - running without migrations');
  }
} else {
  console.log('🚀 Production mode - migrations handled by hosting provider');
}

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

// Configure trust proxy for Railway deployment
// Railway uses reverse proxies, so we need to trust the X-Forwarded-For headers
// Use specific trust proxy settings for Railway to satisfy express-rate-limit security requirements
if (process.env.RAILWAY_ENVIRONMENT) {
  // Railway-specific trust proxy configuration
  app.set('trust proxy', 1); // Trust first proxy (Railway's load balancer)
} else {
  // For other platforms or development, use more permissive setting
  app.set('trust proxy', true);
}

// Sentry middleware (if properly configured)
// Note: Sentry handlers will be enabled when a valid SENTRY_DSN is provided

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : "'self'")],
    },
  },
}));

// CORS configuration for Railway backend + Vercel frontend
const allowedOrigins = [
  process.env.FRONTEND_URL, // Production frontend URL
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []), // Development only
  // Specific Vercel deployment URLs only
  'https://pipenotify-frontend.vercel.app',
  'https://pipenotify-frontend-git-development-mfhanccs.vercel.app',
  // Temporary: Allow requests expecting old Railway URL (will be removed)
  'https://pipenotify.up.railway.app'
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // In production, be strict about origins
    if (process.env.NODE_ENV === 'production' && !origin) {
      return callback(new Error('No origin header - blocked in production'));
    }
    
    // In development, allow no origin for testing
    if (process.env.NODE_ENV !== 'production' && !origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting for security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  // Use default IP key generator that properly handles IPv6
  keyGenerator: rateLimit.ipKeyGenerator
});

// Apply rate limiting to all routes
app.use(limiter);

// Stricter rate limiting for admin and debug endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 500, // Higher limit for development testing
  message: {
    error: 'Too many admin requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  // Use default IP key generator that properly handles IPv6
  keyGenerator: rateLimit.ipKeyGenerator
});

app.use('/api/v1/admin', adminLimiter);
app.use('/health', adminLimiter);

// Raw body preservation for webhook signature validation
app.use('/api/v1/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Debug logging for add-default-rules requests
app.use((req, res, next) => {
  if (req.path.includes('add-default-rules')) {
    console.log(`🚨 DEBUG: ${req.method} ${req.originalUrl} ${req.path}`);
    console.log(`🚨 DEBUG: Origin: ${req.headers.origin}`);
    console.log(`🚨 DEBUG: Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`);
    console.log(`🚨 DEBUG: Content-Type: ${req.headers['content-type']}`);
    console.log(`🚨 DEBUG: Body:`, req.body);
  }
  next();
});

// Import routes
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const adminTeamUpgradeRoutes = require('./routes/admin-team-upgrade');
const oauthRoutes = require('./routes/oauth');
const monitoringRoutes = require('./routes/monitoring');
const billingRoutes = require('./routes/billing');
const settingsRoutes = require('./routes/settings');
const templatesRoutes = require('./routes/templates');
const { authenticateToken } = require('./middleware/auth'); // SECURITY FIX: Import authentication middleware

// Background services initialization function
function initializeBackgroundServices() {
  // Initialize services with delays to prevent overwhelming startup
  const initService = (name, requirePath, delay = 0) => {
    setTimeout(() => {
      console.log(`🔄 STARTING ${name}...`);
      try {
        require(requirePath);
        console.log(`✅ ${name} STARTED`);
      } catch (error) {
        console.error(`❌ FAILED TO START ${name}:`, error.message);
      }
    }, delay);
  };

  // Stagger service initialization to prevent startup overload
  initService('BULLMQ WORKER', './jobs/processor', 0);
  initService('DELAYED NOTIFICATION PROCESSOR', './jobs/delayedNotificationProcessor', 2000);
  initService('BATCH NOTIFICATION PROCESSOR', './jobs/batchProcessor', 4000);
  initService('WORKER MONITORING', './jobs/workerMonitor', 6000);
  initService('HEARTBEAT MONITORING', './services/heartbeatMonitor', 8000);
  initService('STALLED DEAL MONITORING', './jobs/stalledDealMonitor', 10000);
  initService('LOG CLEANUP SERVICE', './jobs/logCleanup', 12000);
  
  // Initialize remaining services
  setTimeout(() => {
    console.log('🔄 STARTING REMAINING MONITORING SERVICES...');
    // Continue with other services that were in the original startup
    initializeAdvancedServices();
  }, 15000);
}

function initializeAdvancedServices() {
  // Advanced monitoring services
  const services = [
    { name: 'SELF-HEALING SYSTEM', path: './services/selfHealing' },
    { name: 'HEALTH TRACKING SYSTEM', path: './services/healthTracker' },
    { name: 'PERFORMANCE ANALYZER', path: './services/performanceAnalyzer' },
    { name: 'AUTO-REMEDIATION SYSTEM', path: './services/autoRemediation' },
    { name: 'HEALTH PREDICTOR', path: './services/healthPredictor' },
    { name: 'SYSTEM REPORTER', path: './services/systemReporter' },
    { name: 'ADVANCED DEBUGGER', path: './services/advancedDebugger' }
  ];

  services.forEach((service, index) => {
    setTimeout(() => {
      try {
        require(service.path);
        console.log(`✅ ${service.name} STARTED`);
      } catch (error) {
        console.error(`❌ FAILED TO START ${service.name}:`, error.message);
      }
    }, index * 2000);
  });
}

// All background services moved to deferred initialization after Express server starts

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
app.use('/api/v1/analytics/advanced', require('./routes/advancedAnalytics'));
app.use('/api/v1/health', require('./routes/health'));

// Minimal health check endpoint - no external dependencies
app.get('/health', (req, res) => {
  console.log('🩺 Health check request received');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'pipenotify-backend',
    uptime: process.uptime()
  });
});

// Emergency ping endpoint - absolute minimal response
app.get('/ping', (req, res) => {
  console.log('🏓 Ping request received');
  res.send('pong');
});

// Migration endpoint to fix Add Default Rules schema (no auth)
app.post('/debug/run-migration-012', async (req, res) => {
  try {
    const { pool } = require('./services/database');
    
    console.log('🔄 Running migration 012 via HTTP endpoint...');
    
    // Check if the columns already exist
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rules' 
      ORDER BY ordinal_position
    `);
    
    const hasIsDefault = columnsResult.rows.some(col => col.column_name === 'is_default');
    const hasRuleTemplateId = columnsResult.rows.some(col => col.column_name === 'rule_template_id');
    const hasAutoCreatedAt = columnsResult.rows.some(col => col.column_name === 'auto_created_at');
    const hasPlanTier = columnsResult.rows.some(col => col.column_name === 'plan_tier');
    
    const missingColumns = [];
    if (!hasIsDefault) missingColumns.push('is_default');
    if (!hasRuleTemplateId) missingColumns.push('rule_template_id');
    if (!hasAutoCreatedAt) missingColumns.push('auto_created_at');
    if (!hasPlanTier) missingColumns.push('plan_tier');
    
    // Add missing columns
    if (missingColumns.length > 0) {
      if (!hasIsDefault) {
        await pool.query('ALTER TABLE rules ADD COLUMN is_default BOOLEAN DEFAULT false');
      }
      if (!hasRuleTemplateId) {
        await pool.query('ALTER TABLE rules ADD COLUMN rule_template_id VARCHAR(100)');
      }
      if (!hasAutoCreatedAt) {
        await pool.query('ALTER TABLE rules ADD COLUMN auto_created_at TIMESTAMP WITH TIME ZONE');
      }
      if (!hasPlanTier) {
        await pool.query('ALTER TABLE rules ADD COLUMN plan_tier VARCHAR(20)');
      }
    }
    
    // Check if rule_provisioning_log table exists
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'rule_provisioning_log'
    `);
    
    let tableCreated = false;
    if (tablesResult.rows.length === 0) {
      await pool.query(`
        CREATE TABLE rule_provisioning_log (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id),
          plan_tier VARCHAR(20) NOT NULL,
          rules_created INTEGER DEFAULT 0,
          provisioning_type VARCHAR(50) NOT NULL,
          from_plan VARCHAR(20),
          to_plan VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_rules JSONB DEFAULT '[]',
          errors JSONB DEFAULT '[]'
        )
      `);
      tableCreated = true;
    }
    
    // Test the is_default query
    const testResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM rules 
      WHERE tenant_id = 1 AND is_default = true
    `);
    
    res.json({
      success: true,
      migration_applied: true,
      missing_columns_added: missingColumns,
      table_created: tableCreated,
      query_test_passed: true,
      default_rules_count: testResult.rows[0].count
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

// Debug endpoint to check database schema (no auth)
app.get('/debug/schema', async (req, res) => {
  try {
    const { pool } = require('./services/database');
    
    console.log('🔍 Debug: Checking database schema...');
    
    // Check if is_default column exists in rules table
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'rules' 
      ORDER BY ordinal_position
    `);
    
    // Check if rule_provisioning_log table exists
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%provisioning%'
    `);
    
    // Test a simple query on rules table
    const rulesCount = await pool.query('SELECT COUNT(*) as count FROM rules');
    
    // Try to test the specific query that's failing (use tenant_id 1 for testing)
    let isDefaultTest = null;
    try {
      const testQuery = await pool.query(`
        SELECT COUNT(*) as total_rules
        FROM rules 
        WHERE tenant_id = $1 AND is_default = true
      `, [1]);
      isDefaultTest = { success: true, count: testQuery.rows[0].total_rules };
    } catch (error) {
      isDefaultTest = { success: false, error: error.message };
    }
    
    res.json({
      success: true,
      schema_check: {
        rules_columns: columnsResult.rows,
        provisioning_tables: tablesResult.rows,
        total_rules: rulesCount.rows[0].count,
        is_default_test: isDefaultTest
      }
    });
    
  } catch (error) {
    console.error('Debug schema check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Schema check failed',
      details: error.message
    });
  }
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
app.post('/api/v1/integration/activate', authenticateToken, async (req, res) => {
  try {
    const { webhooks, templates, rules } = req.body;
    
    // SECURITY FIX: Get tenant ID from authenticated request (no fallback to tenant 1)
    const tenantId = req.tenant.id;
    if (!tenantId) {
      return res.status(401).json({ 
        error: 'Authentication required', 
        message: 'Valid tenant context required' 
      });
    }
    
    console.log(`🔑 Integration activation for authenticated tenant: ${tenantId}`);
    
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
        const webhookUrl = 'https://pipenotify.up.railway.app/api/v1/webhook/pipedrive';
        
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

// =================================================================
// DEVELOPMENT & DEBUG ENDPOINTS 
// These endpoints are only available in development environment
// =================================================================
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
  console.log('🔧 Debug endpoints enabled');

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
    const webhookUrl = 'https://pipenotify.up.railway.app/api/v1/webhook/pipedrive';
    
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

// Check quiet hours configuration and status
app.get('/api/v1/test/check-quiet-hours', async (req, res) => {
  try {
    const { pool } = require('./services/database');
    const { getQuietHours, isQuietTime } = require('./services/quietHours');
    
    const result = {
      timestamp: new Date().toISOString(),
      timezone_info: {
        utc_time: new Date().toISOString(),
        utc_hour: new Date().getUTCHours(),
        utc_minutes: new Date().getUTCMinutes()
      }
    };
    
    // Check if quiet_hours table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'quiet_hours'
    `);
    
    result.table_exists = tableCheck.rows.length > 0;
    
    if (result.table_exists) {
      // Check for any records
      const allRecords = await pool.query(`
        SELECT * FROM quiet_hours ORDER BY tenant_id
      `);
      
      result.total_records = allRecords.rows.length;
      result.all_records = allRecords.rows;
      
      // Specifically check tenant 1
      const tenant1Records = await pool.query(`
        SELECT * FROM quiet_hours WHERE tenant_id = 1
      `);
      
      result.tenant1_records = tenant1Records.rows.length;
      result.tenant1_config = tenant1Records.rows[0] || null;
    }
    
    // Test the actual functions
    const config = await getQuietHours(1);
    result.getQuietHours_result = config;
    
    const quietCheck = await isQuietTime(1);
    result.isQuietTime_result = quietCheck;
    
    result.summary = {
      configured: config.configured,
      is_quiet: quietCheck.is_quiet,
      reason: quietCheck.reason,
      should_send_immediately: !quietCheck.is_quiet
    };
    
    res.json({
      success: true,
      message: 'Quiet hours status check complete',
      result
    });
    
  } catch (error) {
    console.error('❌ Failed to check quiet hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check quiet hours',
      error: error.message
    });
  }
});

// Disable quiet hours for immediate testing
app.post('/api/v1/test/disable-quiet-hours', async (req, res) => {
  try {
    console.log('🔧 Disabling quiet hours for immediate testing...');
    
    const { pool } = require('./services/database');
    
    // Check if quiet_hours table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'quiet_hours'
    `);
    
    if (tableCheck.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No quiet_hours table found - notifications already send immediately',
        actions: []
      });
    }
    
    const actions = [];
    
    // Delete all quiet hours configurations to disable quiet hours
    const result = await pool.query(`
      DELETE FROM quiet_hours WHERE tenant_id = 1
    `);
    
    actions.push(`Deleted ${result.rowCount} quiet hours configurations for tenant 1`);
    
    // Also clean up any pending delayed notifications and send them immediately
    const delayedCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'delayed_notifications'
    `);
    
    if (delayedCheck.rows.length > 0) {
      const pendingNotifications = await pool.query(`
        SELECT COUNT(*) as count FROM delayed_notifications 
        WHERE sent_at IS NULL
      `);
      
      const pendingCount = parseInt(pendingNotifications.rows[0].count);
      actions.push(`Found ${pendingCount} delayed notifications pending`);
      
      if (pendingCount > 0) {
        // Update scheduled time to now so they process immediately
        const updateResult = await pool.query(`
          UPDATE delayed_notifications 
          SET scheduled_for = NOW() 
          WHERE sent_at IS NULL
        `);
        
        actions.push(`Updated ${updateResult.rowCount} delayed notifications to send immediately`);
      }
    }
    
    res.json({
      success: true,
      message: 'Quiet hours disabled successfully - notifications will now send immediately',
      actions,
      instructions: [
        'Go to Pipedrive and create/update deals',
        'Notifications should now appear in Google Chat immediately',
        'To re-enable quiet hours later, configure them in the frontend'
      ]
    });
    
  } catch (error) {
    console.error('❌ Failed to disable quiet hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable quiet hours',
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

} // End of development/debug endpoints
else {
  console.log('🚀 Production mode - debug endpoints disabled');
}

// =================================================================
// PRODUCTION ERROR HANDLING
// =================================================================

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
  console.log(`❌ 404 NOT FOUND: ${req.method} ${req.originalUrl}`);
  console.log(`❌ Headers:`, req.headers);
  console.log(`❌ Body:`, req.body);
  
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
  const startTime = Date.now();
  console.log('🚀 SERVER STARTUP INITIATED');
  
  // Test database connectivity with timeout
  console.log('🔄 TESTING DATABASE CONNECTION...');
  try {
    const { healthCheck } = require('./services/database');
    
    // Add timeout to prevent hanging
    const dbHealthPromise = healthCheck();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database health check timeout')), 10000)
    );
    
    const dbHealth = await Promise.race([dbHealthPromise, timeoutPromise]);
    if (dbHealth.healthy) {
      console.log('✅ DATABASE CONNECTION SUCCESSFUL');
    } else {
      console.error('❌ DATABASE CONNECTION FAILED:', dbHealth.error);
    }
  } catch (dbError) {
    console.error('❌ DATABASE TEST FAILED:', dbError.message);
  }

  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 Production mode - database migrations should be handled by hosting provider (Railway)');
    console.log('💡 Railway automatically runs migrations from the migrations/ directory');
  } else if (runMigration && fixPipedriveConnectionsTable) {
    try {
      console.log('🔄 Running database migrations...');
      
      // Add timeout to migration to prevent hanging
      const migrationPromise = Promise.all([
        runMigration().then(() => console.log('✅ Tenants table migration completed')),
        fixPipedriveConnectionsTable().then(() => console.log('✅ Pipedrive connections table migration completed'))
      ]);
      
      const migrationTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Migration timeout')), 30000)
      );
      
      await Promise.race([migrationPromise, migrationTimeout]);
      console.log('📋 Migration includes delayed_notifications table creation');
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      // Continue startup even if migration fails (in case columns already exist)
    }
  }
  
  // Start server - this should always execute BEFORE background services
  const serverStartTime = Date.now();
  console.log('🔄 STARTING EXPRESS SERVER...');
  server = app.listen(PORT, () => {
    const totalStartTime = Date.now() - startTime;
    const serverBindTime = Date.now() - serverStartTime;
    console.log(`🚀 Pipenotify Backend running on port ${PORT}`);
    console.log(`⏱️ Total startup time: ${totalStartTime}ms, Server bind time: ${serverBindTime}ms`);
    
    // Initialize background services AFTER HTTP server is ready
    console.log('🔄 INITIALIZING BACKGROUND SERVICES...');
    initializeBackgroundServices();
    
    // Initialize advanced services after background services
    setTimeout(() => {
      console.log('🔄 INITIALIZING ADVANCED SERVICES...');
      initializeAdvancedServices();
    }, 5000);
    
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

module.exports = app;// Force redeploy Mon Sep 22 02:53:30 CDT 2025 - Add Default Rules endpoint fix
