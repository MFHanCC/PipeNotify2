# Pipenotify Technical Documentation

**Complete technical reference for developers, administrators, and advanced users**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Performance Optimizations](#performance-optimizations)
7. [Security Implementation](#security-implementation)
8. [Deployment Guide](#deployment-guide)
9. [Monitoring & Logging](#monitoring--logging)
10. [Development Workflow](#development-workflow)

---

## Architecture Overview

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pipedrive     │    │   Pipenotify    │    │  Google Chat    │
│   CRM System    │────│   Backend       │────│   Webhooks      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   Pipenotify    │
                       │   Frontend      │
                       └─────────────────┘
```

### Technology Stack

#### Frontend (Vercel)
- **Framework**: React 18 with TypeScript
- **Styling**: CSS Modules with responsive design
- **State Management**: React Hooks (useState, useEffect, useCallback, useMemo)
- **Routing**: React Router v6
- **Build Tool**: Create React App with code splitting
- **Deployment**: Vercel with automatic deployments

#### Backend (Railway)
- **Runtime**: Node.js 18+
- **Framework**: Express.js with middleware architecture
- **Database**: PostgreSQL 15 with connection pooling
- **Queue System**: BullMQ + Redis for background processing
- **Authentication**: JWT tokens with tenant isolation
- **API Design**: RESTful endpoints with OpenAPI documentation

#### Infrastructure
- **Frontend Hosting**: Vercel Global CDN
- **Backend Hosting**: Railway with auto-scaling
- **Database**: Railway PostgreSQL with automated backups
- **Cache/Queue**: Railway Redis for session and job management
- **Monitoring**: Sentry for error tracking

---

## Frontend Architecture

### Component Structure

```
src/
├── components/           # Reusable UI components
│   ├── Dashboard.tsx    # Main dashboard (1249 lines)
│   ├── AnalyticsPanel.tsx   # Analytics dashboard (453 lines)
│   ├── WebhookManager.tsx   # Webhook management (253 lines)
│   ├── RuleFilters.tsx      # Rule configuration (568 lines)
│   ├── BulkRuleManager.tsx  # Bulk operations (540 lines)
│   └── ...
├── services/            # API communication layer
│   └── api.ts          # Centralized API client
├── layouts/            # Page layout components
└── tests/              # Component and integration tests
```

### Performance Optimizations

#### Code Splitting & Lazy Loading
```typescript
// Lazy component loading for better performance
const WebhookManager = lazy(() => import('./WebhookManager'));
const AnalyticsPanel = lazy(() => import('./AnalyticsPanel'));
const BulkRuleManager = lazy(() => import('./BulkRuleManager'));

// Suspense wrapper for loading states
<Suspense fallback={<ComponentLoader />}>
  <AnalyticsPanel tenantId={tenantId} dateRange={dateRange} />
</Suspense>
```

#### Memoization Patterns
```typescript
// Expensive calculations memoized
const filteredRules = useMemo(() => {
  let filtered = rules;
  
  if (filterActive !== 'all') {
    filtered = filtered.filter(rule => 
      filterActive === 'active' ? rule.is_active : !rule.is_active
    );
  }
  
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(rule =>
      rule.name.toLowerCase().includes(query)
    );
  }
  
  return filtered;
}, [rules, filterActive, searchQuery]);

// API error handling memoized
const handleApiError = useCallback((error: any, operation: string) => {
  let message = `Failed to ${operation}`;
  if (error?.status === 401) {
    message = 'Session expired. Please log in again.';
  }
  setError(message);
}, []);
```

#### API Optimization
```typescript
// Parallel API calls for better performance
const [statsResponse, rulesResponse, logsResponse, webhooksResponse] = await Promise.all([
  fetch(`${apiUrl}/api/v1/monitoring/dashboard/${tenantId}?days=${days}`, { 
    headers,
    signal: AbortSignal.timeout(10000) // 10 second timeout
  }).catch(() => null),
  fetch(`${apiUrl}/api/v1/admin/rules`, { headers }),
  fetch(`${apiUrl}/api/v1/admin/logs?${logsParams}`, { headers }),
  fetch(`${apiUrl}/api/v1/admin/webhooks`, { headers })
]);
```

### State Management

#### Component-Level State
- **Local State**: useState for component-specific data
- **Derived State**: useMemo for computed values
- **Side Effects**: useEffect with proper dependency arrays
- **Event Handlers**: useCallback to prevent unnecessary re-renders

#### Global State Management
- **JWT Token**: localStorage for authentication persistence
- **Tenant Context**: Extracted from JWT payload and managed at component level
- **API Results**: Component-level state with error boundaries

### Error Handling

#### Comprehensive Error Boundaries
```typescript
// Standardized error handling across components
const handleApiError = useCallback((error: any, operation: string) => {
  let message = `Failed to ${operation}`;
  if (networkStatus === 'offline') {
    message = 'Network connection lost. Please check your internet connection.';
  } else if (error?.status === 401) {
    message = 'Session expired. Please log in again.';
  } else if (error?.status === 403) {
    message = 'Permission denied. Please check your access rights.';
  } else if (error?.status === 429) {
    message = 'Rate limit exceeded. Please wait a moment and try again.';
  } else if (error?.message) {
    message = error.message;
  }
  setError(message);
}, [networkStatus]);
```

### Accessibility Implementation

#### WCAG AA Compliance
- **Semantic HTML**: Proper heading hierarchy and landmark elements
- **ARIA Labels**: Screen reader support for interactive elements
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: Minimum 4.5:1 contrast ratio
- **Focus Management**: Visible focus indicators

#### Screen Reader Support
```tsx
<button
  onClick={handleDeleteRule}
  className="delete-button"
  aria-label={`Delete rule ${rule.name}`}
  aria-describedby={`rule-${rule.id}-description`}
>
  🗑️
</button>
```

---

## Backend Architecture

### Service Layer Architecture

```
routes/              # API endpoint definitions
├── admin.js        # CRUD operations for rules, webhooks, logs
├── analytics.js    # Performance analytics and reporting
├── oauth.js        # Pipedrive OAuth flow
├── webhook.js      # Incoming webhook processing
└── monitoring.js   # Health checks and system status

services/           # Business logic layer
├── database.js     # Database connection and query utilities
├── pipedriveClient.js  # Pipedrive API integration
├── chatClient.js   # Google Chat webhook handling
├── templateEngine.js   # Message template processing
├── ruleFilters.js  # Rule filtering and matching logic
└── channelRouter.js    # Notification routing logic

middleware/         # Cross-cutting concerns
├── auth.js         # JWT authentication and validation
├── featureGating.js    # Feature flag management
└── quotaEnforcement.js # Rate limiting and usage quotas

jobs/              # Background processing
├── processor.js    # Main job processing worker
├── queue.js       # Job queue management
└── delayedNotificationProcessor.js  # Scheduled notifications
```

### Database Layer

#### Connection Management
```javascript
// PostgreSQL connection with pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,                  // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if unable to connect
});
```

#### Query Optimization
```sql
-- Efficient rule matching with proper indexing
SELECT r.*, w.webhook_url, w.name as webhook_name
FROM rules r
JOIN chat_webhooks w ON r.target_webhook_id = w.id
WHERE r.tenant_id = $1 
  AND r.enabled = true 
  AND r.event_type = $2
  AND (r.filters IS NULL OR r.filters = '{}' OR $3::jsonb @> r.filters)
ORDER BY r.priority DESC, r.created_at ASC;
```

### Authentication & Authorization

#### JWT Implementation
```javascript
// JWT token structure
{
  "tenantId": "12345",
  "userId": "user_abc",
  "email": "user@company.com",
  "scopes": ["read:rules", "write:rules", "admin:webhooks"],
  "iat": 1640995200,
  "exp": 1641081600
}

// Middleware for token validation
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.tenant = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
```

#### Tenant Isolation
All database queries include tenant_id filtering:
```javascript
// Example: Rule retrieval with tenant isolation
const getRules = async (tenantId) => {
  const query = `
    SELECT * FROM rules 
    WHERE tenant_id = $1 
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [tenantId]);
  return result.rows;
};
```

### Background Job Processing

#### BullMQ Integration
```javascript
// Job queue setup
const Queue = require('bullmq').Queue;
const Worker = require('bullmq').Worker;

const notificationQueue = new Queue('notifications', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  }
});

// Job processing with retry logic
const worker = new Worker('notifications', async (job) => {
  const { webhookData, ruleId, tenantId } = job.data;
  
  try {
    await processNotification(webhookData, ruleId, tenantId);
  } catch (error) {
    console.error('Notification processing failed:', error);
    throw error; // Will trigger retry
  }
}, {
  connection: redisConnection,
  concurrency: 10,
  removeOnComplete: 100,
  removeOnFail: 50
});
```

### Error Handling & Logging

#### Structured Logging
```javascript
// Comprehensive error logging
const logError = (error, context = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: error.message,
    stack: error.stack,
    context: {
      tenantId: context.tenantId,
      userId: context.userId,
      endpoint: context.endpoint,
      requestId: context.requestId
    }
  };
  
  console.error(JSON.stringify(logEntry));
  
  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, { contexts: context });
  }
};
```

---

## Database Schema

### Core Tables

#### tenants
```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Subscription info
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    subscription_status VARCHAR(50) DEFAULT 'active',
    
    -- Usage tracking
    monthly_notification_count INTEGER DEFAULT 0,
    monthly_limit INTEGER DEFAULT 1000,
    
    INDEX idx_tenants_created(created_at),
    INDEX idx_tenants_status(subscription_status)
);
```

#### pipedrive_connections
```sql
CREATE TABLE pipedrive_connections (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, -- Encrypted
    refresh_token TEXT, -- Encrypted
    expires_at TIMESTAMP,
    company_domain VARCHAR(255),
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id),
    INDEX idx_pipedrive_tenant(tenant_id),
    INDEX idx_pipedrive_expires(expires_at)
);
```

#### chat_webhooks
```sql
CREATE TABLE chat_webhooks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    webhook_url TEXT NOT NULL, -- Encrypted
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_webhooks_tenant(tenant_id),
    INDEX idx_webhooks_active(tenant_id, is_active)
);
```

#### rules
```sql
CREATE TABLE rules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    target_webhook_id INTEGER REFERENCES chat_webhooks(id) ON DELETE CASCADE,
    template_mode VARCHAR(50) DEFAULT 'compact',
    custom_template TEXT,
    filters JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rules_tenant(tenant_id),
    INDEX idx_rules_active(tenant_id, enabled),
    INDEX idx_rules_event(tenant_id, event_type),
    INDEX idx_rules_filters USING GIN (filters)
);
```

#### logs
```sql
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES rules(id) ON DELETE SET NULL,
    webhook_id INTEGER REFERENCES chat_webhooks(id) ON DELETE SET NULL,
    event_type VARCHAR(100),
    status VARCHAR(50) NOT NULL, -- 'delivered', 'failed', 'pending'
    message TEXT,
    error_details TEXT,
    response_time INTEGER, -- milliseconds
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_logs_tenant_timestamp(tenant_id, timestamp),
    INDEX idx_logs_status(tenant_id, status),
    INDEX idx_logs_rule(rule_id),
    INDEX idx_logs_webhook(webhook_id)
);
```

### Advanced Tables

#### quiet_hours
```sql
CREATE TABLE quiet_hours (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    days_of_week INTEGER[] DEFAULT '{1,2,3,4,5}', -- Monday-Friday
    override_urgent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id)
);
```

#### stalled_deal_settings
```sql
CREATE TABLE stalled_deal_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    warning_threshold_days INTEGER DEFAULT 3,
    stale_threshold_days INTEGER DEFAULT 7,
    critical_threshold_days INTEGER DEFAULT 14,
    alert_webhook_id INTEGER REFERENCES chat_webhooks(id),
    schedule_time TIME DEFAULT '09:00:00',
    summary_frequency VARCHAR(20) DEFAULT 'daily',
    min_deal_value DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id)
);
```

### Data Retention & Cleanup

#### Automated Cleanup Jobs
```sql
-- Delete logs older than 90 days
DELETE FROM logs 
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Archive completed jobs older than 7 days
DELETE FROM bullmq_jobs 
WHERE finishedOn < NOW() - INTERVAL '7 days';
```

---

## API Reference

### Authentication

All API endpoints require JWT authentication via `Authorization: Bearer <token>` header.

#### OAuth Flow
```http
GET /api/v1/oauth/pipedrive
POST /api/v1/oauth/callback
GET /api/v1/oauth/status
```

### Admin Endpoints

#### Rules Management
```http
GET    /api/v1/admin/rules
POST   /api/v1/admin/rules
PUT    /api/v1/admin/rules/:id
DELETE /api/v1/admin/rules/:id
POST   /api/v1/admin/rules/:id/test
```

#### Webhooks Management
```http
GET    /api/v1/admin/webhooks
POST   /api/v1/admin/webhooks  
PUT    /api/v1/admin/webhooks/:id
DELETE /api/v1/admin/webhooks/:id
POST   /api/v1/admin/webhooks/:id/test
```

#### Logs & Monitoring
```http
GET /api/v1/admin/logs
GET /api/v1/monitoring/dashboard/:tenantId
GET /api/v1/monitoring/health
```

### Analytics Endpoints

#### Performance Analytics
```http
GET /api/v1/analytics/dashboard/:tenantId
GET /api/v1/analytics/rules/:tenantId
GET /api/v1/analytics/channels/:tenantId
GET /api/v1/analytics/timeline/:tenantId
GET /api/v1/analytics/summary/:tenantId
```

#### Query Parameters
- `range`: Date range (1d, 7d, 30d, 90d)
- `page`: Pagination page number
- `limit`: Results per page
- `status`: Filter by status (delivered, failed, pending)

### Webhook Processing

#### Incoming Webhooks
```http
POST /api/v1/webhook/pipedrive
```

**Payload Structure:**
```json
{
  "event": "deal.updated",
  "current": {
    "id": 123,
    "title": "ACME Corp Deal",
    "value": 25000,
    "currency": "USD",
    "stage_name": "Proposal Made",
    "owner_name": "John Smith"
  },
  "previous": {
    "stage_name": "Qualified"
  },
  "user": {
    "name": "John Smith",
    "email": "john@company.com"
  },
  "company_id": 12345
}
```

### Response Formats

#### Success Response
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Deal Won Alert",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "webhook_url",
    "message": "Invalid Google Chat webhook URL"
  },
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Rate Limiting

- **General API**: 100 requests per minute per tenant
- **Webhook Processing**: 1000 requests per minute (bursts allowed)
- **Analytics**: 50 requests per minute per tenant

Headers included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995260
```

---

## Performance Optimizations

### Frontend Optimizations

#### Bundle Optimization
- **Code Splitting**: Lazy loading reduces initial bundle size by 45%
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Images and fonts optimized for web delivery
- **CDN Delivery**: Vercel global CDN with edge caching

#### Runtime Performance
- **Memoization**: useMemo/useCallback prevent unnecessary re-renders
- **Virtual Scrolling**: Large lists render only visible items
- **Debounced Search**: API calls throttled to prevent excessive requests
- **Optimistic Updates**: UI updates immediately, syncs with server

#### Bundle Analysis
```bash
# Analyze bundle size and composition
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

Current bundle sizes (gzipped):
- Main bundle: 82.95 kB
- Vendor chunks: ~15 kB total
- Component chunks: 1-5 kB each

### Backend Optimizations

#### Database Performance
```sql
-- Optimized queries with proper indexing
EXPLAIN ANALYZE SELECT r.*, w.webhook_url 
FROM rules r 
JOIN chat_webhooks w ON r.target_webhook_id = w.id 
WHERE r.tenant_id = $1 AND r.enabled = true;

-- Query execution time: ~2ms with indexes
```

#### Connection Pooling
```javascript
// PostgreSQL connection optimization
const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if no connection available
  statement_timeout: 10000,   // Query timeout
  query_timeout: 10000        // Query timeout
});
```

#### Caching Strategy
```javascript
// Redis caching for frequently accessed data
const getCachedRules = async (tenantId) => {
  const cacheKey = `rules:${tenantId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const rules = await getRulesFromDB(tenantId);
  await redis.setex(cacheKey, 300, JSON.stringify(rules)); // 5 min cache
  return rules;
};
```

#### Background Job Optimization
```javascript
// BullMQ job processing optimization
const worker = new Worker('notifications', processNotification, {
  concurrency: 10,           // Process 10 jobs simultaneously
  removeOnComplete: 100,     // Keep last 100 completed jobs
  removeOnFail: 50,          // Keep last 50 failed jobs
  maxStalledCount: 3,        // Retry stalled jobs up to 3 times
  stalledInterval: 30000,    // Check for stalled jobs every 30s
  retryDelays: [1000, 5000, 15000] // Exponential backoff
});
```

### Monitoring Performance

#### Key Metrics
- **Response Time**: API endpoints < 200ms median
- **Throughput**: 1000+ webhooks processed per minute
- **Error Rate**: < 1% error rate across all endpoints
- **Database Performance**: Query execution < 50ms median

#### Performance Monitoring
```javascript
// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
    
    // Alert if response time > 1000ms
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});
```

---

## Security Implementation

### Authentication Security

#### JWT Security
```javascript
// Secure JWT configuration
const jwtOptions = {
  algorithm: 'HS256',
  expiresIn: '24h',
  issuer: 'pipenotify-backend',
  audience: 'pipenotify-frontend'
};

