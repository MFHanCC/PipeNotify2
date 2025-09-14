/**
 * Default Rules Configuration by Subscription Tier
 * Provides pre-configured notification rules to give users immediate value
 */

/**
 * Free Tier: 3 fundamental rules covering basic deal lifecycle
 * Focus: Core deal events that provide immediate business value
 */
const FREE_TIER_RULES = [
  {
    name: "🎉 Deal Won Celebration",
    event_type: "deal.won", 
    template_mode: "simple",
    filters: {},
    enabled: true,
    description: "Get notified when deals are won to celebrate success",
    category: "outcomes",
    priority: 1
  },
  {
    name: "⚠️ Deal Lost Alert", 
    event_type: "deal.lost",
    template_mode: "simple", 
    filters: {},
    enabled: true,
    description: "Track lost opportunities for learning and improvement",
    category: "outcomes",
    priority: 2
  },
  {
    name: "✨ New Deal Created",
    event_type: "deal.create",
    template_mode: "simple",
    filters: {},
    enabled: true, 
    description: "Get alerted when new opportunities enter your pipeline",
    category: "pipeline",
    priority: 3
  },
  {
    name: "📝 Deal Updated",
    event_type: "deal.change",
    template_mode: "simple",
    filters: {},
    enabled: true,
    description: "Get notified when deals are modified or updated",
    category: "pipeline",
    priority: 4
  }
];

/**
 * Starter Tier: 5 rules adding deal progression and value filtering
 * Focus: Pipeline management and high-value opportunity tracking
 */
const STARTER_TIER_RULES = [
  ...FREE_TIER_RULES,
  {
    name: "📊 Deal Stage Changed",
    event_type: "deal.update",
    template_mode: "simple", 
    filters: {
      stage_change_required: true
    },
    enabled: true,
    description: "Track when deals move through your pipeline stages",
    category: "progression",
    priority: 5
  },
  {
    name: "💎 High-Value Deal Alert",
    event_type: "deal.*",
    template_mode: "simple",
    filters: {
      value_min: 10000
    },
    enabled: true,
    description: "Special attention for deals worth $10,000 or more",
    category: "value",
    priority: 6
  }
];

/**
 * Pro Tier: 7 rules adding advanced pipeline health monitoring
 * Focus: Proactive pipeline management and deal health
 */
const PRO_TIER_RULES = [
  ...STARTER_TIER_RULES,
  {
    name: "⏰ Stalled Deal Alert",
    event_type: "deal.stalled",
    template_mode: "detailed",
    filters: {
      days_inactive: 7
    },
    enabled: true,
    description: "Get alerted when deals haven't been updated in 7+ days",
    category: "health",
    priority: 7
  },
  {
    name: "📅 Deal Close Date Approaching", 
    event_type: "deal.update",
    template_mode: "detailed",
    filters: {
      close_date_within_days: 7,
      status: "open"
    },
    enabled: true,
    description: "Remind you when deal close dates are approaching",
    category: "timing",
    priority: 8
  }
];

/**
 * Team Tier: 10 rules adding team performance and advanced analytics
 * Focus: Team coordination and comprehensive pipeline insights
 */
const TEAM_TIER_RULES = [
  ...PRO_TIER_RULES,
  {
    name: "👥 Team Daily Summary",
    event_type: "summary.daily",
    template_mode: "detailed", 
    filters: {
      schedule: "daily",
      time: "09:00"
    },
    enabled: true,
    description: "Daily team performance and pipeline summary",
    category: "analytics",
    priority: 9
  },
  {
    name: "📈 Pipeline Health Check",
    event_type: "summary.weekly",
    template_mode: "detailed",
    filters: {
      schedule: "weekly", 
      day: "monday",
      time: "09:00"
    },
    enabled: true,
    description: "Weekly pipeline health and forecast report",
    category: "analytics",
    priority: 10
  },
  {
    name: "🔥 Hot Deal Alert",
    event_type: "deal.*",
    template_mode: "detailed",
    filters: {
      probability_min: 80,
      value_min: 5000
    },
    enabled: true,
    description: "Alert for high-probability, valuable deals needing attention",
    category: "opportunity",
    priority: 11
  }
];

/**
 * Plan-based rule mapping
 */
