const { Pool } = require('pg');

/**
 * Channel routing service for directing notifications to specific Google Chat webhooks
 * Supports rule-based routing, priority routing, and fallback mechanisms
 */

/**
 * Route notification to appropriate channel based on deal characteristics
 * @param {Object} webhookData - The webhook data from Pipedrive
 * @param {Object} rule - The notification rule
 * @param {Array} availableWebhooks - Available webhook endpoints for tenant
 * @returns {Object} Selected webhook or null
 */
function routeToChannel(webhookData, rule, availableWebhooks) {
  try {
    // Priority 1: Use rule-specific target channel if set
    if (rule.target_channel_id) {
      const targetChannel = availableWebhooks.find(w => w.id === rule.target_channel_id);
      if (targetChannel && targetChannel.is_active) {
        console.log(`📍 Routing to rule-specific channel: ${targetChannel.name}`);
        return targetChannel;
      }
    }

    // Priority 2: Route based on deal value (high-value deals to executive channels)
    const dealValue = parseFloat(webhookData.current?.value || webhookData.object?.value || 0);
    
    if (dealValue >= 50000) {
      // Route high-value deals to executive/VIP channels
      const vipChannel = findChannelByType(availableWebhooks, ['executive', 'vip', 'high-value', 'leadership']);
      if (vipChannel) {
        console.log(`💎 Routing high-value deal ($${dealValue}) to VIP channel: ${vipChannel.name}`);
        return vipChannel;
      }
    } else if (dealValue >= 10000) {
      // Route medium-value deals to manager channels
      const managerChannel = findChannelByType(availableWebhooks, ['manager', 'sales-manager', 'medium-value']);
      if (managerChannel) {
        console.log(`💼 Routing medium-value deal ($${dealValue}) to manager channel: ${managerChannel.name}`);
        return managerChannel;
      }
    }

    // Priority 3: Route based on deal stage/probability
    const probability = parseInt(webhookData.current?.probability || webhookData.object?.probability || 0);
    
    if (probability >= 90) {
      // Route hot deals to urgent/closing channels
      const hotChannel = findChannelByType(availableWebhooks, ['urgent', 'closing', 'hot-deals', 'pipeline']);
      if (hotChannel) {
        console.log(`🔥 Routing hot deal (${probability}% probability) to urgent channel: ${hotChannel.name}`);
        return hotChannel;
      }
    }

    // Priority 4: Route based on event type
    const eventType = webhookData.event;
    
    if (eventType.includes('won')) {
      // Route won deals to celebration/wins channel
      const winsChannel = findChannelByType(availableWebhooks, ['wins', 'celebrations', 'closed-won', 'success']);
      if (winsChannel) {
        console.log(`🎉 Routing won deal to wins channel: ${winsChannel.name}`);
        return winsChannel;
      }
    } else if (eventType.includes('lost')) {
      // Route lost deals to analysis/review channel
      const lostChannel = findChannelByType(availableWebhooks, ['lost-deals', 'analysis', 'review']);
      if (lostChannel) {
        console.log(`📊 Routing lost deal to analysis channel: ${lostChannel.name}`);
        return lostChannel;
      }
    } else if (eventType.includes('created') || eventType.includes('added')) {
      // Route new deals to leads/new-business channel
      const leadsChannel = findChannelByType(availableWebhooks, ['leads', 'new-business', 'prospects', 'new-deals']);
      if (leadsChannel) {
        console.log(`🆕 Routing new deal to leads channel: ${leadsChannel.name}`);
        return leadsChannel;
      }
    }

    // Priority 5: Route based on time (business hours vs after hours)
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour < 9 || currentHour >= 18) {
      // Route after-hours to 24/7 or alert channels
      const alertChannel = findChannelByType(availableWebhooks, ['alerts', '24-7', 'urgent', 'after-hours']);
      if (alertChannel) {
        console.log(`🌙 Routing after-hours notification to alert channel: ${alertChannel.name}`);
        return alertChannel;
      }
    }

    // Priority 6: Route based on owner/user
    const ownerId = webhookData.current?.user_id || webhookData.object?.user_id || webhookData.user_id;
    if (ownerId) {
      // Look for user-specific channels
      const userChannel = findChannelByType(availableWebhooks, [`user-${ownerId}`, `owner-${ownerId}`]);
      if (userChannel) {
        console.log(`👤 Routing to user-specific channel: ${userChannel.name}`);
        return userChannel;
      }
    }

    // Fallback: Use rule's default webhook or first active webhook
    const fallbackChannel = availableWebhooks.find(w => w.id === rule.target_webhook_id) ||
                           availableWebhooks.find(w => w.is_active);
    
    if (fallbackChannel) {
      console.log(`🔄 Using fallback channel: ${fallbackChannel.name}`);
      return fallbackChannel;
    }

    console.log('❌ No suitable channel found for routing');
    return null;

  } catch (error) {
    console.error('Error in channel routing:', error);
    // Fallback to rule's default webhook on error
    return availableWebhooks.find(w => w.id === rule.target_webhook_id && w.is_active) || null;
  }
}