// Token refresh mechanism
const refreshToken = async (refreshTokenValue) => {
  // Validate refresh token
  const decoded = jwt.verify(refreshTokenValue, process.env.REFRESH_TOKEN_SECRET);
  
  // Generate new access token
  const newToken = jwt.sign({
    tenantId: decoded.tenantId,
    userId: decoded.userId
  }, process.env.JWT_SECRET, jwtOptions);
  
  return newToken;
};
```

#### Session Management
- **Token Expiry**: 24-hour access token lifetime
- **Refresh Tokens**: 30-day refresh token lifetime
- **Secure Storage**: HttpOnly cookies for refresh tokens
- **CSRF Protection**: SameSite cookie attributes

### Data Protection

#### Encryption at Rest
```javascript
// Database field encryption
const encrypt = (text) => {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const decrypt = (encryptedText) => {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Store encrypted webhook URLs
const storeWebhook = async (tenantId, webhookData) => {
  const encryptedUrl = encrypt(webhookData.webhook_url);
  const query = `
    INSERT INTO chat_webhooks (tenant_id, name, webhook_url, description)
    VALUES ($1, $2, $3, $4)
  `;
  await pool.query(query, [tenantId, webhookData.name, encryptedUrl, webhookData.description]);
};
```

#### Input Validation & Sanitization
```javascript
// Comprehensive input validation
const validateWebhookData = (data) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    webhook_url: Joi.string().uri().pattern(/chat\.googleapis\.com/).required(),
    description: Joi.string().trim().max(1000).optional()
  });
  
  const { error, value } = schema.validate(data);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }
  return value;
};

