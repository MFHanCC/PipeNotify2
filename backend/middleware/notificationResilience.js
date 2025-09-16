/**
 * Notification Resilience Middleware
 * Provides comprehensive failover and resilience layer for all notification operations
 */

const { processNotificationDirect } = require('../services/notificationFallback');
const { getQueueInfo } = require('../jobs/queue');
const { pool } = require('../services/database');

// Circuit breaker state
const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  threshold: 5,
  timeout: 60000 // 1 minute
};

/**
 * Enhanced resilience wrapper for all notification operations
 */
async function withResilience(operation, context = {}) {
  const startTime = Date.now();
  let attempt = 0;
  const maxAttempts = 3;
  const backoffBase = 1000;
  
  while (attempt < maxAttempts) {
    attempt++;
    
    try {
      // Check circuit breaker
      if (circuitBreaker.isOpen && shouldKeepCircuitOpen()) {
        throw new Error('Circuit breaker is open - too many recent failures');
      }
      
      // Execute the operation
      const result = await operation();
      
      // Reset circuit breaker on success
      if (circuitBreaker.failures > 0) {
        console.log(`✅ Resilience: Circuit breaker reset after success (was ${circuitBreaker.failures} failures)`);
        circuitBreaker.failures = 0;
        circuitBreaker.isOpen = false;
        circuitBreaker.lastFailure = null;
      }
      
      // Log successful operation
      if (attempt > 1) {
        console.log(`✅ Resilience: Operation succeeded on attempt ${attempt}/${maxAttempts}`);
      }
      
      return {
        success: true,
        result,
        attempts: attempt,
        duration: Date.now() - startTime,
        usedFallback: false
      };
      
    } catch (error) {
      console.error(`❌ Resilience: Attempt ${attempt}/${maxAttempts} failed:`, error.message);
      
      // Update circuit breaker
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = Date.now();
      
      if (circuitBreaker.failures >= circuitBreaker.threshold) {
        circuitBreaker.isOpen = true;
        console.log(`🔴 Resilience: Circuit breaker opened after ${circuitBreaker.failures} failures`);
      }
      
      // If this is the last attempt, try fallback
      if (attempt === maxAttempts) {
        console.log('🔄 Resilience: All attempts failed, trying fallback...');
        
        try {
          const fallbackResult = await tryFallbackOperation(context);
          
          if (fallbackResult && fallbackResult.success) {
            console.log('✅ Resilience: Fallback operation succeeded');
            
            // Log the fallback usage for monitoring
            await logFallbackUsage(context, error.message, fallbackResult);
            
            return {
              success: true,
              result: fallbackResult,
              attempts: attempt,
              duration: Date.now() - startTime,
              usedFallback: true,
              fallbackReason: error.message
            };
          }
        } catch (fallbackError) {
          console.error('❌ Resilience: Fallback also failed:', fallbackError.message);
        }
        
        // Both primary and fallback failed
        throw new Error(`All resilience mechanisms failed. Last error: ${error.message}`);
      }
      
      // Wait before retry (exponential backoff with jitter)
      const backoffTime = Math.min(backoffBase * Math.pow(2, attempt - 1), 5000);
      const jitter = Math.random() * 0.3 * backoffTime;
      await new Promise(resolve => setTimeout(resolve, backoffTime + jitter));
    }
  }
}

/**
 * Try fallback operation based on context
 */
async function tryFallbackOperation(context) {
  if (context.type === 'webhook_processing' && context.webhookData) {
    // Use direct notification processing
    return await processNotificationDirect(context.webhookData);
  }
  
  if (context.type === 'notification_delivery' && context.rule && context.webhookData) {
    // Use direct notification delivery
    const { defaultChatClient } = require('../services/chatClient');
    return await defaultChatClient.sendNotification(
      context.targetWebhook?.webhook_url,
      context.webhookData,
      context.rule.template_mode,
      context.rule.custom_template,
      context.tenantId
    );
  }
  
  if (context.type === 'database_operation' && context.query && context.params) {
    // Use database connection with retry
    return await executeWithDatabaseRetry(context.query, context.params);
  }
  
  console.log('⚠️ Resilience: No suitable fallback found for operation type:', context.type);
  return null;
}

/**
 * Execute database operations with connection retry
 */
