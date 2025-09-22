const { pool } = require('../services/database');
const { getSubscription, PLAN_CONFIGS } = require('../services/stripe');

/**
 * Usage tracking and quota enforcement middleware
 * Tracks notification usage and enforces plan limits
 */

/**
 * Track notification usage for a tenant
 * @param {number} tenantId - Tenant ID
 * @param {number} count - Number of notifications to add (default: 1)
 * @returns {Object} Usage tracking result
 */
async function trackNotificationUsage(tenantId, count = 1) {
  try {
    // Get current subscription
    const subscription = await getSubscription(tenantId);
    const currentCount = subscription.monthly_notification_count || 0;
    const newCount = currentCount + count;
    
    // Update usage counter
    await pool.query(`
      UPDATE subscriptions 
      SET 
        monthly_notification_count = $1,
        updated_at = NOW()
      WHERE tenant_id = $2
    `, [newCount, tenantId]);
    
    console.log(`📊 Usage tracked: Tenant ${tenantId}, +${count} notifications (${newCount} total)`);
    
    return {
      success: true,
      tenant_id: tenantId,
      previous_count: currentCount,
      new_count: newCount,
      limit: subscription.plan_config.limits.notifications,
      remaining: Math.max(0, subscription.plan_config.limits.notifications - newCount)
    };
    
  } catch (error) {
    console.error('Error tracking notification usage:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if tenant is within notification quota
 * @param {number} tenantId - Tenant ID
 * @param {number} requestedCount - Number of notifications requested (default: 1)
 * @returns {Object} Quota check result
 */
async function checkNotificationQuota(tenantId, requestedCount = 1) {
  try {
    // Skip quota enforcement if Stripe is not configured (development mode)
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log(`⚠️ Quota enforcement skipped for tenant ${tenantId} - Stripe not configured`);
      return {
        tenant_id: tenantId,
        plan_tier: 'free',
        current_usage: 0,
        requested: requestedCount,
        limit: 10000, // Allow high limit for development
        remaining: 10000,
        would_exceed: false,
        allowed: true,
        within_quota: true, // Add missing property for processor
        reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    }

    const subscription = await getSubscription(tenantId);
    const currentCount = subscription.monthly_notification_count || 0;
    const limit = subscription.plan_config.limits.notifications;
    const wouldExceed = (currentCount + requestedCount) > limit;
    
    const result = {
      tenant_id: tenantId,
      plan_tier: subscription.plan_tier,
      current_usage: currentCount,
      requested: requestedCount,
      limit: limit,
      remaining: Math.max(0, limit - currentCount),
      within_quota: !wouldExceed,
      usage_percentage: Math.round((currentCount / limit) * 100)
    };
    
    // Add warning levels
    if (result.usage_percentage >= 90) {
      result.warning_level = 'critical';
    } else if (result.usage_percentage >= 75) {
      result.warning_level = 'warning';
    } else {
      result.warning_level = 'normal';
    }
    
    return result;
    
  } catch (error) {
    console.error('Error checking notification quota:', error);
    return {
      success: false,
      error: error.message,
      within_quota: false // Fail safe - block if error
    };
  }
}

/**
 * Middleware to enforce notification quotas
 * Use this before processing webhooks that will send notifications
 */
const enforceNotificationQuota = async (req, res, next) => {
  try {
    // Extract tenant ID from request
    let tenantId = null;
    
    if (req.params.tenantId) {
      tenantId = parseInt(req.params.tenantId);
    } else if (req.body.tenantId) {
      tenantId = parseInt(req.body.tenantId);
    } else if (req.body.company_id) {
      // For webhook requests, lookup tenant by company_id
      const { getTenantByPipedriveCompanyId } = require('../services/database');
      const tenant = await getTenantByPipedriveCompanyId(req.body.company_id);
      tenantId = tenant?.id;
    }
    
    if (!tenantId) {
      console.error('No tenant ID found for quota enforcement');
      return res.status(400).json({
        error: 'Tenant ID required for quota enforcement',
        quota_exceeded: true
      });
    }
    
    // Check quota
    const quotaCheck = await checkNotificationQuota(tenantId, 1);
    
    if (!quotaCheck.within_quota) {
      console.log(`🚫 Quota exceeded for tenant ${tenantId}: ${quotaCheck.current_usage}/${quotaCheck.limit}`);
      
      return res.status(429).json({
        error: 'Notification quota exceeded',
        quota_exceeded: true,
        current_usage: quotaCheck.current_usage,
        limit: quotaCheck.limit,
        plan_tier: quotaCheck.plan_tier,
        upgrade_required: true
      });
    }
    
    // Store quota info in request for downstream use
    req.quotaInfo = quotaCheck;
    
    next();
    
  } catch (error) {
    console.error('Error in quota enforcement middleware:', error);
    res.status(500).json({
      error: 'Quota enforcement failed',
      quota_exceeded: true
    });
  }
};

/**
 * Middleware to track usage after successful notification
 * Use this after successfully sending notifications
 */
const trackUsageAfterSuccess = async (req, res, next) => {
  try {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Check if response indicates success
      const isSuccess = data && (
        data.success === true ||
        data.status === 'success' ||
        data.notifications_sent > 0 ||
        (data.rulesMatched && data.notificationsSent > 0)
      );
      
      if (isSuccess && req.quotaInfo) {
        // Track usage asynchronously (don't block response)
        const notificationCount = data.notifications_sent || data.notificationsSent || 1;
        trackNotificationUsage(req.quotaInfo.tenant_id, notificationCount)
          .catch(error => {
            console.error('Error tracking usage after success:', error);
          });
      }
      
      // Call original res.json
      originalJson.call(this, data);
    };
    
    next();
    
  } catch (error) {
    console.error('Error in usage tracking middleware:', error);
    next();
  }
};

/**
 * Get comprehensive usage statistics for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Object} Detailed usage statistics
 */
async function getUsageStatistics(tenantId) {
  try {
    const subscription = await getSubscription(tenantId);
    const quotaInfo = await checkNotificationQuota(tenantId, 0);
    
    // Get historical usage from logs
    const historyQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as notifications_sent,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_notifications,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_notifications
      FROM logs 
      WHERE tenant_id = $1 
        AND created_at >= DATE_TRUNC('month', NOW())
        AND created_at < DATE_TRUNC('month', NOW() + INTERVAL '1 month')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;
    
    const historyResult = await pool.query(historyQuery, [tenantId]);
    
    // Get webhook usage
    const webhookCountQuery = `
      SELECT COUNT(*) as webhook_count
      FROM chat_webhooks 
      WHERE tenant_id = $1 AND is_active = true
    `;
    
    const webhookResult = await pool.query(webhookCountQuery, [tenantId]);
    
    // Get rules usage
    const rulesCountQuery = `
      SELECT COUNT(*) as rules_count
      FROM rules 
      WHERE tenant_id = $1 AND enabled = true
    `;
    
    const rulesResult = await pool.query(rulesCountQuery, [tenantId]);
    
    const webhookCount = parseInt(webhookResult.rows[0]?.webhook_count || 0);
    const rulesCount = parseInt(rulesResult.rows[0]?.rules_count || 0);
    
    return {
      tenant_id: tenantId,
      plan_tier: subscription.plan_tier,
      billing_period: {
        start: subscription.current_period_start,
        end: subscription.current_period_end
      },
      notifications: {
        current_usage: quotaInfo.current_usage,
        limit: quotaInfo.limit,
        remaining: quotaInfo.remaining,
        percentage: quotaInfo.usage_percentage,
        warning_level: quotaInfo.warning_level
      },
      webhooks: {
        current_count: webhookCount,
        limit: subscription.plan_config.limits.webhooks,
        remaining: Math.max(0, subscription.plan_config.limits.webhooks - webhookCount)
      },
      rules: {
        current_count: rulesCount,
        limit: subscription.plan_config.limits.rules,
        remaining: Math.max(0, subscription.plan_config.limits.rules - rulesCount)
      },
      daily_history: historyResult.rows,
      total_notifications_this_month: historyResult.rows.reduce((sum, day) => sum + parseInt(day.notifications_sent), 0),
      success_rate: historyResult.rows.length > 0 
        ? Math.round(
            historyResult.rows.reduce((sum, day) => sum + parseInt(day.successful_notifications), 0) /
            historyResult.rows.reduce((sum, day) => sum + parseInt(day.notifications_sent), 0) * 100
          )
        : 0
    };
    
  } catch (error) {
    console.error('Error getting usage statistics:', error);
    throw error;
  }
}

/**
 * Reset monthly usage counters (called by billing webhook)
 * @param {number} tenantId - Tenant ID
 */
async function resetMonthlyUsage(tenantId) {
  try {
    await pool.query(`
      UPDATE subscriptions 
      SET 
        monthly_notification_count = 0,
        updated_at = NOW()
      WHERE tenant_id = $1
    `, [tenantId]);
    
    console.log(`🔄 Monthly usage reset for tenant ${tenantId}`);
    
    return { success: true, tenant_id: tenantId };
    
  } catch (error) {
    console.error('Error resetting monthly usage:', error);
    throw error;
  }
}

/**
 * Check if feature is available for tenant's plan
 * @param {number} tenantId - Tenant ID
 * @param {string} feature - Feature name
 * @returns {Object} Feature availability result
 */
async function checkFeatureAvailability(tenantId, feature) {
  try {
    const subscription = await getSubscription(tenantId);
    
    const featureMap = {
      'value_filtering': ['starter', 'pro', 'team'],
      'channel_routing': ['pro', 'team'],
      'stalled_alerts': ['pro', 'team'],
      'custom_templates': ['pro', 'team'],
      'rich_formatting': ['pro', 'team'],
      'quiet_hours': ['pro', 'team'],
      'daily_summaries': ['team'],
      'team_metrics': ['team'],
      'api_access': ['team'],
      'priority_support': ['pro', 'team'],
      'dedicated_support': ['team']
    };
    
    const availableInPlans = featureMap[feature] || [];
    const hasAccess = availableInPlans.includes(subscription.plan_tier);
    
    return {
      feature,
      tenant_id: tenantId,
      plan_tier: subscription.plan_tier,
      has_access: hasAccess,
      available_in_plans: availableInPlans,
      requires_upgrade: !hasAccess && subscription.plan_tier !== 'team'
    };
    
  } catch (error) {
    console.error('Error checking feature availability:', error);
    return {
      feature,
      has_access: false,
      error: error.message
    };
  }
}

module.exports = {
  trackNotificationUsage,
  checkNotificationQuota,
  enforceNotificationQuota,
  trackUsageAfterSuccess,
  getUsageStatistics,
  resetMonthlyUsage,
  checkFeatureAvailability
};