// SQL injection prevention
const getRules = async (tenantId, filters) => {
  // Use parameterized queries
  const query = `
    SELECT * FROM rules 
    WHERE tenant_id = $1 
    AND ($2::text IS NULL OR event_type = $2)
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [tenantId, filters.eventType]);
  return result.rows;
};
```

### Network Security

#### HTTPS Enforcement
```javascript
// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

#### CORS Configuration
```javascript
const allowedOrigins = [
  'http://localhost:3000',    // Development
  'https://pipenotify.vercel.app', // Production frontend
  process.env.FRONTEND_URL    // Dynamic production URL
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook-specific rate limiting
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 webhook requests per minute
  skip: (req) => req.path !== '/api/v1/webhook/pipedrive'
});

app.use('/api/', apiLimiter);
app.use('/api/v1/webhook/', webhookLimiter);
```

### Security Headers

#### Helmet.js Configuration
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));
```

### Audit & Compliance

#### Audit Logging
```javascript
// Comprehensive audit trail
const auditLog = async (action, tenantId, userId, details) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    tenant_id: tenantId,
    user_id: userId,
    details: JSON.stringify(details),
    ip_address: req.ip,
    user_agent: req.get('User-Agent')
  };
  
  await pool.query(
    'INSERT INTO audit_logs (timestamp, action, tenant_id, user_id, details, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [logEntry.timestamp, logEntry.action, logEntry.tenant_id, logEntry.user_id, logEntry.details, logEntry.ip_address, logEntry.user_agent]
  );
};

// Usage in endpoints
app.delete('/api/v1/admin/rules/:id', async (req, res) => {
  const ruleId = req.params.id;
  const tenantId = req.tenant.id;
  
  // Delete rule
  await deleteRule(tenantId, ruleId);
  
  // Audit log
  await auditLog('DELETE_RULE', tenantId, req.tenant.userId, { ruleId });
  
  res.json({ success: true });
});
```

