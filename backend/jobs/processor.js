const { Worker } = require('bullmq');
const { redisConfig, initPromise } = require('./queue');

// Import services
const { defaultChatClient } = require('../services/chatClient');
const { getRulesForEvent, createLog, getTenantByPipedriveCompanyId, getWebhooks } = require('../services/database');
const { applyAdvancedFilters } = require('../services/ruleFilters');
const { routeToChannel } = require('../services/channelRouter');
const { checkNotificationQuota, trackNotificationUsage } = require('../middleware/quotaEnforcement');
const { isQuietTime, queueDelayedNotification } = require('../services/quietHours');

// Create BullMQ worker for processing notification jobs (only if Redis is available)
let notificationWorker = null;

// Wait for Redis initialization then create worker
initPromise.then(() => {
  if (redisConfig) {
    notificationWorker = new Worker('notification', async (job) => {
  const { data } = job;
  
  try {
    console.log(`🚀 PROCESSING JOB ${job.id}: ${data.event} for company ${data.company_id}`);
    
    // Only log full data in development
    if (process.env.NODE_ENV === 'development') {
      try {
        const cleanData = JSON.stringify(data, (key, value) => {
          if (typeof value === 'string') {
            return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
          }
          return value;
        }, 2);
        console.log(`📊 JOB ${job.id} DATA:`, cleanData);
      } catch (logError) {
        console.log(`📊 JOB ${job.id} DATA: [Unable to stringify]`);
      }
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

  // Worker event listeners
  notificationWorker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
  });

  notificationWorker.on('error', (err) => {
    console.error('Worker error:', err);
    
    // Handle Redis connection issues specifically
    if (err.message.includes('Stream isn\'t writeable') || 
        err.message.includes('Connection is closed') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('ECONNREFUSED')) {
      console.log('🔄 Redis connection issue detected, attempting graceful degradation');
      console.log(`🔄 Redis error details: ${err.message}`);
    }
  });

  // Additional connection monitoring
  notificationWorker.on('ioredis:connect', () => {
    console.log('✅ Redis connection established for worker');
  });

  notificationWorker.on('ioredis:close', () => {
    console.log('⚠️ Redis connection closed for worker');
  });

  notificationWorker.on('ioredis:reconnecting', () => {
    console.log('🔄 Redis reconnecting for worker');
  });

  console.log('✅ Notification worker initialized successfully');
} else {
  console.log('⚠️ Notification worker disabled - Redis not available');
}
}).catch(error => {
  console.error('❌ Failed to initialize notification worker:', error.message);
});

// Simple in-memory deduplication cache (for production, use Redis)
const processedWebhooks = new Map();
const DEDUP_TTL = 60000; // 1 minute TTL

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedWebhooks.entries()) {
    if (now - timestamp > DEDUP_TTL) {
      processedWebhooks.delete(key);
    }
  }
}, 30000); // Clean every 30 seconds

