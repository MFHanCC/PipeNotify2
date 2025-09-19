const { Worker } = require('bullmq');
const { redisConfig } = require('./queue');
const cron = require('node-cron');

// Import services
const { defaultChatClient } = require('../services/chatClient');
const { pool, getWebhooks } = require('../services/database');

/**
 * Stalled Deal Monitor - Tracks deals with no recent activity and sends alerts
 * Runs daily checks for deals that haven't been updated within configurable timeframes
 */

// Configuration for stalled deal thresholds (in days)
const STALLED_THRESHOLDS = {
  warning: 3,    // 3 days - Yellow alert
  stale: 7,      // 7 days - Orange alert  
  critical: 14   // 14 days - Red alert
};

/**
 * Find stalled deals for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Array} Array of stalled deals with severity levels
 */
async function findStalledDeals(tenantId) {
  try {
    console.log(`🔍 Checking for stalled deals for tenant ${tenantId}`);
    
    // Query to find deals with their last activity timestamps
    // This simulates checking deal activity - in real implementation, 
    // we'd need to track deal updates or call Pipedrive API
    const query = `
      SELECT DISTINCT
        (l.payload->'object'->>'id') as deal_id,
        (l.payload->'object'->>'title') as deal_title,
        (l.payload->'object'->>'value') as deal_value,
        (l.payload->'object'->>'currency') as deal_currency,
        (l.payload->'object'->>'probability') as deal_probability,
        (l.payload->'object'->>'stage_id') as stage_id,
        (l.payload->'object'->>'user_id') as owner_id,
        MAX(l.created_at) as last_activity,
        NOW() - MAX(l.created_at) as days_since_activity
      FROM logs l
      WHERE l.tenant_id = $1 
        AND l.payload->>'event' LIKE 'deal.%'
        AND l.status = 'success'
        AND (l.payload->'object'->>'id') IS NOT NULL
        AND l.created_at >= NOW() - INTERVAL '30 days'  -- Only check deals active in last 30 days
      GROUP BY 
        (l.payload->'object'->>'id'),
        (l.payload->'object'->>'title'),
        (l.payload->'object'->>'value'),
        (l.payload->'object'->>'currency'), 
        (l.payload->'object'->>'probability'),
        (l.payload->'object'->>'stage_id'),
        (l.payload->'object'->>'user_id')
      HAVING NOW() - MAX(l.created_at) > INTERVAL '${STALLED_THRESHOLDS.warning} days'
      ORDER BY MAX(l.created_at) ASC
    `;
    
    const result = await pool.query(query, [tenantId]);
    
    if (result.rows.length === 0) {
      console.log(`✅ No stalled deals found for tenant ${tenantId}`);
      return [];
    }
    
    // Categorize deals by staleness level
    const stalledDeals = result.rows.map(deal => {
      const daysSinceActivity = parseInt(deal.days_since_activity?.days || 0);
      let severity = 'warning';
      let emoji = '⚠️';
      
      if (daysSinceActivity >= STALLED_THRESHOLDS.critical) {
        severity = 'critical';
        emoji = '🚨';
      } else if (daysSinceActivity >= STALLED_THRESHOLDS.stale) {
        severity = 'stale';
        emoji = '🟠';
      }
      
      return {
        deal_id: deal.deal_id,
        title: deal.deal_title || 'Untitled Deal',
        value: parseFloat(deal.deal_value || 0),
        currency: deal.deal_currency || 'USD',
        probability: parseInt(deal.deal_probability || 0),
        stage_id: deal.stage_id,
        owner_id: deal.owner_id,
        last_activity: deal.last_activity,
        days_since_activity: daysSinceActivity,
        severity,
        emoji
      };
    });
    
    console.log(`📊 Found ${stalledDeals.length} stalled deals:`, {
      critical: stalledDeals.filter(d => d.severity === 'critical').length,
      stale: stalledDeals.filter(d => d.severity === 'stale').length,  
      warning: stalledDeals.filter(d => d.severity === 'warning').length
    });
    
    return stalledDeals;
    
  } catch (error) {
    console.error('Error finding stalled deals:', error);
    return [];
  }
}

/**
 * Format stalled deal alert message
 * @param {Array} stalledDeals - Array of stalled deals
 * @param {string} tenantName - Tenant/company name
 * @returns {string} Formatted message
 */
