const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const { pool } = require('./database');

/**
 * Check if Stripe is configured and throw an error if not
 */
function ensureStripeConfigured() {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }
}

/**
 * Stripe billing service for subscription management
 * Handles customer creation, subscription management, and webhook processing
 */

// Plan configurations
const PLAN_CONFIGS = {
  free: {
    name: 'Free',
    price_id: null,
    features: ['100 notifications/month', '1 Google Chat webhook', '3 custom notification rules', 'Basic email support'],
    limits: {
      notifications: 100,
      webhooks: 1,
      rules: 3,
      log_retention_days: 7
    }
  },
  starter: {
    name: 'Starter',
    price_id: process.env.STRIPE_PRICE_STARTER,
    price: 9,
    features: ['1,000 notifications/month', '3 Google Chat webhooks', '10 custom notification rules', 'Advanced filtering', 'Email support'],
    limits: {
      notifications: 1000,
      webhooks: 3,
      rules: 10,
      log_retention_days: 30
    }
  },
  pro: {
    name: 'Professional',
    price_id: process.env.STRIPE_PRICE_PRO,
    price: 29,
    features: ['10,000 notifications/month', 'Unlimited webhooks', 'Unlimited custom rules', 'Multi-channel routing', 'Stalled deal alerts', 'Custom message templates', 'Priority support'],
    limits: {
      notifications: 10000,
      webhooks: 999,
      rules: 999,
      log_retention_days: 90
    }
  },
  team: {
    name: 'Team',
    price_id: process.env.STRIPE_PRICE_TEAM,
    price: 79,
    features: ['Unlimited notifications', 'Unlimited custom rules', 'Advanced filtering', 'Daily digest summaries', 'Team usage analytics', '1-year activity logs', 'Full API access', 'Dedicated account manager'],
    limits: {
      notifications: 999999,
      webhooks: 999,
      rules: 999,
      log_retention_days: 365
    }
  }
};

/**
 * Get or create Stripe customer for tenant
 * @param {number} tenantId - Tenant ID
 * @param {Object} customerData - Customer information
 * @returns {Object} Stripe customer
 */
async function getOrCreateCustomer(tenantId, customerData = {}) {
  ensureStripeConfigured();
  try {
    // Check if customer already exists
    const existingResult = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1',
      [tenantId]
    );

    if (existingResult.rows.length > 0 && existingResult.rows[0].stripe_customer_id) {
      const customerId = existingResult.rows[0].stripe_customer_id;
      const customer = await stripe.customers.retrieve(customerId);
      console.log(`📋 Found existing Stripe customer: ${customerId}`);
      return customer;
    }

    // Get tenant information
    const tenantResult = await pool.query(
      'SELECT company_name FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const tenant = tenantResult.rows[0];

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      name: customerData.name || tenant.company_name,
      email: customerData.email,
      metadata: {
        tenant_id: tenantId.toString(),
        company_name: tenant.company_name
      }
    });

    // Store customer ID in database
    await pool.query(`
      INSERT INTO subscriptions (tenant_id, stripe_customer_id, plan_tier, status)
      VALUES ($1, $2, 'free', 'active')
      ON CONFLICT (tenant_id) DO UPDATE SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        updated_at = NOW()
    `, [tenantId, customer.id]);

    console.log(`✅ Created new Stripe customer: ${customer.id} for tenant ${tenantId}`);
    return customer;

  } catch (error) {
    console.error('Error getting/creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Create checkout session for subscription
 * @param {number} tenantId - Tenant ID
 * @param {string} planTier - Plan tier (starter, pro, team)
 * @param {string} successUrl - Success redirect URL
 * @param {string} cancelUrl - Cancel redirect URL
 * @returns {Object} Checkout session
 */
async function createCheckoutSession(tenantId, planTier, successUrl, cancelUrl) {
  ensureStripeConfigured();
  try {
    if (!PLAN_CONFIGS[planTier] || planTier === 'free') {
      throw new Error('Invalid plan tier for checkout');
    }

    const plan = PLAN_CONFIGS[planTier];
    if (!plan.price_id) {
      throw new Error(`Price ID not configured for plan: ${planTier}`);
    }

    // Get or create customer
    const customer = await getOrCreateCustomer(tenantId);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: plan.price_id,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenant_id: tenantId.toString(),
        plan_tier: planTier
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId.toString(),
          plan_tier: planTier
        }
      }
    });

    console.log(`💳 Created checkout session: ${session.id} for tenant ${tenantId}, plan ${planTier}`);
    return session;

  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Create customer portal session for managing subscription
 * @param {number} tenantId - Tenant ID
 * @param {string} returnUrl - Return URL after portal session
 * @returns {Object} Portal session
 */