// Real notification processing function
async function processNotification(webhookData) {
  const startTime = Date.now();
  
  try {
    // Step 0: Deduplication check
    const correlationId = webhookData.raw_meta?.correlation_id;
    const entityId = webhookData.raw_meta?.entity_id;
    const eventType = webhookData.event;
    
    if (correlationId && entityId) {
      const dedupKey = `${correlationId}-${entityId}-${eventType}`;
      
      if (processedWebhooks.has(dedupKey)) {
        console.log(`🔄 Duplicate webhook detected, skipping: ${dedupKey}`);
        // Still identify tenant for proper logging
        const tenantId = await identifyTenant(webhookData);
        return { rulesMatched: 0, notificationsSent: 0, tenantId, skipped: true };
      }
      
      // Mark as processed
      processedWebhooks.set(dedupKey, Date.now());
      console.log(`✅ Processing unique webhook: ${dedupKey}`);
    }

    // Step 1: Identify tenant from webhook data
    const tenantId = await identifyTenant(webhookData);
    if (!tenantId) {
      console.log(`No tenant found for company_id: ${webhookData.company_id}`);
      return { rulesMatched: 0, notificationsSent: 0, tenantId: null };
    }

    // Step 1.5: Check notification quota before processing
    const quotaCheck = await checkNotificationQuota(tenantId, 1);
    if (!quotaCheck.within_quota) {
      console.log(`🚫 Notification quota exceeded for tenant ${tenantId}: ${quotaCheck.current_usage}/${quotaCheck.limit}`);
      return { 
        rulesMatched: 0, 
        notificationsSent: 0, 
        tenantId, 
        quotaExceeded: true,
        planTier: quotaCheck.plan_tier 
      };
    }

    console.log(`✅ Quota check passed: ${quotaCheck.current_usage}/${quotaCheck.limit} (${quotaCheck.usage_percentage}%)`);

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

    // Step 2.5: Get available webhooks for channel routing
    const availableWebhooks = await getWebhooks(tenantId);
    console.log(`🔗 Found ${availableWebhooks.length} active webhooks for channel routing`);

    // Step 3: Process each matching rule
    let notificationsSent = 0;
    
    for (const rule of rules) {
      let targetWebhook = null;
      
      try {
        // Check if rule filters match the webhook data (advanced filtering)
        if (!applyAdvancedFilters(webhookData, rule)) {
          console.log(`Rule ${rule.name} advanced filters don't match, skipping`);
          continue;
        }

        // Use channel routing to determine the best webhook
        targetWebhook = routeToChannel(webhookData, rule, availableWebhooks);
        
        if (!targetWebhook) {
          console.error(`❌ No webhook found for rule ${rule.name} (webhook_id: ${rule.target_webhook_id})`);
          continue;
        }
        
        console.log(`🎯 Using webhook ${targetWebhook.id}: ${targetWebhook.webhook_url?.substring(0, 50)}...`);

        // Check quiet hours before sending
        const quietCheck = await isQuietTime(tenantId);
        if (quietCheck.is_quiet) {
          console.log(`🔇 Notification delayed due to quiet hours: ${quietCheck.reason}`);
          
          // Queue for delayed delivery
          const queueResult = await queueDelayedNotification(tenantId, {
            webhook_url: targetWebhook.webhook_url,
            webhook_data: webhookData,
            template_mode: rule.template_mode || 'simple',
            custom_template: rule.custom_template,
            rule_id: rule.id,
            rule_name: rule.name
          });
          
          if (queueResult.queued) {
            // Log queued notification
            await createLog(tenantId, {
              rule_id: rule.id,
              webhook_id: targetWebhook?.id || rule.target_webhook_id,
              event_type: webhookData.event,
              payload: webhookData,
              status: 'pending',
              response_time_ms: Date.now() - startTime,
              error_message: `Delayed until ${queueResult.scheduled_for} (${queueResult.reason})`
            });
            
            console.log(`📅 Notification queued for ${queueResult.scheduled_for} (delay: ${queueResult.delay_minutes}min)`);
            continue; // Skip immediate sending
          }
        }

        // Send notification with multi-tier backup system
        const notificationResult = await sendNotificationWithBackup(rule, webhookData, targetWebhook, tenantId);
        
        if (notificationResult.success) {
          notificationsSent++;
          
          // Track usage for successful notification
          await trackNotificationUsage(tenantId, 1);
          
          // Log successful notification with tier information
          await createLog(tenantId, {
            rule_id: rule.id,
            webhook_id: targetWebhook?.id || rule.target_webhook_id,
            event_type: webhookData.event,
            payload: webhookData,
            formatted_message: notificationResult.message,
            status: 'success',
            response_code: 200,
            response_time_ms: Date.now() - startTime,
            error_message: notificationResult.tier > 1 ? `Delivered via Tier ${notificationResult.tier} backup` : null
          });
          
          // Alert if backup tier was used (indicates primary system issues)
          if (notificationResult.tier > 1) {
            console.warn(`⚠️ BACKUP TIER ${notificationResult.tier} USED for rule: ${rule.name} - Primary system may have issues`);
            await alertSystemReliability(tenantId, rule, notificationResult.tier, webhookData);
          }
          
          console.log(`✅ SUCCESS: Notification sent for rule "${rule.name}" via Tier ${notificationResult.tier}`);
        } else {
          // Log failed notification
          await createLog(tenantId, {
            rule_id: rule.id,
            webhook_id: targetWebhook?.id || rule.target_webhook_id,
            event_type: webhookData.event,
            payload: webhookData,
            formatted_message: notificationResult.message,
            status: 'failed',
            error_message: notificationResult.error,
            response_code: notificationResult.statusCode || 500,
            response_time_ms: Date.now() - startTime
          });
          
          console.error(`❌ FAILED: All tiers failed for rule "${rule.name}":`, notificationResult.errors || notificationResult.error);
        }
      } catch (error) {
        console.error(`Error processing rule ${rule.name}:`, error);
        
        // Log error
        await createLog(tenantId, {
          rule_id: rule.id,
          webhook_id: targetWebhook?.id || rule.target_webhook_id,
          event_type: webhookData.event,
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
    const { resolveTenant } = require('../services/smartTenantResolver');
    
    // Use smart tenant resolution
    const resolution = await resolveTenant(webhookData);
    
    if (resolution.autoMapped) {
      console.log(`🔧 Auto-mapped tenant using strategy: ${resolution.strategy}`);
    }
    
    return resolution.tenantId;
    
  } catch (error) {
    console.error('❌ Smart tenant resolution failed, using fallback:', error);
    
    // Final fallback for development
    if (!webhookData.company_id) {
      console.log('⚠️ No company_id in webhook, using tenant ID 1 for development');
      return 1;
    }
    
    // Try basic lookup as last resort
    const tenant = await getTenantByPipedriveCompanyId(webhookData.company_id);
    if (tenant) {
      return tenant.id;
    }
    
    console.error(`❌ No tenant resolution possible for company_id: ${webhookData.company_id}`);
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
// Multi-tier backup notification system - ensures notifications ALWAYS get delivered
async function sendNotificationWithBackup(rule, webhookData, targetWebhook = null, tenantId = null) {
  const webhookUrl = targetWebhook?.webhook_url || rule.webhook_url;
  
  // Tier 1: Primary delivery with immediate retry
  try {
    console.log(`🎯 TIER 1: Primary delivery to ${webhookUrl}`);
    const result = await defaultChatClient.sendNotification(
      webhookUrl,
      webhookData,
      rule.template_mode,
      rule.custom_template,
      tenantId
    );

    console.log(`✅ TIER 1: Notification sent successfully`);
    return {
      success: true,
      messageId: result.messageId,
      message: result,
      tier: 1
    };
  } catch (primaryError) {
    console.error(`❌ TIER 1: Primary delivery failed:`, primaryError.message);
    
    // Tier 2: Immediate retry with simple template
    try {
      console.log(`🔄 TIER 2: Retry with simple template`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
      
      const retryResult = await defaultChatClient.sendNotification(
        webhookUrl,
        webhookData,
        'simple', // Force simple template for compatibility
        null,
        tenantId
      );

      console.log(`✅ TIER 2: Retry successful with simple template`);
      return {
        success: true,
        messageId: retryResult.messageId,
        message: retryResult,
        tier: 2,
        primaryError: primaryError.message
      };
    } catch (retryError) {
      console.error(`❌ TIER 2: Retry failed:`, retryError.message);
      
      // Tier 3: Alternative webhook (if available)
      try {
        console.log(`🔗 TIER 3: Trying alternative webhook`);
        const alternativeWebhooks = await getWebhooks(tenantId);
        const alternativeWebhook = alternativeWebhooks.find(w => 
          w.id !== targetWebhook?.id && w.webhook_url !== webhookUrl
        );
        
        if (alternativeWebhook) {
          const altResult = await defaultChatClient.sendNotification(
            alternativeWebhook.webhook_url,
            webhookData,
            'simple',
            null,
            tenantId
          );

          console.log(`✅ TIER 3: Alternative webhook successful`);
          return {
            success: true,
            messageId: altResult.messageId,
            message: altResult,
            tier: 3,
            alternativeWebhookId: alternativeWebhook.id
          };
        } else {
          throw new Error('No alternative webhook available');
        }
      } catch (altError) {
        console.error(`❌ TIER 3: Alternative webhook failed:`, altError.message);
        
        // Tier 4: Emergency direct processing (bypass all infrastructure)
        try {
          console.log(`🚨 TIER 4: Emergency direct processing`);
          const { processNotificationDirect } = require('../services/notificationFallback');
          const emergencyResult = await processNotificationDirect(webhookData);
          
          if (emergencyResult.success && emergencyResult.notificationsSent > 0) {
            console.log(`✅ TIER 4: Emergency processing successful`);
            return {
              success: true,
              message: 'Notification sent via emergency fallback',
              tier: 4,
              notificationsSent: emergencyResult.notificationsSent
            };
          } else {
            throw new Error('Emergency processing failed or no notifications sent');
          }
        } catch (emergencyError) {
          console.error(`❌ TIER 4: Emergency processing failed:`, emergencyError.message);
          
          // ALL TIERS FAILED - Return comprehensive error
          return {
            success: false,
            error: 'All notification tiers failed',
            tier: 'ALL_FAILED',
            errors: {
              primary: primaryError.message,
              retry: retryError.message,
              alternative: altError.message,
              emergency: emergencyError.message
            },
            statusCode: 500
          };
        }
      }
    }
  }
}

// Legacy function for backwards compatibility
async function sendNotification(rule, webhookData, targetWebhook = null, tenantId = null) {
  return await sendNotificationWithBackup(rule, webhookData, targetWebhook, tenantId);
}

// System reliability monitoring and alerting
async function alertSystemReliability(tenantId, rule, tier, webhookData) {
  try {
    console.log(`🚨 SYSTEM RELIABILITY ALERT: Tier ${tier} used for tenant ${tenantId}`);
    
<<<<<<< HEAD
    // Track backup tier usage for monitoring
    const alertData = {
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      rule_name: rule.name,
      tier_used: tier,
      event_type: webhookData.event,
      alert_level: tier >= 4 ? 'CRITICAL' : tier >= 3 ? 'WARNING' : 'INFO'
    };
    
    // Log reliability issue for monitoring
    console.error(`🔔 RELIABILITY ALERT:`, JSON.stringify(alertData, null, 2));
    
    // In production, you could send this to monitoring systems:
    // - Slack/Discord alerts for critical issues
    // - Email notifications for administrators 
    // - Metrics to monitoring dashboards (Grafana, DataDog, etc.)
    // - Health check endpoint updates
    
    return alertData;
  } catch (error) {
    console.error('Failed to send reliability alert:', error);
=======
    // Log to file for Claude autonomous monitoring (create directory if needed)
    try {
      require('fs').mkdirSync('./logs/claude-alerts', { recursive: true });
      require('fs').appendFileSync('./logs/claude-alerts/redis-connection-error.txt', 
        `${new Date().toISOString()}: Redis connection error: ${err.message}\n`);
    } catch (logError) {
      console.warn('Could not write to log file:', logError.message);
    }
>>>>>>> origin/main
  }
}

// Worker event listeners are now inside the conditional block above

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down notification worker...');
  if (notificationWorker) {
    await notificationWorker.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down notification worker...');
  if (notificationWorker) {
    await notificationWorker.close();
  }
  process.exit(0);
});

console.log('📋 Notification worker started and listening for jobs...');

module.exports = {
  notificationWorker,
  processNotification
};