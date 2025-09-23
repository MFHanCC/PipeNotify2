/**
 * Guaranteed Notification Delivery Service
 * Multi-tier delivery system that ensures notifications are ALWAYS delivered
 * Tiers: Queue -> Direct -> Batch -> Manual Recovery
 */

const { pool } = require('./database');
const { defaultChatClient } = require('./chatClient');
const { processNotificationDirect } = require('./notificationFallback');

/**
 * Main entry point for guaranteed delivery
 * Routes to appropriate tier based on system health
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
 * Tier 1: Queue-based delivery via BullMQ
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
 * Tier 2: Direct processing (bypass queue)
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
 * Tier 3: Store for batch processing
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
 * Tier 4: Store for manual recovery
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
 * Process batch queue (called by cron job)
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
 * Get delivery statistics
 */
async function getDeliveryStats(hours = 24) {
  try {
    const stats = await pool.query(`
      SELECT 
        tier,
        status,
        COUNT(*) as count,
        AVG(processing_time_ms) as avg_processing_time
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
 * Manual recovery interface
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

// Helper functions

function generateDeliveryId() {
  return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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