const { checkFeatureAvailability } = require('./quotaEnforcement');

/**
 * Plan-based feature gating middleware
 * Ensures users can only access features available in their current plan
 */

// Feature availability mapping
const FEATURE_PLANS = {
  // Starter features
  'value_filtering': ['starter', 'pro', 'team'],
  'enhanced_formatting': ['starter', 'pro', 'team'],
  'stage_filtering': ['starter', 'pro', 'team'],
  'activity_notifications': ['starter', 'pro', 'team'],
  'usage_analytics': ['starter', 'pro', 'team'],
  
  // Professional features
  'channel_routing': ['pro', 'team'],
  'stalled_alerts': ['pro', 'team'],
  'custom_templates': ['pro', 'team'],
  'rich_formatting': ['pro', 'team'],
  'quiet_hours': ['pro', 'team'],
  'priority_support': ['pro', 'team'],
  'advanced_filtering': ['pro', 'team'],
  'probability_filtering': ['pro', 'team'],
  'owner_filtering': ['pro', 'team'],
  'time_filtering': ['pro', 'team'],
  
  // Team features
  'daily_summaries': ['team'],
  'team_metrics': ['team'],
  'api_access': ['team'],
  'dedicated_support': ['team'],
  'custom_field_filtering': ['team'],
  'tag_filtering': ['team'],
  'multi_channel_orchestration': ['team'],
  'pipeline_summaries': ['team'],
  'advanced_analytics': ['team']
};

// Resource limits by plan
const PLAN_LIMITS = {
  free: {
    notifications: 100,
    webhooks: 1,
    rules: 3,
    log_retention_days: 7,
    advanced_rules: 0
  },
  starter: {
    notifications: 1000,
    webhooks: 3,
    rules: 10,
    log_retention_days: 30,
    advanced_rules: 5
  },
  pro: {
    notifications: 10000,
    webhooks: 999,
    rules: 999,
    log_retention_days: 90,
    advanced_rules: 999
  },
  team: {
    notifications: 999999,
    webhooks: 999,
    rules: 999,
    log_retention_days: 365,
    advanced_rules: 999
  }
};

/**
 * Middleware to check if user has access to a specific feature
 * @param {string} feature - Feature name to check
 * @returns {Function} Express middleware function
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      // Extract tenant ID from request
      let tenantId = null;
      
      if (req.params.tenantId) {
        tenantId = parseInt(req.params.tenantId);
      } else if (req.body.tenantId) {
        tenantId = parseInt(req.body.tenantId);
      } else if (req.query.tenantId) {
        tenantId = parseInt(req.query.tenantId);
      }
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant ID required for feature access check',
          feature_blocked: true
        });
      }
      
      // Check feature availability
      const featureCheck = await checkFeatureAvailability(tenantId, feature);
      
      if (!featureCheck.has_access) {
        return res.status(403).json({
          error: `Feature '${feature}' not available in current plan`,
          feature_blocked: true,
          current_plan: featureCheck.plan_tier,
          available_in_plans: featureCheck.available_in_plans,
          requires_upgrade: featureCheck.requires_upgrade
        });
      }
      
      // Store feature info in request for downstream use
      req.featureAccess = featureCheck;
      
      next();
      
    } catch (error) {
      console.error('Error in feature gating middleware:', error);
      res.status(500).json({
        error: 'Feature access check failed',
        feature_blocked: true
      });
    }
  };
}

/**
 * Middleware to check resource limits
 * @param {string} resourceType - Type of resource (webhooks, rules, etc.)
 * @returns {Function} Express middleware function
 */
function checkResourceLimit(resourceType) {
  return async (req, res, next) => {
    try {
      let tenantId = null;
      
      if (req.params.tenantId) {
        tenantId = parseInt(req.params.tenantId);
      } else if (req.body.tenantId) {
        tenantId = parseInt(req.body.tenantId);
      }
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant ID required for resource limit check',
          limit_exceeded: true
        });
      }
      
      const { getSubscription } = require('../services/stripe');
      const { pool } = require('../services/database');
      
      const subscription = await getSubscription(tenantId);
      const limits = PLAN_LIMITS[subscription.plan_tier] || PLAN_LIMITS.free;
      
      let currentCount = 0;
      
      // Get current count based on resource type
      switch (resourceType) {
        case 'webhooks':
          const webhooksResult = await pool.query(
            'SELECT COUNT(*) FROM chat_webhooks WHERE tenant_id = $1 AND is_active = true',
            [tenantId]
          );
          currentCount = parseInt(webhooksResult.rows[0].count);
          break;
          
        case 'rules':
          const rulesResult = await pool.query(
            'SELECT COUNT(*) FROM rules WHERE tenant_id = $1 AND enabled = true',
            [tenantId]
          );
          currentCount = parseInt(rulesResult.rows[0].count);
          break;
          
        case 'advanced_rules':
          // Count rules with advanced filters
          const advancedRulesResult = await pool.query(`
            SELECT COUNT(*) FROM rules 
            WHERE tenant_id = $1 
              AND enabled = true 
              AND (
                filters != '{}' OR 
                target_channel_id IS NOT NULL OR
                custom_template IS NOT NULL
              )
          `, [tenantId]);
          currentCount = parseInt(advancedRulesResult.rows[0].count);
          break;
          
        default:
          return res.status(400).json({
            error: `Unknown resource type: ${resourceType}`,
            limit_exceeded: true
          });
      }
      
      const limit = limits[resourceType] || 0;
      
      if (currentCount >= limit) {
        return res.status(403).json({
          error: `${resourceType} limit exceeded`,
          limit_exceeded: true,
          current_count: currentCount,
          limit: limit,
          plan_tier: subscription.plan_tier,
          upgrade_required: true
        });
      }
      
      // Store limit info in request
      req.resourceLimits = {
        resource_type: resourceType,
        current_count: currentCount,
        limit: limit,
        remaining: limit - currentCount
      };
      
      next();
      
    } catch (error) {
      console.error('Error checking resource limits:', error);
      res.status(500).json({
        error: 'Resource limit check failed',
        limit_exceeded: true
      });
    }
  };
}

