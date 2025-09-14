# Pipenotify API Reference

**Complete API documentation for developers and integrators**

---

## Table of Contents

1. [Authentication](#authentication)
2. [Base URLs & Environments](#base-urls--environments)
3. [Request/Response Format](#requestresponse-format)
4. [Rate Limiting](#rate-limiting)
5. [Admin Endpoints](#admin-endpoints)
6. [Analytics Endpoints](#analytics-endpoints)
7. [Webhook Endpoints](#webhook-endpoints)
8. [OAuth Endpoints](#oauth-endpoints)
9. [Error Handling](#error-handling)
10. [SDKs & Examples](#sdks--examples)

---

## Authentication

### JWT Bearer Token

All API requests require authentication via JWT Bearer token in the Authorization header.

```http
Authorization: Bearer <jwt_token>
```

### Token Structure

```json
{
  "tenantId": "12345",
  "userId": "user_abc",
  "email": "user@company.com",
  "scopes": ["read:rules", "write:rules", "admin:webhooks"],
  "iat": 1640995200,
  "exp": 1641081600
}
```

### Token Lifecycle

- **Access Token**: 24 hours
- **Refresh Token**: 30 days (stored in secure HttpOnly cookie)
- **Auto-refresh**: Frontend automatically refreshes tokens

### Obtaining Tokens

Tokens are obtained through the OAuth flow with Pipedrive:

```http
GET /api/v1/oauth/pipedrive
```

---

## Base URLs & Environments

### Production
```
Frontend: https://pipenotify.vercel.app
Backend:  https://pipenotify-backend.railway.app
```

### Development
```
Frontend: http://localhost:3000
Backend:  http://localhost:3001
```

### API Versioning

Current API version: `v1`

All endpoints are prefixed with `/api/v1/`

---

## Request/Response Format

### Content Type

```http
Content-Type: application/json
Accept: application/json
```

### Request Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Request-ID: <unique_request_id> (optional)
```

### Success Response Format

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Example Rule",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "has_next": false
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "webhook_url",
    "message": "Invalid Google Chat webhook URL"
  },
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_123456789"
}
```

---

## Rate Limiting

### Limits by Endpoint Category

| Category | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | per minute |
| Webhook Processing | 1000 requests | per minute |
| Analytics | 50 requests | per minute |
| OAuth | 10 requests | per minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995260
X-RateLimit-Window: 60
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": "Rate limit exceeded",
  "details": {
    "limit": 100,
    "window": "60 seconds",
    "retry_after": 15
  },
  "code": "RATE_LIMIT_EXCEEDED"
}
```

---

## Admin Endpoints

### Rules Management

#### List Rules

```http
GET /api/v1/admin/rules
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `enabled` (boolean): Filter by enabled status
- `event_type` (string): Filter by event type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "High Value Deal Alert",
      "event_type": "deal.updated",
      "target_webhook_id": 456,
      "template_mode": "detailed",
      "custom_template": null,
      "filters": {
        "deal_value_min": 10000
      },
      "enabled": true,
      "priority": 0,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "webhook": {
        "id": 456,
        "name": "Sales Team Channel"
      }
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "has_next": true
  }
}
```

#### Create Rule

```http
POST /api/v1/admin/rules
```

**Request Body:**
```json
{
  "name": "New Deal Alert",
  "event_type": "deal.added",
  "target_webhook_id": 456,
  "template_mode": "compact",
  "custom_template": null,
  "filters": {
    "pipeline_id": [1, 2],
    "stage_id": [10, 11, 12],
    "owner_id": [100, 101],
    "deal_value_min": 5000,
    "deal_value_max": null
  },
  "enabled": true,
  "priority": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 124,
    "name": "New Deal Alert",
    "event_type": "deal.added",
    "target_webhook_id": 456,
    "template_mode": "compact",
    "custom_template": null,
    "filters": {
      "pipeline_id": [1, 2],
      "stage_id": [10, 11, 12],
      "owner_id": [100, 101],
      "deal_value_min": 5000
    },
    "enabled": true,
    "priority": 10,
    "created_at": "2024-01-15T10:35:00Z",
    "updated_at": "2024-01-15T10:35:00Z"
  }
}
```

#### Update Rule

```http
PUT /api/v1/admin/rules/{rule_id}
```

**Request Body:** Same as Create Rule (partial updates supported)

#### Delete Rule

```http
DELETE /api/v1/admin/rules/{rule_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": 124
  }
}
```

#### Test Rule

```http
POST /api/v1/admin/rules/{rule_id}/test
```

**Request Body:**
```json
{
  "webhook_data": {
    "event": "deal.updated",
    "current": {
      "id": 789,
      "title": "Test Deal",
      "value": 15000,
      "currency": "USD",
      "stage_name": "Proposal Made"
    }
  }
}
```

### Webhooks Management

#### List Webhooks

```http
GET /api/v1/admin/webhooks
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "name": "Sales Team Channel",
      "description": "Main sales team notifications",
      "webhook_url": "https://chat.googleapis.com/v1/spaces/...",
      "is_active": true,
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-01-10T08:00:00Z"
    }
  ],
  "meta": {
    "total": 3
  }
}
```

#### Create Webhook

```http
POST /api/v1/admin/webhooks
```

**Request Body:**
```json
{
  "name": "Management Alerts",
  "webhook_url": "https://chat.googleapis.com/v1/spaces/AAAAA/messages?key=XXXXX",
  "description": "High-priority notifications for management team",
  "is_active": true
}
```

#### Update Webhook

```http
PUT /api/v1/admin/webhooks/{webhook_id}
```

#### Delete Webhook

```http
DELETE /api/v1/admin/webhooks/{webhook_id}
```

#### Test Webhook

```http
POST /api/v1/admin/webhooks/{webhook_id}/test
```

**Response:**
```json
{
  "success": true,
  "data": {
    "test_sent": true,
    "response_time": 234,
    "status": "delivered"
  }
}
```

### Logs Management

#### List Logs

```http
GET /api/v1/admin/logs
```

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Items per page (max: 100)
- `status` (string): Filter by status (delivered, failed, pending)
- `rule_id` (integer): Filter by rule
- `webhook_id` (integer): Filter by webhook
- `start_date` (ISO 8601): Start date filter
- `end_date` (ISO 8601): End date filter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "rule_id": 123,
      "webhook_id": 456,
      "event_type": "deal.updated",
      "status": "delivered",
      "message": "Deal updated: ACME Corp Integration",
      "error_details": null,
      "response_time": 245,
      "timestamp": "2024-01-15T10:30:00Z",
      "rule": {
        "name": "High Value Deal Alert"
      },
      "webhook": {
        "name": "Sales Team Channel"
      }
    }
  ],
  "meta": {
    "total": 1500,
    "page": 1,
    "limit": 20,
    "has_next": true
  }
}
```

---

## Analytics Endpoints

### Dashboard Analytics

#### Get Comprehensive Analytics

```http
GET /api/v1/analytics/dashboard/{tenant_id}
```

**Query Parameters:**
- `range` (string): Time range (1d, 7d, 30d, 90d) - default: 7d

**Response:**
```json
{
  "success": true,
  "data": {
    "totalNotifications": 1250,
    "successRate": 97.6,
    "failureRate": 2.4,
    "avgResponseTime": 423,
    "topPerformingRules": [
      {
        "id": "rule_1",
        "name": "Deal Value > $10K Alert",
        "successCount": 145,
        "failureCount": 3,
        "successRate": 98.0
      }
    ],
    "timeSeriesData": [
      {
        "timestamp": "2024-01-14T00:00:00Z",
        "success": 98,
        "failure": 2,
        "responseTime": 445
      }
    ],
    "ruleEffectiveness": [
      {
        "ruleId": "rule_1",
        "ruleName": "Deal Value > $10K Alert",
        "triggersToday": 12,
        "successRate": 98.0,
        "avgResponseTime": 423,
        "trend": "up"
      }
    ],
    "channelPerformance": [
      {
        "channelName": "Sales Team General",
        "successCount": 234,
        "failureCount": 6,
        "avgResponseTime": 445
      }
    ]
  }
}
```

### Rule Analytics

#### Get Rule Performance

```http
GET /api/v1/analytics/rules/{tenant_id}
```

**Query Parameters:**
- `range` (string): Time range (1d, 7d, 30d, 90d)

**Response:**
```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "ruleId": 123,
        "ruleName": "High Value Deal Alert",
        "totalTriggers": 145,
        "successfulDeliveries": 142,
        "failedDeliveries": 3,
        "successRate": 97.9,
        "avgResponseTime": 423
      }
    ]
  }
}
```

### Channel Analytics

#### Get Channel Performance

```http
GET /api/v1/analytics/channels/{tenant_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "channelName": "Sales Team General",
        "totalDeliveries": 240,
        "successfulDeliveries": 234,
        "failedDeliveries": 6,
        "successRate": 97.5,
        "avgResponseTime": 445
      }
    ]
  }
}
```

### Timeline Analytics

#### Get Time-Series Data

```http
GET /api/v1/analytics/timeline/{tenant_id}
```

**Query Parameters:**
- `range` (string): Time range determines aggregation interval
  - `1d`: Hourly aggregation
  - `7d`: 6-hour aggregation  
  - `30d`, `90d`: Daily aggregation

**Response:**
```json
{
  "success": true,
  "data": {
    "timeline": [
      {
        "timestamp": "2024-01-14T00:00:00Z",
        "success": 98,
        "failure": 2,
        "responseTime": 445
      },
      {
        "timestamp": "2024-01-14T06:00:00Z",
        "success": 67,
        "failure": 1,
        "responseTime": 523
      }
    ]
  }
}
```

### Summary Analytics

#### Get Summary Statistics

```http
GET /api/v1/analytics/summary/{tenant_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalNotifications": 1250,
    "successfulDeliveries": 1220,
    "failedDeliveries": 30,
    "successRate": 97.6,
    "failureRate": 2.4,
    "avgResponseTime": 423,
    "firstNotification": "2024-01-01T10:00:00Z",
    "lastNotification": "2024-01-15T10:30:00Z",
    "dateRange": {
      "startDate": "2024-01-08T10:30:00Z",
      "endDate": "2024-01-15T10:30:00Z"
    }
  }
}
```

---

## Webhook Endpoints

### Incoming Webhooks

#### Pipedrive Webhook Handler

```http
POST /api/v1/webhook/pipedrive
```

**Headers:**
```http
Content-Type: application/json
X-Pipedrive-Signature: <hmac_signature>
```

**Request Body (Deal Updated Example):**
```json
{
  "event": "deal.updated",
  "current": {
    "id": 123,
    "title": "ACME Corp Integration",
    "value": 25000,
    "currency": "USD",
    "stage_name": "Proposal Made",
    "status": "open",
    "probability": 75,
    "expected_close_date": "2024-02-28",
    "owner_name": "John Smith",
    "add_time": "2024-01-15T10:30:00Z",
    "stage_change_time": "2024-01-15T15:20:00Z",
    "person_id": 456,
    "org_id": 789
  },
  "previous": {
    "stage_name": "Qualified",
    "value": 20000
  },
  "user": {
    "id": 100,
    "name": "John Smith",
    "email": "john@company.com"
  },
  "company_id": 12345,
  "company_domain": "company-name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": true,
    "matching_rules": 2,
    "notifications_sent": 2,
    "processing_time": 145
  }
}
```

**Webhook Verification:**

Pipedrive signs webhooks using HMAC-SHA256. Verify signatures:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Webhook Events

#### Supported Event Types

| Event Type | Description | Trigger |
|------------|-------------|---------|
| `deal.added` | New deal created | When deal is added to Pipedrive |
| `deal.updated` | Deal information changed | When deal fields are modified |
| `deal.stage_changed` | Deal moved between stages | When deal stage changes |
| `deal.won` | Deal marked as won | When deal status becomes "won" |
| `deal.lost` | Deal marked as lost | When deal status becomes "lost" |
| `deal.deleted` | Deal removed | When deal is deleted |
| `person.added` | New contact created | When person is added |
| `person.updated` | Contact information changed | When person fields are modified |
| `person.deleted` | Contact removed | When person is deleted |
| `organization.added` | New organization created | When organization is added |
| `organization.updated` | Organization information changed | When organization fields are modified |
| `activity.added` | New activity scheduled | When activity is created |
| `activity.updated` | Activity information changed | When activity is modified |

---

## OAuth Endpoints

### Pipedrive OAuth Flow

#### Initiate OAuth

```http
GET /api/v1/oauth/pipedrive
```

**Response:**
```http
HTTP/1.1 302 Found
Location: https://oauth.pipedrive.com/oauth/authorize?client_id=...&redirect_uri=...&scope=...
```

#### OAuth Callback

```http
POST /api/v1/oauth/callback
```

**Request Body:**
```json
{
  "code": "authorization_code_from_pipedrive",
  "state": "csrf_protection_state"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "jwt_access_token",
    "expires_in": 86400,
    "user": {
      "id": "user_123",
      "email": "user@company.com",
      "tenant_id": "12345"
    }
  }
}
```

#### Check OAuth Status

```http
GET /api/v1/oauth/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "company_domain": "company-name",
    "user_id": 100,
    "expires_at": "2024-02-15T10:30:00Z",
    "scopes": ["deals:read", "activities:read", "persons:read"]
  }
}
```

#### Disconnect OAuth

```http
DELETE /api/v1/oauth/pipedrive
```

**Response:**
```json
{
  "success": true,
  "data": {
    "disconnected": true
  }
}
```

---

## Error Handling

### Error Categories

#### Validation Errors (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "webhook_url",
    "message": "Must be a valid Google Chat webhook URL",
    "code": "INVALID_WEBHOOK_URL"
  },
  "code": "VALIDATION_ERROR"
}
```

#### Authentication Errors (401)
```json
{
  "success": false,
  "error": "Authentication required",
  "details": {
    "message": "Invalid or expired JWT token"
  },
  "code": "AUTH_TOKEN_INVALID"
}
```

#### Authorization Errors (403)
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "details": {
    "required_scope": "admin:webhooks",
    "user_scopes": ["read:rules", "write:rules"]
  },
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

#### Not Found Errors (404)
```json
{
  "success": false,
  "error": "Resource not found",
  "details": {
    "resource": "rule",
    "id": 999
  },
  "code": "RESOURCE_NOT_FOUND"
}
```

#### Rate Limit Errors (429)
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "details": {
    "limit": 100,
    "window": "60 seconds",
    "retry_after": 15
  },
  "code": "RATE_LIMIT_EXCEEDED"
}
```

