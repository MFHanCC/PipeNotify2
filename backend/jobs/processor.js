const { Worker } = require('bullmq');
const { redisConfig } = require('./queue');

// Import services
const { defaultChatClient } = require('../services/chatClient');
const { getRulesForEvent, createLog, getTenantByPipedriveCompanyId, getWebhooks } = require('../services/database');
const { applyAdvancedFilters } = require('../services/ruleFilters');
const { routeToChannel } = require('../services/channelRouter');
const { checkNotificationQuota, trackNotificationUsage } = require('../middleware/quotaEnforcement');
const { isQuietTime, queueDelayedNotification } = require('../services/quietHours');

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
      try {
        // Check if rule filters match the webhook data (advanced filtering)
        if (!applyAdvancedFilters(webhookData, rule)) {
          console.log(`Rule ${rule.name} advanced filters don't match, skipping`);
          continue;
        }

        // Use channel routing to determine the best webhook
        const targetWebhook = routeToChannel(webhookData, rule, availableWebhooks);
        
        if (!targetWebhook) {
          console.log(`No suitable webhook found for rule ${rule.name}, skipping`);
          continue;
        }

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
              webhook_id: targetWebhook.id,
              event_type: webhookData.event,
              payload: webhookData,
              status: 'queued',
              response_time_ms: Date.now() - startTime,
              message: `Delayed until ${queueResult.scheduled_for} (${queueResult.reason})`
            });
            
            console.log(`📅 Notification queued for ${queueResult.scheduled_for} (delay: ${queueResult.delay_minutes}min)`);
            continue; // Skip immediate sending
          }
        }

        // Send notification to the routed Google Chat channel
        const notificationResult = await sendNotification(rule, webhookData, targetWebhook, tenantId);
        
        if (notificationResult.success) {
          notificationsSent++;
          
          // Track usage for successful notification
          await trackNotificationUsage(tenantId, 1);
          
          // Log successful notification
          await createLog(tenantId, {
            rule_id: rule.id,
            webhook_id: targetWebhook?.id || rule.target_webhook_id,
            event_type: webhookData.event,
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
            webhook_id: targetWebhook?.id || rule.target_webhook_id,
            event_type: webhookData.event,
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
    if (!webhookData.company_id) {
      console.log('⚠️ No company_id in webhook, using tenant ID 1 for development');
      return 1;
    }
    
    // First try to find tenant by company_id
    console.log(`🔍 Looking up tenant for company_id: ${webhookData.company_id}`);
    let tenant = await getTenantByPipedriveCompanyId(webhookData.company_id);
    
    if (!tenant && webhookData.user_id) {
      // Fallback: try to find by user_id if company lookup failed
      console.log(`🔄 Company lookup failed, trying user_id: ${webhookData.user_id}`);
      const { getTenantByPipedriveUserId } = require('../services/database');
      tenant = await getTenantByPipedriveUserId(webhookData.user_id);
      
      if (tenant) {
        console.log(`✅ Found tenant by user_id: ${tenant.id}, updating with company_id`);
        // Update the tenant with the company_id for future lookups
        const database = require('../services/database');
        await database.pool.query(
          'UPDATE tenants SET pipedrive_company_id = $1 WHERE id = $2',
          [webhookData.company_id, tenant.id]
        );
      }
    }
    
    // PRODUCTION FIX: If no tenant found, check if there's a default tenant with rules/webhooks
    // This handles the case where users created rules via frontend before webhook registration
    if (!tenant) {
      console.log(`🔍 No tenant found for company_id: ${webhookData.company_id}, checking for default tenant with active rules`);
      
      const database = require('../services/database');
      const defaultTenantWithRules = await database.pool.query(`
        SELECT DISTINCT t.id, t.company_name, COUNT(r.id) as rule_count, COUNT(cw.id) as webhook_count
        FROM tenants t
        LEFT JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
        LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
        WHERE t.pipedrive_company_id IS NULL OR t.pipedrive_company_id = ''
        GROUP BY t.id, t.company_name
        HAVING COUNT(r.id) > 0 AND COUNT(cw.id) > 0
        ORDER BY t.id ASC
        LIMIT 1
      `);
      
      if (defaultTenantWithRules.rows.length > 0) {
        const defaultTenant = defaultTenantWithRules.rows[0];
        console.log(`🔧 Found default tenant ${defaultTenant.id} with ${defaultTenant.rule_count} rules and ${defaultTenant.webhook_count} webhooks`);
        console.log(`🔧 Mapping tenant ${defaultTenant.id} to company_id: ${webhookData.company_id}`);
        
        // Update the default tenant to handle this company_id
        await database.pool.query(`
          UPDATE tenants 
          SET pipedrive_company_id = $1,
              company_name = COALESCE(NULLIF(company_name, ''), 'Pipedrive Account'),
              updated_at = NOW()
          WHERE id = $2
        `, [webhookData.company_id, defaultTenant.id]);
        
        console.log(`✅ Successfully mapped tenant ${defaultTenant.id} to handle company_id: ${webhookData.company_id}`);
        return defaultTenant.id;
      }
    }
    
    if (tenant) {
      console.log(`✅ Found tenant: ${tenant.id} for company_id: ${webhookData.company_id}`);
      return tenant.id;
    } else {
      console.log(`❌ No tenant found for company_id: ${webhookData.company_id}`);
      return null;
    }
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
async function sendNotification(rule, webhookData, targetWebhook = null, tenantId = null) {
  try {
    // Use target webhook URL if provided, otherwise fall back to rule's default
    const webhookUrl = targetWebhook?.webhook_url || rule.webhook_url;
    
    const result = await defaultChatClient.sendNotification(
      webhookUrl,
      webhookData,
      rule.template_mode,
      rule.custom_template,
      tenantId
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