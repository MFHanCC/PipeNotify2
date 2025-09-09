const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock BullMQ to prevent Redis connection during tests
jest.mock('bullmq', () => ({
  Queue: class MockQueue {
    constructor() {}
    add() { return Promise.resolve({ id: 'mock-job-123' }); }
    close() { return Promise.resolve(); }
    on() {} // Add event listener mock
    getWaiting() { return Promise.resolve([]); }
    getActive() { return Promise.resolve([]); }
    getCompleted() { return Promise.resolve([]); }
    getFailed() { return Promise.resolve([]); }
  },
  Worker: class MockWorker {
    constructor() {}
    on() {}
    close() { return Promise.resolve(); }
  }
}));

// Mock database service to return test data
jest.mock('../services/database', () => ({
  getRulesForEvent: jest.fn().mockResolvedValue([]),
  createLog: jest.fn().mockResolvedValue({}),
  getTenantByPipedriveCompanyId: jest.fn().mockResolvedValue({ id: 1 }),
  getAllRules: jest.fn().mockResolvedValue({ rules: [], total: 0 }),
  createRule: jest.fn().mockResolvedValue({ id: 1, name: 'Test Rule', event_type: 'deal.won', enabled: true }),
  updateRule: jest.fn().mockResolvedValue({}),
  deleteRule: jest.fn().mockResolvedValue({}),
  getLogs: jest.fn().mockResolvedValue({ logs: [], total: 0, has_more: false }),
  getDashboardStats: jest.fn().mockResolvedValue({ totalNotifications: 0, successRate: 0, activeRules: 0, avgDeliveryTime: 0, last24Hours: {} }),
  getChatWebhooks: jest.fn().mockResolvedValue([]),
  createChatWebhook: jest.fn().mockResolvedValue({ id: 1 }),
  validateWebhook: jest.fn().mockResolvedValue({ valid: true })
}));

// Mock chat client
jest.mock('../services/chatClient', () => ({
  defaultChatClient: {
    sendNotification: jest.fn().mockResolvedValue({ messageId: 'test-123' })
  }
}));

// Set up environment variables for testing
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const app = require('../server');

// Helper function to generate test JWT tokens
function generateTestToken(payload = {}) {
  const defaultPayload = {
    id: 1,
    tenantId: 1,
    pipedriveUserId: 12345,
    apiDomain: 'test-company',
    ...payload
  };
  return jwt.sign(defaultPayload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

describe('Webhook Routes', () => {
  describe('POST /api/v1/webhook/pipedrive', () => {
    it('should accept valid Pipedrive webhook', async () => {
      const webhookPayload = {
        event: 'deal.updated',
        object: {
          id: 123,
          type: 'deal',
          name: 'Test Deal',
          value: 5000,
          currency: 'USD'
        },
        user_id: 456,
        company_id: 789,
        timestamp: '2025-01-01T12:00:00Z'
      };

      const response = await request(app)
        .post('/api/v1/webhook/pipedrive')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Webhook received successfully');
      expect(response.body).toHaveProperty('event', 'deal.updated');
      expect(response.body).toHaveProperty('status', 'queued');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should reject webhook with missing required fields', async () => {
      const invalidPayload = {
        user_id: 456
        // Missing event and object
      };

      const response = await request(app)
        .post('/api/v1/webhook/pipedrive')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid webhook payload');
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should handle webhook processing errors gracefully', async () => {
      const malformedPayload = null;

      const response = await request(app)
        .post('/api/v1/webhook/pipedrive')
        .send(malformedPayload)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Webhook processing failed');
    });
  });

  describe('GET /api/v1/webhook/health', () => {
    it('should return webhook health status', async () => {
      const response = await request(app)
        .get('/api/v1/webhook/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('endpoint', 'webhook');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

describe('Admin Routes', () => {
  describe('GET /api/v1/admin/rules', () => {
    it('should return rules list', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/v1/admin/rules')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('rules');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('has_more');
      expect(Array.isArray(response.body.rules)).toBe(true);
    });
  });

  describe('POST /api/v1/admin/rules', () => {
    it('should create new rule with valid data', async () => {
      const ruleData = {
        name: 'Test Rule',
        event_type: 'deal.won',
        target_webhook_id: 1,
        template_mode: 'detailed',
        filters: { stage_id: [1, 2, 3] }
      };

      const token = generateTestToken();
      const response = await request(app)
        .post('/api/v1/admin/rules')
        .set('Authorization', `Bearer ${token}`)
        .send(ruleData)
        .expect(201);

      // The createRule endpoint returns the created rule directly
      expect(response.body.rule).toHaveProperty('name', 'Test Rule');
      expect(response.body.rule).toHaveProperty('event_type', 'deal.won');
      expect(response.body.rule).toHaveProperty('enabled', true);
    });

    it('should reject rule creation with missing required fields', async () => {
      const incompleteRuleData = {
        name: 'Incomplete Rule'
        // Missing event_type and target_webhook_id
      };

      const token = generateTestToken();
      const response = await request(app)
        .post('/api/v1/admin/rules')
        .set('Authorization', `Bearer ${token}`)
        .send(incompleteRuleData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
      expect(response.body).toHaveProperty('required');
      expect(response.body.required).toContain('event_type');
      expect(response.body.required).toContain('target_webhook_id');
    });
  });

  describe('GET /api/v1/admin/logs', () => {
    it('should return logs with pagination', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/v1/admin/logs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('has_more');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should accept pagination parameters', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/v1/admin/logs?page=2&limit=25')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('has_more');
    });

    it('should accept rule_id filter', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/v1/admin/logs?rule_id=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      // In a real implementation, we'd verify the logs are filtered by rule_id
    });
  });

  describe('GET /api/v1/admin/stats', () => {
    it('should return dashboard statistics', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalNotifications');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('activeRules');
      expect(response.body).toHaveProperty('avgDeliveryTime');
      expect(response.body).toHaveProperty('last24Hours');
      
      expect(typeof response.body.totalNotifications).toBe('number');
      expect(typeof response.body.successRate).toBe('number');
      expect(typeof response.body.activeRules).toBe('number');
    });
  });
});

describe('Core API Routes', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'pipenotify-backend');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/v1/status', () => {
    it('should return API status and features', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Pipenotify Backend API v1');
      expect(response.body).toHaveProperty('status', 'operational');
      expect(response.body).toHaveProperty('features');
      expect(Array.isArray(response.body.features)).toBe(true);
      expect(response.body.features).toContain('OAuth 2.0 Authentication');
      expect(response.body.features).toContain('Google Chat Integration');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body.message).toContain('/non-existent-route not found');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

describe('CORS Configuration', () => {
  it('should allow requests from localhost:3000', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    // The request should succeed (CORS allows it)
    expect(response.body.status).toBe('healthy');
  });

  it('should handle preflight OPTIONS requests', async () => {
    const response = await request(app)
      .options('/api/v1/admin/rules')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type')
      .expect(204);

    // Check CORS headers are present
    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });
});