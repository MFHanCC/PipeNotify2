const axios = require('axios');
const { processTemplate, getDefaultTemplate } = require('./templateEngine');

/**
 * Google Chat webhook client for sending notifications
 */
class ChatClient {
  constructor() {
    // Create axios instance with default configuration
    this.client = axios.create({
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Pipenotify/1.0'
      }
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`Chat webhook success: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`Chat webhook error: ${error.response?.status} ${error.config?.url}`, {
          message: error.response?.data?.error || error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        throw error;
      }
    );
  }

  /**
   * Send a simple text message to Google Chat
   * @param {string} webhookUrl - Google Chat webhook URL
   * @param {string} text - Message text
   * @returns {Promise<Object>} Response from Google Chat
   */
  async sendTextMessage(webhookUrl, text) {
    if (!webhookUrl || !text) {
      throw new Error('Webhook URL and text are required');
    }

    try {
      const message = { text };
      const response = await this.client.post(webhookUrl, message);
      return {
        success: true,
        messageId: response.data?.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to send text message: ${error.message}`);
    }
  }

  /**
   * Send a rich card message to Google Chat
   * @param {string} webhookUrl - Google Chat webhook URL
   * @param {Object} cardData - Card configuration
   * @returns {Promise<Object>} Response from Google Chat
   */
  async sendCardMessage(webhookUrl, cardData) {
    if (!webhookUrl || !cardData) {
      throw new Error('Webhook URL and card data are required');
    }

    try {
      const message = {
        cards: [cardData]
      };
      const response = await this.client.post(webhookUrl, message);
      return {
        success: true,
        messageId: response.data?.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to send card message: ${error.message}`);
    }
  }

  /**
   * Send formatted notification based on template mode
   * @param {string} webhookUrl - Google Chat webhook URL  
   * @param {Object} webhookData - Original Pipedrive webhook data
   * @param {string} templateMode - 'simple', 'detailed', 'card', or 'custom'
   * @param {string} customTemplate - Custom template (if mode is 'custom')
   * @returns {Promise<Object>} Response from Google Chat
   */
  async sendNotification(webhookUrl, webhookData, templateMode = 'simple', customTemplate = null) {
    try {
      let message;

      switch (templateMode) {
        case 'detailed':
          message = this.formatDetailedMessage(webhookData);
          break;
        case 'card':
          message = this.formatCardMessage(webhookData);
          break;
        case 'custom':
          message = this.formatCustomMessage(webhookData, customTemplate);
          break;
        case 'simple':
        default:
          message = this.formatSimpleMessage(webhookData);
          break;
      }

      const response = await this.client.post(webhookUrl, message);
      return {
        success: true,
        messageId: response.data?.name,
        templateMode,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Format simple text message from webhook data
   * @private
   */
  formatSimpleMessage(webhookData) {
    const { event, object, user, previous } = webhookData;
    const objectType = object?.type || 'item';
    const objectName = object?.name || object?.title || `${objectType} #${object?.id}`;
    const userName = user?.name || 'Someone';
    const value = object?.value ? `${object.currency || '$'}${object.value}` : null;

    let message = '';
    let emoji = '🔔';

    // Handle different event types with specific messages
    switch (event) {
      case 'deal.create':
        emoji = '🆕';
        message = `${emoji} *New Deal Created*\n📋 *${objectName}*`;
        if (value) message += `\n💰 Value: *${value}*`;
        if (object?.stage_id) {
          // You could map stage_id to stage name if you have that data
          message += `\n📍 Stage: Stage ${object.stage_id}`;
        }
        message += `\n👤 Created by: *${userName}*`;
        break;

      case 'deal.change':
        // Determine what changed for more specific messaging
        const changes = [];
        let changeType = 'updated';
        
        if (object?.status === 'won') {
          emoji = '🎉';
          message = `${emoji} *Deal Won!*\n🏆 *${objectName}*`;
          if (value) message += `\n💰 Value: *${value}*`;
          message += `\n👤 Won by: *${userName}*`;
        } else if (object?.status === 'lost') {
          emoji = '❌';
          message = `${emoji} *Deal Lost*\n📋 *${objectName}*`;
          if (value) message += `\n💸 Lost value: *${value}*`;
          if (object?.lost_reason) message += `\n📝 Reason: ${object.lost_reason}`;
          message += `\n👤 Updated by: *${userName}*`;
        } else if (previous && previous.stage_id && object?.stage_id && previous.stage_id !== object.stage_id) {
          emoji = '🔄';
          message = `${emoji} *Deal Stage Changed*\n📋 *${objectName}*`;
          message += `\n📍 Stage: ${previous.stage_id} → *${object.stage_id}*`;
          if (value) message += `\n💰 Value: *${value}*`;
          message += `\n👤 Updated by: *${userName}*`;
        } else {
          // Detect specific field changes
          if (previous) {
            // Value change
            if (previous.value !== object?.value) {
              const oldValue = previous.value ? `${object?.currency || '$'}${previous.value}` : 'No value';
              const newValue = value || 'No value';
              changes.push(`💰 Value: ${oldValue} → *${newValue}*`);
              emoji = '💰';
              changeType = 'value updated';
            }
            
            // Title change
            if (previous.title !== object?.title) {
              changes.push(`📝 Title: "${previous.title}" → "*${object?.title}*"`);
              emoji = '📝';
              changeType = 'title updated';
            }
            
            // Person assignment change
            if (previous.person_id !== object?.person_id) {
              emoji = '👤';
              changeType = 'contact updated';
              if (object?.person_id) {
                changes.push(`👤 Contact: Added person ID ${object.person_id}`);
              } else {
                changes.push(`👤 Contact: Removed`);
              }
            }
            
            // Organization assignment change
            if (previous.org_id !== object?.org_id) {
              emoji = '🏢';
              changeType = 'organization updated';
              if (object?.org_id) {
                changes.push(`🏢 Organization: Added org ID ${object.org_id}`);
              } else {
                changes.push(`🏢 Organization: Removed`);
              }
            }
            
            // Owner change
            if (previous.owner_id !== object?.owner_id) {
              emoji = '👥';
              changeType = 'owner changed';
              changes.push(`👥 Owner: Changed to user ID ${object?.owner_id}`);
            }
            
            // Priority change (if available)
            if (previous.priority !== object?.priority) {
              emoji = '⭐';
              changeType = 'priority updated';
              changes.push(`⭐ Priority: ${previous.priority || 'None'} → *${object?.priority || 'None'}*`);
            }
            
            // Expected close date change
            if (previous.expected_close_date !== object?.expected_close_date) {
              emoji = '📅';
              changeType = 'close date updated';
              const oldDate = previous.expected_close_date || 'Not set';
              const newDate = object?.expected_close_date || 'Not set';
              changes.push(`📅 Expected close: ${oldDate} → *${newDate}*`);
            }
            
            // Label changes (if available in the data)
            if (object?.label_ids && previous.label_ids) {
              const oldLabels = Array.isArray(previous.label_ids) ? previous.label_ids : [];
              const newLabels = Array.isArray(object.label_ids) ? object.label_ids : [];
              
              if (JSON.stringify(oldLabels.sort()) !== JSON.stringify(newLabels.sort())) {
                emoji = '🏷️';
                changeType = 'labels updated';
                const added = newLabels.filter(id => !oldLabels.includes(id));
                const removed = oldLabels.filter(id => !newLabels.includes(id));
                
                if (added.length > 0) {
                  changes.push(`🏷️ Labels added: ${added.join(', ')}`);
                }
                if (removed.length > 0) {
                  changes.push(`🏷️ Labels removed: ${removed.join(', ')}`);
                }
              }
            }
            
            // Product changes (detected from activities or custom fields if available)
            // This would require additional webhook data structure analysis
            
            // Probability change
            if (previous.probability !== object?.probability) {
              emoji = '📊';
              changeType = 'probability updated';
              const oldProb = previous.probability || 0;
              const newProb = object?.probability || 0;
              changes.push(`📊 Probability: ${oldProb}% → *${newProb}%*`);
            }
          }
          
          if (changes.length > 0) {
            message = `${emoji} *Deal ${changeType.charAt(0).toUpperCase() + changeType.slice(1)}*\n📋 *${objectName}*\n${changes.join('\n')}`;
          } else {
            emoji = '📝';
            message = `${emoji} *Deal Updated*\n📋 *${objectName}*`;
            if (value) message += `\n💰 Value: *${value}*`;
          }
          
          message += `\n👤 Updated by: *${userName}*`;
        }
        break;

      case 'deal.delete':
        emoji = '🗑️';
        message = `${emoji} *Deal Deleted*\n📋 *${objectName}*`;
        if (value) message += `\n💰 Value: *${value}*`;
        message += `\n👤 Deleted by: *${userName}*`;
        break;

      case 'person.create':
        emoji = '👤';
        message = `${emoji} *New Person Added*\n👋 *${objectName}*`;
        if (object?.email) message += `\n📧 Email: ${object.email[0]?.value || object.email}`;
        message += `\n👤 Added by: *${userName}*`;
        break;

      case 'person.change':
        emoji = '👤';
        message = `${emoji} *Person Updated*\n👋 *${objectName}*`;
        if (object?.email) message += `\n📧 Email: ${object.email[0]?.value || object.email}`;
        message += `\n👤 Updated by: *${userName}*`;
        break;

      case 'organization.create':
        emoji = '🏢';
        message = `${emoji} *New Organization Added*\n🏢 *${objectName}*`;
        message += `\n👤 Added by: *${userName}*`;
        break;

      case 'organization.change':
        emoji = '🏢';
        message = `${emoji} *Organization Updated*\n🏢 *${objectName}*`;
        message += `\n👤 Updated by: *${userName}*`;
        break;

      case 'activity.create':
        // Determine activity type for better emoji and messaging
        const activityType = object?.type?.toLowerCase() || 'activity';
        if (activityType.includes('call')) {
          emoji = '📞';
          message = `${emoji} *New Call Scheduled*\n📞 *${objectName}*`;
        } else if (activityType.includes('meeting')) {
          emoji = '🤝';
          message = `${emoji} *New Meeting Scheduled*\n🤝 *${objectName}*`;
        } else if (activityType.includes('email')) {
          emoji = '📧';
          message = `${emoji} *New Email Activity*\n📧 *${objectName}*`;
        } else if (activityType.includes('task')) {
          emoji = '✅';
          message = `${emoji} *New Task Created*\n✅ *${objectName}*`;
        } else {
          emoji = '📅';
          message = `${emoji} *New Activity Created*\n📝 *${objectName}*`;
        }
        
        if (object?.type) message += `\n📋 Type: ${object.type}`;
        if (object?.due_date) message += `\n📅 Due: ${object.due_date}`;
        if (object?.due_time) message += ` at ${object.due_time}`;
        if (object?.duration) message += `\n⏱️ Duration: ${object.duration}`;
        message += `\n👤 Created by: *${userName}*`;
        break;

      case 'activity.change':
        const updatedActivityType = object?.type?.toLowerCase() || 'activity';
        if (updatedActivityType.includes('call')) {
          emoji = '📞';
          message = `${emoji} *Call Updated*\n📞 *${objectName}*`;
        } else if (updatedActivityType.includes('meeting')) {
          emoji = '🤝';
          message = `${emoji} *Meeting Updated*\n🤝 *${objectName}*`;
        } else {
          emoji = '📅';
          message = `${emoji} *Activity Updated*\n📝 *${objectName}*`;
        }
        
        if (object?.type) message += `\n📋 Type: ${object.type}`;
        if (object?.done) message += `\n✅ Status: Completed`;
        message += `\n👤 Updated by: *${userName}*`;
        break;

      case 'activity.delete':
        emoji = '🗑️';
        message = `${emoji} *Activity Deleted*\n📅 *${objectName}*`;
        if (object?.type) message += `\n📋 Type: ${object.type}`;
        message += `\n👤 Deleted by: *${userName}*`;
        break;

      case 'note.create':
        emoji = '📔';
        message = `${emoji} *New Note Added*\n📝 *${objectName || 'Note'}*`;
        if (object?.content) message += `\n💬 Content: ${object.content.substring(0, 100)}${object.content.length > 100 ? '...' : ''}`;
        message += `\n👤 Added by: *${userName}*`;
        break;

      case 'note.change':
        emoji = '📔';
        message = `${emoji} *Note Updated*\n📝 *${objectName || 'Note'}*`;
        message += `\n👤 Updated by: *${userName}*`;
        break;

      case 'product.create':
        emoji = '📦';
        message = `${emoji} *New Product Added*\n📦 *${objectName}*`;
        if (object?.code) message += `\n🏷️ Code: ${object.code}`;
        if (object?.prices && object.prices[0]) message += `\n💰 Price: ${object.prices[0].currency || '$'}${object.prices[0].price}`;
        message += `\n👤 Added by: *${userName}*`;
        break;

      case 'product.change':
        emoji = '📦';
        message = `${emoji} *Product Updated*\n📦 *${objectName}*`;
        if (object?.code) message += `\n🏷️ Code: ${object.code}`;
        message += `\n👤 Updated by: *${userName}*`;
        break;

      default:
        // Fallback for unknown events
        let action = 'updated';
        if (event.includes('create')) action = 'created';
        if (event.includes('add')) action = 'added';
        if (event.includes('delete')) action = 'deleted';
        if (event.includes('won')) action = 'won';
        if (event.includes('lost')) action = 'lost';

        message = `🔔 *${userName}* ${action} ${objectType}: *${objectName}*`;
        if (value) message += `\n💰 Value: *${value}*`;
        break;
    }

    return { text: message };
  }

  /**
   * Format detailed card message from webhook data
   * @private
   */
  formatDetailedMessage(webhookData) {
    const { event, object, user, company } = webhookData;
    const timestamp = new Date().toISOString();

    // Determine color based on event type
    let color = '#4285f4'; // Default blue
    if (event.includes('won')) color = '#34a853'; // Green
    if (event.includes('lost')) color = '#ea4335'; // Red
    if (event.includes('deleted')) color = '#fbbc04'; // Yellow

    const card = {
      header: {
        title: `Pipedrive ${event.replace(/\./g, ' ').toUpperCase()}`,
        subtitle: company?.name || 'Pipedrive Notification',
        imageUrl: 'https://cdn.pipedrive.com/assets/icons/pipedrivelogo_108.png'
      },
      sections: [
        {
          widgets: [
            {
              keyValue: {
                topLabel: 'Event',
                content: event,
                contentMultiline: false,
                iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/event/v1/24px.svg'
              }
            },
            {
              keyValue: {
                topLabel: 'Object',
                content: `${object?.type || 'Unknown'}: ${object?.name || object?.title || object?.id}`,
                contentMultiline: true
              }
            }
          ]
        }
      ]
    };

    // Add user information if available
    if (user?.name) {
      card.sections[0].widgets.push({
        keyValue: {
          topLabel: 'User',
          content: user.name,
          contentMultiline: false,
          iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/person/v1/24px.svg'
        }
      });
    }

    // Add object-specific details
    if (object?.value && object?.currency) {
      card.sections[0].widgets.push({
        keyValue: {
          topLabel: 'Value',
          content: `${object.currency} ${object.value}`,
          contentMultiline: false,
          iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/attach_money/v1/24px.svg'
        }
      });
    }

    // Add timestamp
    card.sections.push({
      widgets: [
        {
          keyValue: {
            topLabel: 'Timestamp',
            content: new Date(timestamp).toLocaleString(),
            contentMultiline: false,
            iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/schedule/v1/24px.svg'
          }
        }
      ]
    });

    return { cards: [card] };
  }

  /**
   * Format rich interactive card message from webhook data
   * @private
   */
  formatCardMessage(webhookData) {
    const { event, object, user, previous, company } = webhookData;
    
    // Determine card theme and actions based on event
    let headerColor = '#4285f4'; // Default blue
    let headerIcon = '🔔';
    let actionButtons = [];
    
    if (event.includes('won')) {
      headerColor = '#34a853'; // Green
      headerIcon = '🎉';
    } else if (event.includes('lost')) {
      headerColor = '#ea4335'; // Red  
      headerIcon = '😞';
    } else if (event.includes('created') || event.includes('added')) {
      headerColor = '#fbbc04'; // Yellow
      headerIcon = '🆕';
    } else if (event.includes('deleted')) {
      headerColor = '#9aa0a6'; // Gray
      headerIcon = '🗑️';
    } else if (event.includes('change') || event.includes('update')) {
      headerColor = '#4285f4'; // Blue
      headerIcon = '📝';
    }
    
    // Generate Pipedrive link if we have object ID
    const objectId = object?.id;
    const objectType = object?.type || 'item';
    let pipedriveUrl = null;
    
    if (objectId && objectType) {
      // Generate Pipedrive URL based on object type - use company domain if available
      const baseDomain = webhookData.company_domain || 'app';
      const typeUrlMap = {
        'deal': `https://${baseDomain}.pipedrive.com/pipeline/deal/${objectId}`,
        'person': `https://${baseDomain}.pipedrive.com/person/${objectId}`,
        'organization': `https://${baseDomain}.pipedrive.com/organization/${objectId}`,
        'activity': `https://${baseDomain}.pipedrive.com/activities/calendar/${objectId}`
      };
      pipedriveUrl = typeUrlMap[objectType] || `https://${baseDomain}.pipedrive.com/`;
    }
    
    // Add action buttons
    if (pipedriveUrl) {
      actionButtons.push({
        textButton: {
          text: `View ${objectType.charAt(0).toUpperCase() + objectType.slice(1)}`,
          onClick: {
            openLink: {
              url: pipedriveUrl
            }
          }
        }
      });
    }
    
    // Build main content sections
    const sections = [];
    
    // Main information section
    const mainWidgets = [];
    
    // Event info
    mainWidgets.push({
      keyValue: {
        topLabel: 'Event',
        content: `${headerIcon} ${event.replace(/\./g, ' ').toUpperCase()}`,
        contentMultiline: false,
        iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/notification_important/v1/24px.svg'
      }
    });
    
    // Object information
    const objectName = object?.name || object?.title || `${objectType} #${objectId}`;
    mainWidgets.push({
      keyValue: {
        topLabel: objectType.charAt(0).toUpperCase() + objectType.slice(1),
        content: objectName,
        contentMultiline: true,
        iconUrl: this.getIconForObjectType(objectType)
      }
    });
    
    // Value information (for deals)
    if (object?.value && object?.currency) {
      const value = parseFloat(object.value);
      const formattedValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: object.currency
      }).format(value);
      
      mainWidgets.push({
        keyValue: {
          topLabel: 'Value',
          content: formattedValue,
          contentMultiline: false,
          iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/attach_money/v1/24px.svg'
        }
      });
    }
    
    // Probability (for deals)
    if (object?.probability !== undefined) {
      mainWidgets.push({
        keyValue: {
          topLabel: 'Probability',
          content: `${object.probability}%`,
          contentMultiline: false,
          iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/trending_up/v1/24px.svg'
        }
      });
    }
    
    // User information
    if (user?.name) {
      mainWidgets.push({
        keyValue: {
          topLabel: 'User',
          content: user.name,
          contentMultiline: false,
          iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/person/v1/24px.svg'
        }
      });
    }
    
    sections.push({
      widgets: mainWidgets
    });
    
    // Changes section (for update events)
    if (event.includes('change') && previous && object) {
      const changes = this.detectChanges(previous, object);
      if (changes.length > 0) {
        const changeWidgets = changes.map(change => ({
          keyValue: {
            topLabel: change.field,
            content: `${change.from} → ${change.to}`,
            contentMultiline: false,
            iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/compare_arrows/v1/24px.svg'
          }
        }));
        
        sections.push({
          header: 'Changes',
          widgets: changeWidgets
        });
      }
    }
    
    // Action buttons section
    if (actionButtons.length > 0) {
      sections.push({
        widgets: [{
          buttons: actionButtons
        }]
      });
    }
    
    // Timestamp footer
    sections.push({
      widgets: [{
        keyValue: {
          topLabel: 'Timestamp',
          content: new Date().toLocaleString(),
          contentMultiline: false,
          iconUrl: 'https://fonts.gstatic.com/s/i/materialicons/schedule/v1/24px.svg'
        }
      }]
    });
    
    const card = {
      header: {
        title: `${headerIcon} Pipedrive Notification`,
        subtitle: company?.name || 'Pipeline Update',
        imageUrl: 'https://cdn.pipedrive.com/assets/icons/pipedrivelogo_108.png'
      },
      sections
    };
    
    return { cards: [card] };
  }
  
  /**
   * Get appropriate icon URL for object type
   * @private
   */
  getIconForObjectType(objectType) {
    const iconMap = {
      'deal': 'https://fonts.gstatic.com/s/i/materialicons/handshake/v1/24px.svg',
      'person': 'https://fonts.gstatic.com/s/i/materialicons/person/v1/24px.svg',
      'organization': 'https://fonts.gstatic.com/s/i/materialicons/business/v1/24px.svg',
      'activity': 'https://fonts.gstatic.com/s/i/materialicons/event/v1/24px.svg',
      'note': 'https://fonts.gstatic.com/s/i/materialicons/note/v1/24px.svg',
      'product': 'https://fonts.gstatic.com/s/i/materialicons/inventory/v1/24px.svg'
    };
    
    return iconMap[objectType] || 'https://fonts.gstatic.com/s/i/materialicons/info/v1/24px.svg';
  }
  
  /**
   * Detect changes between previous and current object
   * @private
   */
  detectChanges(previous, current) {
    const changes = [];
    const fieldsToCheck = ['value', 'stage_id', 'probability', 'status', 'title', 'name'];
    
    fieldsToCheck.forEach(field => {
      if (previous[field] !== undefined && current[field] !== undefined) {
        if (previous[field] !== current[field]) {
          changes.push({
            field: field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            from: String(previous[field]),
            to: String(current[field])
          });
        }
      }
    });
    
    return changes;
  }

  /**
   * Format custom message using template engine
   * @private
   */
  formatCustomMessage(webhookData, template) {
    if (!template) {
      // Use default template for the event type
      template = getDefaultTemplate(webhookData.event);
    }

    try {
      // Use the advanced template engine for variable substitution
      const processedMessage = processTemplate(template, webhookData, {
        format: 'text',
        strictMode: false,
        fallbackValues: {
          'company.name': 'Pipedrive',
          'user.name': 'Unknown User',
          'event.timestamp': new Date().toLocaleString()
        }
      });

      return { text: processedMessage };
    } catch (error) {
      console.error('Error formatting custom message:', error);
      return this.formatSimpleMessage(webhookData);
    }
  }

  /**
   * Test webhook connectivity
   * @param {string} webhookUrl - Google Chat webhook URL
   * @returns {Promise<Object>} Test result
   */
  async testWebhook(webhookUrl) {
    try {
      const testMessage = {
        text: '🧪 Test message from Pipenotify - Webhook is working correctly!'
      };

      const response = await this.client.post(webhookUrl, testMessage);
      return {
        success: true,
        messageId: response.data?.name,
        responseStatus: response.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseStatus: error.response?.status,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create default client instance
const defaultChatClient = new ChatClient();

/**
 * Send message to Google Chat webhook (convenience function)
 * @param {string} webhookUrl - Google Chat webhook URL
 * @param {string|Object} message - Message text or formatted message object
 * @returns {Promise<Object>} Response from Google Chat
 */
async function sendToChat(webhookUrl, message) {
  if (typeof message === 'string') {
    return defaultChatClient.sendTextMessage(webhookUrl, message);
  } else if (typeof message === 'object' && message.text) {
    return defaultChatClient.client.post(webhookUrl, message);
  } else {
    throw new Error('Invalid message format. Must be string or object with text property.');
  }
}

module.exports = {
  ChatClient,
  defaultChatClient,
  sendToChat
};