#### Server Errors (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "details": {
    "message": "An unexpected error occurred",
    "request_id": "req_123456789"
  },
  "code": "INTERNAL_ERROR"
}
```

### Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_WEBHOOK_URL` | 400 | Webhook URL format invalid |
| `MISSING_REQUIRED_FIELD` | 400 | Required field not provided |
| `AUTH_TOKEN_MISSING` | 401 | No authentication token provided |
| `AUTH_TOKEN_INVALID` | 401 | Token invalid or expired |
| `AUTH_TOKEN_EXPIRED` | 401 | Token has expired |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `TENANT_ACCESS_DENIED` | 403 | Cannot access this tenant's data |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `PIPEDRIVE_API_ERROR` | 502 | Pipedrive API unavailable |
| `GOOGLE_CHAT_ERROR` | 502 | Google Chat API error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## SDKs & Examples

### JavaScript/Node.js

#### Installation
```bash
npm install @pipenotify/api-client
```

#### Basic Usage
```javascript
const PipenotifyClient = require('@pipenotify/api-client');

const client = new PipenotifyClient({
  baseURL: 'https://pipenotify-backend.railway.app',
  accessToken: 'your_jwt_token'
});

// List rules
const rules = await client.rules.list({
  page: 1,
  limit: 20,
  enabled: true
});

// Create rule
const newRule = await client.rules.create({
  name: 'High Value Deal Alert',
  event_type: 'deal.updated',
  target_webhook_id: 456,
  template_mode: 'detailed',
  filters: {
    deal_value_min: 10000
  },
  enabled: true
});

// Get analytics
const analytics = await client.analytics.dashboard('12345', {
  range: '7d'
});
```

