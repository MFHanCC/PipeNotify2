const { getRulesForEvent, createLog, getTenantByPipedriveCompanyId, getWebhooks } = require('./database');
const { defaultChatClient } = require('./chatClient');
const { routeToChannel } = require('./channelRouter');
const { applyAdvancedFilters } = require('./ruleFilters');

/**
 * Emergency notification fallback service
 * Provides direct webhook-to-notification processing when queue/worker fails
 * This ensures notifications ALWAYS get delivered regardless of infrastructure issues
 */

// Simple in-memory cache for recent notifications to prevent duplicates
const recentNotifications = new Map();
const NOTIFICATION_CACHE_TTL = 300000; // 5 minutes

// Cleanup cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > NOTIFICATION_CACHE_TTL) {
      recentNotifications.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Direct notification processing - bypasses queue entirely
 * Used when worker is down or queue is failing
 */
async function processNotificationDirect(webhookData) {
  const startTime = Date.now();
  
  try {
    console.log('🚨 EMERGENCY DIRECT NOTIFICATION PROCESSING');
    console.log(`📊 Processing event: ${webhookData.event} for company: ${webhookData.company_id}`);
    
    // Step 1: Identify tenant with enhanced fallback logic
    const tenantId = await identifyTenantRobust(webhookData);
    if (!tenantId) {
      console.log(`❌ No tenant found for company_id: ${webhookData.company_id}`);
      return { success: false, error: 'No tenant found', notificationsSent: 0 };
    }
    
    console.log(`✅ Using tenant: ${tenantId}`);
    
    // Step 2: Find matching rules with smart event matching
    let rules = await findMatchingRulesRobust(tenantId, webhookData.event);
    console.log(`📋 Found ${rules.length} matching rules`);
    
    if (rules.length === 0) {
      console.log('⚠️ No rules found for this event type');
      return { success: true, notificationsSent: 0, message: 'No matching rules' };
    }
    
    // Step 3: Get available webhooks
    const availableWebhooks = await getWebhooks(tenantId);
    console.log(`🔗 Found ${availableWebhooks.length} active webhooks`);
    
    if (availableWebhooks.length === 0) {
      console.log('❌ No active webhooks found');
      return { success: false, error: 'No active webhooks', notificationsSent: 0 };
    }
    
    // Step 4: Process each rule and send notifications
    let notificationsSent = 0;
    const results = [];
    
    for (const rule of rules) {
      try {
        // Check for duplicate notification (deduplication)
        const notificationKey = `${tenantId}-${rule.id}-${webhookData.object?.id}-${webhookData.event}`;
        if (recentNotifications.has(notificationKey)) {
          console.log(`🔄 Skipping duplicate notification: ${notificationKey}`);
          continue;
        }
        
        // Apply filters
        if (!applyAdvancedFilters(webhookData, rule)) {
          console.log(`Rule ${rule.name} filters don't match, skipping`);
          continue;
        }
        
        // Route to appropriate channel
        const targetWebhook = routeToChannel(webhookData, rule, availableWebhooks);
        if (!targetWebhook) {
          console.log(`No suitable webhook found for rule ${rule.name}`);
          continue;
        }
        
        // Send notification with retry logic
        const notificationResult = await sendNotificationWithRetry(
          rule, 
          webhookData, 
          targetWebhook, 
          tenantId
        );
        
        if (notificationResult.success) {
          notificationsSent++;
          recentNotifications.set(notificationKey, Date.now());
          
          // Log success
          await createLog(tenantId, {
            rule_id: rule.id,
            webhook_id: targetWebhook.id,
            event_type: webhookData.event,
            payload: webhookData,
            formatted_message: notificationResult.message,
            status: 'success',
            response_code: 200,
            response_time_ms: Date.now() - startTime
          });
          
          console.log(`✅ Sent notification for rule: ${rule.name}`);
        } else {
          // Log failure
          await createLog(tenantId, {
            rule_id: rule.id,
            webhook_id: targetWebhook.id,
            event_type: webhookData.event,
            payload: webhookData,
            formatted_message: notificationResult.message,
            status: 'failed',
            error_message: notificationResult.error,
            response_code: notificationResult.statusCode || 500,
            response_time_ms: Date.now() - startTime
          });
          
          console.error(`❌ Failed notification for rule: ${rule.name}`, notificationResult.error);
        }
        
        results.push(notificationResult);
        
      } catch (error) {
        console.error(`Error processing rule ${rule.name}:`, error);
        results.push({ success: false, error: error.message });
      }
    }
    
    return {
      success: notificationsSent > 0,
      notificationsSent,
      rulesProcessed: rules.length,
      tenantId,
      results,
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('❌ Direct notification processing failed:', error);
    return { success: false, error: error.message, notificationsSent: 0 };
  }
}

/**
 * Determine the tenant ID for an incoming webhook using multiple fallback strategies.
 *
 * Attempts, in order:
 * 1. Direct lookup by webhookData.company_id.
 * 2. Find a tenant with enabled rules and active webhooks and auto-map it to the company_id.
 * 3. As a last resort, pick the first tenant that has any enabled rules or active webhooks and auto-map it.
 *
 * This function may update the tenants table to map a pipedrive/company ID to the chosen tenant (auto-mapping).
 *
 * @param {Object} webhookData - The raw webhook payload; the function uses `webhookData.company_id` to identify the tenant.
 * @returns {Promise<number|null>} The tenant ID if found or mapped; otherwise `null`. Returns `1` when `company_id` is missing (development default).
 */
async function identifyTenantRobust(webhookData) {
  try {
    const companyId = webhookData.company_id;
    
    if (!companyId) {
      console.log('⚠️ No company_id in webhook, using tenant ID 1 for development');
      return 1;
    }
    
    // Strategy 1: Direct company_id lookup
    console.log(`🔍 Looking up tenant for company_id: ${companyId}`);
    let tenant = await getTenantByPipedriveCompanyId(companyId);
    
    if (tenant) {
      console.log(`✅ Found tenant: ${tenant.id} via company_id`);
      return tenant.id;
    }
    
    // Strategy 2: Find tenant with rules and webhooks, then map it
    console.log('🔄 No direct mapping found, searching for tenant with active rules and webhooks');
    
    const database = require('./database');
    const candidateTenants = await database.pool.query(`
      SELECT DISTINCT t.id, t.company_name, 
             COUNT(DISTINCT r.id) as rule_count, 
             COUNT(DISTINCT cw.id) as webhook_count
      FROM tenants t
      LEFT JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
      LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
      WHERE (t.pipedrive_company_id IS NULL OR t.pipedrive_company_id = '' OR t.pipedrive_company_id = $1)
      GROUP BY t.id, t.company_name
      HAVING COUNT(DISTINCT r.id) > 0 AND COUNT(DISTINCT cw.id) > 0
      ORDER BY 
        CASE WHEN t.pipedrive_company_id = $1 THEN 1 ELSE 2 END,
        t.id ASC
      LIMIT 1
    `, [companyId]);
    
    if (candidateTenants.rows.length > 0) {
      const candidateTenant = candidateTenants.rows[0];
      console.log(`🔧 Found candidate tenant ${candidateTenant.id} with ${candidateTenant.rule_count} rules and ${candidateTenant.webhook_count} webhooks`);
      
      // Auto-map this tenant to the company_id
      await database.pool.query(`
        UPDATE tenants 
        SET pipedrive_company_id = $1,
            company_name = COALESCE(NULLIF(company_name, ''), 'Pipedrive Account'),
            updated_at = NOW()
        WHERE id = $2
      `, [companyId, candidateTenant.id]);
      
      console.log(`✅ Auto-mapped tenant ${candidateTenant.id} to company_id: ${companyId}`);
      return candidateTenant.id;
    }
    
    // Strategy 3: Use first tenant with any rules/webhooks (last resort)
    const fallbackTenant = await database.pool.query(`
      SELECT t.id
      FROM tenants t
      WHERE EXISTS (SELECT 1 FROM rules r WHERE r.tenant_id = t.id AND r.enabled = true)
         OR EXISTS (SELECT 1 FROM chat_webhooks cw WHERE cw.tenant_id = t.id AND cw.is_active = true)
      ORDER BY t.id ASC
      LIMIT 1
    `);
    
    if (fallbackTenant.rows.length > 0) {
      const tenantId = fallbackTenant.rows[0].id;
      console.log(`🆘 Using fallback tenant: ${tenantId} for company_id: ${companyId}`);
      
      // Map this tenant to the company_id
      await database.pool.query(`
        UPDATE tenants 
        SET pipedrive_company_id = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [companyId, tenantId]);
      
      return tenantId;
    }
    
    console.log(`❌ No suitable tenant found for company_id: ${companyId}`);
    return null;
    
  } catch (error) {
    console.error('Error in robust tenant identification:', error);
    return null;
  }
}

/**
 * Enhanced rule matching with smart event type handling
 */
async function findMatchingRulesRobust(tenantId, eventType) {
  try {
    // Strategy 1: Exact match
    let rules = await getRulesForEvent(tenantId, eventType);
    if (rules.length > 0) {
      console.log(`📋 Found ${rules.length} rules with exact match for: ${eventType}`);
      return rules;
    }
    
    // Strategy 2: Normalize and try common variations
    const normalizedEvents = normalizeEventType(eventType);
    for (const normalizedEvent of normalizedEvents) {
      if (normalizedEvent !== eventType) {
        rules = await getRulesForEvent(tenantId, normalizedEvent);
        if (rules.length > 0) {
          console.log(`📋 Found ${rules.length} rules with normalized event: ${normalizedEvent}`);
          return rules;
        }
      }
    }
    
    // Strategy 3: Wildcard patterns
    if (eventType.includes('.')) {
      const [entity] = eventType.split('.');
      const wildcardPattern = `${entity}.*`;
      rules = await getRulesForEvent(tenantId, wildcardPattern);
      if (rules.length > 0) {
        console.log(`📋 Found ${rules.length} rules with wildcard pattern: ${wildcardPattern}`);
        return rules;
      }
      
      // Try entity only
      rules = await getRulesForEvent(tenantId, entity);
      if (rules.length > 0) {
        console.log(`📋 Found ${rules.length} rules with entity: ${entity}`);
        return rules;
      }
    }
    
    return [];
    
  } catch (error) {
    console.error('Error in robust rule matching:', error);
    return [];
  }
}

/**
 * Normalize event types to handle Pipedrive variations
 */
function normalizeEventType(eventType) {
  const normalizations = [];
  
  // Handle deal status changes
  if (eventType === 'deal.change' || eventType === 'deal.update') {
    normalizations.push('deal.change', 'deal.update', 'deal.won', 'deal.lost');
  }
  
  // Handle creation events
  if (eventType === 'deal.added') {
    normalizations.push('deal.create', 'deal.new', 'deal.added');
  }
  
  // Handle person events
  if (eventType.startsWith('person.')) {
    const action = eventType.split('.')[1];
    normalizations.push(
      `person.${action}`,
      `contact.${action}`,
      eventType
    );
  }
  
  // Handle organization events
  if (eventType.startsWith('organization.')) {
    const action = eventType.split('.')[1];
    normalizations.push(
      `organization.${action}`,
      `org.${action}`,
      `company.${action}`,
      eventType
    );
  }
  
  // Always include the original
  if (!normalizations.includes(eventType)) {
    normalizations.push(eventType);
  }
  
  return normalizations;
}

/**
 * Send notification with retry logic
 */
async function sendNotificationWithRetry(rule, webhookData, targetWebhook, tenantId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await defaultChatClient.sendNotification(
        targetWebhook.webhook_url,
        webhookData,
        rule.template_mode,
        rule.custom_template,
        tenantId
      );
      
      return {
        success: true,
        message: result,
        messageId: result.messageId,
        attempt
      };
      
    } catch (error) {
      console.error(`❌ Notification attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.message,
          statusCode: error.response?.status,
          attempt
        };
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Health check for the fallback system
 */
async function healthCheck() {
  try {
    const database = require('./database');
    
    // Check database connection
    await database.pool.query('SELECT 1');
    
    // Check if we have active tenants with rules and webhooks
    const activeSetup = await database.pool.query(`
      SELECT COUNT(DISTINCT t.id) as active_tenants
      FROM tenants t
      WHERE EXISTS (SELECT 1 FROM rules r WHERE r.tenant_id = t.id AND r.enabled = true)
        AND EXISTS (SELECT 1 FROM chat_webhooks cw WHERE cw.tenant_id = t.id AND cw.is_active = true)
    `);
    
    return {
      healthy: true,
      database: 'connected',
      activeTenants: parseInt(activeSetup.rows[0].active_tenants),
      cacheSize: recentNotifications.size,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  processNotificationDirect,
  identifyTenantRobust,
  findMatchingRulesRobust,
  healthCheck
};