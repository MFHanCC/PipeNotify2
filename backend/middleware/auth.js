const jwt = require('jsonwebtoken');
const { pool } = require('../services/database');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and extracts tenant information
 */

/**
 * Middleware to authenticate and extract tenant from JWT
 * Replaces hardcoded tenant_id with actual JWT-based tenant resolution
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Extract tenant information from token
    const { tenant_id, user_id, company_id } = decoded;
    
    if (!tenant_id) {
      return res.status(401).json({
        error: 'Invalid token: missing tenant information',
        code: 'INVALID_TOKEN'
      });
    }

    // Verify tenant exists and is active
    const tenantResult = await pool.query(
      'SELECT * FROM tenants WHERE id = $1 AND status = $2',
      [tenant_id, 'active']
    );

    if (tenantResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Tenant not found or inactive',
        code: 'TENANT_INACTIVE'
      });
    }

    const tenant = tenantResult.rows[0];

    // Add tenant info to request object
    req.tenant = {
      id: tenant_id,
      user_id,
      company_id,
      company_name: tenant.company_name,
      pipedrive_company_id: tenant.pipedrive_company_id,
      status: tenant.status
    };

    // Also add for backward compatibility
    req.tenantId = tenant_id;

    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional auth middleware - doesn't fail if no token provided
 * Useful for endpoints that can work with or without authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.tenant = null;
      req.tenantId = null;
      return next();
    }

    // Use the main auth middleware
    await authenticateToken(req, res, next);

  } catch (error) {
    // For optional auth, continue without authentication
    req.tenant = null;
    req.tenantId = null;
    next();
  }
};

/**
 * Generate JWT token for tenant
 * @param {Object} tenantData - Tenant information
 * @returns {Object} Token information
 */
const generateToken = (tenantData) => {
  const payload = {
    tenant_id: tenantData.tenant_id,
    user_id: tenantData.user_id,
    company_id: tenantData.company_id,
    company_name: tenantData.company_name,
    iat: Math.floor(Date.now() / 1000)
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d' // 7 days for trial period
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
    tenant_id: tenantData.tenant_id
  };
};

/**
 * Refresh token middleware (for future use)
 * @param {Object} refreshToken - Refresh token
 * @returns {Object} New access token
 */
const refreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '_REFRESH');
    
    // Generate new access token
    const newToken = generateToken({
      tenant_id: decoded.tenant_id,
      user_id: decoded.user_id,
      company_id: decoded.company_id,
      company_name: decoded.company_name
    });
    
    return newToken;
    
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

/**
 * Middleware to extract tenant ID from various sources
 * Supports JWT, URL params, query params, and body
 */
const extractTenantId = async (req, res, next) => {
  try {
    let tenantId = null;

    // Try JWT first (most secure)
    if (req.tenant && req.tenant.id) {
      tenantId = req.tenant.id;
    }
    // Fallback to URL params
    else if (req.params.tenantId) {
      tenantId = parseInt(req.params.tenantId);
    }
    // Fallback to query params
    else if (req.query.tenantId) {
      tenantId = parseInt(req.query.tenantId);
    }
    // Fallback to request body
    else if (req.body.tenantId) {
      tenantId = parseInt(req.body.tenantId);
    }

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required',
        code: 'MISSING_TENANT_ID'
      });
    }

    req.tenantId = tenantId;
    next();

  } catch (error) {
    console.error('Error extracting tenant ID:', error);
    res.status(500).json({
      error: 'Failed to extract tenant ID',
      code: 'TENANT_EXTRACTION_ERROR'
    });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  refreshToken,
  extractTenantId
};