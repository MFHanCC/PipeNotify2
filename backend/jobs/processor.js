const { Worker } = require('bullmq');
const { redisConfig } = require('./queue');

// Import services
const { defaultChatClient } = require('../services/chatClient');
const { getRulesForEvent, createLog, getTenantByPipedriveCompanyId } = require('../services/database');

// Create BullMQ worker for processing notification jobs
const notificationWorker = new Worker('notification', async (job) => {
  const { data } = job;
  
  try {
    console.log(`🚀 PROCESSING JOB ${job.id}:`, {
      event: data.event,
      object: data.object,
      userId: data.user_id,
      companyId: data.company_id
    });
    
    // Log full data safely
    try {
      const cleanData = JSON.stringify(data, (key, value) => {
        if (typeof value === 'string') {
          return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        }
        return value;
      }, 2);
      console.log(`📊 JOB ${job.id} DATA:`, cleanData);
    } catch (logError) {
      console.log(`📊 JOB ${job.id} DATA: [Unable to stringify safely]`, Object.keys(data));
    }

    // Process the webhook notification
    const result = await processNotification(data);
    
    return {
      status: 'success',
      processed_at: new Date().toISOString(),
      rules_matched: result.rulesMatched,
      notifications_sent: result.notificationsSent,
      tenant_id: result.tenantId
    };

  } catch (error) {
    console.error(`Job ${job.id} processing failed:`, error);
    
    // Log error to database for debugging
    // TODO: Implement error logging to database
    
    throw error; // Re-throw to mark job as failed
  }
}, redisConfig);

// Real notification processing function
async function processNotification(webhookData) {
  const startTime = Date.now();
  
  try {
    // Step 1: Identify tenant from webhook data
    const tenantId = await identifyTenant(webhookData);
    if (!tenantId) {
      console.log(`No tenant found for company_id: ${webhookData.company_id}`);
      return { rulesMatched: 0, notificationsSent: 0, tenantId: null };
    }

    // Step 2: Find matching rules for this event  
    let rules = await getRulesForEvent(tenantId, webhookData.event);
    console.log(`📋 Found ${rules.length} rules for event: ${webhookData.event}`);
    
    // Try broader event matching patterns
    if (rules.length === 0 && webhookData.event.includes('.')) {
      const [entity, action] = webhookData.event.split('.');
      
      // Try entity.* pattern (e.g., deal.*)
      const broadPattern = `${entity}.*`;
      rules = await getRulesForEvent(tenantId, broadPattern);
      console.log(`📋 Found ${rules.length} rules for pattern: ${broadPattern}`);
      
      // If still no rules, try just the entity
      if (rules.length === 0) {
        rules = await getRulesForEvent(tenantId, entity);
        console.log(`📋 Found ${rules.length} rules for entity: ${entity}`);
      }
    }

    if (rules.length === 0) {
      console.log('No rules found for this event type');
      return { rulesMatched: 0, notificationsSent: 0, tenantId };
    }

    // Step 3: Process each matching rule
    let notificationsSent = 0;
    
    for (const rule of rules) {
      try {
        // Check if rule filters match the webhook data
        if (!matchesFilters(webhookData, rule.filters)) {
          console.log(`Rule ${rule.name} filters don't match, skipping`);
          continue;
        }

        // Send notification to Google Chat
        const notificationResult = await sendNotification(rule, webhookData);
        
        if (notificationResult.success) {
          notificationsSent++;
          
          // Log successful notification
          await createLog(tenantId, {
            rule_id: rule.id,
            webhook_id: rule.target_webhook_id,
            payload: webhookData,
            formatted_message: notificationResult.message,
            status: 'success',
            response_code: 200,
            response_time_ms: Date.now() - startTime
          });
          
          console.log(`✅ Sent notification for rule: ${rule.name}`);
        } else {
          // Log failed notification
          await createLog(tenantId, {
            rule_id: rule.id,
            webhook_id: rule.target_webhook_id,
            payload: webhookData,
            formatted_message: notificationResult.message,
            status: 'failed',
            error_message: notificationResult.error,
            response_code: notificationResult.statusCode || 500,
            response_time_ms: Date.now() - startTime
          });
          
          console.error(`❌ Failed to send notification for rule: ${rule.name}`, notificationResult.error);
        }
      } catch (error) {
        console.error(`Error processing rule ${rule.name}:`, error);
        
        // Log error
        await createLog(tenantId, {
          rule_id: rule.id,
          webhook_id: rule.target_webhook_id,
          payload: webhookData,
          status: 'failed',
          error_message: error.message,
          response_time_ms: Date.now() - startTime
        });
      }
    }

    return { 
      rulesMatched: rules.length, 
      notificationsSent, 
      tenantId 
    };

  } catch (error) {
    console.error('Error in processNotification:', error);
    throw error;
  }
}

// Helper function to identify tenant from webhook data
async function identifyTenant(webhookData) {
  try {
    if (!webhookData.company_id) {
      // For development, use the first tenant (ID: 1)
      return 1;
    }
    
    const tenant = await getTenantByPipedriveCompanyId(webhookData.company_id);
    return tenant?.id || null;
  } catch (error) {
    console.error('Error identifying tenant:', error);
    return null;
  }
}

// Helper function to check if webhook data matches rule filters
function matchesFilters(webhookData, filters) {
  try {
    if (!filters || Object.keys(filters).length === 0) {
      return true; // No filters means match all
    }

    // Parse filters if it's a string
    const filterObj = typeof filters === 'string' ? JSON.parse(filters) : filters;
    
    // Example filter matching logic
    for (const [key, value] of Object.entries(filterObj)) {
      switch (key) {
        case 'status':
          if (Array.isArray(value)) {
            if (!value.includes(webhookData.current?.status || webhookData.object?.status)) {
              return false;
            }
          }
          break;
          
        case 'stage_id':
          if (Array.isArray(value)) {
            if (!value.includes(webhookData.current?.stage_id || webhookData.object?.stage_id)) {
              return false;
            }
          }
          break;
          
        case 'value':
          const dealValue = webhookData.current?.value || webhookData.object?.value || 0;
          if (value.min && dealValue < value.min) return false;
          if (value.max && dealValue > value.max) return false;
          break;
          
        // Add more filter types as needed
        default:
          console.log(`Unknown filter type: ${key}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error matching filters:', error);
    return true; // Default to match if there's an error
  }
}

// Helper function to send notification via Google Chat
async function sendNotification(rule, webhookData) {
  try {
    const result = await defaultChatClient.sendNotification(
      rule.webhook_url,
      webhookData,
      rule.template_mode,
      rule.custom_template
    );
    
    return {
      success: true,
      message: result,
      messageId: result.messageId
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statusCode: error.response?.status
    };
  }
}

// Worker event listeners
notificationWorker.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed:`, result);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

notificationWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down notification worker...');
  await notificationWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down notification worker...');
  await notificationWorker.close();
  process.exit(0);
});

console.log('📋 Notification worker started and listening for jobs...');

module.exports = {
  notificationWorker,
  processNotification
};