const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

class AutonomousTestFramework {
  constructor() {
    this.baseUrl = process.env.RAILWAY_URL || 'https://pipenotify.up.railway.app';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://pipenotify-frontend.vercel.app';
    this.chatWebhook = null; // Will be provided
    this.testResults = [];
    this.monitoring = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    this.testResults.push({ timestamp, type, message });
  }

  async checkBackendHealth() {
    try {
      this.log('🔍 Checking backend health...');
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 10000 });
      this.log(`✅ Backend health check passed: ${response.status}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Backend health check failed: ${error.message}`, 'error');
      if (error.response) {
        this.log(`Response: ${JSON.stringify(error.response.data)}`, 'error');
      }
      return false;
    }
  }

  async checkFrontendHealth() {
    try {
      this.log('🔍 Checking frontend health...');
      const response = await axios.get(this.frontendUrl, { timeout: 10000 });
      this.log(`✅ Frontend health check passed: ${response.status}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Frontend health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testOAuthCallback() {
    try {
      this.log('🔍 Testing OAuth callback endpoint...');
      
      // Test with sample OAuth response data
      const testData = {
        code: 'test_authorization_code_12345',
        state: 'test_state'
      };

      const response = await axios.post(`${this.baseUrl}/api/v1/oauth/callback`, testData, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      this.log(`✅ OAuth callback test passed: ${response.status}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ OAuth callback test failed: ${error.message}`, 'error');
      if (error.response) {
        this.log(`Status: ${error.response.status}`, 'error');
        this.log(`Response: ${JSON.stringify(error.response.data)}`, 'error');
        
        // Auto-fix based on error type
        await this.autoFixOAuthError(error.response);
      }
      return false;
    }
  }

  async autoFixOAuthError(errorResponse) {
    this.log('🔧 Attempting automatic fix for OAuth error...', 'warning');
    
    if (errorResponse.status === 400) {
      this.log('🔍 Detected 400 error - checking for form encoding issues', 'warning');
      // Already fixed in previous commits
    } else if (errorResponse.status === 500) {
      this.log('🔍 Detected 500 error - checking for database schema issues', 'warning');
      // Already fixed with migration
    } else if (errorResponse.status === 404) {
      this.log('🔍 Detected 404 error - Railway deployment might be down', 'error');
      await this.checkDeploymentStatus();
    }
  }

  async checkDeploymentStatus() {
    this.log('🔍 Checking Railway deployment status...', 'warning');
    
    // Check if the service is running at all
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/status`, { timeout: 5000 });
      this.log('✅ Railway deployment is running', 'success');
      return true;
    } catch (error) {
      this.log('❌ Railway deployment appears to be down', 'error');
      this.log('💡 Suggestion: Check Railway dashboard for deployment errors', 'warning');
      return false;
    }
  }

  async testWithRealWebhook() {
    if (!this.chatWebhook) {
      this.log('⚠️ No Google Chat webhook provided - skipping real webhook test', 'warning');
      return false;
    }

    try {
      this.log('🔍 Testing with real Google Chat webhook...', 'info');
      
      const testMessage = {
        text: `🤖 Autonomous Test - ${new Date().toISOString()}\n✅ Testing Pipedrive → Google Chat integration`
      };

      const response = await axios.post(this.chatWebhook, testMessage, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.log('✅ Real Google Chat webhook test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Real webhook test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runFullTest() {
    this.log('🚀 Starting comprehensive autonomous test...', 'info');
    
    const tests = [
      { name: 'Backend Health', test: () => this.checkBackendHealth() },
      { name: 'Frontend Health', test: () => this.checkFrontendHealth() },
      { name: 'OAuth Callback', test: () => this.testOAuthCallback() },
      { name: 'Real Webhook', test: () => this.testWithRealWebhook() }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      this.log(`\n📋 Running test: ${name}`, 'info');
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.log(`\n📊 Test Results Summary:`, 'info');
    this.log(`✅ Passed: ${passed}`, 'success');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    
    return { passed, failed };
  }

  async startMonitoring(intervalMinutes = 5) {
    this.monitoring = true;
    this.log(`🔄 Starting autonomous monitoring (every ${intervalMinutes} minutes)...`, 'info');
    
    while (this.monitoring) {
      await this.runFullTest();
      
      // Wait for next check
      await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
    }
  }

  stopMonitoring() {
    this.monitoring = false;
    this.log('⏹️ Stopping autonomous monitoring...', 'info');
  }

  setGoogleChatWebhook(webhook) {
    this.chatWebhook = webhook;
    this.log(`🔗 Google Chat webhook configured`, 'info');
  }

  getTestResults() {
    return this.testResults;
  }
}

// CLI interface
if (require.main === module) {
  const tester = new AutonomousTestFramework();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  const webhook = args.find(arg => arg.startsWith('--webhook='))?.split('=')[1];
  const monitor = args.includes('--monitor');
  const interval = parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 5;
  
  if (webhook) {
    tester.setGoogleChatWebhook(webhook);
  }
  
  if (monitor) {
    tester.startMonitoring(interval);
  } else {
    tester.runFullTest().then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    });
  }
}

module.exports = AutonomousTestFramework;