### Python

#### Installation
```bash
pip install pipenotify-api
```

#### Basic Usage
```python
from pipenotify import PipenotifyClient

client = PipenotifyClient(
    base_url='https://pipenotify-backend.railway.app',
    access_token='your_jwt_token'
)

# List rules
rules = client.rules.list(page=1, limit=20, enabled=True)

# Create rule
new_rule = client.rules.create({
    'name': 'High Value Deal Alert',
    'event_type': 'deal.updated',
    'target_webhook_id': 456,
    'template_mode': 'detailed',
    'filters': {
        'deal_value_min': 10000
    },
    'enabled': True
})

# Get analytics
analytics = client.analytics.dashboard('12345', range='7d')
```

### cURL Examples

#### Authentication
```bash
# Set token as environment variable
export PIPENOTIFY_TOKEN="your_jwt_token"
```

#### List Rules
```bash
curl -X GET \
  "https://pipenotify-backend.railway.app/api/v1/admin/rules" \
  -H "Authorization: Bearer $PIPENOTIFY_TOKEN" \
  -H "Content-Type: application/json"
```

#### Create Rule
```bash
curl -X POST \
  "https://pipenotify-backend.railway.app/api/v1/admin/rules" \
  -H "Authorization: Bearer $PIPENOTIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Value Deal Alert",
    "event_type": "deal.updated",
    "target_webhook_id": 456,
    "template_mode": "detailed",
    "filters": {
      "deal_value_min": 10000
    },
    "enabled": true
  }'
```

