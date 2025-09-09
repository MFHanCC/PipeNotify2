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

// Webhook validation placeholder
app.post('/api/v1/webhooks/validate', (req, res) => {
  res.json({
    message: 'Webhook validation endpoint ready',
    status: 'not_implemented',
    note: 'Will be implemented in Phase 3'
  });
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