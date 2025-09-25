/**
 * Pre-built rule templates for easy onboarding
 * These templates provide common notification patterns that users can quickly apply
 */

const RULE_TEMPLATES = [
  {
    id: 'high-value-deals',
    name: 'High-Value Deal Alerts',
    description: 'Get notified when deals above $10,000 are created or updated',
    category: 'sales',
    difficulty: 'beginner',
    event_type: 'deal.*',
    template: {
      name: 'High-Value Deal Alerts - {{VALUE_THRESHOLD}}',
      event_type: 'deal.*',
      enabled: true,
      filters: {
        value_min: 10000
      },
      template_config: {
        template_mode: 'detailed',
        custom_template: null
      }
    },
    customization: {
      VALUE_THRESHOLD: {
        type: 'number',
        default: 10000,
        min: 1000,
        max: 1000000,
        step: 1000,
        description: 'Minimum deal value to trigger notifications'
      }
    },
    preview: {
      title: 'High-Value Deal Alert',
      description: 'Notifies your team when significant deals are created or updated, helping you stay on top of your biggest opportunities.'
    }
  },

  {
    id: 'deal-won-celebrations',
    name: 'Deal Won Celebrations',
    description: 'Celebrate team wins with special notifications for closed deals',
    category: 'celebrations',
    difficulty: 'beginner',
    event_type: 'deal.updated',
    template: {
      name: 'Deal Won Celebrations 🎉',
      event_type: 'deal.updated',
      enabled: true,
      filters: {
        stage_name: 'won'
      },
      template_config: {
        template_mode: 'custom',
        custom_template: '🎉 **DEAL WON!** 🎉\n\n💰 **{{deal.title}}** - ${{deal.value}}\n👤 **Rep:** {{deal.person_name}}\n🏢 **Company:** {{deal.org_name}}\n\n*Way to go, team! 🚀*'
      }
    },
    customization: {},
    preview: {
      title: 'Deal Won Celebrations 🎉',
      description: 'Creates celebratory notifications with emojis when deals are marked as won, boosting team morale.'
    }
  },

  {
    id: 'stalled-deal-monitor',
    name: 'Stalled Deal Monitor',
    description: 'Track deals that haven\'t been updated in the last 7 days',
    category: 'monitoring',
    difficulty: 'intermediate',
    event_type: 'deal.updated',
    template: {
      name: 'Stalled Deal Monitor - {{DAYS_INACTIVE}} days',
      event_type: 'deal.updated',
      enabled: true,
      filters: {
        time_inactive_days: 7
      },
      template_config: {
        template_mode: 'detailed',
        custom_template: null
      }
    },
    customization: {
      DAYS_INACTIVE: {
        type: 'number',
        default: 7,
        min: 1,
        max: 30,
        step: 1,
        description: 'Number of days without activity to consider a deal stalled'
      }
    },
    preview: {
      title: 'Stalled Deal Monitor',
      description: 'Helps prevent deals from falling through the cracks by monitoring for inactivity.'
    },
    requirements: ['pro', 'team']
  },

  {
    id: 'new-deal-assignments',
    name: 'New Deal Assignments',
    description: 'Notify team when new deals are assigned to specific reps',
    category: 'assignments',
    difficulty: 'beginner',
    event_type: 'deal.added',
    template: {
      name: 'New Deal Assignments - {{OWNER_NAME}}',
      event_type: 'deal.added',
      enabled: true,
      filters: {
        owner_name: 'John Smith'
      },
      template_config: {
        template_mode: 'compact',
        custom_template: null
      }
    },
    customization: {
      OWNER_NAME: {
        type: 'text',
        default: 'John Smith',
        description: 'Name of the deal owner to monitor'
      }
    },
    preview: {
      title: 'New Deal Assignments',
      description: 'Tracks when new deals are assigned to specific team members.'
    }
  },

  {
    id: 'pipeline-stage-tracking',
    name: 'Pipeline Stage Tracking',
    description: 'Monitor deals moving through specific pipeline stages',
    category: 'pipeline',
    difficulty: 'intermediate',
    event_type: 'deal.updated',
    template: {
      name: 'Pipeline Stage Tracking - {{STAGE_NAME}}',
      event_type: 'deal.updated',
      enabled: true,
      filters: {
        stage_name: 'Proposal'
      },
      template_config: {
        template_mode: 'detailed',
        custom_template: null
      }
    },
    customization: {
      STAGE_NAME: {
        type: 'select',
        options: ['Qualified', 'Proposal', 'Negotiation', 'Contract', 'Won', 'Lost'],
        default: 'Proposal',
        description: 'Pipeline stage to monitor'
      }
    },
    preview: {
      title: 'Pipeline Stage Tracking',
      description: 'Get notifications when deals reach critical stages in your sales pipeline.'
    },
    requirements: ['starter', 'pro', 'team']
  },

  {
    id: 'executive-dashboard',
    name: 'Executive Dashboard Alerts',
    description: 'High-level notifications for deals above $50,000',
    category: 'executive',
    difficulty: 'advanced',
    event_type: 'deal.*',
    template: {
      name: 'Executive Dashboard - ${{VALUE_THRESHOLD}}+',
      event_type: 'deal.*',
      enabled: true,
      filters: {
        value_min: 50000,
        probability_min: 75
      },
      template_config: {
        template_mode: 'custom',
        custom_template: '🎯 **EXECUTIVE ALERT**\n\n📊 **Deal:** {{deal.title}}\n💰 **Value:** ${{deal.value}}\n📈 **Probability:** {{deal.probability}}%\n👤 **Owner:** {{deal.person_name}}\n🏢 **Organization:** {{deal.org_name}}\n📅 **Expected Close:** {{deal.expected_close_date}}'
      }
    },
    customization: {
      VALUE_THRESHOLD: {
        type: 'number',
        default: 50000,
        min: 10000,
        max: 1000000,
        step: 10000,
        description: 'Minimum deal value for executive alerts'
      }
    },
    preview: {
      title: 'Executive Dashboard Alerts',
      description: 'Specialized notifications for high-value, high-probability deals that executives need to know about.'
    },
    requirements: ['pro', 'team']
  },

  {
    id: 'lost-deal-analysis',
    name: 'Lost Deal Analysis',
    description: 'Track and analyze deals that are marked as lost',
    category: 'analysis',
    difficulty: 'intermediate',
    event_type: 'deal.updated',
    template: {
      name: 'Lost Deal Analysis',
      event_type: 'deal.updated',
      enabled: true,
      filters: {
        stage_name: 'lost'
      },
      template_config: {
        template_mode: 'custom',
        custom_template: '❌ **DEAL LOST**\n\n📊 **Deal:** {{deal.title}}\n💰 **Value:** ${{deal.value}}\n👤 **Owner:** {{deal.person_name}}\n🏢 **Organization:** {{deal.org_name}}\n📝 **Reason:** {{deal.lost_reason}}\n\n*Review for improvement opportunities*'
      }
    },
    customization: {},
    preview: {
      title: 'Lost Deal Analysis',
      description: 'Helps track lost deals with context for continuous improvement of sales processes.'
    },
    requirements: ['starter', 'pro', 'team']
  },

  {
    id: 'team-activity-digest',
    name: 'Team Activity Digest',
    description: 'Daily summary of all deal activities for team leads',
    category: 'reporting',
    difficulty: 'advanced',
    event_type: 'deal.*',
    template: {
      name: 'Team Activity Digest',
      event_type: 'deal.*',
      enabled: true,
      filters: {},
      template_config: {
        template_mode: 'compact',
        custom_template: null
      }
    },
    customization: {},
    preview: {
      title: 'Team Activity Digest',
      description: 'Comprehensive overview of all team deal activities for managers and team leads.'
    },
    requirements: ['team']
  }
];

