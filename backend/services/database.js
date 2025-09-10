const { Pool } = require('pg');

// Create database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'pass'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'pipenotify_dev'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Database connection health check
async function healthCheck() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { healthy: true };
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return { healthy: false, error: error.message };
  }
}

// Rules management functions
async function getRulesForEvent(tenantId, eventType) {
  try {
    const query = `
      SELECT r.*, cw.webhook_url, cw.name as webhook_name
      FROM rules r
      JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.tenant_id = $1 
        AND r.event_type = $2 
        AND r.enabled = true 
        AND cw.is_active = true
      ORDER BY r.priority ASC, r.created_at ASC
    `;
    
    const result = await pool.query(query, [tenantId, eventType]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching rules for event:', error);
    throw error;
  }
}

async function getAllRules(tenantId, limit = 50, offset = 0) {
  try {
    const query = `
      SELECT r.*, cw.name as webhook_name
      FROM rules r
      LEFT JOIN chat_webhooks cw ON r.target_webhook_id = cw.id
      WHERE r.tenant_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [tenantId, limit, offset]);
    
    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM rules WHERE tenant_id = $1';
    const countResult = await pool.query(countQuery, [tenantId]);
    
    return {
      rules: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  } catch (error) {
    console.error('Error fetching all rules:', error);
    throw error;
  }
}

async function createRule(tenantId, ruleData) {
  try {
    const query = `
      INSERT INTO rules (tenant_id, name, event_type, filters, target_webhook_id, template_mode, custom_template, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      tenantId,
      ruleData.name,
      ruleData.event_type,
      JSON.stringify(ruleData.filters || {}),
      ruleData.target_webhook_id,
      ruleData.template_mode || 'simple',
      ruleData.custom_template || null,
      ruleData.enabled !== false
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating rule:', error);
    throw error;
  }
}

async function updateRule(tenantId, ruleId, updates) {
  try {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');
    
    const query = `
      UPDATE rules 
      SET ${setClause}, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
    `;
    
    const values = [tenantId, ruleId, ...Object.values(updates)];
    const result = await pool.query(query, values);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error updating rule:', error);
    throw error;
  }
}

async function deleteRule(tenantId, ruleId) {
  try {
    const query = 'DELETE FROM rules WHERE tenant_id = $1 AND id = $2 RETURNING id';
    const result = await pool.query(query, [tenantId, ruleId]);
    
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting rule:', error);
    throw error;
  }
}

// Webhook management functions
async function getWebhooks(tenantId) {
  try {
    const query = `
      SELECT * FROM chat_webhooks 
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [tenantId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    throw error;
  }
}

async function createWebhook(tenantId, webhookData) {
  try {
    const query = `
      INSERT INTO chat_webhooks (tenant_id, name, webhook_url, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      tenantId,
      webhookData.name,
      webhookData.webhook_url,
      webhookData.description || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating webhook:', error);
    throw error;
  }
}

// Logs management functions
async function createLog(tenantId, logData) {
  try {
    const query = `
      INSERT INTO logs (tenant_id, rule_id, webhook_id, event_type, payload, formatted_message, status, error_message, response_code, response_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      tenantId,
      logData.rule_id || null,
      logData.webhook_id || null,
      logData.event_type || null,
      JSON.stringify(logData.payload || {}),
      JSON.stringify(logData.formatted_message || {}),
      logData.status,
      logData.error_message || null,
      logData.response_code || null,
      logData.response_time_ms || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating log:', error);
    throw error;
  }
}

async function getLogs(tenantId, options = {}) {
  try {
    const { limit = 50, offset = 0, rule_id, status } = options;
    
    let query = `
      SELECT l.*, r.name as rule_name, cw.name as webhook_name
      FROM logs l
      LEFT JOIN rules r ON l.rule_id = r.id
      LEFT JOIN chat_webhooks cw ON l.webhook_id = cw.id
      WHERE l.tenant_id = $1
    `;
    
    const params = [tenantId];
    let paramIndex = 2;
    
    if (rule_id) {
      query += ` AND l.rule_id = $${paramIndex++}`;
      params.push(rule_id);
    }
    
    if (status) {
      query += ` AND l.status = $${paramIndex++}`;
      params.push(status);
    }
    
    query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM logs WHERE tenant_id = $1';
    const countParams = [tenantId];
    let countParamIndex = 2;
    
    if (rule_id) {
      countQuery += ` AND rule_id = $${countParamIndex++}`;
      countParams.push(rule_id);
    }
    
    if (status) {
      countQuery += ` AND status = $${countParamIndex++}`;
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
      has_more: offset + limit < parseInt(countResult.rows[0].count)
    };
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
}

// Dashboard statistics
async function getDashboardStats(tenantId) {
  try {
    const queries = await Promise.all([
      // Total notifications
      pool.query('SELECT COUNT(*) FROM logs WHERE tenant_id = $1', [tenantId]),
      
      // Success rate (last 1000 logs)
      pool.query(`
        SELECT 
          COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
          COUNT(*) as total_count
        FROM (
          SELECT status FROM logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000
        ) recent_logs
      `, [tenantId]),
      
      // Active rules
      pool.query('SELECT COUNT(*) FROM rules WHERE tenant_id = $1 AND enabled = true', [tenantId]),
      
      // Average delivery time (successful notifications only)
      pool.query(`
        SELECT AVG(response_time_ms) as avg_time
        FROM logs 
        WHERE tenant_id = $1 AND status = 'success' AND response_time_ms IS NOT NULL
      `, [tenantId]),
      
      // Last 24 hours stats
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failures
        FROM logs 
        WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
      `, [tenantId])
    ]);

    const [totalResult, successRateResult, activeRulesResult, avgTimeResult, last24hResult] = queries;
    
    const successRate = successRateResult.rows[0].total_count > 0 
      ? (successRateResult.rows[0].success_count / successRateResult.rows[0].total_count * 100).toFixed(1)
      : 0;

    return {
      totalNotifications: parseInt(totalResult.rows[0].count),
      successRate: parseFloat(successRate),
      activeRules: parseInt(activeRulesResult.rows[0].count),
      avgDeliveryTime: Math.round(avgTimeResult.rows[0].avg_time || 0),
      last24Hours: {
        notifications: parseInt(last24hResult.rows[0].total || 0),
        success: parseInt(last24hResult.rows[0].success || 0),
        failures: parseInt(last24hResult.rows[0].failures || 0)
      }
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

// Tenant management
async function getTenantByPipedriveCompanyId(companyId) {
  try {
    const query = 'SELECT * FROM tenants WHERE pipedrive_company_id = $1';
    const result = await pool.query(query, [companyId]);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching tenant by Pipedrive company ID:', error);
    throw error;
  }
}

async function getTenantByPipedriveUserId(userId) {
  try {
    const query = 'SELECT * FROM tenants WHERE pipedrive_user_id = $1';
    const result = await pool.query(query, [userId]);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching tenant by Pipedrive user ID:', error);
    throw error;
  }
}

async function createTenant(tenantData) {
  try {
    const query = `
      INSERT INTO tenants (company_name, pipedrive_company_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    
    const result = await pool.query(query, [tenantData.company_name, tenantData.pipedrive_company_id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating tenant:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
});

process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
});

module.exports = {
  pool,
  healthCheck,
  getRulesForEvent,
  getAllRules,
  createRule,
  updateRule,
  deleteRule,
  getWebhooks,
  createWebhook,
  createLog,
  getLogs,
  getDashboardStats,
  getTenantByPipedriveCompanyId,
  getTenantByPipedriveUserId,
  createTenant
};