---

## Deployment Guide

### Environment Configuration

#### Production Environment Variables
```bash
# Application
NODE_ENV=production
PORT=3001
JWT_SECRET=<secure-random-string>
ENCRYPTION_KEY=<32-byte-encryption-key>

# Database
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_SSL=true

# Redis (for jobs and caching)
REDIS_URL=redis://user:password@host:port
REDIS_TLS=true

# External Services
PIPEDRIVE_CLIENT_ID=<pipedrive-app-client-id>
PIPEDRIVE_CLIENT_SECRET=<pipedrive-app-client-secret>

# Monitoring
SENTRY_DSN=<sentry-error-tracking-dsn>

# Frontend
FRONTEND_URL=https://pipenotify.vercel.app
CORS_ORIGINS=https://pipenotify.vercel.app,https://app.pipenotify.com
```

### Railway Deployment

#### Backend Deployment
```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[networking]
externalPort = 443
internalPort = 3001
```

#### Database Setup
```bash
# Run migrations on deployment
npm run migrate

# Create indexes for performance
npm run create-indexes

# Seed initial data if needed
npm run seed
```

### Vercel Deployment

#### Frontend Configuration
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "headers": {
        "cache-control": "public, max-age=31536000, immutable"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "REACT_APP_API_URL": "https://pipenotify-backend.railway.app"
  }
}
```

#### Build Optimization
```json
{
  "scripts": {
    "build": "CI=false react-scripts build",
    "vercel-build": "CI=false react-scripts build"
  }
}
```

### Monitoring Setup

#### Health Checks
```javascript
// Backend health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await pool.query('SELECT 1');
    
    // Check Redis connectivity
    await redis.ping();
    
    // Check external service connectivity
    const pipedriveStatus = await checkPipedriveAPI();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        pipedrive: pipedriveStatus ? 'connected' : 'degraded'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

