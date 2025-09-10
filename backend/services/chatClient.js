const axios = require('axios');

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
   * @param {string} templateMode - 'simple', 'detailed', or 'custom'
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
          emoji = '📝';
          message = `${emoji} *Deal Updated*\n📋 *${objectName}*`;
          if (value) message += `\n💰 Value: *${value}*`;
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
        emoji = '📅';
        message = `${emoji} *New Activity Created*\n📝 *${objectName}*`;
        if (object?.type) message += `\n📋 Type: ${object.type}`;
        if (object?.due_date) message += `\n📅 Due: ${object.due_date}`;
        message += `\n👤 Created by: *${userName}*`;
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
   * Format custom message using template
   * @private
   */
  formatCustomMessage(webhookData, template) {
    if (!template) {
      return this.formatSimpleMessage(webhookData);
    }

    try {
      // Simple template variable replacement
      let message = template;
      const variables = {
        '{{event}}': webhookData.event,
        '{{object.type}}': webhookData.object?.type || '',
        '{{object.name}}': webhookData.object?.name || webhookData.object?.title || '',
        '{{object.id}}': webhookData.object?.id || '',
        '{{object.value}}': webhookData.object?.value || '',
        '{{object.currency}}': webhookData.object?.currency || '',
        '{{user.name}}': webhookData.user?.name || '',
        '{{user.email}}': webhookData.user?.email || '',
        '{{company.name}}': webhookData.company?.name || '',
        '{{timestamp}}': new Date().toLocaleString()
      };

      // Replace all template variables
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(key, 'g'), value);
      });

      return { text: message };
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