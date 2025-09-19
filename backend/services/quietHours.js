// Safely import database pool with error handling
let pool;
try {
  ({ pool } = require('./database'));
} catch (error) {
  console.log('⚠️ Database service not available for quietHours:', error.message);
  pool = null;
}

/**
 * Quiet Hours Scheduling Service
 * Manages business hours, quiet periods, and notification timing
 */

/**
 * Default quiet hours configuration
 * PRODUCTION: Quiet hours are DISABLED by default to ensure notifications are always sent
 * Users must explicitly enable and configure quiet hours if they want them
 */
const DEFAULT_QUIET_HOURS = {
  timezone: 'UTC', // Fallback only - frontend auto-detects user timezone
  start_time: '18:00',  // 6 PM (only used if explicitly enabled)
  end_time: '09:00',    // 9 AM next day (only used if explicitly enabled)
  weekends_enabled: true, // Allow weekend notifications by default
  holidays: [],
  enabled: false // CRITICAL: Quiet hours disabled by default
};

/**
 * Get quiet hours configuration for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Object} Quiet hours configuration
 */
async function getQuietHours(tenantId) {
  try {
    const result = await pool.query(`
      SELECT * FROM quiet_hours WHERE tenant_id = $1
    `, [tenantId]);
    
    if (result.rows.length === 0) {
      // Return default configuration if none exists
      console.log(`⚠️ No timezone configured for tenant ${tenantId}, using UTC fallback. Frontend should auto-detect timezone.`);
      return {
        tenant_id: tenantId,
        ...DEFAULT_QUIET_HOURS,
        configured: false
      };
    }
    
    const config = result.rows[0];
    return {
      tenant_id: tenantId,
      timezone: config.timezone || DEFAULT_QUIET_HOURS.timezone,
      start_time: config.start_time || DEFAULT_QUIET_HOURS.start_time,
      end_time: config.end_time || DEFAULT_QUIET_HOURS.end_time,
      weekends_enabled: config.weekends_enabled !== null ? config.weekends_enabled : DEFAULT_QUIET_HOURS.weekends_enabled,
      holidays: config.holidays || DEFAULT_QUIET_HOURS.holidays,
      enabled: config.enabled !== null ? config.enabled : DEFAULT_QUIET_HOURS.enabled,
      configured: true
    };
    
  } catch (error) {
    console.error('Error getting quiet hours:', error);
    return {
      tenant_id: tenantId,
      ...DEFAULT_QUIET_HOURS,
      configured: false
    };
  }
}

/**
 * Set quiet hours configuration for a tenant
 * @param {number} tenantId - Tenant ID
 * @param {Object} config - Quiet hours configuration
 * @returns {Object} Updated configuration
 */
