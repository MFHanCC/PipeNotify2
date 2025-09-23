// Centralized API configuration
// This ensures all components use the same API URL and avoids hardcoding

// API URL with proper fallback and error handling
export const API_BASE_URL = process.env.REACT_APP_API_URL || (() => {
  // Check if we're in local development
  if (process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost') {
    // Try multiple common backend ports for local development
    const fallbackUrls = ['http://localhost:3002', 'http://localhost:3001', 'http://localhost:5000'];
    return fallbackUrls[0]; // Default to 3002 which seems to be expected
  }
  
  // For deployed development environment (Vercel), use Railway dev backend
  if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('pipenotify-frontend')) {
    console.log('🔧 Using Railway development backend as fallback');
    return 'https://dev-backend.up.railway.app';
  }
  
  // In production without REACT_APP_API_URL set, this is an error
  console.error('❌ REACT_APP_API_URL not set in production environment');
  throw new Error('API URL not configured for production');
})();

// Connection status tracking
export let isBackendAvailable = false;
export let lastConnectionCheck = 0;

// Check backend availability
export const checkBackendConnection = async (): Promise<boolean> => {
  const now = Date.now();
  // Only check once per 30 seconds to avoid spam
  if (now - lastConnectionCheck < 30000) {
    return isBackendAvailable;
  }
  
  try {
    lastConnectionCheck = now;
    const response = await fetch(`${API_BASE_URL}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    isBackendAvailable = response.ok;
    return response.ok;
  } catch (error) {
    isBackendAvailable = false;
    return false;
  }
};


// Validate API URL is properly configured
if (!API_BASE_URL) {
  throw new Error('API_BASE_URL could not be determined');
}

// Make API URL globally accessible for debugging
(window as any).API_BASE_URL = API_BASE_URL;

// Log configuration in development only
if (process.env.NODE_ENV === 'development') {
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
}

// Always log in browser console for debugging
console.log(`🔗 API Base URL: ${API_BASE_URL}`);