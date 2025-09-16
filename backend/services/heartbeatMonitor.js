/**
 * Heartbeat Notification System
 * Sends periodic health notifications and detects system issues
 */

const { processNotificationDirect } = require('./notificationFallback');
const { pool } = require('./database');

let heartbeatInterval;
let lastNotificationTime = null;
const HEARTBEAT_INTERVAL = 60 * 60 * 1000; // 1 hour
const NOTIFICATION_TIMEOUT_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
const HEARTBEAT_ENABLED = process.env.ENABLE_HEARTBEAT === 'true' || process.env.NODE_ENV === 'production';

/**
 * Start heartbeat monitoring
 */
function startHeartbeatMonitoring() {
  if (!HEARTBEAT_ENABLED) {
    console.log('🫀 Heartbeat monitoring disabled (set ENABLE_HEARTBEAT=true to enable)');
    return;
  }
  
  if (heartbeatInterval) {
    console.log('🫀 Heartbeat monitoring already running');
    return;
  }
  
  console.log('🫀 Starting heartbeat monitoring (hourly health checks)...');
  
  // Initial heartbeat after 5 minutes
  setTimeout(performHeartbeat, 5 * 60 * 1000);
  
  // Regular heartbeat every hour
  heartbeatInterval = setInterval(performHeartbeat, HEARTBEAT_INTERVAL);
}

/**
 * Stop heartbeat monitoring
 */
function stopHeartbeatMonitoring() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('🫀 Heartbeat monitoring stopped');
  }
}

/**
 * Perform a heartbeat check and notification
 */
async function performHeartbeat() {
  try {
    console.log('🫀 Performing heartbeat check...');
    
    // Check for active tenants with rules and webhooks
    const activeTenants = await pool.query(`
      SELECT DISTINCT t.id, t.company_name, t.pipedrive_company_id,
             COUNT(DISTINCT r.id) as rule_count,
             COUNT(DISTINCT cw.id) as webhook_count
      FROM tenants t
      JOIN rules r ON t.id = r.tenant_id AND r.enabled = true
      JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
      GROUP BY t.id, t.company_name, t.pipedrive_company_id
      HAVING COUNT(DISTINCT r.id) > 0 AND COUNT(DISTINCT cw.id) > 0
      ORDER BY t.id
      LIMIT 5
    `);
    
    if (activeTenants.rows.length === 0) {
      console.log('🫀 No active tenants found for heartbeat');
      return;
    }
    
    // Check for recent notification activity
    const recentActivity = await pool.query(`
      SELECT COUNT(*) as recent_notifications, MAX(created_at) as last_notification
      FROM logs 
      WHERE created_at > NOW() - INTERVAL '1 hour' AND status = 'success'
    `);
    
    const recentNotifications = parseInt(recentActivity.rows[0].recent_notifications);
    const lastNotification = recentActivity.rows[0].last_notification;
    
    // Determine if we need to send an alert
    const timeSinceLastNotification = lastNotification 
      ? Date.now() - new Date(lastNotification).getTime() 
      : null;
      
    const shouldSendAlert = !lastNotification || timeSinceLastNotification > NOTIFICATION_TIMEOUT_THRESHOLD;
    
    if (shouldSendAlert) {
      console.log('🚨 ALERT: No successful notifications in 24+ hours');
      await sendHeartbeatAlert(activeTenants.rows[0]);
    } else {
      console.log(`🫀 System healthy: ${recentNotifications} notifications in last hour`);
      
      // Send periodic health confirmation (every 12 hours)
      if (shouldSendHealthConfirmation()) {
        await sendHealthConfirmation(activeTenants.rows[0], recentNotifications);
      }
    }
    
    // Update last heartbeat time
    lastNotificationTime = Date.now();
    
  } catch (error) {
    console.error('🫀 Heartbeat check failed:', error.message);
    
    // Try to send critical error alert
    try {
      const fallbackTenant = await pool.query(`
        SELECT t.id, t.company_name FROM tenants t
        JOIN chat_webhooks cw ON t.id = cw.tenant_id AND cw.is_active = true
        ORDER BY t.id LIMIT 1
      `);
      
      if (fallbackTenant.rows.length > 0) {
        await sendCriticalErrorAlert(fallbackTenant.rows[0], error.message);
      }
    } catch (alertError) {
      console.error('🫀 Failed to send critical error alert:', alertError.message);
    }
  }
}

