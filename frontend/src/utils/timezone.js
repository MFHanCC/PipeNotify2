/**
 * Timezone Detection Utility
 * Automatically detects user's timezone and sends it to backend
 */

/**
 * Get user's timezone using browser API
 * @returns {string} IANA timezone identifier (e.g., "America/Chicago")
 */
export function getUserTimezone() {
  try {
    // Use Intl.DateTimeFormat to get user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('Detected user timezone:', timezone);
    return timezone;
  } catch (error) {
    console.warn('Failed to detect timezone, falling back to UTC:', error);
    return 'UTC';
  }
}

/**
 * Send user's timezone to backend to save in database
 * @param {string} apiUrl - Backend API URL
 * @returns {Promise<boolean>} Success status
 */
export async function saveUserTimezone(apiUrl) {
  try {
    const timezone = getUserTimezone();
    
    // Use the proper auth token function
    const { getAuthToken } = await import('./auth');
    const token = getAuthToken();
    
    console.log('🕐 Attempting to save timezone:', timezone);
    console.log('🔑 Using token:', token ? 'Present' : 'Missing');
    
    if (!token) {
      console.warn('🔑 No authentication token found, skipping timezone save');
      return false;
    }
    
    const response = await fetch(`${apiUrl}/api/v1/admin/timezone/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ timezone })
    });

    console.log('🌐 Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Timezone saved successfully:', timezone);
      return true;
    } else {
      const errorText = await response.text();
      console.warn('⚠️ Failed to save timezone:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error saving timezone:', error);
    return false;
  }
}

// Retry tracking to prevent infinite loops
let timezoneRetryCount = 0;
let timezoneRetryTimer = null;
const MAX_TIMEZONE_RETRIES = 3;

/**
 * Auto-detect and save timezone (call this when user logs in or during onboarding)
 * @param {string} apiUrl - Backend API URL  
 * @param {number} retryAttempt - Current retry attempt (internal use)
 */
export async function autoSetupTimezone(apiUrl, retryAttempt = 0) {
  try {
    console.log('🕐 Auto-setting up user timezone...');
    
    // Check if user is authenticated first
    const { getAuthToken } = await import('./auth');
    const token = getAuthToken();
    
    if (!token) {
      console.log('🔑 User not authenticated yet, skipping timezone setup');
      return false;
    }
    
    const success = await saveUserTimezone(apiUrl);
    
    if (success) {
      console.log('✅ Timezone auto-setup completed');
      // Reset retry count on success
      timezoneRetryCount = 0;
      if (timezoneRetryTimer) {
        clearTimeout(timezoneRetryTimer);
        timezoneRetryTimer = null;
      }
    } else if (retryAttempt < MAX_TIMEZONE_RETRIES) {
      console.warn(`⚠️ Timezone auto-setup failed, will retry later (attempt ${retryAttempt + 1}/${MAX_TIMEZONE_RETRIES})`);
      
      // Clear any existing timer
      if (timezoneRetryTimer) {
        clearTimeout(timezoneRetryTimer);
      }
      
      // Exponential backoff: 5s, 10s, 20s
      const retryDelay = 5000 * Math.pow(2, retryAttempt);
      
      timezoneRetryTimer = setTimeout(() => {
        console.log(`🔄 Retrying timezone setup... (attempt ${retryAttempt + 1}/${MAX_TIMEZONE_RETRIES})`);
        autoSetupTimezone(apiUrl, retryAttempt + 1);
      }, retryDelay);
    } else {
      console.error('❌ Timezone setup failed after maximum retries. Giving up.');
      timezoneRetryCount = 0;
    }
    
    return success;
  } catch (error) {
    console.error('❌ Timezone auto-setup error:', error);
    return false;
  }
}

/**
 * Stop any ongoing timezone retry attempts (call on component unmount)
 */
export function stopTimezoneRetries() {
  if (timezoneRetryTimer) {
    clearTimeout(timezoneRetryTimer);
    timezoneRetryTimer = null;
  }
  timezoneRetryCount = 0;
}

/**
 * Manual timezone setup for debugging (expose on window for testing)
 */
if (typeof window !== 'undefined') {
  window.setupTimezone = async () => {
    const apiUrl = 'https://pipenotify.up.railway.app';
    console.log('🔧 Manual timezone setup...');
    const result = await autoSetupTimezone(apiUrl);
    console.log('🔧 Manual setup result:', result);
    return result;
  };
}