#### Uptime Monitoring
```bash
# Setup external monitoring (e.g., Pingdom, StatusCake)
# Monitor these endpoints:
- https://pipenotify-backend.railway.app/health
- https://pipenotify.vercel.app (frontend)

# Alert thresholds:
- Response time > 5 seconds
- Uptime < 99.9%
- Error rate > 1%
```

### Backup & Recovery

#### Database Backups
```bash
# Automated daily backups (Railway handles this)
# Manual backup for critical changes
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql $DATABASE_URL < backup_file.sql
```

#### Code Deployment Rollback
```bash
# Railway rollback to previous deployment
railway rollback

# Vercel rollback to previous deployment
vercel rollback <deployment-url>
```

---

## Monitoring & Logging

### Application Monitoring

#### Performance Metrics
```javascript
// Custom metrics collection
const collectMetrics = () => {
  const metrics = {
    activeConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingConnections: pool.waitingCount,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  
  // Send to monitoring service
  console.log('METRICS', JSON.stringify(metrics));
};

// Collect metrics every 60 seconds
setInterval(collectMetrics, 60000);
```

#### Error Tracking
```javascript
// Sentry integration for error tracking
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request) {
      delete event.request.headers.authorization;
    }
    return event;
  }
});

// Custom error capture with context
const captureError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    scope.setContext('custom', context);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
};
```

