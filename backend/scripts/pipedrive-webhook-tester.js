const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

class PipedriveWebhookTester {
  constructor() {
    this.backendUrl = process.env.RAILWAY_URL || 'https://pipenotify.up.railway.app';
    this.localBackend = 'http://localhost:3001'; // Fallback to local
    this.chatWebhook = 'https://chat.googleapis.com/v1/spaces/AAQASsBob7E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=reMpAdFngUO-J6g9278dze05lysc8CVlb7orJAdK0zQ';
    this.currentBackend = null;
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    this.testResults.push({ timestamp, type, message });
  }

  async selectWorkingBackend() {
    this.log('🔍 Determining which backend to use for testing...', 'info');
    
    // Try Railway first
    try {
      await axios.get(`${this.backendUrl}/health`, { timeout: 5000 });
      this.currentBackend = this.backendUrl;
      this.log('✅ Using Railway backend for testing', 'success');
      return true;
    } catch (error) {
      this.log('⚠️ Railway backend unavailable, trying local...', 'warning');
    }
    
    // Try local backend
    try {
      await axios.get(`${this.localBackend}/health`, { timeout: 3000 });
      this.currentBackend = this.localBackend;
      this.log('✅ Using local backend for testing', 'success');
      return true;
    } catch (error) {
      this.log('❌ No backend available for testing', 'error');
      return false;
    }
  }

  // Generate realistic Pipedrive webhook payloads
  generateDealCreatedPayload() {
    return {
      event: 'added.deal',
      object: 'deal',
      timestamp: Math.floor(Date.now() / 1000),
      company_id: 12345,
      user_id: 67890,
      current: {
        id: Math.floor(Math.random() * 100000),
        title: 'Test Deal - Autonomous Integration Test',
        value: 15000,
        currency: 'USD',
        status: 'open',
        stage_id: 1,
        pipeline_id: 1,
        person_id: 123,
        org_id: 456,
        user_id: 67890,
        add_time: new Date().toISOString(),
        creator_user_id: 67890
      }
    };
  }

  generateDealUpdatedPayload(updates = {}) {
    const baseDeal = {
      id: 99999,
      title: 'Test Deal - Stage Change',
      value: 25000,
      currency: 'USD',
      status: 'open',
      stage_id: 2,
      pipeline_id: 1,
      person_id: 123,
      org_id: 456,
      user_id: 67890
    };

    return {
      event: 'updated.deal',
      object: 'deal',
      timestamp: Math.floor(Date.now() / 1000),
      company_id: 12345,
      user_id: 67890,
      current: { ...baseDeal, ...updates },
      previous: baseDeal
    };
  }

  generateDealWonPayload() {
    return this.generateDealUpdatedPayload({
      status: 'won',
      stage_id: 5,
      won_time: new Date().toISOString()
    });
  }

  generateDealLostPayload() {
    return this.generateDealUpdatedPayload({
      status: 'lost',
      stage_id: 6,
      lost_time: new Date().toISOString(),
      lost_reason: 'Budget constraints'
    });
  }

  generatePersonAddedPayload() {
    return {
      event: 'added.person',
      object: 'person',
      timestamp: Math.floor(Date.now() / 1000),
      company_id: 12345,
      user_id: 67890,
      current: {
        id: Math.floor(Math.random() * 10000),
        name: 'John Doe - Test Contact',
        email: ['john.doe.test@example.com'],
        phone: ['+1-555-0123'],
        org_id: 456,
        owner_id: 67890,
        add_time: new Date().toISOString()
      }
    };
  }

  async sendWebhookTest(webhookPayload, testName) {
    try {
      this.log(`🚀 Testing: ${testName}`, 'info');
      this.log(`📊 Payload: ${JSON.stringify(webhookPayload, null, 2)}`, 'info');
      
      const response = await axios.post(
        `${this.currentBackend}/api/v1/webhook/pipedrive`,
        webhookPayload,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Pipedrive-Webhooks/1.0'
          }
        }
      );

      this.log(`✅ ${testName} - Webhook accepted (${response.status})`, 'success');
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return { success: true, status: response.status, data: response.data };
    } catch (error) {
      this.log(`❌ ${testName} - Failed: ${error.message}`, 'error');
      if (error.response) {
        this.log(`Response: ${JSON.stringify(error.response.data)}`, 'error');
      }
      return { success: false, error: error.message };
    }
  }

  async testGoogleChatDelivery() {
    try {
      this.log('🧪 Testing direct Google Chat delivery...', 'info');
      
      const testMessage = {
        text: `🧪 **Pipedrive Integration Test**\n\n✅ Testing notification delivery\n🤖 Autonomous webhook tester\n⏰ ${new Date().toLocaleString()}\n\nThis confirms your Google Chat webhook is working correctly!`
      };

      const response = await axios.post(this.chatWebhook, testMessage, {
        timeout: 10000
      });

      this.log('✅ Google Chat delivery test passed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Google Chat delivery test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runComprehensiveTests() {
    this.log('🚀 Starting comprehensive Pipedrive webhook testing...', 'info');
    
    // Step 1: Select working backend
    const backendAvailable = await this.selectWorkingBackend();
    if (!backendAvailable) {
      this.log('❌ Cannot proceed - no backend available', 'error');
      return false;
    }

    // Step 2: Test Google Chat delivery
    await this.testGoogleChatDelivery();

    // Step 3: Test Pipedrive webhook scenarios
    const tests = [
      {
        name: 'Deal Created',
        payload: this.generateDealCreatedPayload(),
        description: 'New deal added to pipeline'
      },
      {
        name: 'Deal Stage Changed', 
        payload: this.generateDealUpdatedPayload({ stage_id: 3 }),
        description: 'Deal moved to different stage'
      },
      {
        name: 'Deal Won',
        payload: this.generateDealWonPayload(),
        description: 'Deal marked as won'
      },
      {
        name: 'Deal Lost',
        payload: this.generateDealLostPayload(),
        description: 'Deal marked as lost'
      },
      {
        name: 'Person Added',
        payload: this.generatePersonAddedPayload(),
        description: 'New contact added'
      }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      this.log(`\n📋 === ${test.name} Test ===`, 'info');
      this.log(`📝 Description: ${test.description}`, 'info');
      
      const result = await this.sendWebhookTest(test.payload, test.name);
      
      if (result.success) {
        passed++;
        this.log(`✅ ${test.name}: Webhook processed successfully`, 'success');
      } else {
        failed++;
        this.log(`❌ ${test.name}: Webhook processing failed`, 'error');
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    this.log('\n📊 === TEST SUMMARY ===', 'info');
    this.log(`✅ Passed: ${passed}`, 'success');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`🔗 Backend: ${this.currentBackend}`, 'info');
    this.log(`💬 Check your Google Chat for notifications!`, 'info');

    return { passed, failed, backend: this.currentBackend };
  }
}

// CLI interface
if (require.main === module) {
  const tester = new PipedriveWebhookTester();
  tester.runComprehensiveTests().then(results => {
    if (results) {
      process.exit(results.failed > 0 ? 1 : 0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = PipedriveWebhookTester;