const express = require('express');
const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Import billing services
const {
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  handleCheckoutSuccess,
  getSubscription,
  getAvailablePlans
} = require('../services/stripe');

const { getUsageStatistics } = require('../middleware/quotaEnforcement');
const { 
  getTenantFeatures, 
  getUpgradeRecommendations, 
  requireFeature, 
  checkResourceLimit 
} = require('../middleware/featureGating');

/**
 * GET /api/v1/billing/plans
 * Get all available pricing plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = getAvailablePlans();
    
    res.json({
      success: true,
      plans
    });
    
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pricing plans'
    });
  }
});

/**
 * GET /api/v1/billing/subscription
 * Get subscription info without authentication (for pricing page)
 */
router.get('/subscription', async (req, res) => {
  try {
    // Return default response for unauthenticated users
    res.json({
      success: true,
      subscription: null,
      usage: {
        plan_tier: 'free',
        notifications_used: 0,
        notifications_limit: 100,
        webhooks_used: 0,
        webhooks_limit: 1,
        rules_used: 0,
        rules_limit: 3,
        usage_percentage: 0
      }
    });
  } catch (error) {
    console.error('Error getting default subscription info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load subscription information'
    });
  }
});

/**
 * GET /api/v1/billing/subscription/current
 * Get current subscription details for authenticated user
 */
router.get('/subscription/current', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tenantId = decoded.tenant_id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const { getTenantFeatures } = require('../middleware/featureGating');
    const features = await getTenantFeatures(tenantId);
    
    // Get actual subscription from database
    const { pool } = require('../services/database');
    const subscriptionResult = await pool.query(
      'SELECT * FROM subscriptions WHERE tenant_id = $1',
      [tenantId]
    );

    let subscription = null;
    if (subscriptionResult.rows.length > 0) {
      subscription = subscriptionResult.rows[0];
    }

    // Get current usage
    const usage = {
      plan_tier: features.plan_tier,
      notifications_used: 0, // Could be calculated from logs if needed
      notifications_limit: features.limits.notifications === -1 ? 999999 : features.limits.notifications,
      webhooks_used: 0, // Could be calculated from chat_webhooks if needed
      webhooks_limit: features.limits.webhooks === -1 ? 999 : features.limits.webhooks,
      rules_used: 0, // Could be calculated from rules if needed  
      rules_limit: features.limits.rules === -1 ? 999 : features.limits.rules,
      usage_percentage: 0
    };

    res.json({
      success: true,
      subscription,
      usage
    });
    
  } catch (error) {
    console.error('Error getting current subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load subscription information'
    });
  }
});

/**
 * GET /api/v1/billing/subscription/:tenantId
 * Get current subscription details for a tenant
 */
router.get('/subscription/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    const subscription = await getSubscription(tenantId);
    
    res.json({
      success: true,
      subscription
    });
    
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription details'
    });
  }
});

/**
 * POST /api/v1/billing/checkout
 * Create checkout session for plan upgrade
 */
router.post('/checkout', async (req, res) => {
  try {
    const { tenantId, planTier, successUrl, cancelUrl } = req.body;
    
    // Validate required fields
    if (!tenantId || !planTier || !successUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenantId, planTier, successUrl, cancelUrl'
      });
    }
    
    // Validate plan tier
    const plans = getAvailablePlans();
    if (!plans[planTier] || planTier === 'free') {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan tier'
      });
    }
    
    // Create checkout session
    const session = await createCheckoutSession(
      parseInt(tenantId),
      planTier,
      successUrl,
      cancelUrl
    );
    
    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

/**
 * POST /api/v1/billing/portal
 * Create customer portal session for subscription management
 */
router.post('/portal', async (req, res) => {
  try {
    const { tenantId, returnUrl } = req.body;
    
    if (!tenantId || !returnUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenantId, returnUrl'
      });
    }
    
    // Create portal session
    const session = await createPortalSession(
      parseInt(tenantId),
      returnUrl
    );
    
    res.json({
      success: true,
      portal_url: session.url
    });
    
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create portal session'
    });
  }
});

/**
 * POST /api/v1/billing/checkout/success
 * Handle successful checkout completion
 */
router.post('/checkout/success', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing session ID'
      });
    }
    
    const result = await handleCheckoutSuccess(sessionId);
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Error handling checkout success:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle checkout success'
    });
  }
});

/**
 * POST /api/v1/billing/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) {
      console.error('Stripe not configured');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }
    
    // Handle the webhook event
    await handleWebhookEvent(event);
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

/**
 * GET /api/v1/billing/usage/:tenantId
 * Get comprehensive usage statistics for a tenant
 */
router.get('/usage/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    const usageStats = await getUsageStatistics(tenantId);
    
    res.json({
      success: true,
      usage_statistics: usageStats
    });
    
  } catch (error) {
    console.error('Error getting usage statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics'
    });
  }
});

/**
 * POST /api/v1/billing/preview-upgrade
 * Preview what happens when upgrading to a new plan
 */
