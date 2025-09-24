const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { pool } = require('../services/database');
const { generateToken } = require('../middleware/auth');
const router = express.Router();

// OAuth scope documentation for Pipedrive Marketplace submission
const REQUIRED_PIPEDRIVE_SCOPES = [
  'users:read',     // Read user profile for authentication and company identification
  'webhooks:write', // Create and manage webhooks for automatic notifications
  'webhooks:read',  // List and manage existing webhooks
  'deals:read',     // Read deal data to process deal-related notifications
  'persons:read',   // Read contact data to include contact details in notifications
  'activities:read' // Read activity data to send activity-related notifications
];

const OAUTH_SCOPE_EXPLANATIONS = {
  'users:read': 'Identify your Pipedrive account and company for secure multi-tenant isolation',
  'webhooks:write': 'Set up automatic notifications by registering webhooks with Pipedrive',
  'webhooks:read': 'Manage and monitor existing notification settings and webhook configurations',
  'deals:read': 'Process and send notifications when deals are created, updated, won, or lost',
  'persons:read': 'Include contact names and details in deal and activity notifications',
  'activities:read': 'Send notifications about scheduled activities, calls, and meetings'
};

// OAuth 2.0 callback endpoint - exchanges authorization code for access token
router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }


    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.PIPEDRIVE_REDIRECT_URI || `${process.env.FRONTEND_URL}/onboarding`,
      client_id: process.env.PIPEDRIVE_CLIENT_ID,
      client_secret: process.env.PIPEDRIVE_CLIENT_SECRET,
    });

    const tokenResponse = await axios.post('https://oauth.pipedrive.com/oauth/token', tokenParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    const { access_token, refresh_token, expires_in, api_domain } = tokenResponse.data;

    // Get user info from Pipedrive
    // api_domain from Pipedrive already includes protocol (https://)
    const apiUrl = api_domain.startsWith('http') ? api_domain : `https://${api_domain}`;
    const userResponse = await axios.get(`${apiUrl}/v1/users/me`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    const userData = userResponse.data.data;
    const companyName = userData.company_name;
    const userId = userData.id;
    const userName = userData.name;
    const companyId = userData.company_id; // This is the critical missing piece!

    // Create or get tenant
    let tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE pipedrive_user_id = $1',
      [userId]
    );

    let tenantId;
    if (tenantResult.rows.length === 0) {
      // Create new tenant with company_id
      const insertResult = await pool.query(
        'INSERT INTO tenants (company_name, pipedrive_user_id, pipedrive_user_name, pipedrive_company_id, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
        [companyName, userId, userName, companyId]
      );
      tenantId = insertResult.rows[0].id;
      console.log('✅ Created tenant with company_id:', companyId);
    } else {
      tenantId = tenantResult.rows[0].id;
      
      // Update existing tenant with company_id if missing
      await pool.query(
        'UPDATE tenants SET pipedrive_company_id = $1, company_name = $2, pipedrive_user_name = $3 WHERE id = $4',
        [companyId, companyName, userName, tenantId]
      );
      console.log('✅ Updated tenant with company_id:', companyId);
    }

    // Store or update Pipedrive connection
    await pool.query(
      `INSERT INTO pipedrive_connections (tenant_id, access_token, refresh_token, api_domain, expires_at, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (tenant_id) 
       DO UPDATE SET access_token = $2, refresh_token = $3, api_domain = $4, expires_at = $5, updated_at = NOW()`,
      [
        tenantId,
        access_token,
        refresh_token,
        api_domain,
        new Date(Date.now() + expires_in * 1000)
      ]
    );

    // Generate JWT token using the new auth middleware
    const tokenData = generateToken({
      tenant_id: tenantId,
      user_id: userId,
      company_id: companyId,
      company_name: companyName
    });

    // Provision default rules for new tenants (after successful connection)
    let ruleProvisioningResult = null;
    try {
      const { provisionDefaultRules } = require('../services/ruleProvisioning');
      const { getSubscription } = require('../services/stripe');
      
      // Check if this is a new tenant or first-time connection
      const isNewConnection = tenantResult.rows.length === 0;
      
      if (isNewConnection) {
        console.log(`🚀 Provisioning default rules for new tenant ${tenantId}`);
        
        // Get the tenant's actual subscription tier
        let subscriptionTier = 'free'; // Default fallback
        try {
          const subscription = await getSubscription(tenantId);
          subscriptionTier = subscription.plan_tier || 'free';
          console.log(`📋 Detected subscription tier: ${subscriptionTier}`);
        } catch (subscriptionError) {
          console.warn('⚠️ Could not get subscription tier, defaulting to free:', subscriptionError.message);
        }
        
        ruleProvisioningResult = await provisionDefaultRules(tenantId, subscriptionTier, 'initial');
        
        if (ruleProvisioningResult.success) {
          console.log(`✅ Provisioned ${ruleProvisioningResult.rules_created} default rules for ${subscriptionTier} tier`);
        } else {
          console.warn('⚠️ Rule provisioning failed:', ruleProvisioningResult.error);
        }
      } else {
        console.log(`👤 Existing tenant ${tenantId} reconnected - skipping rule provisioning`);
      }
      
    } catch (provisioningError) {
      console.error('Error during rule provisioning:', provisioningError);
      // Don't fail the OAuth flow for rule provisioning errors
    }

    const response = {
      success: true,
      ...tokenData,
      user: {
        id: userId,
        name: userName,
        company: companyName,
        apiDomain: api_domain,
      },
      tenant: {
        id: tenantId,
        company_id: companyId,
        company_name: companyName
      }
    };

    // Add rule provisioning info if available
    if (ruleProvisioningResult) {
      response.default_rules = {
        provisioned: ruleProvisioningResult.success,
        rules_created: ruleProvisioningResult.rules_created || 0,
        rules_skipped: ruleProvisioningResult.rules_skipped || 0
      };
      
      if (ruleProvisioningResult.success && ruleProvisioningResult.rules_created > 0) {
        response.onboarding_message = `Welcome! We've set up ${ruleProvisioningResult.rules_created} notification rules to get you started.`;
      }
    }

    res.json(response);

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    if (error.response) {
      console.error('Pipedrive API error:', error.response.data);
      return res.status(400).json({
        error: 'Failed to exchange authorization code',
        details: error.response.data,
      });
    }
    
    res.status(500).json({
      error: 'Internal server error during OAuth callback',
      message: error.message,
    });
  }
});

