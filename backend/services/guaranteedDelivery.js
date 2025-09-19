/**
 * Guaranteed Notification Delivery Service
 * Multi-tier delivery system that ensures notifications are ALWAYS delivered
 * Tiers: Queue -> Direct -> Batch -> Manual Recovery
 */

const { pool } = require('./database');
const { defaultChatClient } = require('./chatClient');
const { processNotificationDirect } = require('./notificationFallback');

/**
 * Orchestrates multi-tier guaranteed delivery for a webhook: attempts queueing, falls back to direct delivery,
 * then to batch scheduling, and finally records for manual recovery if all tiers fail.
 *
 * The function:
 * - Generates a unique deliveryId and records an initial 'started' attempt.
 * - Tier 1: tries to enqueue the delivery (queue). On success records and returns queue result.
 * - Tier 2: if queueing fails, attempts direct processing (direct). On success records and returns direct result.
 * - Tier 3: if direct processing fails, schedules the delivery for batch processing and records a 'queued_batch' attempt.
 * - On any unexpected error, records a 'failed' attempt, schedules the entry for manual recovery, and returns a failure object.
 *
 * @param {object} webhookData - Webhook payload. Expected to include at least `event` and `company_id`; the rest of the shape is passed through to downstream tiers.
 * @param {object} [options] - Optional delivery hints used by the queue tier (e.g., priority, delay, attempts, backoff). These are advisory and only applied when Tier 1 (queue) is used.
 * @returns {Promise<object>} A result object describing the outcome:
 *   - On Tier 1 success: { success: true, tier: 'queue', jobId, deliveryId, ... }
 *   - On Tier 2 success: { success: true, tier: 'direct', notificationsSent, processingTime, deliveryId, ... }
 *   - If queued for batch (Tier 3): { success: false, tier: 'batch', deliveryId, message: 'Queued for batch processing', batchResult }
 *   - On final failure: { success: false, tier: 'failed', deliveryId, error, message: 'All tiers failed, stored for manual recovery' }
 */
async function guaranteeDelivery(webhookData, options = {}) {
  const deliveryId = generateDeliveryId();
  const startTime = Date.now();
  
  console.log(`🛡️ GUARANTEED DELIVERY ${deliveryId}: Starting multi-tier processing`);
  
  try {
    // Record delivery attempt
    await recordDeliveryAttempt(deliveryId, webhookData, 'started');
    
    // Tier 1: Queue-based processing (BullMQ)
    const queueResult = await attemptQueueDelivery(deliveryId, webhookData, options);
    if (queueResult.success) {
      await recordDeliveryAttempt(deliveryId, webhookData, 'success', 'queue', queueResult);
      return queueResult;
    }
    
    console.log(`⚠️ TIER 1 FAILED: ${queueResult.error}, escalating to TIER 2`);
    
    // Tier 2: Direct processing (bypass queue)
    const directResult = await attemptDirectDelivery(deliveryId, webhookData);
    if (directResult.success) {
      await recordDeliveryAttempt(deliveryId, webhookData, 'success', 'direct', directResult);
      return directResult;
    }
    
    console.log(`⚠️ TIER 2 FAILED: ${directResult.error}, escalating to TIER 3`);
    
    // Tier 3: Store for batch processing
    const batchResult = await scheduleForBatchProcessing(deliveryId, webhookData);
    await recordDeliveryAttempt(deliveryId, webhookData, 'queued_batch', 'batch', batchResult);
    
    console.log(`📦 TIER 3: Queued for batch processing, delivery_id: ${deliveryId}`);
    
    return {
      success: false,
      tier: 'batch',
      deliveryId,
      message: 'Queued for batch processing',
      batchResult
    };
    
  } catch (error) {
    console.error(`❌ GUARANTEED DELIVERY ${deliveryId} FAILED:`, error);
    
    await recordDeliveryAttempt(deliveryId, webhookData, 'failed', 'all_tiers', { error: error.message });
    
    // Even if everything fails, store for manual recovery
    await scheduleForManualRecovery(deliveryId, webhookData, error);
    
    return {
      success: false,
      tier: 'failed',
      deliveryId,
      error: error.message,
      message: 'All tiers failed, stored for manual recovery'
    };
  }
}

