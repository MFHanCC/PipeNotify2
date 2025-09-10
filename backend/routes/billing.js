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

module.exports = router;