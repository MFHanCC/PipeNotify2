// Pipedrive → Google Chat Integration API Service
// Handles all backend communication for Railway-hosted API

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Types for API responses
interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface NotificationRule {
  id: string;
  name: string;
  eventType: string;
  templateMode: 'compact' | 'detailed';
  targetSpace: string;
  filters: {
    pipeline?: string;
    stage?: string;
    owner?: string;
    minValue?: number;
  };
  enabled: boolean;
  lastTriggered?: string;
  successRate: number;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  ruleId: string;
  ruleName: string;
  targetSpace: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  errorDetails?: string;
  timestamp: string;
  deliveryTime?: number;
}

interface DashboardStats {
  totalNotifications: number;
  successRate: number;
  activeRules: number;
  avgDeliveryTime: number;
}

interface PlanDetails {
  tier: 'free' | 'starter' | 'pro' | 'team';
  name: string;
  price: number;
  notifications_limit: number;
  webhooks_limit: number;
  rules_limit: number;
  features: string[];
}

interface Subscription {
  id: string;
  tenant_id: number;
  stripe_subscription_id: string;
  plan_tier: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  metadata: any;
}

interface UsageStats {
  notifications_used: number;
  notifications_limit: number;
  usage_percentage: number;
  webhooks_used: number;
  webhooks_limit: number;
  rules_used: number;
  rules_limit: number;
  plan_tier: string;
}

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    return this.handleResponse(response);
  }

  // Authentication
  async handleOAuthCallback(code: string, state?: string): Promise<{ 
    success: boolean; 
    token: string; 
    user: { id: number; name: string; company: string; apiDomain: string }; 
    tenantId: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Don't include auth headers for callback
      body: JSON.stringify({ code, state }),
    });
    return this.handleResponse(response);
  }

  async refreshOAuthToken(): Promise<{ success: boolean; access_token: string; expires_in: number }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/oauth/refresh`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getOAuthStatus(): Promise<{ 
    connected: boolean; 
    expired?: boolean; 
    apiDomain?: string; 
    connectedAt?: string; 
    expiresAt?: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/oauth/status`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // Webhook management
  async validateWebhook(url: string): Promise<{ valid: boolean; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/webhooks/validate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ webhook_url: url }),
    });
    return this.handleResponse(response);
  }

  async getWebhooks(): Promise<Array<{ id: string; name: string; webhook_url: string; description?: string }>> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/webhooks`, {
      headers: this.getAuthHeaders(),
    });
    const result = await this.handleResponse<{ webhooks: any[] }>(response);
    return result.webhooks.map(webhook => ({
      id: webhook.id.toString(),
      name: webhook.name,
      webhook_url: webhook.webhook_url,
      description: webhook.description
    }));
  }

  async createWebhook(webhook: { name: string; webhook_url: string; description?: string }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/webhooks`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(webhook),
    });
    return this.handleResponse(response);
  }

  // Rules management
  async getRules(): Promise<NotificationRule[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/rules`, {
      headers: this.getAuthHeaders(),
    });
    const result = await this.handleResponse<{ rules: any[] }>(response);
    
    // Transform backend format to frontend format
    return result.rules.map(rule => ({
      id: rule.id.toString(),
      name: rule.name,
      eventType: rule.event_type,
      templateMode: rule.template_mode === 'detailed' ? 'detailed' : 'compact',
      targetSpace: rule.webhook_name || `Webhook ${rule.target_webhook_id}`,
      filters: typeof rule.filters === 'string' ? JSON.parse(rule.filters) : rule.filters,
      enabled: rule.enabled,
      lastTriggered: rule.updated_at,
      successRate: 95, // Mock for now, will be calculated from logs
      createdAt: rule.created_at
    }));
  }

  async createRule(rule: Omit<NotificationRule, 'id' | 'createdAt' | 'lastTriggered' | 'successRate'>): Promise<NotificationRule> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/rules`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        name: rule.name,
        event_type: rule.eventType,
        filters: rule.filters,
        target_webhook_id: rule.targetSpace, // This should be webhook ID
        template_mode: rule.templateMode,
        enabled: rule.enabled
      }),
    });
    return this.handleResponse(response);
  }

  async updateRule(id: string, updates: Partial<NotificationRule>): Promise<NotificationRule> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/rules/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        ...(updates.name && { name: updates.name }),
        ...(updates.eventType && { event_type: updates.eventType }),
        ...(updates.filters && { filters: updates.filters }),
        ...(updates.templateMode && { template_mode: updates.templateMode }),
        ...(updates.hasOwnProperty('enabled') && { enabled: updates.enabled })
      }),
    });
    return this.handleResponse(response);
  }

  async deleteRule(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/rules/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `Failed to delete rule: ${response.status}`);
    }
  }

  async testRule(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/rules/${id}/test`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // Test notification (for onboarding)
  async testNotification(payload: {
    templateId: string;
    webhookId: string;
    filters: any;
  }): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/test/notification`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse(response);
  }

  // Dashboard data
  async getDashboardStats(range: string = '7d'): Promise<DashboardStats> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/stats`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // Logs management
  async getLogs(params?: {
    page?: number;
    limit?: number;
    status?: string;
    rule?: string;
    range?: string;
  }): Promise<{ logs: DeliveryLog[]; total: number; page: number; hasMore: boolean }> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status && params.status !== 'all') searchParams.append('status', params.status);
    if (params?.rule && params.rule !== 'all') searchParams.append('rule', params.rule);
    if (params?.range) searchParams.append('range', params.range);

    const response = await fetch(`${API_BASE_URL}/api/v1/admin/logs?${searchParams}`, {
      headers: this.getAuthHeaders(),
    });
    const result = await this.handleResponse<{ logs: any[]; total: number; page: number; has_more: boolean }>(response);
    
    // Transform backend format to frontend format
    return {
      logs: result.logs.map(log => ({
        id: log.id.toString(),
        ruleId: log.rule_id?.toString() || '',
        ruleName: log.rule_name || 'Unknown Rule',
        targetSpace: log.webhook_name || 'Unknown Webhook',
        status: log.status as 'success' | 'error' | 'pending',
        message: log.formatted_message ? JSON.stringify(log.formatted_message) : 'Notification sent',
        errorDetails: log.error_message || undefined,
        timestamp: log.created_at,
        deliveryTime: log.response_time_ms
      })),
      total: result.total,
      page: result.page,
      hasMore: result.has_more
    };
  }

  // Integration activation (for onboarding completion)
  async activateIntegration(payload: {
    webhooks: Array<{ id: string; name: string; url: string }>;
    templates: Array<{ id: string; mode: 'compact' | 'detailed' }>;
    rules: Array<any>;
  }): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/integration/activate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse(response);
  }

  // Pipedrive data (for dropdowns and previews)
  async getPipelines(): Promise<Array<{ id: string; name: string }>> {
    const response = await fetch(`${API_BASE_URL}/api/v1/pipedrive/pipelines`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getStages(pipelineId?: string): Promise<Array<{ id: string; name: string; pipelineId: string }>> {
    const params = pipelineId ? `?pipeline=${pipelineId}` : '';
    const response = await fetch(`${API_BASE_URL}/api/v1/pipedrive/stages${params}`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getUsers(): Promise<Array<{ id: string; name: string; email: string }>> {
    const response = await fetch(`${API_BASE_URL}/api/v1/pipedrive/users`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // Template previews
  async getTemplatePreview(templateId: string, mode: 'compact' | 'detailed' = 'compact'): Promise<{ 
    preview: string; 
    sampleData: any 
  }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/templates/${templateId}/preview?mode=${mode}`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // Billing and subscription management
  async getPlans(): Promise<PlanDetails[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/plans`, {
      headers: this.getAuthHeaders(),
    });
    const data = await this.handleResponse(response) as any;
    
    // Convert plans object to array format expected by frontend
    if (data.plans) {
      return Object.entries(data.plans).map(([tier, plan]: [string, any]) => ({
        tier: tier as 'free' | 'starter' | 'pro' | 'team',
        name: plan.name,
        price: plan.price || 0,
        price_id: plan.price_id,
        features: plan.features,
        notifications_limit: plan.limits.notifications,
        webhooks_limit: plan.limits.webhooks,
        rules_limit: plan.limits.rules,
        log_retention_days: plan.limits.log_retention_days
      }));
    }
    
    return [];
  }

  async getCurrentSubscription(): Promise<{ subscription: Subscription | null; usage: UsageStats }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/subscription`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async createCheckoutSession(planTier: string): Promise<{ checkout_url: string; session_id: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ plan_tier: planTier }),
    });
    return this.handleResponse(response);
  }

  async createPortalSession(): Promise<{ portal_url: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/portal`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async cancelSubscription(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getUsageHistory(months: number = 6): Promise<Array<{
    month: string;
    notifications_used: number;
    notifications_limit: number;
    usage_percentage: number;
  }>> {
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/usage-history?months=${months}`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getFeatureAccess(): Promise<{ [featureName: string]: { has_access: boolean; plan_required: string } }> {
    // This would need tenant ID in real implementation
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/features/1`, {
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // Error handling utility
  static isNetworkError(error: Error): boolean {
    return error.message.includes('Network error') || 
           error.message.includes('Failed to fetch') ||
           error.message.includes('ERR_NETWORK');
  }

  static isAuthError(error: Error): boolean {
    return error.message.includes('401') || 
           error.message.includes('Unauthorized') ||
           error.message.includes('Invalid token');
  }
}

// Export singleton instance
const apiService = new ApiService();
export default apiService;

// Export types for components to use
export type {
  NotificationRule,
  DeliveryLog,
  DashboardStats,
  PlanDetails,
  Subscription,
  UsageStats,
  ApiResponse
};