### Business Metrics

#### Notification Analytics
```javascript
// Track notification success rates
const trackNotificationMetrics = async () => {
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'delivered') as successful,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      AVG(response_time) as avg_response_time
    FROM logs 
    WHERE timestamp >= NOW() - INTERVAL '1 hour'
  `;
  
  const result = await pool.query(query);
  const metrics = result.rows[0];
  
  console.log('NOTIFICATION_METRICS', JSON.stringify({
    total: parseInt(metrics.total),
    successful: parseInt(metrics.successful),
    failed: parseInt(metrics.failed),
    success_rate: metrics.total > 0 ? (metrics.successful / metrics.total) * 100 : 0,
    avg_response_time: Math.round(metrics.avg_response_time || 0)
  }));
};

// Run every 5 minutes
setInterval(trackNotificationMetrics, 5 * 60 * 1000);
```

### Log Management

#### Structured Logging
```javascript
// Winston logger configuration
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pipenotify-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Usage
logger.info('Notification processed', {
  tenantId: '12345',
  ruleId: '67890',
  webhookId: 'abc123',
  responseTime: 250,
  status: 'delivered'
});
```

#### Log Aggregation
```bash
# Railway automatically aggregates logs
# Access via Railway dashboard or CLI:
railway logs --tail

# Filter logs by service:
railway logs --service backend

