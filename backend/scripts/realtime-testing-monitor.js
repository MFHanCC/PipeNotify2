const axios = require('axios');
const { execSync } = require('child_process');

class RealtimeTestingMonitor {
  constructor() {
    this.railwayUrl = 'https://pipenotify.up.railway.app';
    this.localUrl = 'http://localhost:3001';
    this.frontendUrl = 'https://pipenotify-frontend.vercel.app';
    this.chatWebhook = 'https://chat.googleapis.com/v1/spaces/AAQASsBob7E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=reMpAdFngUO-J6g9278dze05lysc8CVlb7orJAdK0zQ';
    
    this.isActive = false;
    this.testingMode = true; // Optimized for real-time testing
    this.alertThreshold = 3000; // 3 second response time alert
    this.lastHealthStatus = {};
    this.fixAttempts = 0;
    this.maxFixAttempts = 3;
  }

  async sendAlert(message, isError = false, urgent = false) {
    try {
      const icon = urgent ? '🚨' : (isError ? '⚠️' : '🔍');
      const priority = urgent ? '**URGENT**' : '';
      await axios.post(this.chatWebhook, {
        text: `${icon} ${priority} **Real-Time Testing Monitor**\n${message}\n_${new Date().toLocaleString()}_`
      });
    } catch (error) {
      console.log(`Alert failed: ${error.message}`);
    }
  }

