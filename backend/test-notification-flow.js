#!/usr/bin/env node

/**
 * Test notification flow end-to-end
 * This script tests the complete notification pipeline to identify where failures occur
 */

require('dotenv').config();

async function testNotificationFlow() {
  console.log('🧪 Testing complete notification flow...\n');
  
  try {
    // Test 1: Database connectivity
    console.log('📊 TEST 1: Database connectivity');
    const { healthCheck, getRulesForEvent, getWebhooks } = require('./services/database');
    const dbHealth = await healthCheck();
    
    if (dbHealth.healthy) {
      console.log('✅ Database connected successfully');
    } else {
      console.error('❌ Database connection failed:', dbHealth.error);
      return;
    }
    
    // Test 2: Redis/Queue connectivity
    console.log('\n🔗 TEST 2: Redis/Queue connectivity');
    const { getQueueInfo } = require('./jobs/queue');
    const queueInfo = await getQueueInfo();
    
    if (queueInfo.connected) {
      console.log('✅ Queue connected successfully');
      console.log(`📊 Queue stats: waiting=${queueInfo.waiting}, active=${queueInfo.active}, completed=${queueInfo.completed}, failed=${queueInfo.failed}`);
    } else {
      console.error('❌ Queue connection failed:', queueInfo.error);
      return;
    }
    
    // Test 3: Check for rules and webhooks
    console.log('\n📋 TEST 3: Rules and webhooks for tenant 1');
    const tenantId = 1;
    const rules = await getRulesForEvent(tenantId, 'deal.*');
    const webhooks = await getWebhooks(tenantId);
    
    console.log(`📋 Found ${rules.length} rules and ${webhooks.length} webhooks for tenant 1`);
    
    if (rules.length === 0) {
      console.error('❌ No rules found for tenant 1 - notifications cannot be sent');
      return;
    }
    
    if (webhooks.length === 0) {
      console.error('❌ No webhooks found for tenant 1 - notifications cannot be sent');
      return;
    }
    
    console.log('✅ Rules and webhooks configured properly');
    
    // Test 4: Worker status
    console.log('\n🔄 TEST 4: Worker status');
    const { notificationWorker } = require('./jobs/processor');
    
    if (notificationWorker) {
      console.log('✅ Worker instance exists');
      
      // Check if worker is running by checking its Redis connection
      try {
        // Test worker connection by getting waiting jobs
        const waitingJobs = await notificationWorker.getWaiting();
        console.log(`✅ Worker connected to Redis, ${waitingJobs.length} jobs waiting`);
      } catch (workerError) {
        console.error('❌ Worker Redis connection failed:', workerError.message);
        return;
      }
    } else {
      console.error('❌ Worker instance not found');
      return;
    }
    
    // Test 5: Add a test job to queue
    console.log('\n🚀 TEST 5: Adding test job to queue');
    const { addNotificationJob } = require('./jobs/queue');
    
    const testWebhookData = {
      event: 'deal.updated',
      object: {
        id: 999,
        type: 'deal',
        title: 'Test Deal - Notification Flow Check',
        value: 1500,
        currency: 'USD',
        status: 'open'
      },
      user_id: 1,
      company_id: 1,
      company: {
        id: 1,
        name: 'Test Company'
      },
      timestamp: new Date().toISOString()
    };
    
    try {
      const job = await addNotificationJob(testWebhookData, {
        priority: 1,
        delay: 0
      });
      
      console.log(`✅ Test job added successfully: ${job.id}`);
      
      // Wait a moment and check job status
      console.log('⏳ Waiting 10 seconds for job processing...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check if job was processed
      const jobStatus = await job.getState();
      console.log(`📊 Job ${job.id} status: ${jobStatus}`);
      
      if (jobStatus === 'completed') {
        const result = await job.returnvalue;
        console.log('✅ Job completed successfully:', result);
      } else if (jobStatus === 'failed') {
        const failedReason = job.failedReason;
        console.error('❌ Job failed:', failedReason);
      } else {
        console.log(`⏳ Job still in state: ${jobStatus}`);
      }
      
    } catch (jobError) {
      console.error('❌ Failed to add test job:', jobError.message);
    }
    
    // Test 6: Direct notification test
    console.log('\n📬 TEST 6: Direct notification test');
    const firstWebhook = webhooks[0];
    
    if (firstWebhook && firstWebhook.webhook_url) {
      console.log(`🎯 Testing direct notification to: ${firstWebhook.webhook_url.substring(0, 50)}...`);
      
      const { defaultChatClient } = require('./services/chatClient');
      
      try {
        const directResult = await defaultChatClient.sendTextMessage(
          firstWebhook.webhook_url,
          '🧪 Direct test notification from backend - notification system is working!'
        );
        
        console.log('✅ Direct notification sent successfully:', directResult);
      } catch (directError) {
        console.error('❌ Direct notification failed:', directError.message);
      }
    } else {
      console.log('⏭️ Skipping direct test - no webhook URL available');
    }
    
    console.log('\n🎯 TEST SUMMARY:');
    console.log('- Database: ✅');
    console.log('- Redis/Queue: ✅');
    console.log('- Rules/Webhooks: ✅');
    console.log('- Worker: ✅');
    console.log('- Job processing: Check logs above');
    console.log('- Direct notification: Check logs above');
    
  } catch (error) {
    console.error('❌ Test flow failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testNotificationFlow().catch(console.error);