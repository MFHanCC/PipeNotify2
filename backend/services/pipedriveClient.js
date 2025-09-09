const axios = require('axios');

class PipedriveClient {
  constructor(apiToken, companyDomain = null) {
    this.apiToken = apiToken;
    this.companyDomain = companyDomain; // For company-specific API URLs
    this.baseURL = companyDomain 
      ? `https://${companyDomain}.pipedrive.com/api/v1`
      : 'https://api.pipedrive.com/v1';
    
    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Pipenotify/1.0'
      }
    });

    // Add request interceptor to include API token
    this.client.interceptors.request.use((config) => {
      config.params = { ...config.params, api_token: this.apiToken };
      return config;
    });

    // Add response interceptor for error handling and logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`Pipedrive API success: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`Pipedrive API error: ${error.response?.status} ${error.config?.url}`, {
          message: error.response?.data?.error || error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        throw error;
      }
    );
  }

  // User and authentication methods
  async getCurrentUser() {
    try {
      const response = await this.client.get('/users/me');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get current user: ${error.message}`);
    }
  }

  async validateConnection() {
    try {
      const user = await this.getCurrentUser();
      return {
        valid: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          company_id: user.company_id,
          company_name: user.company_name
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Deal methods
  async getDeals(params = {}) {
    try {
      const response = await this.client.get('/deals', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get deals: ${error.message}`);
    }
  }

  async getDeal(dealId) {
    try {
      const response = await this.client.get(`/deals/${dealId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get deal ${dealId}: ${error.message}`);
    }
  }

  // Person methods
  async getPersons(params = {}) {
    try {
      const response = await this.client.get('/persons', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get persons: ${error.message}`);
    }
  }

  async getPerson(personId) {
    try {
      const response = await this.client.get(`/persons/${personId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get person ${personId}: ${error.message}`);
    }
  }

  // Organization methods
  async getOrganizations(params = {}) {
    try {
      const response = await this.client.get('/organizations', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get organizations: ${error.message}`);
    }
  }

  async getOrganization(organizationId) {
    try {
      const response = await this.client.get(`/organizations/${organizationId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get organization ${organizationId}: ${error.message}`);
    }
  }

  // Pipeline and stage methods
  async getPipelines() {
    try {
      const response = await this.client.get('/pipelines');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get pipelines: ${error.message}`);
    }
  }

  async getStages(pipelineId = null) {
    try {
      const params = pipelineId ? { pipeline_id: pipelineId } : {};
      const response = await this.client.get('/stages', { params });
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get stages: ${error.message}`);
    }
  }

  // Activity methods
  async getActivities(params = {}) {
    try {
      const response = await this.client.get('/activities', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get activities: ${error.message}`);
    }
  }

  // Webhook management methods
  async getWebhooks() {
    try {
      const response = await this.client.get('/webhooks');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get webhooks: ${error.message}`);
    }
  }

  async createWebhook(eventAction, subscriptionUrl, httpAuth = null) {
    try {
      const webhookData = {
        event_action: eventAction,
        subscription_url: subscriptionUrl,
        http_auth_user: httpAuth?.user,
        http_auth_password: httpAuth?.password
      };

      const response = await this.client.post('/webhooks', webhookData);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to create webhook: ${error.message}`);
    }
  }

  async deleteWebhook(webhookId) {
    try {
      const response = await this.client.delete(`/webhooks/${webhookId}`);
      return response.data.success;
    } catch (error) {
      throw new Error(`Failed to delete webhook ${webhookId}: ${error.message}`);
    }
  }

  // Generic API call method for flexibility
  async apiCall(method, endpoint, data = null, params = {}) {
    try {
      const config = {
        method,
        url: endpoint,
        params,
        ...(data && { data })
      };

      const response = await this.client(config);
      return response.data;
    } catch (error) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }
}

// Factory function to create client instances
function createPipedriveClient(apiToken, companyDomain = null) {
  if (!apiToken) {
    throw new Error('Pipedrive API token is required');
  }
  return new PipedriveClient(apiToken, companyDomain);
}

// Default client using environment variable
let defaultClient = null;
if (process.env.PIPEDRIVE_API_TOKEN) {
  defaultClient = createPipedriveClient(
    process.env.PIPEDRIVE_API_TOKEN,
    process.env.PIPEDRIVE_COMPANY_DOMAIN
  );
}

module.exports = {
  PipedriveClient,
  createPipedriveClient,
  defaultClient
};