async function setQuietHours(tenantId, config) {
  try {
    const {
      timezone = DEFAULT_QUIET_HOURS.timezone,
      start_time = DEFAULT_QUIET_HOURS.start_time,
      end_time = DEFAULT_QUIET_HOURS.end_time,
      weekends_enabled = DEFAULT_QUIET_HOURS.weekends_enabled,
      holidays = DEFAULT_QUIET_HOURS.holidays
    } = config;
    
    // Validate timezone
    if (!isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
    
    // Validate time format
    if (!isValidTimeFormat(start_time) || !isValidTimeFormat(end_time)) {
      throw new Error('Invalid time format. Use HH:MM format');
    }
    
    const result = await pool.query(`
      INSERT INTO quiet_hours (tenant_id, timezone, start_time, end_time, weekends_enabled, holidays)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id) DO UPDATE SET
        timezone = EXCLUDED.timezone,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        weekends_enabled = EXCLUDED.weekends_enabled,
        holidays = EXCLUDED.holidays,
        updated_at = NOW()
      RETURNING *
    `, [tenantId, timezone, start_time, end_time, weekends_enabled, JSON.stringify(holidays)]);
    
    console.log(`✅ Quiet hours configured for tenant ${tenantId}: ${start_time}-${end_time} (${timezone})`);
    
    return {
      tenant_id: tenantId,
      timezone,
      start_time,
      end_time,
      weekends_enabled,
      holidays,
      configured: true
    };
    
  } catch (error) {
    console.error('Error setting quiet hours:', error);
    throw error;
  }
}

/**
 * Check if current time is within quiet hours for a tenant
 * @param {number} tenantId - Tenant ID
 * @param {Date} checkTime - Time to check (defaults to now)
 * @returns {Object} Quiet hours check result
 */
async function isQuietTime(tenantId, checkTime = new Date()) {
  try {
    const config = await getQuietHours(tenantId);
    
    if (!config.configured || !config.enabled) {
      // If no quiet hours configured OR explicitly disabled, never in quiet time
      return {
        is_quiet: false,
        reason: config.configured ? 'disabled' : 'no_config',
        next_allowed: null,
        config
      };
    }
    
    // Convert to tenant's timezone
    const tenantTime = convertToTimezone(checkTime, config.timezone);
    
    // Check if it's weekend and weekends are disabled
    const isWeekend = tenantTime.getDay() === 0 || tenantTime.getDay() === 6; // Sunday = 0, Saturday = 6
    if (isWeekend && !config.weekends_enabled) {
      const nextMonday = getNextMonday(tenantTime);
      const nextAllowed = combineDateAndTime(nextMonday, config.end_time, config.timezone);
      
      return {
        is_quiet: true,
        reason: 'weekend',
        next_allowed: nextAllowed,
        config
      };
    }
    
    // Check if it's a holiday
    if (config.holidays && config.holidays.length > 0) {
      const dateStr = tenantTime.toISOString().split('T')[0]; // YYYY-MM-DD
      if (config.holidays.includes(dateStr)) {
        const nextDay = new Date(tenantTime);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextAllowed = combineDateAndTime(nextDay, config.end_time, config.timezone);
        
        return {
          is_quiet: true,
          reason: 'holiday',
          next_allowed: nextAllowed,
          config
        };
      }
    }
    
    // Check if it's within quiet hours
    const currentHour = tenantTime.getHours();
    const currentMinute = tenantTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    const [startHour, startMinute] = config.start_time.split(':').map(Number);
    const [endHour, endMinute] = config.end_time.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;
    
    let isQuiet = false;
    let nextAllowed = null;
    
    if (startTimeMinutes > endTimeMinutes) {
      // Quiet period spans midnight (e.g., 18:00 - 09:00)
      isQuiet = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes;
      
      if (isQuiet) {
        if (currentTimeMinutes >= startTimeMinutes) {
          // After start time, next allowed is tomorrow at end time
          const tomorrow = new Date(tenantTime);
          tomorrow.setDate(tomorrow.getDate() + 1);
          nextAllowed = combineDateAndTime(tomorrow, config.end_time, config.timezone);
        } else {
          // Before end time, next allowed is today at end time
          nextAllowed = combineDateAndTime(tenantTime, config.end_time, config.timezone);
        }
      }
    } else {
      // Quiet period within same day (e.g., 12:00 - 13:00)
      isQuiet = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
      
      if (isQuiet) {
        nextAllowed = combineDateAndTime(tenantTime, config.end_time, config.timezone);
      }
    }
    
    return {
      is_quiet: isQuiet,
      reason: isQuiet ? 'quiet_hours' : null,
      next_allowed: nextAllowed,
      tenant_time: tenantTime.toISOString(),
      config
    };
    
  } catch (error) {
    console.error('Error checking quiet time:', error);
    return {
      is_quiet: false,
      reason: 'error',
      error: error.message,
      config: null
    };
  }
}

/**
 * Get next allowed notification time for a tenant
 * @param {number} tenantId - Tenant ID
 * @param {Date} fromTime - Starting time (defaults to now)
 * @returns {Object} Next allowed time information
 */
async function getNextAllowedTime(tenantId, fromTime = new Date()) {
  try {
    const quietCheck = await isQuietTime(tenantId, fromTime);
    
    if (!quietCheck.is_quiet) {
      return {
        allowed_now: true,
        next_allowed: fromTime,
        delay_minutes: 0
      };
    }
    
    const nextAllowed = new Date(quietCheck.next_allowed);
    const delayMs = nextAllowed.getTime() - fromTime.getTime();
    const delayMinutes = Math.ceil(delayMs / (1000 * 60));
    
    return {
      allowed_now: false,
      next_allowed: nextAllowed,
      delay_minutes: delayMinutes,
      reason: quietCheck.reason
    };
    
  } catch (error) {
    console.error('Error getting next allowed time:', error);
    return {
      allowed_now: true,
      next_allowed: fromTime,
      delay_minutes: 0,
      error: error.message
    };
  }
}

/**
 * Queue notification for delayed delivery during quiet hours
 * @param {number} tenantId - Tenant ID  
 * @param {Object} notificationData - Notification data
 * @returns {Object} Queue result
 */
async function queueDelayedNotification(tenantId, notificationData) {
  try {
    const nextAllowed = await getNextAllowedTime(tenantId);
    
    if (nextAllowed.allowed_now) {
      return {
        queued: false,
        send_immediately: true,
        delay_minutes: 0
      };
    }
    
    // Store in database for delayed sending
    // Ensure proper JSON serialization to prevent [object Object] issues
    let serializedData;
    try {
      if (typeof notificationData === 'string') {
        // Verify it's valid JSON
        JSON.parse(notificationData);
        serializedData = notificationData;
      } else {
        serializedData = JSON.stringify(notificationData);
      }
    } catch (error) {
      console.error('⚠️ Failed to serialize notification data:', error);
      // Fallback to empty object instead of [object Object]
      serializedData = JSON.stringify({});
    }
    
    const result = await pool.query(`
      INSERT INTO delayed_notifications (tenant_id, notification_data, scheduled_for, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `, [tenantId, serializedData, nextAllowed.next_allowed]);
    
    console.log(`📅 Notification queued for delayed delivery: ${result.rows[0].id}, scheduled for ${nextAllowed.next_allowed}`);
    
    return {
      queued: true,
      send_immediately: false,
      queue_id: result.rows[0].id,
      scheduled_for: nextAllowed.next_allowed,
      delay_minutes: nextAllowed.delay_minutes,
      reason: nextAllowed.reason
    };
    
  } catch (error) {
    console.error('Error queuing delayed notification:', error);
    return {
      queued: false,
      send_immediately: true,
      error: error.message
    };
  }
}

/**
 * Process delayed notifications that are ready to be sent
 */
async function processDelayedNotifications() {
  try {
    // Check if pool is available
    if (!pool) {
      console.log('⚠️ Database pool not available, skipping delayed notification processing');
      return { processed: 0, error: 'Database not available' };
    }

    // Check if table exists first
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'delayed_notifications'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️  delayed_notifications table does not exist. Run migration: npm run migrate');
      return { processed: 0, error: 'Table not found' };
    }
    
    const now = new Date();
    
    // Get notifications ready to be sent
    const result = await pool.query(`
      SELECT * FROM delayed_notifications 
      WHERE scheduled_for <= $1 AND sent_at IS NULL
      ORDER BY scheduled_for ASC
      LIMIT 50
    `, [now]);
    
    if (result.rows.length === 0) {
      return { processed: 0 };
    }
    
    console.log(`📬 Processing ${result.rows.length} delayed notifications`);
    
    let processed = 0;
    const { defaultChatClient } = require('./chatClient');
    
    for (const notification of result.rows) {
      try {
        let notificationData;
        
        // Handle malformed JSON data from previous versions
        try {
          notificationData = JSON.parse(notification.notification_data);
        } catch (parseError) {
          console.error(`⚠️ Malformed notification data for ID ${notification.id}: ${notification.notification_data}`);
          
          // Mark as failed and skip
          await pool.query(`
            UPDATE delayed_notifications 
            SET status = 'failed', error_message = 'Malformed JSON data'
            WHERE id = $1
          `, [notification.id]);
          
          continue;
        }
        
        // Validate required fields
        if (!notificationData.webhook_url || !notificationData.webhook_data) {
          console.error(`⚠️ Missing required fields in notification ${notification.id}`);
          
          await pool.query(`
            UPDATE delayed_notifications 
            SET status = 'failed', error_message = 'Missing required notification fields'
            WHERE id = $1
          `, [notification.id]);
          
          continue;
        }
        
        // Send the notification
        await defaultChatClient.sendNotification(
          notificationData.webhook_url,
          notificationData.webhook_data,
          notificationData.template_mode || 'simple',
          notificationData.custom_template,
          notification.tenant_id
        );
        
        // Mark as sent
        await pool.query(`
          UPDATE delayed_notifications 
          SET sent_at = NOW(), status = 'sent'
          WHERE id = $1
        `, [notification.id]);
        
        processed++;
        console.log(`✅ Delayed notification sent: ${notification.id}`);
        
      } catch (error) {
        console.error(`❌ Failed to send delayed notification ${notification.id}:`, error);
        
        // Mark as failed
        await pool.query(`
          UPDATE delayed_notifications 
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [error.message, notification.id]);
      }
    }
    
    return { processed };
    
  } catch (error) {
    console.error('Error processing delayed notifications:', error);
    return { processed: 0, error: error.message };
  }
}

// Utility functions

function isValidTimezone(timezone) {
  try {
    new Date().toLocaleString('en-US', { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

function isValidTimeFormat(timeString) {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
}

function convertToTimezone(date, timezone) {
  try {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  } catch (error) {
    console.error('Error converting timezone:', error);
    return date; // Fallback to original date
  }
}

function combineDateAndTime(date, timeString, timezone) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  
  // Convert back to UTC
  try {
    const utcTime = new Date(combined.toLocaleString('sv-SE', { timeZone: timezone }));
    return utcTime;
  } catch (error) {
    console.error('Error combining date and time:', error);
    return combined;
  }
}

function getNextMonday(date) {
  const nextMonday = new Date(date);
  const daysUntilMonday = (8 - date.getDay()) % 7 || 7; // 1 = Monday
  nextMonday.setDate(date.getDate() + daysUntilMonday);
  return nextMonday;
}

module.exports = {
  getQuietHours,
  setQuietHours,
  isQuietTime,
  getNextAllowedTime,
  queueDelayedNotification,
  processDelayedNotifications,
  DEFAULT_QUIET_HOURS
};