/**
 * Get all feature permissions for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Object} Complete feature access information
 */
async function getTenantFeatures(tenantId) {
  try {
    const { getSubscription } = require('../services/stripe');
    const subscription = await getSubscription(tenantId);
    const planTier = subscription.plan_tier;
    const limits = PLAN_LIMITS[planTier] || PLAN_LIMITS.free;
    
    // Check access to all features
    const features = {};
    for (const [feature, availablePlans] of Object.entries(FEATURE_PLANS)) {
      features[feature] = {
        available: availablePlans.includes(planTier),
        available_in_plans: availablePlans
      };
    }
    
    return {
      tenant_id: tenantId,
      plan_tier: planTier,
      limits: limits,
      features: features,
      can_upgrade: planTier !== 'team'
    };
    
  } catch (error) {
    console.error('Error getting tenant features:', error);
    throw error;
  }
}

/**
 * Generate upgrade recommendations based on requested features
 * @param {string} currentPlan - Current plan tier
 * @param {Array} requestedFeatures - List of requested features
 * @returns {Object} Upgrade recommendations
 */
function getUpgradeRecommendations(currentPlan, requestedFeatures) {
  const recommendations = {
    current_plan: currentPlan,
    requested_features: requestedFeatures,
    blocked_features: [],
    recommended_plan: currentPlan,
    upgrade_benefits: []
  };
  
  // Find blocked features
  for (const feature of requestedFeatures) {
    const availablePlans = FEATURE_PLANS[feature] || [];
    if (!availablePlans.includes(currentPlan)) {
      recommendations.blocked_features.push({
        feature,
        available_in_plans: availablePlans,
        minimum_plan: availablePlans[0] || 'team'
      });
    }
  }
  
  if (recommendations.blocked_features.length === 0) {
    return recommendations;
  }
  
  // Determine minimum plan needed
  const planHierarchy = ['free', 'starter', 'pro', 'team'];
  let minPlanIndex = planHierarchy.indexOf(currentPlan);
  
  for (const blocked of recommendations.blocked_features) {
    const requiredPlanIndex = planHierarchy.indexOf(blocked.minimum_plan);
    if (requiredPlanIndex > minPlanIndex) {
      minPlanIndex = requiredPlanIndex;
    }
  }
  
  recommendations.recommended_plan = planHierarchy[minPlanIndex];
  
  // Calculate benefits
  const currentLimits = PLAN_LIMITS[currentPlan];
  const newLimits = PLAN_LIMITS[recommendations.recommended_plan];
  
  Object.keys(newLimits).forEach(limit => {
    if (newLimits[limit] > currentLimits[limit]) {
      recommendations.upgrade_benefits.push({
        feature: limit,
        current: currentLimits[limit],
        new: newLimits[limit],
        improvement: newLimits[limit] - currentLimits[limit]
      });
    }
  });
  
  return recommendations;
}

/**
 * Middleware that adds feature access info to all responses
 */
const addFeatureInfo = async (req, res, next) => {
  try {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Add feature access info if tenant ID is available
      if (req.featureAccess && typeof data === 'object') {
        data._feature_access = {
          plan_tier: req.featureAccess.plan_tier,
          has_access: req.featureAccess.has_access
        };
      }
      
      if (req.resourceLimits && typeof data === 'object') {
        data._resource_limits = req.resourceLimits;
      }
      
      // Call original res.json
      originalJson.call(this, data);
    };
    
    next();
    
  } catch (error) {
    console.error('Error in feature info middleware:', error);
    next();
  }
};

module.exports = {
  requireFeature,
  checkResourceLimit,
  getTenantFeatures,
  getUpgradeRecommendations,
  addFeatureInfo,
  FEATURE_PLANS,
  PLAN_LIMITS
};