  log(message, type = 'info', sendAlert = false) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    if (sendAlert) {
      this.sendAlert(message, type === 'error', type === 'critical');
    }
  }

  async quickHealthCheck(service, url, endpoint = '', timeout = 5000) {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${url}${endpoint}`, { timeout });
      const responseTime = Date.now() - startTime;
      
      const result = {
        service,
        status: 'healthy',
        responseTime,
        code: response.status,
        timestamp: new Date().toISOString()
      };

      // Alert if response time is slow during testing
      if (responseTime > this.alertThreshold) {
        this.log(`⚠️ ${service} slow response: ${responseTime}ms`, 'warning', true);
      }

      return result;
    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        code: error.response?.status || 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  async testOAuthEndpoint() {
    try {
      const testData = {
        code: 'test_oauth_realtime_' + Date.now(),
        state: 'testing_state'
      };

      const response = await axios.post(`${this.railwayUrl}/api/v1/oauth/callback`, testData, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/json' }
      });

      return { status: 'healthy', code: response.status, service: 'OAuth Callback' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        code: error.response?.status || 0,
        service: 'OAuth Callback'
      };
    }
  }

  async testWebhookEndpoint() {
    try {
      const testPayload = {
        event: 'updated.deal',
        object: 'deal',
        timestamp: Math.floor(Date.now() / 1000),
        company_id: 12345,
        user_id: 67890,
        current: {
          id: 99999,
          title: 'Real-time Test Deal',
          value: 10000,
          status: 'won'
        }
      };

      const response = await axios.post(`${this.railwayUrl}/api/v1/webhook/pipedrive`, testPayload, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });

      return { status: 'healthy', code: response.status, service: 'Pipedrive Webhook' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        code: error.response?.status || 0,
        service: 'Pipedrive Webhook'
      };
    }
  }

  async immediateFixRailway() {
    if (this.fixAttempts >= this.maxFixAttempts) {
      this.log('🚨 Max auto-fix attempts reached - Railway needs manual intervention', 'critical', true);
      return false;
    }

    this.fixAttempts++;
    this.log(`🔧 IMMEDIATE FIX: Railway down, triggering redeployment (${this.fixAttempts}/${this.maxFixAttempts})`, 'warning', true);

    try {
      execSync(`git commit --allow-empty -m "Real-time testing fix: Railway redeployment ${this.fixAttempts}"`, { stdio: 'pipe' });
      execSync('git push', { stdio: 'pipe' });
      
      this.log('✅ Redeployment triggered - monitoring recovery...', 'success', true);
      
      // Wait 30 seconds then check recovery
      setTimeout(() => this.checkRecovery(), 30000);
      
      return true;
    } catch (error) {
      this.log(`❌ Auto-fix failed: ${error.message}`, 'error', true);
      return false;
    }
  }

  async checkRecovery() {
    const healthCheck = await this.quickHealthCheck('Railway Recovery', this.railwayUrl, '/health');
    
    if (healthCheck.status === 'healthy') {
      this.fixAttempts = 0; // Reset on successful recovery
      this.log('🎉 Railway recovered successfully!', 'success', true);
    } else {
      this.log('⏳ Railway still recovering... will retry in 30s', 'warning', true);
      setTimeout(() => this.checkRecovery(), 30000);
    }
  }

  async runRealTimeCheck() {
    this.log('🔍 Real-time system check...', 'info');

    // Quick parallel health checks
    const checks = [
      this.quickHealthCheck('Railway', this.railwayUrl, '/health'),
      this.quickHealthCheck('Local Backend', this.localUrl, '/health'),
      this.quickHealthCheck('Frontend', this.frontendUrl),
    ];

    const results = await Promise.all(checks);
    const unhealthy = results.filter(r => r.status === 'unhealthy');
    const healthy = results.filter(r => r.status === 'healthy');

    // Immediate issue detection and fixes
    for (const issue of unhealthy) {
      if (issue.service === 'Railway') {
        if (issue.code === 404) {
          this.log('🚨 Railway completely down - triggering immediate fix', 'critical', true);
          await this.immediateFixRailway();
        } else {
          this.log(`⚠️ Railway issue: ${issue.code} - ${issue.error}`, 'error', true);
        }
      } else {
        this.log(`⚠️ ${issue.service} issue: ${issue.error}`, 'warning', true);
      }
    }

    // Test critical endpoints if Railway is healthy
    const railwayHealthy = healthy.some(r => r.service === 'Railway');
    if (railwayHealthy) {
      const oauthTest = await this.testOAuthEndpoint();
      const webhookTest = await this.testWebhookEndpoint();

      if (oauthTest.status === 'unhealthy') {
        this.log(`🚨 OAuth endpoint failed: ${oauthTest.code} - ${oauthTest.error}`, 'error', true);
      }

      if (webhookTest.status === 'unhealthy') {
        this.log(`🚨 Webhook endpoint failed: ${webhookTest.code} - ${webhookTest.error}`, 'error', true);
      }
    }

    return { healthy: healthy.length, unhealthy: unhealthy.length, total: results.length };
  }

  async startRealTimeTesting(intervalSeconds = 30) {
    this.isActive = true;
    this.log('🚀 Starting real-time testing monitor...', 'info');
    
    await this.sendAlert(`🚀 **Real-Time Testing Monitor Started**\n• Monitoring every ${intervalSeconds} seconds\n• Immediate issue detection and auto-fix\n• OAuth and webhook endpoint testing\n• Optimized for active user testing\n\n⚡ Ready for your testing session!`);

    // Initial comprehensive check
    await this.runRealTimeCheck();

    // Start monitoring loop with faster intervals for testing
    while (this.isActive) {
      await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      
      if (this.isActive) {
        const results = await this.runRealTimeCheck();
        this.log(`📊 Real-time check complete - Healthy: ${results.healthy}, Issues: ${results.unhealthy}`, 'info');
      }
    }
  }

  stop() {
    this.isActive = false;
    this.log('⏹️ Stopping real-time testing monitor...', 'info');
    this.sendAlert('⏹️ Real-time testing monitor stopped');
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new RealtimeTestingMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });
  
  // Start with 30-second intervals for real-time testing
  const interval = parseInt(process.argv[2]) || 30;
  monitor.startRealTimeTesting(interval).catch(console.error);
}

module.exports = RealtimeTestingMonitor;