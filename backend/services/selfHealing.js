/**
 * Self-Healing Mechanisms Service
 * Automatically detects and fixes common notification system issues
 * Ensures bulletproof operation with minimal manual intervention
 */

const { pool } = require('./database');
const { resolveTenant } = require('./smartTenantResolver');
const { guaranteeDelivery } = require('./guaranteedDelivery');
const { processBatchQueue } = require('./guaranteedDelivery');

/**
 * Self-healing system configuration
 */
const HEALING_CONFIG = {
  // Interval between health checks (5 minutes)
  CHECK_INTERVAL_MS: 5 * 60 * 1000,
  
  // Auto-healing thresholds
  MAX_FAILED_QUEUE_ITEMS: 50,
  MAX_QUEUE_AGE_HOURS: 2,
  MAX_ORPHANED_TENANTS: 5,
  MAX_UNMAPPED_COMPANIES: 10,
  
  // Recovery limits
  MAX_AUTO_RETRIES: 3,
  MAX_AUTO_FIXES_PER_CYCLE: 20
};

/**
 * Health check results structure
 */
class HealthCheckResult {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.healthy = true;
    this.issues = [];
    this.autoFixes = [];
    this.manualActionRequired = [];
  }

  addIssue(severity, description, details = {}) {
    this.issues.push({
      severity, // 'critical', 'warning', 'info'
      description,
      details,
      timestamp: new Date().toISOString()
    });
    
    if (severity === 'critical') {
      this.healthy = false;
    }
  }

  addAutoFix(description, result) {
    this.autoFixes.push({
      description,
      result,
      timestamp: new Date().toISOString()
    });
  }

  addManualAction(description, details = {}) {
    this.manualActionRequired.push({
      description,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Orchestrates a full self-healing health check: runs multiple subsystem checks, applies safe automatic fixes, and aggregates findings.
 *
 * This function executes the suite of health checks for the notification system (queue health, tenant mapping, delivery performance,
 * database cleanup, and webhook availability), records detected issues, records any automatic fixes applied, and flags items that
 * require manual intervention. It never throws for expected check-level failures — those are recorded on the returned result — but
 * unexpected runtime errors will mark the returned HealthCheckResult as unhealthy and include a critical issue entry.
 *
 * @returns {Promise<HealthCheckResult>} A HealthCheckResult containing timestamped issues, applied auto-fixes, manual-action items, and overall health state.
 */
async function runSelfHealing() {
  const result = new HealthCheckResult();
  console.log('🔍 Starting self-healing health check...');

  try {
    // 1. Check notification queue health
    await checkQueueHealth(result);
    
    // 2. Check tenant mapping integrity
    await checkTenantMappingHealth(result);
    
    // 3. Check delivery system health
    await checkDeliverySystemHealth(result);
    
    // 4. Check database cleanup needs
    await checkDatabaseCleanupNeeds(result);
    
    // 5. Check webhook connectivity
    await checkWebhookConnectivity(result);
    
    // Log results
    if (result.autoFixes.length > 0) {
      console.log(`✅ Self-healing applied ${result.autoFixes.length} automatic fixes`);
    }
    
    if (result.manualActionRequired.length > 0) {
      console.log(`⚠️ Self-healing detected ${result.manualActionRequired.length} issues requiring manual intervention`);
    }
    
    if (result.healthy) {
      console.log('💚 System health check: HEALTHY');
    } else {
      console.log('🚨 System health check: DEGRADED');
    }

  } catch (error) {
    result.healthy = false;
    result.addIssue('critical', 'Self-healing system failure', { error: error.message });
    console.error('❌ Self-healing system failed:', error);
  }

  return result;
}

/**
 * Evaluate the notification queue for stalled or failed items and apply safe automatic fixes.
 *
 * Runs checks for (1) a high number of recent failed items and (2) old pending items.
 * For excessive recent failures, it marks eligible failed notifications as retryable (status -> 'pending',
 * schedules them immediately, and increments retry_count) subject to configured retry limits.
 * For old pending items, it reschedules them to run immediately.
 * Findings and any applied automatic actions are recorded on the provided HealthCheckResult.
 *
 * Errors during the check are recorded on the result as a critical issue (the function does not throw).
 *
 * @param {HealthCheckResult} result - Accumulator object where detected issues, auto-fixes, and manual actions are recorded.
 */
async function checkQueueHealth(result) {
  try {
    // Check for stalled/failed queue items
    const stalledItems = await pool.query(`
      SELECT COUNT(*) as count
      FROM notification_queue 
      WHERE status = 'failed' 
        AND created_at > NOW() - INTERVAL '${HEALING_CONFIG.MAX_QUEUE_AGE_HOURS} hours'
    `);

    const stalledCount = parseInt(stalledItems.rows[0].count);
    
    if (stalledCount > HEALING_CONFIG.MAX_FAILED_QUEUE_ITEMS) {
      result.addIssue('critical', `High number of failed queue items: ${stalledCount}`, {
        threshold: HEALING_CONFIG.MAX_FAILED_QUEUE_ITEMS,
        actual: stalledCount
      });

      // Auto-fix: Retry failed notifications that haven't been retried too many times
      const retryResult = await pool.query(`
        UPDATE notification_queue 
        SET status = 'pending', 
            scheduled_for = NOW(),
            retry_count = retry_count + 1
        WHERE status = 'failed'
          AND retry_count < ${HEALING_CONFIG.MAX_AUTO_RETRIES}
          AND created_at > NOW() - INTERVAL '1 hour'
        RETURNING id
      `);

      if (retryResult.rowCount > 0) {
        result.addAutoFix(`Retried ${retryResult.rowCount} failed notifications`, {
          retriedCount: retryResult.rowCount
        });
      }
    }

    // Check for old pending items that might be stuck
    const oldPendingItems = await pool.query(`
      SELECT COUNT(*) as count
      FROM notification_queue 
      WHERE status = 'pending' 
        AND created_at < NOW() - INTERVAL '${HEALING_CONFIG.MAX_QUEUE_AGE_HOURS} hours'
    `);

    const oldPendingCount = parseInt(oldPendingItems.rows[0].count);
    
    if (oldPendingCount > 0) {
      result.addIssue('warning', `Found ${oldPendingCount} old pending notifications`, {
        ageThreshold: `${HEALING_CONFIG.MAX_QUEUE_AGE_HOURS} hours`,
        count: oldPendingCount
      });

      // Auto-fix: Reschedule old pending items
      const rescheduleResult = await pool.query(`
        UPDATE notification_queue 
        SET scheduled_for = NOW()
        WHERE status = 'pending' 
          AND created_at < NOW() - INTERVAL '${HEALING_CONFIG.MAX_QUEUE_AGE_HOURS} hours'
        RETURNING id
      `);

      if (rescheduleResult.rowCount > 0) {
        result.addAutoFix(`Rescheduled ${rescheduleResult.rowCount} stalled pending notifications`, {
          rescheduledCount: rescheduleResult.rowCount
        });
      }
    }

  } catch (error) {
    result.addIssue('critical', 'Queue health check failed', { error: error.message });
  }
}

/**
 * Verify tenant-to-Pipedrive mappings, record issues, and attempt safe automatic fixes.
 *
 * Performs two checks:
 * 1. Finds tenants that have enabled rules but no `pipedrive_company_id`. For each, it
 *    attempts an automatic mapping by inferring the most frequent `company_id` from
 *    recent delivery logs (last 7 days); successful mappings are recorded as auto-fixes.
 * 2. Detects duplicate `pipedrive_company_id` values shared by multiple tenants and
 *    records these as warnings requiring manual review.
 *
 * All findings are appended to the provided HealthCheckResult via addIssue, addAutoFix,
 * and addManualAction. Errors during per-tenant auto-mapping are logged and do not
 * abort the overall check; an unexpected failure of the check records a critical issue
 * on the HealthCheckResult.
 *
 * @param {HealthCheckResult} result - Collector for detected issues, applied auto-fixes,
 *   and manual-action recommendations.
 */
async function checkTenantMappingHealth(result) {
  try {
    // Check for tenants with rules but no Pipedrive company mapping
    const unmappedTenants = await pool.query(`
      SELECT t.id, t.company_name, COUNT(r.id) as rule_count
      FROM tenants t
      LEFT JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
      WHERE (t.pipedrive_company_id IS NULL OR t.pipedrive_company_id::text = '')
        AND r.id IS NOT NULL
      GROUP BY t.id, t.company_name
    `);

    if (unmappedTenants.rows.length > 0) {
      result.addIssue('warning', `Found ${unmappedTenants.rows.length} tenants with rules but no Pipedrive mapping`, {
        tenants: unmappedTenants.rows
      });

      // Auto-fix: For tenants with clear company_id patterns, attempt auto-mapping
      for (const tenant of unmappedTenants.rows) {
        try {
          // Look for recent delivery logs that might contain company_id
          const recentCompanyId = await pool.query(`
            SELECT company_id, COUNT(*) as frequency
            FROM delivery_log 
            WHERE tenant_id = $1 
              AND company_id IS NOT NULL
              AND created_at > NOW() - INTERVAL '7 days'
            GROUP BY company_id
            ORDER BY frequency DESC, created_at DESC
            LIMIT 1
          `, [tenant.id]);

          if (recentCompanyId.rows.length > 0) {
            const companyId = recentCompanyId.rows[0].company_id;
            
            await pool.query(`
              UPDATE tenants 
              SET pipedrive_company_id = $1,
                  updated_at = NOW()
              WHERE id = $2
            `, [companyId, tenant.id]);

            result.addAutoFix(`Auto-mapped tenant ${tenant.id} to company_id ${companyId}`, {
              tenantId: tenant.id,
              companyId: companyId,
              confidence: 'high'
            });
          }
        } catch (autoMapError) {
          console.error(`Auto-mapping failed for tenant ${tenant.id}:`, autoMapError.message);
        }
      }
    }

    // Check for duplicate company mappings
    const duplicateMappings = await pool.query(`
      SELECT pipedrive_company_id, COUNT(*) as tenant_count, 
             ARRAY_AGG(id) as tenant_ids
      FROM tenants 
      WHERE pipedrive_company_id IS NOT NULL 
        AND pipedrive_company_id::text != ''
      GROUP BY pipedrive_company_id
      HAVING COUNT(*) > 1
    `);

    if (duplicateMappings.rows.length > 0) {
      result.addIssue('warning', `Found ${duplicateMappings.rows.length} duplicate Pipedrive company mappings`, {
        duplicates: duplicateMappings.rows
      });
      
      result.addManualAction('Review and resolve duplicate tenant mappings', {
        duplicates: duplicateMappings.rows
      });
    }

  } catch (error) {
    result.addIssue('critical', 'Tenant mapping health check failed', { error: error.message });
  }
}

/**
 * Evaluate recent delivery performance and resolve batch-processing backlogs.
 *
 * Performs two checks:
 * 1. Delivery performance (last 1 hour): computes total attempts, successes, failures, and average processing time.
 *    - Adds a warning if success rate < 95% or average processing time > 5000 ms.
 *    - Records an informational entry with the computed metrics.
 * 2. Batch backlog: counts pending 'batch' notifications older than 10 minutes.
 *    - If backlog > 10, records a warning and attempts to clear the backlog by calling processBatchQueue().
 *    - If batch processing succeeds and items are processed, records an auto-fix entry; if processing fails, records a critical issue.
 *
 * Any unexpected error during the checks is recorded on the provided result as a critical issue.
 *
 * @param {HealthCheckResult} result - Mutable health-check result object used to record issues, auto-fixes, and manual actions.
 */
async function checkDeliverySystemHealth(result) {
  try {
    // Check recent delivery success rate
    const deliveryStats = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(processing_time_ms) as avg_processing_time
      FROM delivery_log 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    const stats = deliveryStats.rows[0];
    const totalAttempts = parseInt(stats.total_attempts);
    const successfulAttempts = parseInt(stats.successful);
    const failedAttempts = parseInt(stats.failed);
    
    if (totalAttempts > 0) {
      const successRate = (successfulAttempts / totalAttempts) * 100;
      const avgProcessingTime = parseFloat(stats.avg_processing_time) || 0;

      if (successRate < 95) {
        result.addIssue('warning', `Low delivery success rate: ${successRate.toFixed(1)}%`, {
          successRate: successRate,
          totalAttempts: totalAttempts,
          failedAttempts: failedAttempts
        });
      }

      if (avgProcessingTime > 5000) { // 5 seconds
        result.addIssue('warning', `High average processing time: ${avgProcessingTime.toFixed(0)}ms`, {
          avgProcessingTime: avgProcessingTime
        });
      }

      result.addIssue('info', 'Recent delivery performance', {
        successRate: successRate,
        totalAttempts: totalAttempts,
        avgProcessingTime: avgProcessingTime
      });
    }

    // Check for backed up batch processing
    const batchBacklog = await pool.query(`
      SELECT COUNT(*) as count
      FROM notification_queue 
      WHERE tier = 'batch' 
        AND status = 'pending'
        AND created_at < NOW() - INTERVAL '10 minutes'
    `);

    const backlogCount = parseInt(batchBacklog.rows[0].count);
    
    if (backlogCount > 10) {
      result.addIssue('warning', `Batch processing backlog: ${backlogCount} items`, {
        backlogCount: backlogCount
      });

      // Auto-fix: Trigger immediate batch processing
      try {
        const batchResult = await processBatchQueue();
        
        if (batchResult.processed > 0) {
          result.addAutoFix(`Processed ${batchResult.processed} backed up batch notifications`, {
            processed: batchResult.processed
          });
        }
      } catch (batchError) {
        result.addIssue('critical', 'Failed to process batch backlog', { error: batchError.message });
      }
    }

  } catch (error) {
    result.addIssue('critical', 'Delivery system health check failed', { error: error.message });
  }
}

/**
 * Assess database cleanup needs and apply safe automatic cleanups, recording results on the provided HealthCheckResult.
 *
 * Checks for delivery_log rows older than 90 days (and deletes up to 1000 rows per run) and for malformed notification_queue entries
 * (null data, text containing "[object Object]", or missing `webhook_url`). Detected issues are added to `result`; applied automatic
 * fixes are recorded via `result.addAutoFix`. If an unexpected error occurs, a critical issue is recorded on `result`.
 *
 * @param {HealthCheckResult} result - HealthCheckResult instance used to record detected issues, automatic fixes, and manual actions.
 */
async function checkDatabaseCleanupNeeds(result) {
  try {
    // Check for old delivery logs (90+ days)
    const oldLogs = await pool.query(`
      SELECT COUNT(*) as count
      FROM delivery_log 
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);

    const oldLogCount = parseInt(oldLogs.rows[0].count);
    
    if (oldLogCount > 1000) {
      result.addIssue('info', `Found ${oldLogCount} old delivery logs ready for cleanup`, {
        count: oldLogCount
      });

      // Auto-fix: Clean up old logs in batches
      const cleanupResult = await pool.query(`
        DELETE FROM delivery_log 
        WHERE created_at < NOW() - INTERVAL '90 days'
        AND id IN (
          SELECT id FROM delivery_log 
          WHERE created_at < NOW() - INTERVAL '90 days'
          LIMIT 1000
        )
      `);

      if (cleanupResult.rowCount > 0) {
        result.addAutoFix(`Cleaned up ${cleanupResult.rowCount} old delivery logs`, {
          cleanedCount: cleanupResult.rowCount
        });
      }
    }

    // Check for malformed notification data
    const malformedData = await pool.query(`
      SELECT COUNT(*) as count
      FROM notification_queue 
      WHERE notification_data IS NULL 
         OR notification_data::text LIKE '%[object Object]%'
         OR (notification_data::jsonb ? 'webhook_url') = false
    `);

    const malformedCount = parseInt(malformedData.rows[0].count);
    
    if (malformedCount > 0) {
      result.addIssue('warning', `Found ${malformedCount} notifications with malformed data`, {
        count: malformedCount
      });

      // Auto-fix: Remove malformed notifications that can't be processed
      const cleanupMalformed = await pool.query(`
        UPDATE notification_queue 
        SET status = 'failed',
            error_message = 'Malformed notification data - auto-cleaned by self-healing'
        WHERE (notification_data IS NULL 
               OR notification_data::text LIKE '%[object Object]%'
               OR (notification_data::jsonb ? 'webhook_url') = false)
          AND status = 'pending'
      `);

      if (cleanupMalformed.rowCount > 0) {
        result.addAutoFix(`Marked ${cleanupMalformed.rowCount} malformed notifications as failed`, {
          cleanedCount: cleanupMalformed.rowCount
        });
      }
    }

  } catch (error) {
    result.addIssue('critical', 'Database cleanup health check failed', { error: error.message });
  }
}

/**
 * Inspect the database for a small sample of active webhooks and record the finding on the provided HealthCheckResult.
 *
 * This function queries for up to three enabled webhooks that are referenced by enabled rules and:
 * - Adds a warning issue if no active webhooks are found for connectivity monitoring.
 * - Adds an informational issue listing how many active webhooks were discovered.
 * - Records a critical issue if the health check query fails.
 *
 * Note: This routine does not perform actual network connectivity tests to avoid generating outbound traffic.
 *
 * @param {Object} result - HealthCheckResult-like object used to record issues, auto-fixes, and manual actions.
 */
async function checkWebhookConnectivity(result) {
  try {
    // Get a sample of active webhooks for connectivity testing
    const sampleWebhooks = await pool.query(`
      SELECT DISTINCT cw.webhook_url
      FROM chat_webhooks cw
      JOIN rules r ON cw.id = r.target_webhook_id
      WHERE cw.enabled = true 
        AND r.enabled = true
      LIMIT 3
    `);

    if (sampleWebhooks.rows.length === 0) {
      result.addIssue('warning', 'No active webhooks found for connectivity testing');
      return;
    }

    // Note: We don't actually test connectivity here to avoid spam
    // This is a placeholder for future implementation
    result.addIssue('info', `Found ${sampleWebhooks.rows.length} active webhooks for monitoring`, {
      webhookCount: sampleWebhooks.rows.length
    });

  } catch (error) {
    result.addIssue('critical', 'Webhook connectivity health check failed', { error: error.message });
  }
}

/**
 * Initialize and start the periodic self-healing monitor.
 *
 * Runs an initial health check immediately, then schedules recurring runs using
 * HEALING_CONFIG.CHECK_INTERVAL_MS. Startup and scheduling failures are logged;
 * errors from individual runs are caught and logged but do not stop the scheduler.
 */
function startSelfHealingMonitor() {
  console.log('🚀 Starting self-healing monitoring system...');
  console.log(`⏰ Health checks will run every ${HEALING_CONFIG.CHECK_INTERVAL_MS / 60000} minutes`);

  // Run initial health check
  runSelfHealing().catch(error => {
    console.error('❌ Initial self-healing check failed:', error);
  });

  // Schedule periodic health checks
  setInterval(async () => {
    try {
      await runSelfHealing();
    } catch (error) {
      console.error('❌ Scheduled self-healing check failed:', error);
    }
  }, HEALING_CONFIG.CHECK_INTERVAL_MS);
}

/**
 * Run immediate emergency fixes for critical notification-system failures.
 *
 * Performs three corrective actions synchronously: retries failed notifications (incrementing retry counts and rescheduling them for immediate delivery), processes any pending batch queue items, and clears stale "processing" locks by resetting those items to "pending".
 *
 * Side effects: updates notification_queue rows (status, scheduled_for, retry_count), invokes batch processing, and may delete or modify database state as part of fixes. On error the function records a critical issue in the returned HealthCheckResult and returns that result.
 *
 * @return {Promise<HealthCheckResult>} A HealthCheckResult summarizing detected issues, applied automatic fixes, and any manual actions required.
async function runEmergencyHealing() {
  console.log('🚨 Running emergency self-healing...');
  
  const result = new HealthCheckResult();
  
  try {
    // Focus on critical issues that can break the system
    
    // 1. Retry all failed notifications immediately
    const failedRetry = await pool.query(`
      UPDATE notification_queue 
      SET status = 'pending', 
          scheduled_for = NOW(),
          retry_count = retry_count + 1
      WHERE status = 'failed'
        AND retry_count < 3
      RETURNING id
    `);

    if (failedRetry.rowCount > 0) {
      result.addAutoFix(`Emergency retry of ${failedRetry.rowCount} failed notifications`, {
        retriedCount: failedRetry.rowCount
      });
    }

    // 2. Process all pending batch items immediately
    const batchResult = await processBatchQueue();
    
    if (batchResult.processed > 0) {
      result.addAutoFix(`Emergency processed ${batchResult.processed} batch notifications`, {
        processed: batchResult.processed
      });
    }

    // 3. Clear any processing locks that might be stuck
    const clearLocks = await pool.query(`
      UPDATE notification_queue 
      SET status = 'pending'
      WHERE status = 'processing'
        AND created_at < NOW() - INTERVAL '30 minutes'
      RETURNING id
    `);

    if (clearLocks.rowCount > 0) {
      result.addAutoFix(`Cleared ${clearLocks.rowCount} stuck processing locks`, {
        clearedCount: clearLocks.rowCount
      });
    }

    console.log('✅ Emergency self-healing completed');
    return result;

  } catch (error) {
    result.addIssue('critical', 'Emergency self-healing failed', { error: error.message });
    console.error('❌ Emergency self-healing failed:', error);
    return result;
  }
}

module.exports = {
  runSelfHealing,
  runEmergencyHealing,
  startSelfHealingMonitor,
  HEALING_CONFIG
};