async function createPortalSession(tenantId, returnUrl) {
  ensureStripeConfigured();
  try {
    // Get customer
    const result = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1',
      [tenantId]
    );

    if (result.rows.length === 0 || !result.rows[0].stripe_customer_id) {
      throw new Error('No Stripe customer found for tenant');
    }

    const customerId = result.rows[0].stripe_customer_id;

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    console.log(`🏪 Created portal session for tenant ${tenantId}`);
    return session;

  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
}

/**
 * Handle successful checkout completion
 * @param {string} sessionId - Checkout session ID
 */
async function handleCheckoutSuccess(sessionId) {
  ensureStripeConfigured();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const tenantId = parseInt(session.metadata.tenant_id);
    const planTier = session.metadata.plan_tier;

    console.log(`✅ Checkout successful for tenant ${tenantId}, upgrading to ${planTier}`);

    // Update subscription in database
    const now = new Date();
    await pool.query(`
      UPDATE subscriptions 
      SET 
        stripe_subscription_id = $1,
        plan_tier = $2,
        status = 'active',
        current_period_start = $3,
        current_period_end = $4,
        monthly_notification_count = 0,
        updated_at = NOW()
      WHERE tenant_id = $5
    `, [
      session.subscription,
      planTier,
      now,
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      tenantId
    ]);

    // Log the upgrade
    console.log(`📈 Tenant ${tenantId} upgraded to ${planTier} plan`);

    return {
      success: true,
      tenant_id: tenantId,
      plan_tier: planTier,
      subscription_id: session.subscription
    };

  } catch (error) {
    console.error('Error handling checkout success:', error);
    throw error;
  }
}

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe webhook event
 */
