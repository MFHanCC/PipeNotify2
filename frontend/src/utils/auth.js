/**
 * Centralized Authentication Utilities
 * Handles token storage, retrieval, and validation consistently across the app
 */

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';

/**
 * Get the current authentication token
 * Checks both localStorage and sessionStorage for backwards compatibility
 * @returns {string|null} The authentication token or null if not found
 */
export const getAuthToken = () => {
  // Priority order: auth_token -> oauth_token -> token
  return localStorage.getItem(TOKEN_KEY) || 
         sessionStorage.getItem('oauth_token') || 
         localStorage.getItem('token') ||
         sessionStorage.getItem('token');
};

/**
 * Set the authentication token
 * @param {string} token - The JWT token
 * @param {string} refreshToken - Optional refresh token
 * @param {number} expiresIn - Token expiry in seconds
 */
export const setAuthToken = (token, refreshToken = null, expiresIn = null) => {
  if (!token) {
    console.error('Cannot set empty auth token');
    return;
  }

  // Store the main token
  localStorage.setItem(TOKEN_KEY, token);
  
  // Store refresh token if provided
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  
  // Calculate and store expiry time
  if (expiresIn) {
    const expiryTime = new Date().getTime() + (expiresIn * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }
  
  // Clean up old token formats for consistency
  sessionStorage.removeItem('oauth_token');
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

/**
 * Clear all authentication tokens
 */
export const clearAuthTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  
  // Clean up legacy token formats
  sessionStorage.removeItem('oauth_token');
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

/**
 * Check if the current token is expired
 * @returns {boolean} True if token is expired or expiry is unknown
 */
export const isTokenExpired = () => {
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryTime) {
    // If we don't know when it expires, assume it might be expired
    return false; // Let the backend handle validation
  }
  
  return new Date().getTime() > parseInt(expiryTime);
};

/**
 * Get refresh token
 * @returns {string|null} The refresh token or null if not found
 */
export const getRefreshToken = () => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has a valid token
 */
export const isAuthenticated = () => {
  const token = getAuthToken();
  return !!token && !isTokenExpired();
};

/**
 * Decode JWT payload without verification
 * @param {string} token - The JWT token
 * @returns {object|null} Decoded payload or null if invalid
 */
export const decodeJWTPayload = (token) => {
  try {
    if (!token) return null;
    
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

/**
 * Get tenant ID from the current token
 * @returns {string|null} The tenant ID or null if not found
 */
export const getTenantId = () => {
  const token = getAuthToken();
  if (!token) return null;
  
  const payload = decodeJWTPayload(token);
  return payload?.tenant_id?.toString() || payload?.tenantId?.toString() || null;
};

/**
 * Get user ID from the current token
 * @returns {string|null} The user ID or null if not found
 */
export const getUserId = () => {
  const token = getAuthToken();
  if (!token) return null;
  
  const payload = decodeJWTPayload(token);
  return payload?.user_id?.toString() || payload?.userId?.toString() || null;
};

/**
 * Create authorization headers for API requests
 * @returns {object} Headers object with Authorization
 */
export const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Handle authentication errors from API responses
 * @param {Response} response - Fetch response object
 * @returns {boolean} True if authentication error was handled
 */
export const handleAuthError = (response) => {
  if (response.status === 401 || response.status === 403) {
    console.warn('Authentication failed, clearing tokens');
    clearAuthTokens();
    // Redirect to login/onboarding if needed
    window.location.href = '/onboarding';
    return true;
  }
  return false;
};

/**
 * Make authenticated API request with automatic error handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Handle authentication errors automatically
  if (handleAuthError(response)) {
    throw new Error('Authentication failed');
  }
  
  return response;
};

/**
 * Logout user by clearing all auth data and redirecting
 */
export const logout = () => {
  clearAuthTokens();
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/';
};