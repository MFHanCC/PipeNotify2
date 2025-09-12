const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { pool } = require('../services/database');
const { generateToken } = require('../middleware/auth');
const router = express.Router();

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

    res.json({
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
    });

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

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'JWT token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tenantId = decoded.tenantId;

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
    const tenantId = decoded.tenantId;

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

module.exports = router;