/**
 * Get all available rule templates
 * @param {string} planTier - User's plan tier
 * @returns {Array} Filtered templates based on plan
 */
function getRuleTemplates(planTier = 'free') {
  return RULE_TEMPLATES.filter(template => {
    if (!template.requirements) return true; // Available to all plans
    return template.requirements.includes(planTier);
  }).map(template => ({
    ...template,
    available: !template.requirements || template.requirements.includes(planTier)
  }));
}

/**
 * Get a specific rule template by ID
 * @param {string} templateId - Template ID
 * @returns {Object|null} Template or null if not found
 */
function getRuleTemplate(templateId) {
  return RULE_TEMPLATES.find(template => template.id === templateId) || null;
}

/**
 * Apply customization to a rule template
 * @param {Object} template - Rule template
 * @param {Object} customization - User customization values
 * @returns {Object} Customized rule configuration
 */
function applyTemplateCustomization(template, customization = {}) {
  const rule = JSON.parse(JSON.stringify(template.template)); // Deep copy
  
  // Apply customization values to the rule name and configuration
  Object.keys(customization).forEach(key => {
    const value = customization[key];
    const placeholder = `{{${key}}}`;
    
    // Replace in rule name
    if (rule.name && rule.name.includes(placeholder)) {
      rule.name = rule.name.replace(placeholder, value);
    }
    
    // Replace in custom template
    if (rule.template_config?.custom_template && 
        rule.template_config.custom_template.includes(placeholder)) {
      rule.template_config.custom_template = 
        rule.template_config.custom_template.replace(placeholder, value);
    }
    
    // Apply to filters based on customization type
    const customizationConfig = template.customization[key];
    if (customizationConfig) {
      switch (customizationConfig.type) {
        case 'number':
          if (key === 'VALUE_THRESHOLD') {
            rule.filters.value_min = parseInt(value);
          } else if (key === 'DAYS_INACTIVE') {
            rule.filters.time_inactive_days = parseInt(value);
          }
          break;
        case 'text':
          if (key === 'OWNER_NAME') {
            rule.filters.owner_name = value;
          }
          break;
        case 'select':
          if (key === 'STAGE_NAME') {
            rule.filters.stage_name = value.toLowerCase();
          }
          break;
      }
    }
  });
  
  return rule;
}

/**
 * Get templates by category
 * @param {string} category - Category name
 * @param {string} planTier - User's plan tier
 * @returns {Array} Templates in the category
 */
function getTemplatesByCategory(category, planTier = 'free') {
  return getRuleTemplates(planTier).filter(template => 
    template.category === category
  );
}

/**
 * Get all available categories
 * @param {string} planTier - User's plan tier
 * @returns {Array} List of categories with counts
 */
function getTemplateCategories(planTier = 'free') {
  const templates = getRuleTemplates(planTier);
  const categories = {};
  
  templates.forEach(template => {
    if (!categories[template.category]) {
      categories[template.category] = {
        name: template.category,
        displayName: template.category.charAt(0).toUpperCase() + template.category.slice(1),
        count: 0
      };
    }
    categories[template.category].count++;
  });
  
  return Object.values(categories);
}

module.exports = {
  RULE_TEMPLATES,
  getRuleTemplates,
  getRuleTemplate,
  applyTemplateCustomization,
  getTemplatesByCategory,
  getTemplateCategories
};