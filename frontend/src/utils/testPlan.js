/**
 * Testing utility to override plan tier in development
 * This allows testing different plan features without modifying the database
 */

// Set this to test different plans: 'free', 'starter', 'pro', 'team'
const TEST_PLAN_OVERRIDE = 'team'; // Change this to test different plans

export function getTestPlanFeatures(originalFeatures) {
  // Temporarily allow override in production for marketplace submission
  // TODO: Remove this after marketplace approval
  const allowOverride = true; // process.env.NODE_ENV === 'development';
  if (!allowOverride) {
    return originalFeatures;
  }
  
  // If no override is set, return original
  if (!TEST_PLAN_OVERRIDE || TEST_PLAN_OVERRIDE === 'original') {
    return originalFeatures;
  }
  
  const planConfigs = {
    free: {
      plan_tier: 'free',
      limits: {
        notifications: 100,
        webhooks: 1,
        rules: 3,
        log_retention_days: 7,
        advanced_rules: 0
      },
      features: {
        deal_updated_notifications: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
        value_filtering: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
        enhanced_formatting: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
        stage_filtering: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
        activity_notifications: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
        usage_analytics: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
        channel_routing: { available: false, available_in_plans: ['pro', 'team'] },
        stalled_alerts: { available: false, available_in_plans: ['pro', 'team'] },
        custom_templates: { available: false, available_in_plans: ['pro', 'team'] },
        rich_formatting: { available: false, available_in_plans: ['pro', 'team'] },
        quiet_hours: { available: false, available_in_plans: ['pro', 'team'] },
        priority_support: { available: false, available_in_plans: ['pro', 'team'] },
        advanced_filtering: { available: false, available_in_plans: ['pro', 'team'] },
        probability_filtering: { available: false, available_in_plans: ['pro', 'team'] },
        owner_filtering: { available: false, available_in_plans: ['pro', 'team'] },
        time_filtering: { available: false, available_in_plans: ['pro', 'team'] }
      }
    },
    
    starter: {
      plan_tier: 'starter',
      limits: {
        notifications: 1000,
        webhooks: 3,
        rules: 10,
        log_retention_days: 30,
        advanced_rules: 5
      },
      features: {
        deal_updated_notifications: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        value_filtering: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        enhanced_formatting: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        stage_filtering: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        activity_notifications: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        usage_analytics: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        channel_routing: { available: false, available_in_plans: ['pro', 'team'] },
        stalled_alerts: { available: false, available_in_plans: ['pro', 'team'] },
        custom_templates: { available: false, available_in_plans: ['pro', 'team'] },
        rich_formatting: { available: false, available_in_plans: ['pro', 'team'] },
        quiet_hours: { available: false, available_in_plans: ['pro', 'team'] },
        priority_support: { available: false, available_in_plans: ['pro', 'team'] },
        advanced_filtering: { available: false, available_in_plans: ['pro', 'team'] },
        probability_filtering: { available: false, available_in_plans: ['pro', 'team'] },
        owner_filtering: { available: false, available_in_plans: ['pro', 'team'] },
        time_filtering: { available: false, available_in_plans: ['pro', 'team'] }
      }
    },
    
    pro: {
      plan_tier: 'pro',
      limits: {
        notifications: 5000,
        webhooks: 10,
        rules: 50,
        log_retention_days: 90,
        advanced_rules: 25
      },
      features: {
        deal_updated_notifications: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        value_filtering: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        enhanced_formatting: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        stage_filtering: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        activity_notifications: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        usage_analytics: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        channel_routing: { available: true, available_in_plans: ['pro', 'team'] },
        stalled_alerts: { available: true, available_in_plans: ['pro', 'team'] },
        custom_templates: { available: true, available_in_plans: ['pro', 'team'] },
        rich_formatting: { available: true, available_in_plans: ['pro', 'team'] },
        quiet_hours: { available: true, available_in_plans: ['pro', 'team'] },
        priority_support: { available: true, available_in_plans: ['pro', 'team'] },
        advanced_filtering: { available: true, available_in_plans: ['pro', 'team'] },
        probability_filtering: { available: true, available_in_plans: ['pro', 'team'] },
        owner_filtering: { available: true, available_in_plans: ['pro', 'team'] },
        time_filtering: { available: true, available_in_plans: ['pro', 'team'] }
      }
    },
    
    team: {
      plan_tier: 'team',
      limits: {
        notifications: -1, // unlimited
        webhooks: -1, // unlimited
        rules: -1, // unlimited
        log_retention_days: 365,
        advanced_rules: -1 // unlimited
      },
      features: {
        deal_updated_notifications: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        value_filtering: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        enhanced_formatting: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        stage_filtering: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        activity_notifications: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        usage_analytics: { available: true, available_in_plans: ['starter', 'pro', 'team'] },
        channel_routing: { available: true, available_in_plans: ['pro', 'team'] },
        stalled_alerts: { available: true, available_in_plans: ['pro', 'team'] },
        custom_templates: { available: true, available_in_plans: ['pro', 'team'] },
        rich_formatting: { available: true, available_in_plans: ['pro', 'team'] },
        quiet_hours: { available: true, available_in_plans: ['pro', 'team'] },
        priority_support: { available: true, available_in_plans: ['pro', 'team'] },
        advanced_filtering: { available: true, available_in_plans: ['pro', 'team'] },
        probability_filtering: { available: true, available_in_plans: ['pro', 'team'] },
        owner_filtering: { available: true, available_in_plans: ['pro', 'team'] },
        time_filtering: { available: true, available_in_plans: ['pro', 'team'] }
      }
    }
  };
  
  const testConfig = planConfigs[TEST_PLAN_OVERRIDE];
  if (!testConfig) {
    console.warn(`Invalid TEST_PLAN_OVERRIDE: ${TEST_PLAN_OVERRIDE}. Using original.`);
    return originalFeatures;
  }
  
  console.log(`🧪 [DEV] Testing as ${TEST_PLAN_OVERRIDE.toUpperCase()} plan user`);
  
  return {
    ...originalFeatures,
    ...testConfig,
    tenant_id: originalFeatures?.tenant_id || 1,
    can_upgrade: TEST_PLAN_OVERRIDE !== 'team'
  };
}