function formatStalledDealMessage(stalledDeals, tenantName = 'Your Team') {
  if (stalledDeals.length === 0) {
    return null;
  }
  
  const criticalDeals = stalledDeals.filter(d => d.severity === 'critical');
  const staleDeals = stalledDeals.filter(d => d.severity === 'stale');
  const warningDeals = stalledDeals.filter(d => d.severity === 'warning');
  
  let message = `🔔 **Stalled Deal Alert** - ${tenantName}\n\n`;
  
  if (criticalDeals.length > 0) {
    message += '🚨 **CRITICAL** - No activity for 14+ days:\n';
    criticalDeals.slice(0, 3).forEach(deal => { // Show max 3 critical deals
      message += `• *${deal.title}* - ${deal.currency} ${deal.value.toLocaleString()} (${deal.days_since_activity} days)\n`;
    });
    if (criticalDeals.length > 3) {
      message += `• *...and ${criticalDeals.length - 3} more critical deals*\n`;
    }
    message += '\n';
  }
  
  if (staleDeals.length > 0) {
    message += '🟠 **STALE** - No activity for 7+ days:\n';
    staleDeals.slice(0, 3).forEach(deal => { // Show max 3 stale deals
      message += `• *${deal.title}* - ${deal.currency} ${deal.value.toLocaleString()} (${deal.days_since_activity} days)\n`;
    });
    if (staleDeals.length > 3) {
      message += `• *...and ${staleDeals.length - 3} more stale deals*\n`;
    }
    message += '\n';
  }
  
  if (warningDeals.length > 0 && criticalDeals.length === 0) {
    // Only show warnings if there are no critical deals (to avoid spam)
    message += '⚠️ **WARNING** - No activity for 3+ days:\n';
    warningDeals.slice(0, 5).forEach(deal => { // Show max 5 warning deals
      message += `• *${deal.title}* - ${deal.currency} ${deal.value.toLocaleString()} (${deal.days_since_activity} days)\n`;
    });
    if (warningDeals.length > 5) {
      message += `• *...and ${warningDeals.length - 5} more deals need attention*\n`;
    }
    message += '\n';
  }
  
  // Add summary and call to action
  const totalValue = stalledDeals.reduce((sum, deal) => sum + deal.value, 0);
  message += `💰 **Total stalled pipeline:** ${stalledDeals[0]?.currency || 'USD'} ${totalValue.toLocaleString()}\n`;
  message += '📈 **Action needed:** Follow up on these deals to keep your pipeline moving!\n';
  
  return message;
}

/**
 * Send stalled deal alerts to appropriate channels
 * @param {number} tenantId - Tenant ID  
 * @param {Array} stalledDeals - Array of stalled deals
 */
