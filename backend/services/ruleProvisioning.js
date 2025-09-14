const { pool } = require('./database');
const { getDefaultRulesForPlan, getUpgradeRules, validateRuleTemplate } = require('../config/defaultRules');
const { getSubscription } = require('./stripe');

/**
 * Rule Provisioning Service
 * Automatically creates default rules based on subscription tiers
 */

/**
 * Main function to provision default rules for a tenant
 * @param {number} tenantId - Tenant ID
 * @param {string} planTier - Subscription tier (free, starter, pro, team)
 * @param {string} provisioningType - Type of provisioning ('initial', 'upgrade', 'manual')
 * @param {string} fromPlan - Previous plan tier (for upgrades)
 * @returns {Object} Provisioning result
 */
async function provisionDefaultRules(tenantId, planTier = null, provisioningType = 'initial', fromPlan = null) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`🔧 Starting rule provisioning for tenant ${tenantId}`, {
      planTier,
      provisioningType,
      fromPlan
    });

    // Get tenant's current subscription if planTier not provided
    if (!planTier) {
      try {
        const subscription = await getSubscription(tenantId);
        planTier = subscription.plan_tier || 'free';
      } catch (error) {
        console.warn(`Could not get subscription for tenant ${tenantId}, defaulting to free tier`);
        planTier = 'free';
      }
    }

    // Get the appropriate rule templates
    let ruleTemplates;
    if (provisioningType === 'upgrade' && fromPlan) {
      ruleTemplates = getUpgradeRules(fromPlan, planTier);
      console.log(`📈 Getting upgrade rules from ${fromPlan} to ${planTier}: ${ruleTemplates.length} rules`);
    } else {
      ruleTemplates = getDefaultRulesForPlan(planTier);
      console.log(`📋 Getting default rules for ${planTier}: ${ruleTemplates.length} rules`);
    }

    if (ruleTemplates.length === 0) {
      console.log('No rule templates found for provisioning');
      await client.query('ROLLBACK');
      return {
        success: true,
        tenant_id: tenantId,
        plan_tier: planTier,
        rules_created: 0,
        message: 'No new rules to provision'
      };
    }

    // Get tenant's primary webhook
    const webhookResult = await client.query(
      'SELECT id, name FROM chat_webhooks WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1',
      [tenantId]
    );

    if (webhookResult.rows.length === 0) {
      console.error(`No active webhooks found for tenant ${tenantId}`);
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'No active webhooks found for tenant',
        tenant_id: tenantId,
        requires_webhook_setup: true
      };
    }

    const primaryWebhook = webhookResult.rows[0];
    console.log(`✅ Using primary webhook: ${primaryWebhook.name} (ID: ${primaryWebhook.id})`);

    // Check for existing default rules to avoid duplicates
    const existingRulesResult = await client.query(
      'SELECT name, rule_template_id FROM rules WHERE tenant_id = $1 AND is_default = true',
      [tenantId]
    );

    const existingRuleNames = existingRulesResult.rows.map(r => r.name);
    const existingTemplateIds = existingRulesResult.rows.map(r => r.rule_template_id);

    console.log(`🔍 Found ${existingRuleNames.length} existing default rules:`, existingRuleNames);

    // Filter out rules that already exist
    const newRuleTemplates = ruleTemplates.filter(template => 
      !existingRuleNames.includes(template.name) &&
      !existingTemplateIds.includes(template.name.toLowerCase().replace(/[^a-z0-9]/g, '_'))
    );

    console.log(`📝 Will create ${newRuleTemplates.length} new rules`);

    const createdRules = [];
    const errors = [];

    // Create each new rule
    for (const template of newRuleTemplates) {
      try {
        // Validate template
        const validation = validateRuleTemplate(template);
        if (!validation.success) {
          console.error(`❌ Invalid template for ${template.name}:`, validation.errors);
          errors.push({
            template_name: template.name,
            error: 'Template validation failed',
            details: validation.errors
          });
          continue;
        }

        // Generate template ID
        const templateId = template.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Create the rule
        const ruleResult = await client.query(`
          INSERT INTO rules (
            tenant_id, name, event_type, filters, target_webhook_id, 
            template_mode, enabled, is_default, rule_template_id, 
            auto_created_at, plan_tier, priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11)
          RETURNING id, name
        `, [
          tenantId,
          template.name,
          template.event_type,
          JSON.stringify(template.filters || {}),
          primaryWebhook.id,
          template.template_mode,
          template.enabled,
          true, // is_default
          templateId,
          planTier,
          template.priority || 5
        ]);

        const createdRule = ruleResult.rows[0];
        createdRules.push({
          id: createdRule.id,
          name: createdRule.name,
          template_id: templateId,
          event_type: template.event_type
        });

        console.log(`✅ Created rule: ${createdRule.name} (ID: ${createdRule.id})`);

      } catch (error) {
        console.error(`❌ Failed to create rule ${template.name}:`, error);
        errors.push({
          template_name: template.name,
          error: error.message,
          code: error.code
        });
      }
    }

    // Log the provisioning activity
    await client.query(`
      INSERT INTO rule_provisioning_log (
        tenant_id, plan_tier, rules_created, provisioning_type, 
        from_plan, to_plan, created_rules, errors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      tenantId,
      planTier,
      createdRules.length,
      provisioningType,
      fromPlan,
      provisioningType === 'upgrade' ? planTier : null,
      JSON.stringify(createdRules),
      JSON.stringify(errors)
    ]);

    await client.query('COMMIT');

    const result = {
      success: true,
      tenant_id: tenantId,
      plan_tier: planTier,
      provisioning_type: provisioningType,
      rules_created: createdRules.length,
      rules_skipped: ruleTemplates.length - newRuleTemplates.length,
      created_rules: createdRules,
      webhook_used: {
        id: primaryWebhook.id,
        name: primaryWebhook.name
      }
    };

    if (errors.length > 0) {
      result.errors = errors;
      result.partial_success = true;
    }

    if (fromPlan && provisioningType === 'upgrade') {
      result.from_plan = fromPlan;
      result.upgrade_completed = true;
    }

    console.log(`🎉 Rule provisioning completed for tenant ${tenantId}:`, {
      rulesCreated: createdRules.length,
      errorsEncountered: errors.length
    });

    return result;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rule provisioning failed:', error);
    
    return {
      success: false,
      tenant_id: tenantId,
      error: error.message,
      code: error.code
    };

  } finally {
    client.release();
  }
}

/**
 * Provision rules for a tenant upgrade
 * @param {number} tenantId - Tenant ID
 * @param {string} fromPlan - Previous subscription tier
 * @param {string} toPlan - New subscription tier
 * @returns {Object} Provisioning result
 */
async function provisionUpgradeRules(tenantId, fromPlan, toPlan) {
  return await provisionDefaultRules(tenantId, toPlan, 'upgrade', fromPlan);
}

/**
 * Get provisioning status for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Object} Provisioning status information
 */
async function getProvisioningStatus(tenantId) {
  try {
    // Get current subscription
    let subscription;
    try {
      subscription = await getSubscription(tenantId);
    } catch (error) {
      subscription = { plan_tier: 'free' };
    }

    // Get current default rules
    const rulesResult = await pool.query(`
      SELECT 
        COUNT(*) as total_rules,
        COUNT(CASE WHEN enabled = true THEN 1 END) as enabled_rules,
        array_agg(name) FILTER (WHERE name IS NOT NULL) as rule_names,
        array_agg(rule_template_id) FILTER (WHERE rule_template_id IS NOT NULL) as template_ids
      FROM rules 
      WHERE tenant_id = $1 AND is_default = true
    `, [tenantId]);

    const rules = rulesResult.rows[0];

    // Get provisioning history
    const historyResult = await pool.query(`
      SELECT * FROM rule_provisioning_log 
      WHERE tenant_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [tenantId]);

    // Get available rules for current plan
    const availableRules = getDefaultRulesForPlan(subscription.plan_tier);

    return {
      tenant_id: tenantId,
      current_plan: subscription.plan_tier,
      default_rules_count: parseInt(rules.total_rules || 0),
      enabled_rules_count: parseInt(rules.enabled_rules || 0),
      available_rules_count: availableRules.length,
      rule_names: rules.rule_names || [],
      template_ids: rules.template_ids || [],
      provisioning_history: historyResult.rows,
      needs_provisioning: parseInt(rules.total_rules || 0) < availableRules.length,
      has_webhook: true // We'll check this separately if needed
    };

  } catch (error) {
    console.error('Error getting provisioning status:', error);
    return {
      tenant_id: tenantId,
      error: error.message,
      needs_provisioning: true
    };
  }
}