async function handleWebhookEvent(event) {
  ensureStripeConfigured();
  try {
    console.log(`🔔 Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSuccess(event.data.object.id);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

  } catch (error) {
    console.error('Error handling webhook event:', error);
    throw error;
  }
}

/**
 * Handle successful invoice payment
 * @param {Object} invoice - Stripe invoice object
 */
async function handleInvoicePaymentSucceeded(invoice) {
  ensureStripeConfigured();
  try {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    // Reset monthly usage counter
    await pool.query(`
      UPDATE subscriptions 
      SET 
        monthly_notification_count = 0,
        current_period_start = $1,
        current_period_end = $2,
        status = 'active',
        updated_at = NOW()
      WHERE stripe_subscription_id = $3
    `, [
      new Date(invoice.period_start * 1000),
      new Date(invoice.period_end * 1000),
      subscriptionId
    ]);

    console.log(`💳 Payment succeeded for subscription: ${subscriptionId}`);

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

/**
 * Handle failed invoice payment
 * @param {Object} invoice - Stripe invoice object
 */
async function handleInvoicePaymentFailed(invoice) {
  ensureStripeConfigured();
  try {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    // Mark subscription as past due
    await pool.query(`
      UPDATE subscriptions 
      SET 
        status = 'past_due',
        updated_at = NOW()
      WHERE stripe_subscription_id = $1
    `, [subscriptionId]);

    console.log(`❌ Payment failed for subscription: ${subscriptionId}`);

    // TODO: Send notification to customer about failed payment
    // TODO: Implement grace period before downgrading to free

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

/**
 * Handle subscription updates
 * @param {Object} subscription - Stripe subscription object
 */
async function handleSubscriptionUpdated(subscription) {
  ensureStripeConfigured();
  try {
    const tenantId = parseInt(subscription.metadata.tenant_id);
    const planTier = subscription.metadata.plan_tier;

    await pool.query(`
      UPDATE subscriptions 
      SET 
        plan_tier = $1,
        status = $2,
        current_period_start = $3,
        current_period_end = $4,
        updated_at = NOW()
      WHERE stripe_subscription_id = $5
    `, [
      planTier,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
      subscription.id
    ]);

    console.log(`📝 Subscription updated: ${subscription.id}, status: ${subscription.status}`);

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

/**
 * Handle subscription cancellation
 * @param {Object} subscription - Stripe subscription object
 */
async function handleSubscriptionCanceled(subscription) {
  ensureStripeConfigured();
  try {
    // Downgrade to free plan
    await pool.query(`
      UPDATE subscriptions 
      SET 
        plan_tier = 'free',
        status = 'canceled',
        stripe_subscription_id = NULL,
        monthly_notification_count = 0,
        updated_at = NOW()
      WHERE stripe_subscription_id = $1
    `, [subscription.id]);

    console.log(`❌ Subscription canceled: ${subscription.id}`);

  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

/**
 * Get subscription details for tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Object} Subscription details
 */
async function getSubscription(tenantId) {
  try {
    // Check if subscriptions table exists first
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscriptions'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️  subscriptions table does not exist. Run migration: npm run migrate');
      
      // Check if this is an enterprise/team customer
      try {
        const tenantCheck = await pool.query('SELECT pipedrive_company_id, company_name FROM tenants WHERE id = $1', [tenantId]);
        if (tenantCheck.rows.length > 0) {
          const tenant = tenantCheck.rows[0];
          
          // Known enterprise customer
          const enterpriseCompanyId = process.env.ENTERPRISE_COMPANY_ID;
          if (enterpriseCompanyId && tenant.pipedrive_company_id == enterpriseCompanyId) {
            console.log('🚀 Known enterprise customer detected - assigning Team plan features');
            return {
              tenant_id: tenantId,
              plan_tier: 'team',
              status: 'active',
              monthly_notification_count: 0,
              plan_config: PLAN_CONFIGS.team
            };
          }
          
          // TODO: Add additional Team plan customer detection logic here
          // For now, we'll check in the subscription creation logic below
        }
      } catch (tenantCheckError) {
        console.error('Error checking tenant details:', tenantCheckError);
      }
      
      // Return default free plan if table doesn't exist and not enterprise
      return {
        tenant_id: tenantId,
        plan_tier: 'free',
        status: 'active',
        monthly_notification_count: 0,
        plan_config: PLAN_CONFIGS.free
      };
    }

    const result = await pool.query(`
      SELECT * FROM subscriptions WHERE tenant_id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      // Check if this is an enterprise/team customer before creating subscription
      let planTier = 'free';
      let planPeriodEnd = null;
      
      try {
        const tenantCheck = await pool.query('SELECT pipedrive_company_id, company_name FROM tenants WHERE id = $1', [tenantId]);
        if (tenantCheck.rows.length > 0) {
          const tenant = tenantCheck.rows[0];
          
          // Known enterprise customer
          const enterpriseCompanyId = process.env.ENTERPRISE_COMPANY_ID;
          if (enterpriseCompanyId && tenant.pipedrive_company_id == enterpriseCompanyId) {
            console.log('🚀 Known enterprise customer detected - auto-upgrading to Team plan');
            planTier = 'team';
            planPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
          }
          
          // TODO: Add logic for other Team plan customers
          // For immediate fix, you can add specific company IDs or names here
          
          console.log(`📋 Tenant details: Company="${tenant.company_name}", PipedriveID="${tenant.pipedrive_company_id}"`);
        }
      } catch (tenantCheckError) {
        console.error('Error checking tenant details:', tenantCheckError);
      }
      
      // Create subscription record with appropriate plan
      const now = new Date();
      await pool.query(`
        INSERT INTO subscriptions (tenant_id, plan_tier, status, current_period_start, current_period_end)
        VALUES ($1, $2, 'active', $3, $4)
      `, [tenantId, planTier, now, planPeriodEnd]);

      return {
        tenant_id: tenantId,
        plan_tier: planTier,
        status: 'active',
        monthly_notification_count: 0,
        current_period_start: now,
        current_period_end: planPeriodEnd,
        plan_config: PLAN_CONFIGS[planTier]
      };
    }

    const subscription = result.rows[0];
    
    // Auto-upgrade enterprise customer if still on free plan
    if (subscription.plan_tier === 'free') {
      try {
        const tenantCheck = await pool.query('SELECT pipedrive_company_id FROM tenants WHERE id = $1', [tenantId]);
        const enterpriseCompanyId = process.env.ENTERPRISE_COMPANY_ID;
        if (tenantCheck.rows.length > 0 && enterpriseCompanyId && tenantCheck.rows[0].pipedrive_company_id == enterpriseCompanyId) {
          console.log('🚀 Enterprise customer on free plan - auto-upgrading to Team plan');
          
          const now = new Date();
          const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          
          const upgradeResult = await pool.query(`
            UPDATE subscriptions 
            SET plan_tier = 'team', 
                status = 'active',
                current_period_start = $1,
                current_period_end = $2,
                updated_at = NOW()
            WHERE tenant_id = $3
            RETURNING *
          `, [now, oneYearFromNow, tenantId]);
          
          const upgradedSubscription = upgradeResult.rows[0];
          console.log('✅ Auto-upgraded to Team plan successfully');
          
          return {
            ...upgradedSubscription,
            plan_config: PLAN_CONFIGS.team
          };
        }
      } catch (upgradeError) {
        console.error('Error auto-upgrading enterprise customer:', upgradeError);
      }
    }
    
    const planConfig = PLAN_CONFIGS[subscription.plan_tier] || PLAN_CONFIGS.free;

    return {
      ...subscription,
      plan_config: planConfig
    };

  } catch (error) {
    console.error('Error getting subscription:', error);
    throw error;
  }
}

/**
 * Get all available plans
 * @returns {Object} All plan configurations
 */
function getAvailablePlans() {
  return PLAN_CONFIGS;
}

module.exports = {
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  handleCheckoutSuccess,
  getSubscription,
  getAvailablePlans,
  PLAN_CONFIGS
};