async function sendStalledDealAlerts(tenantId, stalledDeals) {
  try {
    if (stalledDeals.length === 0) return;
    
    // Get available webhooks for this tenant
    const webhooks = await getWebhooks(tenantId);
    if (webhooks.length === 0) {
      console.log(`No webhooks available for tenant ${tenantId} stalled deal alerts`);
      return;
    }
    
    // Find the best webhook for alerts
    let alertWebhook = webhooks.find(w => 
      w.name?.toLowerCase().includes('alert') ||
      w.name?.toLowerCase().includes('stalled') ||
      w.name?.toLowerCase().includes('pipeline') ||
      w.name?.toLowerCase().includes('manager')
    ) || webhooks[0]; // Fallback to first webhook
    
    // Format the alert message
    const message = formatStalledDealMessage(stalledDeals);
    if (!message) return;
    
    console.log(`📤 Sending stalled deal alert to webhook: ${alertWebhook.name}`);
    
    // Send the alert
    const result = await defaultChatClient.sendNotification(
      alertWebhook.webhook_url,
      {
        event: 'stalled.deals.alert',
        message_text: message,
        current: {
          stalled_count: stalledDeals.length,
          critical_count: stalledDeals.filter(d => d.severity === 'critical').length,
          total_value: stalledDeals.reduce((sum, deal) => sum + deal.value, 0)
        }
      },
      'simple', // Use simple template mode
      null,
      tenantId
    );
    
    console.log(`✅ Stalled deal alert sent successfully for tenant ${tenantId}`);
    
    return {
      success: true,
      deals_alerted: stalledDeals.length,
      webhook_used: alertWebhook.name
    };
    
  } catch (error) {
    console.error('Error sending stalled deal alerts:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process stalled deal monitoring for a single tenant
 * @param {number} tenantId - Tenant ID
 */
async function processStalledDealMonitoring(tenantId) {
  try {
    console.log(`🕐 Processing stalled deal monitoring for tenant ${tenantId}`);
    
    // Find stalled deals
    const stalledDeals = await findStalledDeals(tenantId);
    
    if (stalledDeals.length === 0) {
      return {
        tenant_id: tenantId,
        stalled_deals: 0,
        alerts_sent: 0
      };
    }
    
    // Send alerts for stalled deals
    const alertResult = await sendStalledDealAlerts(tenantId, stalledDeals);
    
    return {
      tenant_id: tenantId,
      stalled_deals: stalledDeals.length,
      alerts_sent: alertResult.success ? 1 : 0,
      breakdown: {
        critical: stalledDeals.filter(d => d.severity === 'critical').length,
        stale: stalledDeals.filter(d => d.severity === 'stale').length,
        warning: stalledDeals.filter(d => d.severity === 'warning').length
      }
    };
    
  } catch (error) {
    console.error(`Error processing stalled deal monitoring for tenant ${tenantId}:`, error);
    return {
      tenant_id: tenantId,
      stalled_deals: 0,
      alerts_sent: 0,
      error: error.message
    };
  }
}

/**
 * Run stalled deal monitoring for all active tenants
 */
async function runStalledDealMonitoring() {
  try {
    console.log('🚀 Starting daily stalled deal monitoring...');
    
    // Get all active tenants
    const tenantsResult = await pool.query(`
      SELECT DISTINCT tenant_id 
      FROM rules 
      WHERE enabled = true
    `);
    
    const tenantIds = tenantsResult.rows.map(row => row.tenant_id);
    console.log(`📋 Found ${tenantIds.length} active tenants to monitor`);
    
    if (tenantIds.length === 0) {
      console.log('No active tenants found');
      return;
    }
    
    // Process each tenant
    const results = [];
    for (const tenantId of tenantIds) {
      const result = await processStalledDealMonitoring(tenantId);
      results.push(result);
      
      // Small delay between tenants to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Log summary
    const summary = {
      tenants_processed: results.length,
      total_stalled_deals: results.reduce((sum, r) => sum + r.stalled_deals, 0),
      total_alerts_sent: results.reduce((sum, r) => sum + r.alerts_sent, 0),
      errors: results.filter(r => r.error).length
    };
    
    console.log('📊 Stalled deal monitoring summary:', summary);
    
    return summary;
    
  } catch (error) {
    console.error('Error running stalled deal monitoring:', error);
    throw error;
  }
}

// Schedule stalled deal monitoring to run daily at 9 AM (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  console.log('⏰ Scheduling stalled deal monitoring for 9 AM daily...');
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running scheduled stalled deal monitoring...');
    try {
      await runStalledDealMonitoring();
    } catch (error) {
      console.error('Scheduled stalled deal monitoring failed:', error);
    }
  }, {
    timezone: 'UTC'
  });
} else {
  console.log('⏸️ Skipping cron job scheduling in test environment');
}

// Also create a BullMQ worker for manual triggering (only if Redis is available)
let stalledDealWorker = null;

if (redisConfig) {
  stalledDealWorker = new Worker('stalled-deals', async (job) => {
    const { tenantId } = job.data;
    
    if (tenantId) {
      // Process single tenant
      return await processStalledDealMonitoring(tenantId);
    } else {
      // Process all tenants
    return await runStalledDealMonitoring();
  }
}, redisConfig);

  stalledDealWorker.on('completed', (job, result) => {
    console.log(`✅ Stalled deal monitoring job ${job.id} completed:`, result);
  });

  stalledDealWorker.on('failed', (job, err) => {
    console.error(`❌ Stalled deal monitoring job ${job.id} failed:`, err.message);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down stalled deal monitor...');
    await stalledDealWorker.close();
    process.exit(0);
  });
} else {
  console.log('⚠️ Stalled deal worker disabled - Redis not available');
  
  // Add non-Redis shutdown handlers
  process.on('SIGTERM', async () => {
    console.log('Shutting down stalled deal monitor...');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down stalled deal monitor...');
    process.exit(0);
  });
}

console.log('📋 Stalled deal monitoring system started');

module.exports = {
  findStalledDeals,
  formatStalledDealMessage,
  sendStalledDealAlerts,
  processStalledDealMonitoring,
  runStalledDealMonitoring,
  stalledDealWorker
};