/**
 * Find channel by type keywords in name or description
 * @param {Array} webhooks - Available webhooks
 * @param {Array} typeKeywords - Keywords to match
 * @returns {Object|null} Matching webhook
 */
function findChannelByType(webhooks, typeKeywords) {
  for (const keyword of typeKeywords) {
    const channel = webhooks.find(w => 
      w.is_active && (
        w.name?.toLowerCase().includes(keyword.toLowerCase()) ||
        w.description?.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    if (channel) return channel;
  }
  return null;
}

/**
 * Get routing suggestions based on current webhook setup
 * @param {Array} webhooks - Current webhooks
 * @returns {Array} Suggestions for better routing
 */
function getRoutingSuggestions(webhooks) {
  const suggestions = [];
  
  const activeWebhooks = webhooks.filter(w => w.is_active);
  
  if (activeWebhooks.length === 1) {
    suggestions.push({
      type: 'setup',
      priority: 'high',
      title: 'Add specialized channels',
      description: 'Consider creating separate channels for high-value deals, wins, and urgent notifications',
      channels: ['High Value Deals', 'Wins & Celebrations', 'Urgent Notifications']
    });
  }

  // Check for missing channel types
  const channelTypes = {
    'high-value': ['executive', 'vip', 'high-value', 'leadership'],
    'wins': ['wins', 'celebrations', 'closed-won', 'success'],
    'leads': ['leads', 'new-business', 'prospects', 'new-deals'],
    'urgent': ['urgent', 'alerts', 'hot-deals'],
    'lost-analysis': ['lost-deals', 'analysis', 'review']
  };

  Object.entries(channelTypes).forEach(([type, keywords]) => {
    const hasChannelType = activeWebhooks.some(w => 
      keywords.some(keyword => 
        w.name?.toLowerCase().includes(keyword) ||
        w.description?.toLowerCase().includes(keyword)
      )
    );

    if (!hasChannelType && activeWebhooks.length >= 2) {
      suggestions.push({
        type: 'channel-type',
        priority: 'medium',
        title: `Consider adding ${type.replace('-', ' ')} channel`,
        description: `Create a dedicated channel for ${type.replace('-', ' ')} notifications`,
        suggestedNames: keywords.slice(0, 2)
      });
    }
  });

  return suggestions;
}

/**
 * Create channel routing rules based on deal patterns
 * @param {number} tenantId - Tenant ID
 * @param {Object} routingConfig - Routing configuration
 * @param {Object} pool - Database pool
 */
async function createRoutingRules(tenantId, routingConfig, pool) {
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get available webhooks for tenant
      const webhooksResult = await client.query(
        'SELECT * FROM chat_webhooks WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      );
      const webhooks = webhooksResult.rows;

      if (webhooks.length < 2) {
        throw new Error('At least 2 active webhooks required for channel routing');
      }

      // Create routing rules based on configuration
      const rules = [];

      // High-value deals rule
      if (routingConfig.highValueChannel && routingConfig.highValueThreshold) {
        const highValueWebhook = webhooks.find(w => w.name === routingConfig.highValueChannel);
        if (highValueWebhook) {
          rules.push({
            name: 'High Value Deals',
            event_type: 'deal.*',
            filters: JSON.stringify({
              value_min: routingConfig.highValueThreshold
            }),
            target_channel_id: highValueWebhook.id,
            priority: 1
          });
        }
      }

      // Won deals rule
      if (routingConfig.winsChannel) {
        const winsWebhook = webhooks.find(w => w.name === routingConfig.winsChannel);
        if (winsWebhook) {
          rules.push({
            name: 'Won Deals Celebration',
            event_type: 'deal.won',
            filters: JSON.stringify({}),
            target_channel_id: winsWebhook.id,
            priority: 2
          });
        }
      }

      // New leads rule
      if (routingConfig.leadsChannel) {
        const leadsWebhook = webhooks.find(w => w.name === routingConfig.leadsChannel);
        if (leadsWebhook) {
          rules.push({
            name: 'New Leads',
            event_type: 'deal.added',
            filters: JSON.stringify({}),
            target_channel_id: leadsWebhook.id,
            priority: 3
          });
        }
      }

      // Urgent deals rule (high probability)
      if (routingConfig.urgentChannel) {
        const urgentWebhook = webhooks.find(w => w.name === routingConfig.urgentChannel);
        if (urgentWebhook) {
          rules.push({
            name: 'Urgent High-Probability Deals',
            event_type: 'deal.*',
            filters: JSON.stringify({
              probability_min: 80
            }),
            target_channel_id: urgentWebhook.id,
            priority: 4
          });
        }
      }

      // Insert rules
      for (const rule of rules) {
        await client.query(`
          INSERT INTO rules (tenant_id, name, event_type, filters, target_channel_id, priority, enabled, template_mode)
          VALUES ($1, $2, $3, $4, $5, $6, true, 'simple')
          ON CONFLICT (tenant_id, name) DO UPDATE SET
            event_type = EXCLUDED.event_type,
            filters = EXCLUDED.filters,
            target_channel_id = EXCLUDED.target_channel_id,
            priority = EXCLUDED.priority,
            updated_at = NOW()
        `, [
          tenantId,
          rule.name,
          rule.event_type,
          rule.filters,
          rule.target_channel_id,
          rule.priority
        ]);
      }

      await client.query('COMMIT');
      console.log(`✅ Created ${rules.length} channel routing rules for tenant ${tenantId}`);
      
      return {
        success: true,
        rulesCreated: rules.length,
        rules: rules.map(r => ({ name: r.name, event_type: r.event_type }))
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating routing rules:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get channel routing statistics
 * @param {number} tenantId - Tenant ID
 * @param {Object} pool - Database pool
 * @param {number} days - Days to look back
 */
async function getRoutingStats(tenantId, pool, days = 30) {
  try {
    const query = `
      SELECT 
        cw.name as channel_name,
        cw.id as channel_id,
        COUNT(l.id) as notification_count,
        COUNT(CASE WHEN l.status = 'success' THEN 1 END) as success_count,
        AVG(l.response_time_ms) as avg_response_time,
        COUNT(DISTINCT l.rule_id) as rules_using_channel
      FROM chat_webhooks cw
      LEFT JOIN rules r ON cw.id = r.target_webhook_id
      LEFT JOIN logs l ON r.id = l.rule_id AND l.created_at >= NOW() - INTERVAL '${days} days'
      WHERE cw.tenant_id = $1 AND cw.is_active = true
      GROUP BY cw.id, cw.name
      ORDER BY notification_count DESC
    `;

    const result = await pool.query(query, [tenantId]);
    
    return result.rows.map(row => ({
      channel_name: row.channel_name,
      channel_id: row.channel_id,
      notifications_sent: parseInt(row.notification_count || 0),
      success_rate: row.notification_count > 0 
        ? Math.round((row.success_count / row.notification_count) * 100) 
        : 0,
      avg_response_time_ms: Math.round(row.avg_response_time || 0),
      rules_count: parseInt(row.rules_using_channel || 0)
    }));

  } catch (error) {
    console.error('Error getting routing stats:', error);
    return [];
  }
}

module.exports = {
  routeToChannel,
  getRoutingSuggestions,
  createRoutingRules,
  getRoutingStats
};