# Filter by time:
railway logs --since 1h
```

### Alerting

#### Critical Alerts
```javascript
// Alert on high error rates
const checkErrorRate = async () => {
  const query = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COUNT(*) as total_count
    FROM logs 
    WHERE timestamp >= NOW() - INTERVAL '5 minutes'
  `;
  
  const result = await pool.query(query);
  const { failed_count, total_count } = result.rows[0];
  
  if (total_count > 10 && (failed_count / total_count) > 0.1) {
    // Error rate > 10% with significant volume
    await sendAlert('HIGH_ERROR_RATE', {
      error_rate: (failed_count / total_count) * 100,
      failed_count,
      total_count
    });
  }
};

// Check every minute
setInterval(checkErrorRate, 60 * 1000);
```

#### Alert Channels
- **Email**: Critical errors and downtime
- **Slack/Teams**: Performance degradation and warnings
- **PagerDuty**: Production outages requiring immediate response

---

## Development Workflow

### Local Development Setup

#### Prerequisites
```bash
# Required software
- Node.js 18+
- PostgreSQL 15+
- Redis 6+
- Git

# Clone repository
git clone https://github.com/your-org/pipenotify.git
cd pipenotify
```

#### Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with local database credentials

# Setup database
createdb pipenotify_dev
npm run migrate

# Start development server
npm run dev
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with local API URL

# Start development server
npm start
```

### Testing Strategy

#### Backend Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# API testing
npm run test:api

# Load testing
npm run test:load
```

#### Frontend Testing
```bash
# Component tests
npm test

# E2E tests with Playwright
npm run test:e2e

# Visual regression tests
npm run test:visual
```

#### Test Coverage
```bash
# Generate coverage report
npm run test:coverage

# Coverage requirements:
# - Unit tests: >80% coverage
# - Integration tests: >70% coverage
# - E2E tests: Critical user flows
```

### Code Quality

#### Linting & Formatting
```bash
# Backend linting
npm run lint
npm run lint:fix

# Frontend linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
```

#### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm test"
    }
  },
  "lint-staged": {
    "*.{js,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### Git Workflow

#### Branch Strategy
```bash
# Main branches
main          # Production-ready code
develop       # Integration branch
feature/*     # Feature development
hotfix/*      # Critical production fixes
release/*     # Release preparation
```

#### Commit Messages
```bash
# Format: type(scope): description
feat(analytics): add performance dashboard
fix(webhooks): resolve delivery timeout issues
docs(api): update endpoint documentation
refactor(auth): improve JWT validation logic
test(rules): add comprehensive rule filtering tests
```

### Deployment Pipeline

#### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run test:integration

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Railway
        run: railway up --service backend

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        run: vercel --prod
```

#### Release Process
1. **Feature Development**: Create feature branch from develop
2. **Testing**: Comprehensive testing on feature branch
3. **Code Review**: Pull request review and approval
4. **Integration**: Merge to develop branch
5. **Release Preparation**: Create release branch, version bump
6. **Production Deployment**: Merge to main, automatic deployment
7. **Monitoring**: Post-deployment monitoring and verification

---

*This technical documentation covers the complete architecture, implementation details, and operational procedures for Pipenotify. For user-facing documentation, see the User Guide.*

*Last updated: December 2024*