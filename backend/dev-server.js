const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:3000', 'https://pipenotify-frontend.vercel.app'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'pipenotify-backend-dev'
  });
});

// Mock analytics endpoints
app.get('/api/v1/analytics/metrics', (req, res) => {
  res.json({
    data: {
      totalNotifications: 1234,
      successfulNotifications: 1222,
      failedNotifications: 12,
      successRate: 98.5,
      avgResponseTime: 145
    }
  });
});

app.get('/api/v1/analytics/timeseries', (req, res) => {
  const now = new Date();
  const data = [];
  
  // Generate 30 days of mock data
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    data.push({
      timestamp: date.toISOString(),
      success: Math.floor(Math.random() * 80) + 20,
      failure: Math.floor(Math.random() * 10) + 2,
      responseTime: Math.floor(Math.random() * 200) + 100
    });
  }
  
  res.json({ data });
});

app.get('/api/v1/analytics/channels', (req, res) => {
  res.json({
    data: [
      { channelName: 'Sales Team Chat', successCount: 456, failureCount: 4, avgResponseTime: 120 },
      { channelName: 'Executive Dashboard', successCount: 234, failureCount: 6, avgResponseTime: 135 },
      { channelName: 'Customer Success', successCount: 123, failureCount: 2, avgResponseTime: 110 },
      { channelName: 'Marketing Alerts', successCount: 89, failureCount: 3, avgResponseTime: 145 },
      { channelName: 'Finance Notifications', successCount: 67, failureCount: 1, avgResponseTime: 98 }
    ]
  });
});

app.get('/api/v1/analytics/rules', (req, res) => {
  res.json({
    data: [
      { id: '1', name: 'Deal Won Notifications', totalTriggers: 45, successCount: 45, failureCount: 0, successRate: 100, avgResponseTime: 120 },
      { id: '2', name: 'High Value Deal Alerts', totalTriggers: 23, successCount: 23, failureCount: 0, successRate: 98.7, avgResponseTime: 135 },
      { id: '3', name: 'Stage Changes', totalTriggers: 156, successCount: 152, failureCount: 4, successRate: 97.5, avgResponseTime: 145 },
      { id: '4', name: 'Overdue Deal Reminders', totalTriggers: 34, successCount: 33, failureCount: 1, successRate: 95.8, avgResponseTime: 110 },
      { id: '5', name: 'New Lead Notifications', totalTriggers: 89, successCount: 88, failureCount: 1, successRate: 99.2, avgResponseTime: 125 },
      { id: '6', name: 'Deal Lost Analysis', totalTriggers: 12, successCount: 12, failureCount: 0, successRate: 100, avgResponseTime: 105 },
      { id: '7', name: 'Activity Summaries', totalTriggers: 67, successCount: 66, failureCount: 1, successRate: 98.1, avgResponseTime: 140 },
      { id: '8', name: 'Pipeline Reports', totalTriggers: 45, successCount: 44, failureCount: 1, successRate: 96.9, avgResponseTime: 130 }
    ]
  });
});

// Additional mock endpoints to prevent 404s
app.get('/api/v1/admin/webhooks', (req, res) => {
  res.json([]);
});

app.get('/api/v1/oauth/profile', (req, res) => {
  res.json({ user: { name: 'Demo User', email: 'demo@example.com' } });
});

app.get('/api/v1/billing/features/:id', (req, res) => {
  res.json({ basic_analytics: true, advanced_analytics: true });
});

app.post('/api/v1/admin/timezone/save', (req, res) => {
  res.json({ success: true });
});

app.get('/api/v1/admin/logs', (req, res) => {
  res.json({ logs: [], total: 0, page: 1 });
});

app.get('/api/v1/monitoring/dashboard/:id', (req, res) => {
  res.json({ status: 'healthy', metrics: {} });
});

app.get('/api/v1/admin/rules', (req, res) => {
  res.json([]);
});

app.get('/api/v1/admin/stalled-deals/stats', (req, res) => {
  res.json({ total: 0, overdue: 0 });
});

app.get('/api/v1/admin/stalled-deals/settings', (req, res) => {
  res.json({ enabled: false });
});

app.get('/api/v1/settings/quiet-hours', (req, res) => {
  res.json({ enabled: false, startTime: '22:00', endTime: '08:00' });
});

app.get('/api/v1/settings/quiet-hours/status', (req, res) => {
  res.json({ isQuietTime: false });
});

// Catch all 404s
app.use((req, res) => {
  console.log(`❌ 404 NOT FOUND: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Analytics: http://localhost:${PORT}/api/v1/analytics/metrics`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;