router.post('/preview-upgrade', async (req, res) => {
  try {
    const { tenantId, newPlanTier } = req.body;
    
    if (!tenantId || !newPlanTier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenantId, newPlanTier'
      });
    }
    
    const plans = getAvailablePlans();
    const currentSubscription = await getSubscription(parseInt(tenantId));
    const newPlan = plans[newPlanTier];
    
    if (!newPlan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan tier'
      });
    }
    
    const comparison = {
      current_plan: {
        tier: currentSubscription.plan_tier,
        name: currentSubscription.plan_config.name,
        price: currentSubscription.plan_config.price || 0,
        limits: currentSubscription.plan_config.limits
      },
      new_plan: {
        tier: newPlanTier,
        name: newPlan.name,
        price: newPlan.price || 0,
        limits: newPlan.limits
      },
      improvements: []
    };
    
    // Calculate improvements
    Object.keys(newPlan.limits).forEach(key => {
      const currentLimit = currentSubscription.plan_config.limits[key];
      const newLimit = newPlan.limits[key];
      
      if (newLimit > currentLimit) {
        comparison.improvements.push({
          feature: key,
          current: currentLimit,
          new: newLimit,
          improvement: newLimit - currentLimit
        });
      }
    });
    
    res.json({
      success: true,
      comparison
    });
    
  } catch (error) {
    console.error('Error previewing upgrade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview upgrade'
    });
  }
});

/**
 * GET /api/v1/billing/features/:tenantId
 * Get all available features for a tenant's plan
 */
router.get('/features/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    const features = await getTenantFeatures(tenantId);
    
    res.json({
      success: true,
      features
    });
    
  } catch (error) {
    console.error('Error getting tenant features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tenant features'
    });
  }
});

/**
 * POST /api/v1/billing/upgrade-recommendations
 * Get upgrade recommendations based on requested features
 */
router.post('/upgrade-recommendations', async (req, res) => {
  try {
    const { currentPlan, requestedFeatures } = req.body;
    
    if (!currentPlan || !requestedFeatures || !Array.isArray(requestedFeatures)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: currentPlan, requestedFeatures (array)'
      });
    }
    
    const recommendations = getUpgradeRecommendations(currentPlan, requestedFeatures);
    
    res.json({
      success: true,
      recommendations
    });
    
  } catch (error) {
    console.error('Error getting upgrade recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upgrade recommendations'
    });
  }
});

/**
 * GET /api/v1/billing/limits/:tenantId
 * Get current resource usage and limits for a tenant
 */
router.get('/limits/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    const { getSubscription } = require('../services/stripe');
    const { pool } = require('../services/database');
    
    const subscription = await getSubscription(tenantId);
    const { PLAN_LIMITS } = require('../middleware/featureGating');
    const limits = PLAN_LIMITS[subscription.plan_tier] || PLAN_LIMITS.free;
    
    // Get current usage
    const [webhooksResult, rulesResult, advancedRulesResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM chat_webhooks WHERE tenant_id = $1 AND is_active = true', [tenantId]),
      pool.query('SELECT COUNT(*) FROM rules WHERE tenant_id = $1 AND enabled = true', [tenantId]),
      pool.query(`
        SELECT COUNT(*) FROM rules 
        WHERE tenant_id = $1 
          AND enabled = true 
          AND (filters != '{}' OR target_channel_id IS NOT NULL OR custom_template IS NOT NULL)
      `, [tenantId])
    ]);
    
    const currentUsage = {
      notifications: subscription.monthly_notification_count || 0,
      webhooks: parseInt(webhooksResult.rows[0].count),
      rules: parseInt(rulesResult.rows[0].count),
      advanced_rules: parseInt(advancedRulesResult.rows[0].count)
    };
    
    const limitStatus = {};
    Object.keys(limits).forEach(resource => {
      const current = currentUsage[resource] || 0;
      const limit = limits[resource];
      limitStatus[resource] = {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        percentage: limit > 0 ? Math.round((current / limit) * 100) : 0,
        near_limit: limit > 0 ? (current / limit) >= 0.8 : false
      };
    });
    
    res.json({
      success: true,
      tenant_id: tenantId,
      plan_tier: subscription.plan_tier,
      limits: limitStatus
    });
    
  } catch (error) {
    console.error('Error getting limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get resource limits'
    });
  }
});

/**
 * GET /api/v1/billing/usage-history
 * Get usage history for the past N months
 */
router.get('/usage-history', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    
    // For now, return mock data since we don't have historical tracking
    // In production, this would query historical usage data
    const mockHistory = [];
    const currentDate = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Mock usage data - in real implementation this would come from database
      const usageData = {
        month: monthName,
        notifications_used: Math.floor(Math.random() * 80) + 10, // 10-90 notifications
        notifications_limit: 100,
        usage_percentage: 0
      };
      
      usageData.usage_percentage = (usageData.notifications_used / usageData.notifications_limit) * 100;
      mockHistory.push(usageData);
    }
    
    res.json(mockHistory);
    
  } catch (error) {
    console.error('Error getting usage history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage history'
    });
  }
});

module.exports = router;