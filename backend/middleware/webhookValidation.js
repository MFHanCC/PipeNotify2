const crypto = require('crypto');

/**
 * Pipedrive Webhook Signature Validation Middleware
 * Validates webhook payloads using HMAC-SHA256 signatures
 * Required for Pipedrive Marketplace compliance
 */

const validatePipedriveSignature = (req, res, next) => {
  try {
    // Get signature from headers
    const receivedSignature = req.headers['x-pipedrive-signature'] || req.headers['x-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.PIPEDRIVE_WEBHOOK_SECRET;
    
    // Skip validation in development if no secret is configured
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Webhook signature validation skipped - no WEBHOOK_SECRET configured');
        return next();
      } else {
        console.error('❌ Webhook secret not configured in production');
        return res.status(500).json({
          error: 'Webhook validation not configured',
          message: 'Contact support if this persists'
        });
      }
    }

    // Skip validation if no signature provided (for development/testing)
    if (!receivedSignature) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ No webhook signature provided - validation skipped for development');
        return next();
      } else {
        console.error('❌ No webhook signature provided');
        return res.status(401).json({
          error: 'Webhook signature required',
          message: 'Missing X-Pipedrive-Signature header'
        });
      }
    }

    // Get raw body for signature validation
    let rawBody = '';
    
    if (req.rawBody) {
      // Use pre-parsed raw body if available
      rawBody = req.rawBody;
    } else if (Buffer.isBuffer(req.body)) {
      // Body is already a buffer - use it directly for signature validation
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      // Body is a string
      rawBody = req.body;
    } else {
      // Body is an object, stringify it
      rawBody = JSON.stringify(req.body);
    }

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // Normalize signature format (remove 'sha256=' prefix if present)
    const normalizedReceived = receivedSignature.replace(/^sha256=/, '');
    const normalizedExpected = expectedSignature.replace(/^sha256=/, '');

    // Compare signatures using timing-safe comparison
    const signatureMatches = crypto.timingSafeEqual(
      Buffer.from(normalizedReceived, 'hex'),
      Buffer.from(normalizedExpected, 'hex')
    );

    if (!signatureMatches) {
      console.error('❌ Webhook signature validation failed', {
        received: normalizedReceived.substring(0, 8) + '...', // Log only first 8 chars for security
        expected: normalizedExpected.substring(0, 8) + '...',
        bodyLength: rawBody.length,
        hasSecret: !!webhookSecret
      });

      return res.status(401).json({
        error: 'Invalid webhook signature',
        message: 'Webhook signature validation failed'
      });
    }

    console.log('✅ Webhook signature validated successfully');
    next();

  } catch (error) {
    console.error('❌ Webhook signature validation error:', error);
    
    // In production, reject invalid signatures
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        error: 'Webhook validation error',
        message: 'Internal server error during signature validation'
      });
    } else {
      // In development, log error but continue
      console.warn('⚠️ Signature validation error in development - continuing anyway');
      next();
    }
  }
};

/**
 * Raw body parser middleware for webhook signature validation
 * Preserves raw body for HMAC verification
 */
const preserveRawBody = (req, res, next) => {
  let data = '';
  
  req.on('data', chunk => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

module.exports = {
  validatePipedriveSignature,
  preserveRawBody
};