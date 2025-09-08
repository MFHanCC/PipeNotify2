# Backend Structure Document

This document outlines the backend architecture, hosting setup, and infrastructure components for the Pipedrive → Google Chat integration app. It's written in clear, everyday language so anyone can understand how the backend works.

## 1. Backend Architecture

Overall, our backend is a stateless web service built with Node.js and Express.js. We follow a simple modular pattern:

- **Express routes** handle incoming HTTP requests and direct them to controller functions.  
- **Services** contain the core business logic (for example, processing Pipedrive webhooks and dispatching Google Chat notifications).  
- **Data access layer** interacts with the PostgreSQL database.  
- **Job queue (BullMQ)** handles retries and background tasks, such as forwarding messages to Chat or cleaning up old logs.

How this supports our goals:

- **Scalability**: Each component is stateless, so we can run multiple instances behind a load balancer. The job queue scales independently.  
- **Maintainability**: Clear separation of concerns lets developers work on routes, services, or data layers without conflicting with each other.  
- **Performance**: Lightweight Express server with Redis-backed queue ensures low latency (&lt;10s) for notifications.

## 2. Database Management

We use PostgreSQL, a reliable SQL database, to store all our data. Key points:

- **Type**: Relational (SQL) database.  
- **Hosting**: Managed PostgreSQL on Railway.  
- **Data structures**: Tables for users (tenants), Pipedrive connections, Chat webhooks, rules, logs, and subscription plans.  
- **Access**: We use a standard Node.js PostgreSQL client (e.g., `pg` library) with parameterized queries to prevent SQL injection.

Best practices:

- Connections are pooled for efficiency.  
- Sensitive fields (like webhook URLs and API tokens) are encrypted at rest by the host.  
- We enforce a 90-day retention policy on logs with a scheduled cleanup job.

## 3. Database Schema

Below is a high-level, human-readable description of our main tables, followed by SQL table definitions for PostgreSQL.

### Human-Readable Schema

- **Tenants**: Represents each customer (Pipedrive account) using the app.  
  Fields: Tenant ID, company name, creation date.

- **PipedriveConnections**: Stores the API token for each tenant.  
  Fields: Connection ID, Tenant ID, API token (encrypted), date connected.

- **ChatWebhooks**: Holds Google Chat space webhook URLs.  
  Fields: Webhook ID, Tenant ID, name (e.g., `#sales-wins`), webhook URL (encrypted), creation date.

- **Rules**: Defines which events to listen for and where to send them.  
  Fields: Rule ID, Tenant ID, name, event type (Deal Won, Stage Changed, etc.), filters (pipeline, stage, owner, min deal value), target Webhook ID, template mode (compact/detailed), enabled flag, timestamps.

- **Logs**: Records each notification attempt.  
  Fields: Log ID, Tenant ID, Rule ID, event payload (JSON), status (success/failure), error message (if any), timestamp.

- **Subscriptions**: Tracks subscription plans per tenant.  
  Fields: Subscription ID, Tenant ID, plan type (Professional/Enterprise), start date, end date, status.

### PostgreSQL Table Definitions

