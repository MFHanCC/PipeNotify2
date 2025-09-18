#!/usr/bin/env node

/**
 * Batch Notification Processor
 * Processes notifications that failed immediate delivery
 * Runs every 5 minutes to ensure guaranteed delivery
 */

const cron = require('node-cron');
const { processBatchQueue } = require('../services/guaranteedDelivery');

console.log('🔄 Starting batch notification processor...');

// Process batch queue every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('📦 Batch processor: Checking for pending notifications...');
  
  try {
    const result = await processBatchQueue();
    
    if (result.processed > 0) {
      console.log(`✅ Batch processor: Processed ${result.processed} notifications (${result.failed} failed)`);
    } else if (result.error) {
      console.error(`❌ Batch processor error: ${result.error}`);
    }
    // Don't log when no notifications (to avoid spam)
    
  } catch (error) {
    console.error('❌ Batch processor crashed:', error);
  }
}, {
  timezone: 'UTC'
});

console.log('📋 Batch notification processor started (runs every 5 minutes)');

// Health check function
async function healthCheck() {
  try {
    const { getDeliveryStats } = require('../services/guaranteedDelivery');
    const stats = await getDeliveryStats(1); // Last 1 hour
    
    return {
      healthy: true,
      processor: 'batch',
      stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      healthy: false,
      processor: 'batch',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  healthCheck
};