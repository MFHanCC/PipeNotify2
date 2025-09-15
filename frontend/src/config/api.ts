// Centralized API configuration
// This ensures all components use the same API URL and avoids hardcoding

export const API_BASE_URL = process.env.REACT_APP_API_URL || (() => {
  // Only fallback to localhost in development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  
  // In production without REACT_APP_API_URL set, this is an error
  console.error('❌ REACT_APP_API_URL not set in production environment');
  throw new Error('API URL not configured for production');
})();

// Validate API URL is properly configured
if (!API_BASE_URL) {
  throw new Error('API_BASE_URL could not be determined');
}

// Log configuration in development only
if (process.env.NODE_ENV === 'development') {
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
}