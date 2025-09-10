const cron = require('node-cron');
const { processDelayedNotifications } = require('../services/quietHours');

/**
 * Delayed Notification Processor
 * Runs every 5 minutes to send notifications that were delayed due to quiet hours
 */

console.log('⏰ Starting delayed notification processor...');

// Process delayed notifications every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('🔔 Checking for delayed notifications to send...');
  try {
    const result = await processDelayedNotifications();
    if (result.processed > 0) {
      console.log(`📬 Processed ${result.processed} delayed notifications`);
    }
  } catch (error) {
    console.error('Error processing delayed notifications:', error);
  }
}, {
  timezone: 'UTC'
});

console.log('📋 Delayed notification processor started (runs every 5 minutes)');

module.exports = {
  processDelayedNotifications
};