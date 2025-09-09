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
    const { event, object, user } = webhookData;
    const objectType = object?.type || 'item';
    const objectName = object?.name || object?.title || `${objectType} #${object?.id}`;
    const userName = user?.name || 'Someone';

    let action = 'updated';
    if (event.includes('added')) action = 'added';
    if (event.includes('deleted')) action = 'deleted';
    if (event.includes('won')) action = 'won';
    if (event.includes('lost')) action = 'lost';

    return {
      text: `🔔 *${userName}* ${action} ${objectType}: *${objectName}*`
    };
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