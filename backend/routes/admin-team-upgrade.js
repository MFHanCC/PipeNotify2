const express = require('express');
const { pool } = require('../services/database');
const { provisionDefaultRules } = require('../services/ruleProvisioning');
const router = express.Router();

/**
 * Admin endpoint to upgrade a tenant to Team plan
 * This is a temporary endpoint for fixing Team plan rule provisioning
 */
router.post('/upgrade-to-team', async (req, res) => {
  try {
    const { identifier, confirm } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ 
        error: 'Missing identifier. Provide tenant ID, company name, or pipedrive company ID' 
      });
    }
    
    if (!confirm) {
      return res.status(400).json({ 
        error: 'Missing confirmation. Set confirm: true to proceed' 
      });
    }
    
    console.log(`🔍 Looking up tenant: ${identifier}`);
    
    // Find tenant by ID, company name, or pipedrive company ID
    let tenantQuery;
    let queryParams;
    
    if (!isNaN(identifier)) {
      // Numeric - could be tenant ID or pipedrive company ID
      tenantQuery = `
        SELECT id, company_name, pipedrive_company_id, pipedrive_user_name 
        FROM tenants 
        WHERE id = $1 OR pipedrive_company_id::text = $1
      `;
      queryParams = [identifier];
    } else {
      // String - search by company name
      tenantQuery = `
        SELECT id, company_name, pipedrive_company_id, pipedrive_user_name 
        FROM tenants 
        WHERE company_name ILIKE $1
      `;
      queryParams = [`%${identifier}%`];
    }
    
    const tenantResult = await pool.query(tenantQuery, queryParams);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No tenant found',
        identifier: identifier
      });
    }
    
    if (tenantResult.rows.length > 1) {
      return res.status(400).json({ 
        error: 'Multiple tenants found, be more specific',
        tenants: tenantResult.rows.map(t => ({
          id: t.id,
          company_name: t.company_name,
          pipedrive_company_id: t.pipedrive_company_id
        }))
      });
    }
    
    const tenant = tenantResult.rows[0];
    const tenantId = tenant.id;
    
    console.log(`✅ Found tenant: ID=${tenant.id}, Company=${tenant.company_name}`);
    
    // Check current rules
    const currentRulesResult = await pool.query(`
      SELECT COUNT(*) as total_rules,
             COUNT(CASE WHEN is_default = true THEN 1 END) as default_rules
      FROM rules 
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const currentRules = currentRulesResult.rows[0];
    const currentDefaultRules = parseInt(currentRules.default_rules);
    
    console.log(`📝 Current rules: ${currentDefaultRules} default, ${currentRules.total_rules} total`);
    
    // Update or create subscription
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscriptions'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('📊 Updating subscription to Team plan...');
      
      await pool.query(`
        INSERT INTO subscriptions (
          tenant_id, plan_tier, status, 
          current_period_start, current_period_end,
          monthly_notification_count, created_at, updated_at
        ) VALUES (
          $1, 'team', 'active',
          NOW(), NOW() + INTERVAL '1 year',
          0, NOW(), NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          plan_tier = 'team',
          status = 'active',
          current_period_end = NOW() + INTERVAL '1 year',
          updated_at = NOW()
      `, [tenantId]);
      
      console.log('✅ Subscription updated to Team plan');
    }
    
    let ruleProvisioningResult = null;
    
    if (currentDefaultRules < 10) {
      console.log('🔄 Need to provision Team plan rules (should have 10 default rules)');
      
      // Remove existing default rules
      const deleteResult = await pool.query(
        'DELETE FROM rules WHERE tenant_id = $1 AND is_default = true RETURNING id, name',
        [tenantId]
      );
      
      console.log(`🗑️  Removed ${deleteResult.rowCount} existing default rules`);
      
      // Provision Team plan rules
      ruleProvisioningResult = await provisionDefaultRules(tenantId, 'team', 'manual');
      
      if (ruleProvisioningResult.success) {
        console.log(`🎉 Successfully provisioned ${ruleProvisioningResult.rules_created} Team plan rules!`);
      } else {
        console.log('❌ Rule provisioning failed:', ruleProvisioningResult.error);
      }
    } else {
      console.log('✅ Already has sufficient default rules for Team plan');
      ruleProvisioningResult = {
        success: true,
        rules_created: 0,
        message: 'Already had sufficient rules'
      };
    }
    
    // Final verification
    const finalRulesResult = await pool.query(`
      SELECT COUNT(*) as total_rules,
             COUNT(CASE WHEN is_default = true THEN 1 END) as default_rules,
             array_agg(name) FILTER (WHERE is_default = true) as rule_names
      FROM rules 
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const finalRules = finalRulesResult.rows[0];
    
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        company_name: tenant.company_name,
        pipedrive_company_id: tenant.pipedrive_company_id,
        user_name: tenant.pipedrive_user_name
      },
      before: {
        default_rules: currentDefaultRules,
        total_rules: parseInt(currentRules.total_rules)
      },
      after: {
        default_rules: parseInt(finalRules.default_rules),
        total_rules: parseInt(finalRules.total_rules),
        rule_names: finalRules.rule_names || []
      },
      rule_provisioning: ruleProvisioningResult,
      message: ruleProvisioningResult?.success 
        ? `Successfully upgraded tenant to Team plan with ${finalRules.default_rules} default rules`
        : 'Upgrade completed but rule provisioning had issues'
    });
    
  } catch (error) {
    console.error('❌ Error upgrading to Team plan:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Admin endpoint to list tenants (for debugging)
 */
router.get('/tenants', async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = `
      SELECT id, company_name, pipedrive_company_id, pipedrive_user_name, created_at,
             (SELECT COUNT(*) FROM rules WHERE tenant_id = tenants.id AND is_default = true) as default_rules
      FROM tenants
    `;
    let params = [];
    
    if (search) {
      query += ` WHERE company_name ILIKE $1 OR pipedrive_user_name ILIKE $1 OR pipedrive_company_id::text = $2`;
      params = [`%${search}%`, search];
    }
    
    query += ` ORDER BY created_at DESC LIMIT 20`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      tenants: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Error listing tenants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;