/**
 * Remove all default rules for a tenant (useful for testing)
 * @param {number} tenantId - Tenant ID
 * @returns {Object} Removal result
 */
async function removeDefaultRules(tenantId) {
  try {
    const result = await pool.query(
      'DELETE FROM rules WHERE tenant_id = $1 AND is_default = true RETURNING id, name',
      [tenantId]
    );

    return {
      success: true,
      tenant_id: tenantId,
      rules_removed: result.rowCount,
      removed_rules: result.rows
    };

  } catch (error) {
    console.error('Error removing default rules:', error);
    return {
      success: false,
      tenant_id: tenantId,
      error: error.message
    };
  }
}

/**
 * Update default rules when plan changes
 * @param {number} tenantId - Tenant ID
 * @param {string} newPlan - New subscription tier
 * @param {string} oldPlan - Previous subscription tier
 * @returns {Object} Update result
 */
async function updateRulesForPlanChange(tenantId, newPlan, oldPlan) {
  try {
    console.log(`🔄 Updating rules for plan change: ${oldPlan} → ${newPlan}`);

    const planHierarchy = ['free', 'starter', 'pro', 'team'];
    const oldPlanIndex = planHierarchy.indexOf(oldPlan);
    const newPlanIndex = planHierarchy.indexOf(newPlan);

    if (newPlanIndex > oldPlanIndex) {
      // Upgrade: Add new rules
      return await provisionUpgradeRules(tenantId, oldPlan, newPlan);
    } else if (newPlanIndex < oldPlanIndex) {
      // Downgrade: Disable rules that are no longer available
      const newPlanRules = getDefaultRulesForPlan(newPlan);
      const allowedRuleNames = newPlanRules.map(r => r.name);

      const disableResult = await pool.query(`
        UPDATE rules 
        SET enabled = false, updated_at = NOW()
        WHERE tenant_id = $1 
          AND is_default = true 
          AND name NOT IN (${allowedRuleNames.map((_, i) => `$${i + 2}`).join(', ')})
        RETURNING id, name
      `, [tenantId, ...allowedRuleNames]);

      return {
        success: true,
        tenant_id: tenantId,
        plan_change: 'downgrade',
        from_plan: oldPlan,
        to_plan: newPlan,
        rules_disabled: disableResult.rowCount,
        disabled_rules: disableResult.rows
      };
    } else {
      // Same plan level
      return {
        success: true,
        tenant_id: tenantId,
        plan_change: 'same',
        message: 'No rule changes needed'
      };
    }

  } catch (error) {
    console.error('Error updating rules for plan change:', error);
    return {
      success: false,
      tenant_id: tenantId,
      error: error.message
    };
  }
}

module.exports = {
  provisionDefaultRules,
  provisionUpgradeRules,
  getProvisioningStatus,
  removeDefaultRules,
  updateRulesForPlanChange
};