// Get authenticated user profile
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'JWT token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tenantId = decoded.tenant_id;

    // Get tenant and connection info
    const tenantResult = await pool.query(`
      SELECT t.*, pc.api_domain, pc.status as connection_status
      FROM tenants t
      LEFT JOIN pipedrive_connections pc ON t.id = pc.tenant_id
      WHERE t.id = $1
    `, [tenantId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];
    
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        company_name: tenant.company_name,
        pipedrive_company_id: tenant.pipedrive_company_id,
        pipedrive_user_id: tenant.pipedrive_user_id,
        pipedrive_user_name: tenant.pipedrive_user_name,
        api_domain: tenant.api_domain,
        connection_status: tenant.connection_status || 'unknown',
        subscription_status: tenant.subscription_status
      }
    });

  } catch (error) {
    console.error('Profile endpoint error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'JWT token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tenantId = decoded.tenant_id;

    // Get current refresh token
    const connectionResult = await pool.query(
      'SELECT refresh_token, api_domain FROM pipedrive_connections WHERE tenant_id = $1',
      [tenantId]
    );

    if (connectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { refresh_token, api_domain } = connectionResult.rows[0];

    // Refresh the access token
    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_id: process.env.PIPEDRIVE_CLIENT_ID,
      client_secret: process.env.PIPEDRIVE_CLIENT_SECRET,
    });

    const tokenResponse = await axios.post('https://oauth.pipedrive.com/oauth/token', refreshParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    const { access_token, refresh_token: new_refresh_token, expires_in } = tokenResponse.data;

    // Update stored tokens
    await pool.query(
      'UPDATE pipedrive_connections SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW() WHERE tenant_id = $4',
      [
        access_token,
        new_refresh_token || refresh_token,
        new Date(Date.now() + expires_in * 1000),
        tenantId
      ]
    );

    res.json({
      success: true,
      access_token,
      expires_in,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired JWT token' });
    }
    
    if (error.response) {
      console.error('Pipedrive refresh error:', error.response.data);
      return res.status(400).json({
        error: 'Failed to refresh access token',
        details: error.response.data,
      });
    }
    
    res.status(500).json({
      error: 'Internal server error during token refresh',
      message: error.message,
    });
  }
});

// Get current OAuth status
router.get('/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'JWT token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tenantId = decoded.tenant_id;

    // Get connection status
    const connectionResult = await pool.query(
      'SELECT api_domain, expires_at, connected_at FROM pipedrive_connections WHERE tenant_id = $1',
      [tenantId]
    );

    if (connectionResult.rows.length === 0) {
      return res.json({
        connected: false,
        message: 'No Pipedrive connection found',
      });
    }

    const connection = connectionResult.rows[0];
    const isExpired = new Date() > new Date(connection.expires_at);

    res.json({
      connected: true,
      expired: isExpired,
      apiDomain: connection.api_domain,
      connectedAt: connection.connected_at,
      expiresAt: connection.expires_at,
    });

  } catch (error) {
    console.error('OAuth status error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired JWT token' });
    }
    
    res.status(500).json({
      error: 'Internal server error getting OAuth status',
      message: error.message,
    });
  }
});

// GET /api/v1/oauth/scopes - Return OAuth scope information for marketplace documentation
router.get('/scopes', (req, res) => {
  res.json({
    required_scopes: REQUIRED_PIPEDRIVE_SCOPES,
    scope_explanations: OAUTH_SCOPE_EXPLANATIONS,
    why_we_need_these: "PipeNotify requires these permissions to securely connect your Pipedrive account with Google Chat notifications. We only access the minimum data necessary to deliver your configured notifications.",
    data_usage: "We never store your Pipedrive data permanently. We only process webhook events in real-time to format and deliver notifications to your Google Chat channels.",
    security: "All API calls use OAuth 2.0 tokens with automatic refresh. No passwords or API keys are stored."
  });
});

module.exports = router;