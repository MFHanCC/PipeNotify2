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

/**
 * Auto-detect and save timezone (call this when user logs in or during onboarding)
 * @param {string} apiUrl - Backend API URL  
 */
export async function autoSetupTimezone(apiUrl) {
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
    } else {
      console.warn('⚠️ Timezone auto-setup failed, will retry later');
      // Schedule a retry after a delay
      setTimeout(() => {
        console.log('🔄 Retrying timezone setup...');
        autoSetupTimezone(apiUrl);
      }, 2000);
    }
    
    return success;
  } catch (error) {
    console.error('❌ Timezone auto-setup error:', error);
    return false;
  }
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