const PLAN_DEFAULT_RULES = {
  free: FREE_TIER_RULES,
  starter: STARTER_TIER_RULES,
  pro: PRO_TIER_RULES,
  team: TEAM_TIER_RULES
};

/**
 * Get default rules for a specific subscription tier
 * @param {string} planTier - Subscription plan (free, starter, pro, team)
 * @returns {Array} Array of default rule templates
 */
function getDefaultRulesForPlan(planTier) {
  const rules = PLAN_DEFAULT_RULES[planTier?.toLowerCase()] || FREE_TIER_RULES;
  return rules.map(rule => ({
    ...rule,
    is_default: true,
    auto_created: true,
    plan_tier: planTier
  }));
}

/**
 * Get additional rules when upgrading from one tier to another
 * @param {string} fromPlan - Current plan tier
 * @param {string} toPlan - Target plan tier  
 * @returns {Array} Array of new rule templates to add
 */
function getUpgradeRules(fromPlan, toPlan) {
  const currentRules = PLAN_DEFAULT_RULES[fromPlan?.toLowerCase()] || [];
  const newPlanRules = PLAN_DEFAULT_RULES[toPlan?.toLowerCase()] || [];
  
  // Get rules that are in new plan but not in current plan
  const currentRuleNames = currentRules.map(r => r.name);
  const additionalRules = newPlanRules.filter(
    rule => !currentRuleNames.includes(rule.name)
  );
  
  return additionalRules.map(rule => ({
    ...rule,
    is_default: true,
    auto_created: true,
    plan_tier: toPlan,
    upgrade_addition: true
  }));
}

/**
 * Get rule categories for UI organization
 * @returns {Object} Categories with descriptions and icons
 */
function getRuleCategories() {
  return {
    outcomes: {
      name: "Deal Outcomes",
      description: "Won and lost deal notifications",
      icon: "🎯",
      color: "green"
    },
    pipeline: {
      name: "Pipeline Activity", 
      description: "New deals and pipeline changes",
      icon: "📊",
      color: "blue"
    },
    progression: {
      name: "Deal Progression",
      description: "Stage changes and deal movement",
      icon: "📈", 
      color: "purple"
    },
    value: {
      name: "Value-Based Alerts",
      description: "High-value deal notifications",
      icon: "💎",
      color: "yellow"
    },
    health: {
      name: "Pipeline Health",
      description: "Stalled deals and health monitoring", 
      icon: "⚡",
      color: "orange"
    },
    timing: {
      name: "Time-Based Alerts",
      description: "Date and deadline notifications",
      icon: "⏰",
      color: "red"
    },
    analytics: {
      name: "Team Analytics",
      description: "Summary reports and insights",
      icon: "📊",
      color: "indigo"
    },
    opportunity: {
      name: "Hot Opportunities",
      description: "High-probability deal alerts", 
      icon: "🔥",
      color: "pink"
    }
  };
}

/**
 * Validate rule template structure
 * @param {Object} ruleTemplate - Rule template to validate
 * @returns {Object} Validation result with success flag and errors
 */
function validateRuleTemplate(ruleTemplate) {
  const errors = [];
  
  if (!ruleTemplate.name || typeof ruleTemplate.name !== 'string') {
    errors.push('Rule name is required and must be a string');
  }
  
  if (!ruleTemplate.event_type || typeof ruleTemplate.event_type !== 'string') {
    errors.push('Event type is required and must be a string');
  }
  
  if (!ruleTemplate.template_mode || !['simple', 'compact', 'detailed', 'custom'].includes(ruleTemplate.template_mode)) {
    errors.push('Template mode must be one of: simple, compact, detailed, custom');
  }
  
  if (ruleTemplate.filters && typeof ruleTemplate.filters !== 'object') {
    errors.push('Filters must be an object');
  }
  
  if (typeof ruleTemplate.enabled !== 'boolean') {
    errors.push('Enabled must be a boolean');
  }
  
  return {
    success: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  getDefaultRulesForPlan,
  getUpgradeRules, 
  getRuleCategories,
  validateRuleTemplate,
  PLAN_DEFAULT_RULES,
  FREE_TIER_RULES,
  STARTER_TIER_RULES,
  PRO_TIER_RULES,
  TEAM_TIER_RULES
};