const express = require('express');
const router = express.Router();
const { healthCheck } = require('../services/database');
const { healthCheck: fallbackHealthCheck } = require('../services/notificationFallback');

/**
 * Comprehensive health monitoring for the notification system
 * These endpoints help detect and diagnose notification delivery issues
 */

// Overall system health check
router.get('/notifications', async (req, res) => {
  try {
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'checking'
    };
    
    // Check database connection
    try {
      const dbHealth = await healthCheck();
      checks.database = dbHealth.healthy ? 'healthy' : 'unhealthy';
      checks.databaseDetails = dbHealth;
    } catch (error) {
      checks.database = 'failed';
      checks.databaseError = error.message;
    }
    
    // Check notification queue and worker
    try {
      const queueHealth = await checkQueueHealth();
      checks.queue = queueHealth.healthy ? 'healthy' : 'unhealthy';
      checks.queueDetails = queueHealth;
    } catch (error) {
      checks.queue = 'failed';
      checks.queueError = error.message;
    }
    
    // Check worker process
    try {
      const workerHealth = await checkWorkerHealth();
      checks.worker = workerHealth.healthy ? 'healthy' : 'unhealthy';
      checks.workerDetails = workerHealth;
    } catch (error) {
      checks.worker = 'failed';
      checks.workerError = error.message;
    }
    
    // Check fallback system
    try {
      const fallbackHealth = await fallbackHealthCheck();
      checks.fallback = fallbackHealth.healthy ? 'healthy' : 'unhealthy';
      checks.fallbackDetails = fallbackHealth;
    } catch (error) {
      checks.fallback = 'failed';
      checks.fallbackError = error.message;
    }
    
    // Check tenant and rule configuration
    try {
      const configHealth = await checkConfigurationHealth();
      checks.configuration = configHealth.healthy ? 'healthy' : 'unhealthy';
      checks.configurationDetails = configHealth;
    } catch (error) {
      checks.configuration = 'failed';
      checks.configurationError = error.message;
    }
    
    // Determine overall status
    const healthyComponents = [
      checks.database === 'healthy',
      checks.fallback === 'healthy',
      checks.configuration === 'healthy'
    ];
    
    const criticalComponents = [
      checks.queue === 'healthy' || checks.fallback === 'healthy', // At least one delivery method
      checks.worker === 'healthy' || checks.fallback === 'healthy'  // At least one processing method
    ];
    
    if (healthyComponents.every(Boolean) && criticalComponents.every(Boolean)) {
      checks.status = 'healthy';
      checks.overallHealth = 'All systems operational';
    } else if (criticalComponents.every(Boolean)) {
      checks.status = 'degraded';
      checks.overallHealth = 'Some components down but notifications can still be delivered';
    } else {
      checks.status = 'unhealthy';
      checks.overallHealth = 'Critical components down - notification delivery may fail';
    }
    
    res.json(checks);
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Worker-specific health check
router.get('/worker', async (req, res) => {
  try {
    const workerHealth = await checkWorkerHealth();
    res.json(workerHealth);
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Queue-specific health check
router.get('/queue', async (req, res) => {
  try {
    const queueHealth = await checkQueueHealth();
    res.json(queueHealth);
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Tenant mapping health check
router.get('/tenants', async (req, res) => {
  try {
    const { pool } = require('../services/database');
    
    // Check tenant configuration
    const tenantStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT t.id) as total_tenants,
        COUNT(DISTINCT CASE WHEN t.pipedrive_company_id IS NOT NULL THEN t.id END) as mapped_tenants,
        COUNT(DISTINCT CASE WHEN r.enabled = true THEN t.id END) as tenants_with_rules,
        COUNT(DISTINCT CASE WHEN cw.is_active = true THEN t.id END) as tenants_with_webhooks,
        COUNT(DISTINCT CASE WHEN r.enabled = true AND cw.is_active = true THEN t.id END) as fully_configured_tenants
      FROM tenants t
      LEFT JOIN rules r ON t.id = r.tenant_id
      LEFT JOIN chat_webhooks cw ON t.id = cw.tenant_id
    `);
    
    const stats = tenantStats.rows[0];
    
    // Get detailed tenant info
    const tenantDetails = await pool.query(`
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
    
    const healthy = parseInt(stats.fully_configured_tenants) > 0;
    
    res.json({
      healthy,
      stats: {
        totalTenants: parseInt(stats.total_tenants),
        mappedTenants: parseInt(stats.mapped_tenants),
        tenantsWithRules: parseInt(stats.tenants_with_rules),
        tenantsWithWebhooks: parseInt(stats.tenants_with_webhooks),
        fullyConfiguredTenants: parseInt(stats.fully_configured_tenants)
      },
      tenants: tenantDetails.rows,
      issues: healthy ? [] : [
        'No fully configured tenants found (need both enabled rules and active webhooks)'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Heartbeat system status
router.get('/heartbeat', (req, res) => {
  try {
    const { getHeartbeatStatus } = require('../services/heartbeatMonitor');
    const status = getHeartbeatStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      enabled: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Force heartbeat check
router.post('/heartbeat/force', async (req, res) => {
  try {
    const { forceHeartbeat } = require('../services/heartbeatMonitor');
    const result = await forceHeartbeat();
    res.json({
      message: 'Heartbeat check completed',
      status: result
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Resilience system status
router.get('/resilience', async (req, res) => {
  try {
    const { resilienceHealthCheck, getResilienceStatus } = require('../middleware/notificationResilience');
    const [healthCheck, status] = await Promise.all([
      resilienceHealthCheck(),
      getResilienceStatus()
    ]);
    
    res.json({
      ...status,
      healthCheck
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Reset circuit breaker
router.post('/resilience/reset', (req, res) => {
  try {
    const { resetCircuitBreaker } = require('../middleware/notificationResilience');
    const result = resetCircuitBreaker();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test notification delivery
router.post('/test-notification', async (req, res) => {
  try {
    const { tenantId, eventType = 'deal.won', companyId } = req.body;
    
    // Create test webhook data
    const testWebhookData = {
      event: eventType,
      company_id: companyId || process.env.DEFAULT_COMPANY_ID || '0', // Use provided or default
      user_id: 23658744,
      object: {
        type: 'deal',
        id: 999999,
        title: 'Test Deal for Notification System',
        value: 50000,
        currency: 'USD',
        status: eventType.includes('won') ? 'won' : eventType.includes('lost') ? 'lost' : 'open'
      },
      timestamp: new Date().toISOString(),
      meta: {
        entity: 'deal',
        action: eventType.split('.')[1] || 'change',
        company_id: companyId || process.env.DEFAULT_COMPANY_ID || '0',
        user_id: 23658744
      }
    };
    
    // Test both normal and fallback processing
    const results = {
      timestamp: new Date().toISOString(),
      testData: testWebhookData
    };
    
    // Test queue-based processing
    try {
      const { addNotificationJob } = require('../jobs/queue');
      const job = await addNotificationJob(testWebhookData, { delay: 0 });
      results.queueTest = {
        success: true,
        jobId: job.id,
        message: 'Test job queued successfully'
      };
    } catch (queueError) {
      results.queueTest = {
        success: false,
        error: queueError.message
      };
    }
    
    // Test fallback processing
    try {
      const { processNotificationDirect } = require('../services/notificationFallback');
      const fallbackResult = await processNotificationDirect(testWebhookData);
      results.fallbackTest = fallbackResult;
    } catch (fallbackError) {
      results.fallbackTest = {
        success: false,
        error: fallbackError.message
      };
    }
    
    // Determine overall test result
    const anySuccess = results.queueTest?.success || results.fallbackTest?.success;
    results.overallResult = anySuccess ? 'success' : 'failed';
    results.notificationsSent = results.fallbackTest?.notificationsSent || 0;
    
    res.json(results);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions
async function checkQueueHealth() {
  try {
    const { getQueueInfo } = require('../jobs/queue');
    const queueInfo = await getQueueInfo();
    
    return {
      healthy: queueInfo.connected,
      connection: queueInfo.connected ? 'connected' : 'disconnected',
      waiting: queueInfo.waiting,
      active: queueInfo.active,
      completed: queueInfo.completed,
      failed: queueInfo.failed,
      redis: queueInfo.redis,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkWorkerHealth() {
  try {
    // Check if worker is processing jobs by looking at recent activity
    const { pool } = require('../services/database');
    
    // Look for recent job completions in logs
    const recentActivity = await pool.query(`
      SELECT COUNT(*) as recent_logs,
             MAX(created_at) as last_activity
      FROM logs 
      WHERE created_at > NOW() - INTERVAL '5 minutes'
    `);
    
    const lastActivity = recentActivity.rows[0].last_activity;
    const recentLogs = parseInt(recentActivity.rows[0].recent_logs);
    
    // Worker is considered healthy if there's been recent activity or if there are no jobs to process
    const { getQueueInfo } = require('../jobs/queue');
    const queueInfo = await getQueueInfo();
    
    const noJobsWaiting = queueInfo.waiting === 0 && queueInfo.active === 0;
    const recentActivityExists = lastActivity && (Date.now() - new Date(lastActivity).getTime()) < 300000; // 5 minutes
    
    const healthy = noJobsWaiting || recentActivityExists;
    
    return {
      healthy,
      lastActivity,
      recentLogs,
      queueWaiting: queueInfo.waiting,
      queueActive: queueInfo.active,
      status: healthy ? 'active' : 'potentially_stalled',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkConfigurationHealth() {
  try {
    const { pool } = require('../services/database');
    
    // Check for common configuration issues
    const issues = [];
    
    // Check 1: Any enabled rules exist
    const enabledRules = await pool.query('SELECT COUNT(*) as count FROM rules WHERE enabled = true');
    if (parseInt(enabledRules.rows[0].count) === 0) {
      issues.push('No enabled rules found');
    }
    
    // Check 2: Any active webhooks exist
    const activeWebhooks = await pool.query('SELECT COUNT(*) as count FROM chat_webhooks WHERE is_active = true');
    if (parseInt(activeWebhooks.rows[0].count) === 0) {
      issues.push('No active webhooks found');
    }
    
    // Check 3: Orphaned rules (rules without valid webhooks) - SIMPLE CLEAN QUERY
    const orphanedRules = await pool.query(`
      SELECT COUNT(*) as count 
      FROM rules r 
      WHERE r.enabled = true 
        AND (r.target_webhook_id IS NULL 
             OR NOT EXISTS (
               SELECT 1 FROM chat_webhooks cw 
               WHERE cw.id = r.target_webhook_id 
               AND cw.is_active = true
             ))
    `);
    if (parseInt(orphanedRules.rows[0].count) > 0) {
      issues.push(`${orphanedRules.rows[0].count} enabled rules have no active target webhook`);
    }
    
    // Check 4: Tenant mapping issues
    const unmappedTenants = await pool.query(`
      SELECT COUNT(*) as count 
      FROM tenants t
      WHERE (t.pipedrive_company_id IS NULL OR t.pipedrive_company_id::text = '')
        AND EXISTS (SELECT 1 FROM rules r WHERE r.tenant_id = t.id AND r.enabled = true)
    `);
    if (parseInt(unmappedTenants.rows[0].count) > 0) {
      issues.push(`${unmappedTenants.rows[0].count} tenants with rules have no Pipedrive company mapping`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      checks: {
        enabledRules: parseInt(enabledRules.rows[0].count),
        activeWebhooks: parseInt(activeWebhooks.rows[0].count),
        orphanedRules: parseInt(orphanedRules.rows[0].count),
        unmappedTenants: parseInt(unmappedTenants.rows[0].count)
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// TEMPORARY: Team plan upgrade endpoint for fixing rule provisioning
router.post('/upgrade-team/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const { confirm } = req.body;
    
    if (!confirm) {
      return res.status(400).json({ 
        error: 'Missing confirmation. Send {"confirm": true} in request body' 
      });
    }
    
    console.log(`🔄 Upgrading tenant ${tenantId} to Team plan...`);
    
    const { pool } = require('../services/database');
    const { provisionDefaultRules } = require('../services/ruleProvisioning');
    
    // Get tenant info
    const tenantResult = await pool.query(`
      SELECT id, company_name, pipedrive_company_id 
      FROM tenants 
      WHERE id = $1
    `, [tenantId]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = tenantResult.rows[0];
    
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
    
    let ruleProvisioningResult = null;
    
    if (currentDefaultRules < 10) {
      console.log('🔄 Provisioning Team plan rules (10 total)...');
      
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
        pipedrive_company_id: tenant.pipedrive_company_id
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
      message: `Successfully upgraded tenant to Team plan with ${finalRules.default_rules} default rules`
    });
    
  } catch (error) {
    console.error('❌ Error upgrading to Team plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;