```sql
-- Tenants
DROP TABLE IF EXISTS tenants CASCADE;
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PipedriveConnections
DROP TABLE IF EXISTS pipedrive_connections CASCADE;
CREATE TABLE pipedrive_connections (
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  api_token TEXT NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ChatWebhooks
DROP TABLE IF EXISTS chat_webhooks CASCADE;
CREATE TABLE chat_webhooks (
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rules
DROP TABLE IF EXISTS rules CASCADE;
CREATE TABLE rules (
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  filters JSONB NOT NULL,
  target_webhook_id INT REFERENCES chat_webhooks(id),
  template_mode TEXT CHECK (template_mode IN ('compact','detailed')),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs
DROP TABLE IF EXISTS logs CASCADE;
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id INT REFERENCES rules(id),
  payload JSONB NOT NULL,
  status TEXT CHECK (status IN ('success','failure')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
DROP TABLE IF EXISTS subscriptions CASCADE;
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('Professional','Enterprise')),
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT CHECK (status IN ('active','cancelled','expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. API Design and Endpoints

We use RESTful endpoints in Express.js. All endpoints require a valid API token (for the tenant) or a signature (for webhooks).

- **POST /connect/pipedrive**  
  Purpose: Store a tenant's Pipedrive API token.  
  Body: `{ apiToken: string }`.  
  Response: Success or error.

- **POST /webhook/pipedrive**  
  Purpose: Receive real-time Pipedrive events.  
  Headers: HMAC signature for verification.  
  Body: Pipedrive payload.  
  Action: Enqueue job to process event and route to matching rules.

- **GET /rules**  
  Purpose: List all rules for the tenant.  

- **POST /rules**  
  Purpose: Create a new rule.  
  Body: Rule details (event type, filters, target webhook, template mode).

- **PUT /rules/:id**  
  Purpose: Update an existing rule.  
  Body: Updated fields.

- **DELETE /rules/:id**  
  Purpose: Remove a rule.

- **POST /test**  
  Purpose: Trigger a test notification against a specific rule or webhook.  
  Body: `{ ruleId: number }` or payload.

- **GET /logs**  
  Purpose: Fetch recent logs with optional filters (status, date range, rule).

- **GET /health**  
  Purpose: Service health check for uptime monitors.

## 5. Hosting Solutions

We host on **Railway**, a managed cloud platform that handles our backend infrastructure including the Node.js app, PostgreSQL database, and Redis.

Benefits:

- **Reliability**: Automated backups, database failover, and SLA-backed uptime.  
- **Scalability**: Vertical scaling (CPU/RAM) or horizontal scaling (multiple service instances) on demand.  
- **Cost-Effectiveness**: Pay-as-you-go pricing with easy resource adjustments.
- **Integrated Services**: PostgreSQL and Redis are managed alongside the application with automatic environment variable provisioning.

## 6. Infrastructure Components

- **Load Balancer** (provided by Railway): Distributes incoming HTTP traffic across app instances.  
- **Redis**: Back-end for BullMQ, used to queue and retry notification jobs.  
- **BullMQ Job Queue**: Manages background tasks (webhook forwarding, log cleanup).  
- **Sentry**: Tracks exceptions and performance issues in real time.

Together, these components ensure fast response times and reliable background processing.

## 7. Security Measures

- **TLS Everywhere**: All inbound and outbound traffic is encrypted with HTTPS.  
- **Authentication &amp; Authorization**:  
  • API token stored per tenant for Pipedrive.  
  • Each request checks the token or webhook signature before proceeding.  
- **Data Encryption**: Secrets (API tokens, webhook URLs) are encrypted at rest by the host.  
- **Webhook Validation**: We verify Pipedrive request signatures to ensure legitimacy.  
- **Tenant Isolation**: All data queries include a tenant ID to prevent cross-tenant data access.  
- **CORS Configuration**: Strict CORS policy allowing only specified frontend origins (Vercel domains).
- **Rate Limiting &amp; Backoff**: To respect Pipedrive and Google Chat quotas, we implement exponential backoff and per-space queueing.

### CORS Configuration

```javascript
// backend/server.js - CORS setup for Vercel frontend
const cors = require('cors');

const allowedOrigins = [
  'http://localhost:3000', // Development frontend
  'https://your-app.vercel.app', // Production Vercel deployment
  process.env.FRONTEND_URL, // Dynamic production URL from environment
  'https://*.vercel.app' // Vercel preview deployments (if needed)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.some(allowed => 
      origin === allowed || (allowed.includes('*') && origin.includes('vercel.app'))
    )) {
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

## 8. Monitoring and Maintenance

- **Error Tracking**: Sentry captures exceptions, stack traces, and performance metrics from the Railway-hosted backend.  
- **Uptime Monitoring**: External health checks on `/health` endpoint ensure 99.9% availability.  
- **Logging**: All notification attempts are logged for 90 days; a nightly cleanup job purges older entries.  
- **Routine Maintenance**:  
  • Database migrations managed via versioned scripts deployed through Railway.  
  • Dependencies updated regularly and security patches applied via automated deployments.  
  • Automated backups of the PostgreSQL database managed by Railway.

## 9. Integration with Frontend

The backend is designed to work seamlessly with the Vercel-hosted React frontend:

- **API Communication**: Frontend makes requests to Railway backend URL via configured environment variables.
- **CORS Handling**: Backend specifically allows Vercel domains while blocking unauthorized origins.
- **Environment Separation**: Development uses localhost, production uses Railway public URL.
- **Error Handling**: Unified error responses that work well with frontend error boundaries and user feedback.

## 10. Conclusion and Overall Backend Summary

In summary, our backend is a modular, stateless Node.js service using Express.js hosted on Railway. It relies on PostgreSQL for structured data and Redis/BullMQ for background jobs. By hosting on Railway, we gain reliable, scalable infrastructure with built-in load balancing, database management, and service orchestration. The backend is optimally configured to work with our Vercel-hosted frontend through proper CORS configuration and environment management.

Robust security measures (TLS, token validation, data encryption, CORS restrictions) keep customer data safe, while Sentry and health checks ensure we meet our uptime and performance goals. This setup aligns perfectly with our project's mission: delivering real-time, rule-based Pipedrive event notifications to Google Chat with minimal latency, maximum reliability, and optimal cost-effectiveness through the Railway + Vercel architecture.