/**
 * Enqueues a notification job in the Tier 1 delivery queue (BullMQ).
 *
 * Attempts to verify queue connectivity, then adds a job for the provided webhook payload.
 * On success returns an object containing success=true, tier='queue', the created jobId, and deliveryId.
 * On failure (including queue not connected) it catches the error and returns success=false with an error message;
 * the function does not throw.
 *
 * @param {string} deliveryId - Unique identifier for this delivery attempt (used for logging/tracking).
 * @param {Object} webhookData - Payload to be delivered; typically contains event and company identifiers.
 * @param {Object} [options] - Enqueue options.
 * @param {number} [options.priority=5] - Job priority (lower number = higher priority).
 * @param {number} [options.delay=0] - Milliseconds to delay job execution.
 * @return {{success: boolean, tier: string, jobId?: string|number, deliveryId: string, error?: string}}
 */
async function attemptQueueDelivery(deliveryId, webhookData, options) {
  try {
    const { addNotificationJob, getQueueInfo } = require('../jobs/queue');
    
    // Check queue health first
    const queueHealth = await getQueueInfo();
    if (!queueHealth.connected) {
      throw new Error('Queue not connected');
    }
    
    // Add job to queue
    const job = await addNotificationJob(webhookData, {
      priority: options.priority || 5,
      delay: options.delay || 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
    
    console.log(`✅ TIER 1: Queued job ${job.id} for delivery ${deliveryId}`);
    
    return {
      success: true,
      tier: 'queue',
      jobId: job.id,
      deliveryId
    };
    
  } catch (error) {
    console.error(`❌ TIER 1 FAILED (${deliveryId}):`, error.message);
    return {
      success: false,
      tier: 'queue',
      error: error.message,
      deliveryId
    };
  }
}

/**
 * Attempt immediate (direct) delivery of a webhook, bypassing the queue (Tier 2).
 *
 * Attempts to deliver the provided webhook payload via processNotificationDirect and returns a
 * structured result indicating success or failure. This function catches internal errors and
 * returns an error object instead of throwing.
 *
 * @param {string} deliveryId - Unique delivery identifier used for logging and result correlation.
 * @param {Object} webhookData - Webhook payload to deliver. Expected to include at least
 *   `event` and `company_id` and any data required by processNotificationDirect.
 * @returns {Promise<Object>} Result object:
 *   - On success: { success: true, tier: 'direct', notificationsSent: number, processingTime: number, deliveryId }
 *   - On failure: { success: false, tier: 'direct', error: string, deliveryId }
 */
async function attemptDirectDelivery(deliveryId, webhookData) {
  try {
    console.log(`🔄 TIER 2: Direct processing for delivery ${deliveryId}`);
    
    const result = await processNotificationDirect(webhookData);
    
    if (result.success && result.notificationsSent > 0) {
      console.log(`✅ TIER 2: Sent ${result.notificationsSent} notifications for delivery ${deliveryId}`);
      return {
        success: true,
        tier: 'direct',
        notificationsSent: result.notificationsSent,
        deliveryId,
        processingTime: result.processingTime
      };
    } else {
      throw new Error(result.error || 'No notifications sent');
    }
    
  } catch (error) {
    console.error(`❌ TIER 2 FAILED (${deliveryId}):`, error.message);
    return {
      success: false,
      tier: 'direct',
      error: error.message,
      deliveryId
    };
  }
}

/**
 * Persist a delivery for later batch processing (Tier 3).
 *
 * Stores the webhook payload in the notification_queue table with status 'pending' and tier 'batch',
 * scheduling it to be processed 5 minutes from now.
 *
 * @param {string} deliveryId - Unique ID for this delivery attempt.
 * @param {Object} webhookData - The webhook payload to be stored for batch processing.
 * @return {Promise<{success: boolean, queueId: number, scheduledFor: Date, deliveryId: string}>}
 *   Resolves with metadata about the queued entry: the DB queueId, the scheduled processing time, and the deliveryId.
 * @throws {Error} Propagates database errors if the insert fails.
 */
async function scheduleForBatchProcessing(deliveryId, webhookData) {
  try {
    const result = await pool.query(`
      INSERT INTO notification_queue (
        delivery_id,
        webhook_data,
        status,
        tier,
        created_at,
        scheduled_for
      ) VALUES ($1, $2, 'pending', 'batch', NOW(), NOW() + INTERVAL '5 minutes')
      RETURNING id
    `, [deliveryId, JSON.stringify(webhookData)]);
    
    const queueId = result.rows[0].id;
    console.log(`📦 TIER 3: Stored in batch queue ${queueId} for delivery ${deliveryId}`);
    
    return {
      success: true,
      queueId,
      scheduledFor: new Date(Date.now() + 5 * 60 * 1000),
      deliveryId
    };
    
  } catch (error) {
    console.error(`❌ TIER 3 FAILED (${deliveryId}):`, error.message);
    throw error;
  }
}

/**
 * Store a delivery for manual recovery (Tier 4).
 *
 * Inserts a 'manual_recovery' row into the notification_queue table with status 'manual_recovery',
 * tier 'manual', the original webhook payload, the triggering error message, created_at = NOW(),
 * and scheduled_for = NOW() + 1 hour.
 * If persistence fails, delegates to logCriticalFailure to surface the critical condition.
 *
 * @param {string} deliveryId - Unique delivery identifier for this attempt.
 * @param {Object} webhookData - Original webhook payload to be used for manual replay.
 * @param {Error} error - Error that caused escalation; its message is stored with the record.
 */
async function scheduleForManualRecovery(deliveryId, webhookData, error) {
  try {
    await pool.query(`
      INSERT INTO notification_queue (
        delivery_id,
        webhook_data,
        status,
        tier,
        error_message,
        created_at,
        scheduled_for
      ) VALUES ($1, $2, 'manual_recovery', 'manual', $3, NOW(), NOW() + INTERVAL '1 hour')
    `, [deliveryId, JSON.stringify(webhookData), error.message]);
    
    console.log(`🆘 TIER 4: Stored for manual recovery - delivery ${deliveryId}`);
    
  } catch (recoveryError) {
    console.error(`❌ MANUAL RECOVERY STORAGE FAILED (${deliveryId}):`, recoveryError.message);
    // If even this fails, we're in a critical state
    await logCriticalFailure(deliveryId, webhookData, error, recoveryError);
  }
}

/**
 * Process pending batch notifications scheduled for immediate delivery.
 *
 * Scans up to 50 entries from `notification_queue` with status `'pending'` and tier `'batch'`
 * whose `scheduled_for` is <= now, attempts direct delivery for each (via `attemptDirectDelivery`),
 * and updates each row's status to `'completed'`, `'failed'`, or `'error'` with appropriate
 * metadata (processed_at, notifications_sent, error_message, retry_count).
 *
 * Returns a summary object with counts and a human-readable message:
 * - On success: { processed, failed, total, message }
 * - On top-level failure: { processed: 0, failed: 0, error } where `error` is the error message
 *
 * Side effects:
 * - Reads from and updates the `notification_queue` table.
 * - Calls `attemptDirectDelivery` for each notification.
 *
 * This function swallows per-notification errors (marks the row and continues) and only returns
 * an error object when the overall batch processing step fails.
 *
 * @return {Promise<Object>} Summary of the batch run.
 */
async function processBatchQueue() {
  try {
    console.log('📦 Processing batch notification queue...');
    
    // Get pending notifications
    const result = await pool.query(`
      SELECT * FROM notification_queue
      WHERE status = 'pending' 
        AND tier = 'batch'
        AND scheduled_for <= NOW()
      ORDER BY created_at ASC
      LIMIT 50
    `);
    
    if (result.rows.length === 0) {
      return { processed: 0, message: 'No pending notifications' };
    }
    
    console.log(`📦 Processing ${result.rows.length} batch notifications`);
    
    let processed = 0;
    let failed = 0;
    
    for (const notification of result.rows) {
      try {
        const webhookData = JSON.parse(notification.webhook_data);
        
        // Try direct processing for batch items
        const directResult = await attemptDirectDelivery(notification.delivery_id, webhookData);
        
        if (directResult.success) {
          // Mark as processed
          await pool.query(`
            UPDATE notification_queue 
            SET status = 'completed', 
                processed_at = NOW(),
                notifications_sent = $1
            WHERE id = $2
          `, [directResult.notificationsSent || 1, notification.id]);
          
          processed++;
          console.log(`✅ Batch processed: ${notification.delivery_id}`);
        } else {
          // Mark as failed, will be retried later
          await pool.query(`
            UPDATE notification_queue 
            SET status = 'failed', 
                error_message = $1,
                retry_count = COALESCE(retry_count, 0) + 1
            WHERE id = $2
          `, [directResult.error, notification.id]);
          
          failed++;
          console.log(`❌ Batch failed: ${notification.delivery_id} - ${directResult.error}`);
        }
        
      } catch (error) {
        console.error(`❌ Batch processing error for ${notification.delivery_id}:`, error);
        
        await pool.query(`
          UPDATE notification_queue 
          SET status = 'error', 
              error_message = $1,
              retry_count = COALESCE(retry_count, 0) + 1
          WHERE id = $2
        `, [error.message, notification.id]);
        
        failed++;
      }
    }
    
    return {
      processed,
      failed,
      total: result.rows.length,
      message: `Processed ${processed}, failed ${failed} batch notifications`
    };
    
  } catch (error) {
    console.error('❌ Batch queue processing failed:', error);
    return { processed: 0, failed: 0, error: error.message };
  }
}

/**
 * Retrieve delivery statistics for the past N hours.
 *
 * Queries delivery_log for a breakdown by tier and status and a summary of totals.
 *
 * @param {number} [hours=24] - Time window (in hours) to aggregate statistics over.
 * @returns {Promise<{
 *   timeframe: string,
 *   summary: { total_attempts: number, successful: number, failed: number, queued_batch: number },
 *   breakdown: Array<{ tier: string|null, status: string, count: string, avg_processing_time: number|null }>,
 *   timestamp: string
 * }|null>} An object containing the timeframe label, a summary row, a breakdown array (each row has `tier`, `status`, `count` and `avg_processing_time` in seconds), and an ISO timestamp; returns null on error.
 */
async function getDeliveryStats(hours = 24) {
  try {
    const stats = await pool.query(`
      SELECT 
        tier,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time
      FROM delivery_log
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY tier, status
      ORDER BY tier, status
    `);
    
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'queued_batch' THEN 1 END) as queued_batch
      FROM delivery_log
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
    `);
    
    return {
      timeframe: `${hours} hours`,
      summary: summary.rows[0],
      breakdown: stats.rows,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to get delivery stats:', error);
    return null;
  }
}

/**
 * Retry failed or manual-recovery notifications by re-invoking the delivery flow.
 *
 * Finds up to `limit` entries in `notification_queue` with status 'failed' or 'manual_recovery'
 * and `retry_count < 5`, attempts delivery for each by calling `guaranteeDelivery`, and updates
 * the queue row to 'completed' on success or increments `retry_count` and stores the error on failure.
 *
 * @param {number} [limit=10] - Maximum number of failed notifications to process in this run.
 * @returns {Promise<object>} Summary of the retry run with shape:
 *   { retried: number, successful: number, failed: number, message?: string, error?: string }.
 */
async function retryFailedDeliveries(limit = 10) {
  try {
    const failedNotifications = await pool.query(`
      SELECT * FROM notification_queue
      WHERE status IN ('failed', 'manual_recovery')
        AND retry_count < 5
      ORDER BY created_at ASC
      LIMIT $1
    `, [limit]);
    
    let retried = 0;
    let successful = 0;
    
    for (const notification of failedNotifications.rows) {
      try {
        const webhookData = JSON.parse(notification.webhook_data);
        
        console.log(`🔄 Retrying failed delivery: ${notification.delivery_id}`);
        
        const result = await guaranteeDelivery(webhookData);
        
        if (result.success) {
          await pool.query(`
            UPDATE notification_queue 
            SET status = 'completed', processed_at = NOW()
            WHERE id = $1
          `, [notification.id]);
          successful++;
        }
        
        retried++;
        
      } catch (error) {
        console.error(`❌ Retry failed for ${notification.delivery_id}:`, error);
        
        await pool.query(`
          UPDATE notification_queue 
          SET retry_count = COALESCE(retry_count, 0) + 1,
              error_message = $1
          WHERE id = $2
        `, [error.message, notification.id]);
      }
    }
    
    return {
      retried,
      successful,
      failed: retried - successful,
      message: `Retried ${retried} failed deliveries, ${successful} successful`
    };
    
  } catch (error) {
    console.error('❌ Manual retry failed:', error);
    return { retried: 0, successful: 0, error: error.message };
  }
}

/**
 * Generate a unique delivery identifier string.
 *
 * The returned ID is suitable for use as a delivery tracking key across the
 * guaranteed-delivery workflow (e.g., logging, database records, job metadata).
 * Format: `del_<timestamp>_<randomToken>`.
 *
 * @return {string} A unique delivery ID.
 */

function generateDeliveryId() {
  return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Persist a delivery attempt record to the delivery_log table.
 *
 * Inserts a row with delivery metadata (deliveryId, event type, company id),
 * status, optional tier, and an optional JSON-serialized result. The record's
 * created_at timestamp is set to NOW(). Errors while writing are logged and
 * not propagated.
 *
 * @param {string} deliveryId - Unique identifier for this delivery attempt.
 * @param {Object} webhookData - Webhook payload; must contain `event` and `company_id`.
 * @param {string} status - Logical status of the attempt (e.g., "started", "success", "failed", "queued_batch").
 * @param {string|null} [tier=null] - Delivery tier name (e.g., "queue", "direct", "batch", "manual"), or null when not applicable.
 * @param {Object|null} [result=null] - Optional result/details object; will be stored as a JSON string when provided.
 */
async function recordDeliveryAttempt(deliveryId, webhookData, status, tier = null, result = null) {
  try {
    await pool.query(`
      INSERT INTO delivery_log (
        delivery_id,
        event_type,
        company_id,
        status,
        tier,
        result_data,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      deliveryId,
      webhookData.event,
      webhookData.company_id,
      status,
      tier,
      result ? JSON.stringify(result) : null
    ]);
  } catch (error) {
    console.error('❌ Failed to record delivery attempt:', error);
  }
}