#### Get Analytics
```bash
curl -X GET \
  "https://pipenotify-backend.railway.app/api/v1/analytics/dashboard/12345?range=7d" \
  -H "Authorization: Bearer $PIPENOTIFY_TOKEN" \
  -H "Content-Type: application/json"
```

### Webhook Testing

#### Test Webhook Delivery
```bash
curl -X POST \
  "https://pipenotify-backend.railway.app/api/v1/admin/webhooks/456/test" \
  -H "Authorization: Bearer $PIPENOTIFY_TOKEN" \
  -H "Content-Type: application/json"
```

#### Simulate Pipedrive Webhook
```bash
curl -X POST \
  "https://pipenotify-backend.railway.app/api/v1/webhook/pipedrive" \
  -H "Content-Type: application/json" \
  -H "X-Pipedrive-Signature: sha256=<signature>" \
  -d '{
    "event": "deal.updated",
    "current": {
      "id": 123,
      "title": "Test Deal",
      "value": 15000,
      "currency": "USD",
      "stage_name": "Proposal Made"
    },
    "user": {
      "id": 100,
      "name": "Test User",
      "email": "test@company.com"
    },
    "company_id": 12345
  }'
```

---

## Webhooks Integration Guide

### Setting Up Webhooks in Pipedrive

1. **Create Webhook in Pipedrive:**
   ```
   → Go to Settings → Apps & integrations → Webhooks
   → Click "Create webhook"
   → Set URL: https://pipenotify-backend.railway.app/api/v1/webhook/pipedrive
   → Select events: deal.*, person.*, activity.*
   → Set HTTP method: POST
   → Save webhook
   ```

2. **Verify Webhook Signature:**
   ```javascript
   // In your webhook handler
   const signature = req.headers['x-pipedrive-signature'];
   const isValid = verifySignature(req.body, signature, webhookSecret);
   ```

### Google Chat Webhook Setup

1. **Create Incoming Webhook in Google Chat:**
   ```
   → Open Google Chat space
   → Click space name → "Manage webhooks"
   → Click "Add webhook"
   → Name: "Pipedrive Notifications"
   → Copy webhook URL
   ```

2. **Add Webhook to Pipenotify:**
   ```bash
   curl -X POST \
     "https://pipenotify-backend.railway.app/api/v1/admin/webhooks" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{
       "name": "Sales Team Channel",
       "webhook_url": "https://chat.googleapis.com/v1/spaces/...",
       "description": "Main sales notifications"
     }'
   ```

---

*This API reference provides complete documentation for integrating with Pipenotify. For additional examples and advanced usage, see the Technical Documentation.*

*Last updated: December 2024*