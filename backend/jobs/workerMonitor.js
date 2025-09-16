/**
 * Worker monitoring and auto-restart system
 * Ensures the notification worker stays healthy and automatically recovers from failures
 */

const { getQueueInfo } = require('./queue');

let monitoringInterval;
let lastWorkerCheck = Date.now();
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const CHECK_INTERVAL = 60000; // 1 minute
const WORKER_TIMEOUT = 300000; // 5 minutes

/**
 * Start monitoring the worker process
 */
function startWorkerMonitoring() {
  if (monitoringInterval) {
    console.log('Worker monitoring already started');
    return;
  }
  
  console.log('🔍 Starting worker health monitoring...');
  
  monitoringInterval = setInterval(async () => {
    try {
      await checkWorkerHealth();
    } catch (error) {
      console.error('Worker monitoring error:', error);
    }
  }, CHECK_INTERVAL);
  
  // Initial health check
  checkWorkerHealth();
}

/**
 * Stop monitoring the worker process
 */
function stopWorkerMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Worker monitoring stopped');
  }
}

/**
 * Check worker health and restart if necessary
 */
async function checkWorkerHealth() {
  try {
    const queueInfo = await getQueueInfo();
    const now = Date.now();
    
    // Check if there are jobs waiting but no activity
    const hasWaitingJobs = queueInfo.waiting > 0;
    const noActiveJobs = queueInfo.active === 0;
    const timeSinceLastCheck = now - lastWorkerCheck;
    
    // Check recent database activity as a proxy for worker health
    const recentActivity = await checkRecentWorkerActivity();
    
    let workerIssue = false;
    let issueReason = '';
    
    if (hasWaitingJobs && noActiveJobs && timeSinceLastCheck > WORKER_TIMEOUT) {
      workerIssue = true;
      issueReason = `Jobs waiting (${queueInfo.waiting}) but no active processing for ${Math.round(timeSinceLastCheck/1000)}s`;
    } else if (!recentActivity.hasActivity && hasWaitingJobs) {
      workerIssue = true;
      issueReason = `No recent worker activity in database but ${queueInfo.waiting} jobs waiting`;
    } else if (!queueInfo.connected) {
      workerIssue = true;
      issueReason = 'Queue connection failed';
    }
    
    if (workerIssue) {
      consecutiveFailures++;
      console.error(`❌ Worker health issue #${consecutiveFailures}: ${issueReason}`);
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`🚨 CRITICAL: Worker failed ${consecutiveFailures} consecutive checks`);
        await attemptWorkerRestart();
      }
    } else {
      if (consecutiveFailures > 0) {
        console.log(`✅ Worker health restored after ${consecutiveFailures} failures`);
      }
      consecutiveFailures = 0;
      lastWorkerCheck = now;
    }
    
    // Log periodic health status
    if (now % (5 * 60 * 1000) < CHECK_INTERVAL) { // Every 5 minutes
      console.log(`🔍 Worker health check: ${workerIssue ? '❌ UNHEALTHY' : '✅ HEALTHY'}`, {
        waiting: queueInfo.waiting,
        active: queueInfo.active,
        consecutiveFailures,
        lastActivity: recentActivity.lastActivity
      });
    }
    
  } catch (error) {
    consecutiveFailures++;
    console.error(`❌ Worker health check failed #${consecutiveFailures}:`, error.message);
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error('🚨 CRITICAL: Health check system failing - manual intervention required');
    }
  }
}

/**
 * Check for recent worker activity in the database
 */
async function checkRecentWorkerActivity() {
  try {
    const { pool } = require('../services/database');
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as recent_logs,
        MAX(created_at) as last_activity,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as recent_successes
      FROM logs 
      WHERE created_at > NOW() - INTERVAL '10 minutes'
    `);
    
    const row = result.rows[0];
    const lastActivity = row.last_activity;
    const recentLogs = parseInt(row.recent_logs);
    const hasActivity = lastActivity && (Date.now() - new Date(lastActivity).getTime()) < 600000; // 10 minutes
    
    return {
      hasActivity,
      lastActivity,
      recentLogs,
      recentSuccesses: parseInt(row.recent_successes)
    };
    
  } catch (error) {
    console.error('Error checking worker activity:', error);
    return { hasActivity: false, error: error.message };
  }
}

/**
 * Attempt to restart the worker process
 */
async function attemptWorkerRestart() {
  try {
    console.log('🔄 Attempting worker restart...');
    
    // Strategy 1: Try to recreate the worker from the processor module
    try {
      console.log('🔄 Reloading processor module...');
      
      // Clear the require cache for the processor
      const processorPath = require.resolve('./processor');
      delete require.cache[processorPath];
      
      // Re-require the processor to restart the worker
      require('./processor');
      
      console.log('✅ Processor module reloaded');
      
      // Reset failure counter
      consecutiveFailures = 0;
      lastWorkerCheck = Date.now();
      
      // Wait a bit and verify the restart worked
      setTimeout(async () => {
        const queueInfo = await getQueueInfo();
        console.log(`🔍 Post-restart queue status: waiting=${queueInfo.waiting}, active=${queueInfo.active}`);
      }, 5000);
      
      return true;
      
    } catch (moduleError) {
      console.error('❌ Failed to reload processor module:', moduleError);
    }
    
    // Strategy 2: Log the failure for manual intervention
    console.error('🚨 CRITICAL: Automatic worker restart failed - manual intervention required');
    console.error('🔧 Recommended actions:');
    console.error('   1. Check Railway logs for worker errors');
    console.error('   2. Restart the Railway service');
    console.error('   3. Check Redis connection and health');
    
    // Create an alert file for external monitoring
    try {
      const fs = require('fs');
      const alertPath = './logs/worker-failure-alert.txt';
      const alertMessage = `Worker failure detected at ${new Date().toISOString()}\nConsecutive failures: ${consecutiveFailures}\nRequires manual intervention\n`;
      
      // Ensure logs directory exists
      if (!fs.existsSync('./logs')) {
        fs.mkdirSync('./logs', { recursive: true });
      }
      
      fs.writeFileSync(alertPath, alertMessage);
      console.log(`📝 Alert written to ${alertPath}`);
    } catch (alertError) {
      console.error('Failed to write alert file:', alertError);
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Critical error in worker restart attempt:', error);
    return false;
  }
}

/**
 * Get current monitoring status
 */
function getMonitoringStatus() {
  return {
    active: !!monitoringInterval,
    consecutiveFailures,
    lastWorkerCheck: new Date(lastWorkerCheck).toISOString(),
    nextCheck: monitoringInterval ? new Date(Date.now() + CHECK_INTERVAL).toISOString() : null,
    checkInterval: CHECK_INTERVAL,
    workerTimeout: WORKER_TIMEOUT,
    maxConsecutiveFailures: MAX_CONSECUTIVE_FAILURES
  };
}

/**
 * Force a worker health check (for debugging)
 */
async function forceHealthCheck() {
  console.log('🔍 Forcing worker health check...');
  await checkWorkerHealth();
  return getMonitoringStatus();
}

// Start monitoring when this module is loaded
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_WORKER_MONITORING === 'true') {
  startWorkerMonitoring();
  console.log('🔍 Worker monitoring enabled');
} else {
  console.log('🔍 Worker monitoring disabled (set ENABLE_WORKER_MONITORING=true to enable)');
}

module.exports = {
  startWorkerMonitoring,
  stopWorkerMonitoring,
  checkWorkerHealth,
  attemptWorkerRestart,
  getMonitoringStatus,
  forceHealthCheck
};