/**
 * Log a critical delivery failure to console and a fallback file for post-mortem analysis.
 *
 * Logs a compact JSON-like entry to stderr containing minimal webhook context (event, company_id, object id),
 * the original error message and the recovery error message, and a timestamp. As a last-resort persistence
 * step it appends the same information as a JSON line to ./logs/critical-failures.log (creating the directory
 * if needed). Any errors thrown while performing the logging are caught and logged to stderr but not rethrown.
 *
 * @param {string} deliveryId - Unique identifier for the delivery attempt.
 * @param {object} webhookData - The original webhook payload; only `event`, `company_id`, and `object.id` are recorded.
 * @param {Error} error - The primary error that caused the delivery to fail.
 * @param {Error} recoveryError - Any error encountered while attempting to schedule or store recovery information.
 */
async function logCriticalFailure(deliveryId, webhookData, error, recoveryError) {
  try {
    console.error(`🚨 CRITICAL FAILURE ${deliveryId}:`, {
      webhookData: {
        event: webhookData.event,
        company_id: webhookData.company_id,
        object_id: webhookData.object?.id
      },
      originalError: error.message,
      recoveryError: recoveryError.message,
      timestamp: new Date().toISOString()
    });
    
    // Write to file as last resort
    const fs = require('fs');
    const logPath = './logs/critical-failures.log';
    
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }
    
    fs.appendFileSync(logPath, JSON.stringify({
      deliveryId,
      event: webhookData.event,
      company_id: webhookData.company_id,
      originalError: error.message,
      recoveryError: recoveryError.message,
      timestamp: new Date().toISOString()
    }) + '\n');
    
  } catch (logError) {
    console.error('❌ Even critical failure logging failed:', logError);
  }
}

module.exports = {
  guaranteeDelivery,
  processBatchQueue,
  getDeliveryStats,
  retryFailedDeliveries,
  attemptDirectDelivery
};