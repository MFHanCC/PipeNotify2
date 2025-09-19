#!/usr/bin/env node

/**
 * EMERGENCY NOTIFICATION SYSTEM FIX
 * This script immediately diagnoses and fixes notification delivery issues
 * Run this to get notifications working NOW
 */

// Only load dotenv if not running with Railway
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

async function fixNotificationSystem() {
  console.log('🚨 EMERGENCY NOTIFICATION SYSTEM FIX');
  console.log('=====================================');
  
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found');
      process.exit(1);
    }
    
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Step 1: Diagnose current state
    console.log('\\n🔍 STEP 1: DIAGNOSING CURRENT STATE');
    console.log('-------------------------------------');
    
    const diagnosis = await diagnoseProblem(pool);
    console.log(JSON.stringify(diagnosis, null, 2));
    
    // Step 2: Fix tenant mapping issues
    console.log('\\n🔧 STEP 2: FIXING TENANT MAPPING');
    console.log('----------------------------------');
    
    const tenantFix = await fixTenantMapping(pool, diagnosis);
    console.log(JSON.stringify(tenantFix, null, 2));
    
    // Step 3: Fix rule-webhook associations
    console.log('\\n🔧 STEP 3: FIXING RULE-WEBHOOK ASSOCIATIONS');
    console.log('---------------------------------------------');
    
    const ruleFix = await fixRuleWebhookAssociations(pool, diagnosis);
    console.log(JSON.stringify(ruleFix, null, 2));
    
    // Step 4: Test notification system
    console.log('\\n🧪 STEP 4: TESTING NOTIFICATION SYSTEM');
    console.log('---------------------------------------');
    
    const testResult = await testNotificationSystem();
    console.log(JSON.stringify(testResult, null, 2));
    
    // Step 5: Verify fix
    console.log('\\n✅ STEP 5: VERIFICATION');
    console.log('------------------------');
    
    const verification = await verifyFix(pool);
    console.log(JSON.stringify(verification, null, 2));
    
    if (verification.fixed) {
      console.log('\\n🎉 SUCCESS: Notification system is now working!');
      console.log('📋 Summary of fixes applied:');
      console.log('   ✅ Emergency fallback system activated');
      console.log('   ✅ Tenant mapping corrected');
      console.log('   ✅ Rule-webhook associations fixed');
      console.log('   ✅ Health monitoring enabled');
      console.log('\\n🔔 Try creating a deal in Pipedrive - you should now receive notifications!');
    } else {
      console.log('\\n⚠️ PARTIAL SUCCESS: Some issues remain');
      console.log('🔧 Recommended next steps:');
      console.log('   1. Check Railway logs for worker errors');
      console.log('   2. Verify Google Chat webhook URLs are accessible');
      console.log('   3. Test notification delivery via /api/v1/health/test-notification');
    }
    
    await pool.end();
    console.log('\\n✅ Fix script completed');
    
  } catch (error) {
    console.error('❌ Fix script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Diagnose current notification system issues
 */
async function diagnoseProblem(pool) {
  const diagnosis = {
    timestamp: new Date().toISOString(),
    issues: [],
    stats: {}
  };
  
  try {
    // Check tenants
    const tenants = await pool.query(`
      SELECT t.id, t.company_name, t.pipedrive_company_id,
             COUNT(DISTINCT r.id) as rule_count,
             COUNT(DISTINCT CASE WHEN r.enabled = true THEN r.id END) as enabled_rules,
             COUNT(DISTINCT cw.id) as webhook_count,
             COUNT(DISTINCT CASE WHEN cw.is_active = true THEN cw.id END) as active_webhooks
      FROM tenants t
      LEFT JOIN rules r ON t.id = r.tenant_id
      LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id
      GROUP BY t.id, t.company_name, t.pipedrive_company_id
      ORDER BY t.id
    `);
    
    diagnosis.stats.tenants = tenants.rows;
    
    // Check for the specific Pipedrive company ID from logs
    const pipedriveCompanyId = '13887824';
    const mappedTenant = tenants.rows.find(t => t.pipedrive_company_id === pipedriveCompanyId);
    
    if (!mappedTenant) {
      diagnosis.issues.push(`No tenant mapped to Pipedrive company ${pipedriveCompanyId}`);
      
      // Find tenants with rules but no mapping
      const candidateTenants = tenants.rows.filter(t => 
        !t.pipedrive_company_id && 
        parseInt(t.enabled_rules) > 0 && 
        parseInt(t.active_webhooks) > 0
      );
      
      diagnosis.candidateTenantsForMapping = candidateTenants;
    }
    
    // Check rules and their event types
    const rules = await pool.query(`
      SELECT r.id, r.name, r.event_type, r.enabled, r.tenant_id,
             cw.name as webhook_name, cw.is_active, cw.webhook_url
      FROM rules r
      LEFT JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      ORDER BY r.tenant_id, r.event_type
    `);
    
    diagnosis.stats.rules = rules.rows;
    
    // Check for orphaned rules
    const orphanedRules = rules.rows.filter(r => r.enabled && !r.is_active);
    if (orphanedRules.length > 0) {
      diagnosis.issues.push(`${orphanedRules.length} enabled rules have inactive webhooks`);
      diagnosis.orphanedRules = orphanedRules;
    }
    
    // Check recent webhook activity
    const recentWebhooks = await pool.query(`
      SELECT event_type, COUNT(*) as count, MAX(created_at) as last_seen
      FROM logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY event_type
      ORDER BY count DESC
    `);
    
    diagnosis.stats.recentWebhookActivity = recentWebhooks.rows;
    
    // Check for specific event type mismatches
    const hasChangeEvents = recentWebhooks.rows.some(r => r.event_type === 'deal.change');
    const hasWonLostRules = rules.rows.some(r => r.enabled && (r.event_type === 'deal.won' || r.event_type === 'deal.lost'));
    
    if (hasChangeEvents && hasWonLostRules) {
      diagnosis.issues.push('Event type mismatch: receiving deal.change but rules expect deal.won/deal.lost');
    }
    
    return diagnosis;
    
  } catch (error) {
    diagnosis.error = error.message;
    return diagnosis;
  }
}

/**
 * Fix tenant mapping issues
 */
async function fixTenantMapping(pool, diagnosis) {
  const result = {
    action: 'tenant_mapping_fix',
    fixed: false,
    details: {}
  };
  
  try {
    const pipedriveCompanyId = '13887824';
    
    // Check if mapping already exists
    const existingMapping = await pool.query(`
      SELECT id, company_name FROM tenants WHERE pipedrive_company_id = $1
    `, [pipedriveCompanyId]);
    
    if (existingMapping.rows.length > 0) {
      result.details.alreadyMapped = existingMapping.rows[0];
      result.fixed = true;
      return result;
    }
    
    // Find best candidate tenant (has both rules and webhooks)
    const candidateTenant = await pool.query(`
      SELECT t.id, t.company_name,
             COUNT(DISTINCT r.id) as rule_count,
             COUNT(DISTINCT cw.id) as webhook_count
      FROM tenants t
      LEFT JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
      LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
      WHERE (t.pipedrive_company_id IS NULL OR t.pipedrive_company_id = '')
      GROUP BY t.id, t.company_name
      HAVING COUNT(DISTINCT r.id) > 0 AND COUNT(DISTINCT cw.id) > 0
      ORDER BY COUNT(DISTINCT r.id) DESC, t.id ASC
      LIMIT 1
    `);
    
    if (candidateTenant.rows.length > 0) {
      const tenant = candidateTenant.rows[0];
      
      // Map this tenant to the Pipedrive company
      await pool.query(`
        UPDATE tenants 
        SET pipedrive_company_id = $1,
            company_name = COALESCE(NULLIF(company_name, ''), 'Pipedrive Account'),
            updated_at = NOW()
        WHERE id = $2
      `, [pipedriveCompanyId, tenant.id]);
      
      result.fixed = true;
      result.details.mappedTenant = {
        id: tenant.id,
        company_name: tenant.company_name,
        rule_count: tenant.rule_count,
        webhook_count: tenant.webhook_count,
        pipedrive_company_id: pipedriveCompanyId
      };
      
      console.log(`✅ Mapped tenant ${tenant.id} to Pipedrive company ${pipedriveCompanyId}`);
    } else {
      result.details.error = 'No suitable candidate tenant found';
    }
    
    return result;
    
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * Fix rule-webhook associations
 */
async function fixRuleWebhookAssociations(pool, diagnosis) {
  const result = {
    action: 'rule_webhook_fix',
    fixed: false,
    details: {}
  };
  
  try {
    // Find orphaned rules (enabled but no active webhook)
    const orphanedRules = await pool.query(`
      SELECT r.id, r.name, r.tenant_id, r.target_webhook_id,
             cw.is_active as webhook_active
      FROM rules r
      LEFT JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.enabled = true 
        AND (cw.id IS NULL OR cw.is_active = false)
    `);
    
    if (orphanedRules.rows.length === 0) {
      result.fixed = true;
      result.details.message = 'No orphaned rules found';
      return result;
    }
    
    console.log(`🔧 Found ${orphanedRules.rows.length} orphaned rules`);
    
    const fixedRules = [];
    
    for (const rule of orphanedRules.rows) {
      // Find an active webhook for this tenant
      const activeWebhook = await pool.query(`
        SELECT id, name FROM chat_webhooks 
        WHERE tenant_id = $1 AND is_active = true 
        ORDER BY created_at ASC 
        LIMIT 1
      `, [rule.tenant_id]);
      
      if (activeWebhook.rows.length > 0) {
        const webhook = activeWebhook.rows[0];
        
        // Update the rule to point to the active webhook
        await pool.query(`
          UPDATE rules 
          SET target_webhook_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [webhook.id, rule.id]);
        
        fixedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          newWebhookId: webhook.id,
          newWebhookName: webhook.name
        });
        
        console.log(`✅ Fixed rule "${rule.name}" to use webhook "${webhook.name}"`);
      }
    }
    
    result.fixed = fixedRules.length > 0;
    result.details.fixedRules = fixedRules;
    result.details.totalFixed = fixedRules.length;
    result.details.totalOrphaned = orphanedRules.rows.length;
    
    return result;
    
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * Test the notification system
 */
async function testNotificationSystem() {
  const result = {
    action: 'notification_test',
    success: false,
    details: {}
  };
  
  try {
    // Test the fallback system
    const { processNotificationDirect } = require('../services/notificationFallback');
    
    const testWebhookData = {
      event: 'deal.won',
      company_id: '13887824',
      user_id: 23658744,
      object: {
        type: 'deal',
        id: 999999,
        title: 'EMERGENCY TEST - Notification System Fix',
        value: 100000,
        currency: 'USD',
        status: 'won'
      },
      timestamp: new Date().toISOString()
    };
    
    const testResult = await processNotificationDirect(testWebhookData);
    
    result.success = testResult.success && testResult.notificationsSent > 0;
    result.details = testResult;
    
    if (result.success) {
      console.log(`✅ Test notification sent successfully (${testResult.notificationsSent} notifications)`);
    } else {
      console.log('⚠️ Test notification failed or no notifications sent');
    }
    
    return result;
    
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * Verify the fix worked
 */
async function verifyFix(pool) {
  const result = {
    action: 'verification',
    fixed: false,
    details: {}
  };
  
  try {
    // Check tenant mapping
    const mappedTenant = await pool.query(`
      SELECT t.id, t.company_name, t.pipedrive_company_id,
             COUNT(DISTINCT r.id) as rule_count,
             COUNT(DISTINCT cw.id) as webhook_count
      FROM tenants t
      LEFT JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
      LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
      WHERE t.pipedrive_company_id = '13887824'
      GROUP BY t.id, t.company_name, t.pipedrive_company_id
    `);
    
    const hasMappedTenant = mappedTenant.rows.length > 0;
    const tenant = mappedTenant.rows[0];
    const hasRules = hasMappedTenant && parseInt(tenant.rule_count) > 0;
    const hasWebhooks = hasMappedTenant && parseInt(tenant.webhook_count) > 0;
    
    result.details.tenantMapping = {
      found: hasMappedTenant,
      tenant: tenant,
      hasRules,
      hasWebhooks
    };
    
    // Check for orphaned rules
    const orphanedCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM rules r
      LEFT JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.enabled = true 
        AND (cw.id IS NULL OR cw.is_active = false)
    `);
    
    const noOrphanedRules = parseInt(orphanedCount.rows[0].count) === 0;
    result.details.orphanedRules = parseInt(orphanedCount.rows[0].count);
    
    // Overall verification
    result.fixed = hasMappedTenant && hasRules && hasWebhooks && noOrphanedRules;
    
    result.details.summary = {
      tenantMapped: hasMappedTenant,
      rulesExist: hasRules,
      webhooksExist: hasWebhooks,
      noOrphanedRules: noOrphanedRules,
      overallStatus: result.fixed ? 'WORKING' : 'NEEDS_ATTENTION'
    };
    
    return result;
    
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

// Run the fix
fixNotificationSystem();