async function executeWithDatabaseRetry(query, params, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Test connection first
      await pool.query('SELECT 1');
      
      // Execute the actual query
      const result = await pool.query(query, params);
      return result;
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Database retry ${i + 1}/${maxRetries} failed:`, error.message);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if circuit breaker should remain open
 */
function shouldKeepCircuitOpen() {
  if (!circuitBreaker.isOpen || !circuitBreaker.lastFailure) {
    return false;
  }
  
  const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
  
  if (timeSinceLastFailure > circuitBreaker.timeout) {
    // Timeout expired, close the circuit breaker
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = Math.max(0, circuitBreaker.failures - 1); // Gradual recovery
    console.log(`🟡 Resilience: Circuit breaker half-opened for testing (failures: ${circuitBreaker.failures})`);
    return false;
  }
  
  return true;
}

/**
 * Log fallback usage for monitoring
 */
async function logFallbackUsage(context, primaryError, fallbackResult) {
  try {
    await pool.query(`
      INSERT INTO logs (tenant_id, event_type, payload, status, error_message, response_time_ms, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      context.tenantId || null,
      'system.fallback_used',
      JSON.stringify({
        context_type: context.type,
        primary_error: primaryError,
        fallback_success: fallbackResult.success,
        fallback_notifications_sent: fallbackResult.notificationsSent || 0
      }),
      fallbackResult.success ? 'fallback_success' : 'fallback_failed',
      primaryError,
      fallbackResult.processingTime || 0
    ]);
  } catch (logError) {
    console.error('Failed to log fallback usage:', logError.message);
  }
}

/**
 * Health check for resilience system
 */
async function resilienceHealthCheck() {
  try {
    const queueInfo = await getQueueInfo();
    
    // Check recent fallback usage
    const recentFallbacks = await pool.query(`
      SELECT COUNT(*) as fallback_count, 
             COUNT(CASE WHEN status = 'fallback_success' THEN 1 END) as successful_fallbacks
      FROM logs 
      WHERE event_type = 'system.fallback_used' 
        AND created_at > NOW() - INTERVAL '1 hour'
    `);
    
    const fallbackStats = recentFallbacks.rows[0];
    
    return {
      healthy: true,
      circuitBreaker: {
        isOpen: circuitBreaker.isOpen,
        failures: circuitBreaker.failures,
        threshold: circuitBreaker.threshold,
        lastFailure: circuitBreaker.lastFailure ? new Date(circuitBreaker.lastFailure).toISOString() : null
      },
      queue: {
        connected: queueInfo.connected,
        waiting: queueInfo.waiting,
        active: queueInfo.active
      },
      fallbackUsage: {
        lastHour: parseInt(fallbackStats.fallback_count),
        successful: parseInt(fallbackStats.successful_fallbacks),
        successRate: parseInt(fallbackStats.fallback_count) > 0 
          ? Math.round((parseInt(fallbackStats.successful_fallbacks) / parseInt(fallbackStats.fallback_count)) * 100)
          : 100
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

/**
 * Reset circuit breaker (for admin use)
 */
function resetCircuitBreaker() {
  const oldState = { ...circuitBreaker };
  
  circuitBreaker.failures = 0;
  circuitBreaker.lastFailure = null;
  circuitBreaker.isOpen = false;
  
  console.log('🔄 Resilience: Circuit breaker manually reset');
  
  return {
    message: 'Circuit breaker reset successfully',
    oldState,
    newState: { ...circuitBreaker }
  };
}

/**
 * Get current resilience status
 */
function getResilienceStatus() {
  return {
    circuitBreaker: {
      isOpen: circuitBreaker.isOpen,
      failures: circuitBreaker.failures,
      threshold: circuitBreaker.threshold,
      timeout: circuitBreaker.timeout,
      lastFailure: circuitBreaker.lastFailure ? new Date(circuitBreaker.lastFailure).toISOString() : null,
      timeUntilReset: circuitBreaker.isOpen && circuitBreaker.lastFailure
        ? Math.max(0, circuitBreaker.timeout - (Date.now() - circuitBreaker.lastFailure))
        : 0
    },
    status: circuitBreaker.isOpen ? 'circuit_open' : 'operational',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  withResilience,
  resilienceHealthCheck,
  resetCircuitBreaker,
  getResilienceStatus,
  executeWithDatabaseRetry
};