/**
 * Send heartbeat alert for system issues
 */
async function sendHeartbeatAlert(tenant) {
  try {
    const alertData = {
      event: 'system.alert',
      company_id: tenant.pipedrive_company_id || '13887824',
      user_id: 0,
      object: {
        type: 'system_alert',
        id: Date.now(),
        title: '🚨 PIPENOTIFY SYSTEM ALERT',
        message: 'No notifications delivered in 24+ hours',
        severity: 'critical',
        system_health: 'degraded',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    const result = await processNotificationDirect(alertData);
    
    if (result.success && result.notificationsSent > 0) {
      console.log('🚨 Heartbeat alert sent successfully');
    } else {
      console.log('🚨 Heartbeat alert failed to send');
    }
    
    return result;
    
  } catch (error) {
    console.error('🚨 Failed to send heartbeat alert:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send health confirmation message
 */
async function sendHealthConfirmation(tenant, recentNotifications) {
  try {
    const healthData = {
      event: 'system.health',
      company_id: tenant.pipedrive_company_id || '13887824',
      user_id: 0,
      object: {
        type: 'system_health',
        id: Date.now(),
        title: '💚 Pipenotify System Health Check',
        message: `System operational: ${recentNotifications} notifications delivered in the last hour`,
        severity: 'info',
        system_health: 'healthy',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    const result = await processNotificationDirect(healthData);
    
    if (result.success && result.notificationsSent > 0) {
      console.log('💚 Health confirmation sent successfully');
    }
    
    return result;
    
  } catch (error) {
    console.error('💚 Failed to send health confirmation:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send critical error alert
 */
async function sendCriticalErrorAlert(tenant, errorMessage) {
  try {
    const errorData = {
      event: 'system.error',
      company_id: tenant.pipedrive_company_id || '13887824',
      user_id: 0,
      object: {
        type: 'system_error',
        id: Date.now(),
        title: '⛔ PIPENOTIFY CRITICAL ERROR',
        message: `System error detected: ${errorMessage}`,
        severity: 'critical',
        system_health: 'error',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    const result = await processNotificationDirect(errorData);
    console.log('⛔ Critical error alert sent');
    return result;
    
  } catch (error) {
    console.error('⛔ Failed to send critical error alert:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Determine if we should send health confirmation
 */
function shouldSendHealthConfirmation() {
  if (!lastNotificationTime) return true;
  
  const timeSinceLastConfirmation = Date.now() - lastNotificationTime;
  return timeSinceLastConfirmation > (12 * 60 * 60 * 1000); // 12 hours
}

/**
 * Get heartbeat status
 */
function getHeartbeatStatus() {
  return {
    enabled: HEARTBEAT_ENABLED,
    active: !!heartbeatInterval,
    lastNotificationTime: lastNotificationTime ? new Date(lastNotificationTime).toISOString() : null,
    nextHeartbeat: heartbeatInterval ? new Date(Date.now() + HEARTBEAT_INTERVAL).toISOString() : null,
    interval: HEARTBEAT_INTERVAL,
    timeoutThreshold: NOTIFICATION_TIMEOUT_THRESHOLD
  };
}

/**
 * Force a heartbeat check (for debugging)
 */
async function forceHeartbeat() {
  console.log('🫀 Forcing heartbeat check...');
  await performHeartbeat();
  return getHeartbeatStatus();
}

// Auto-start in production
if (HEARTBEAT_ENABLED) {
  setTimeout(startHeartbeatMonitoring, 10000); // Start after 10 seconds
}

module.exports = {
  startHeartbeatMonitoring,
  stopHeartbeatMonitoring,
  performHeartbeat,
  getHeartbeatStatus,
  forceHeartbeat
};