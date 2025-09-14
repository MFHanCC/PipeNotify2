import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import './Dashboard.css';
import './Settings.css';
import { getAuthToken, getTenantId, getAuthHeaders, authenticatedFetch, handleAuthError } from '../utils/auth';

// Lazy load heavy components to improve initial bundle size
const WebhookManager = lazy(() => import('./WebhookManager'));
const RuleFilters = lazy(() => import('./RuleFilters'));
const TemplateEditor = lazy(() => import('./TemplateEditor'));
const ChannelRouting = lazy(() => import('./ChannelRouting'));
const QuietHours = lazy(() => import('./QuietHours'));
const AnalyticsPanel = lazy(() => import('./AnalyticsPanel'));
const NotificationPreview = lazy(() => import('./NotificationPreview'));
const BulkRuleManager = lazy(() => import('./BulkRuleManager'));
const OnboardingWizard = lazy(() => import('./OnboardingWizard'));
const StalledDealMonitor = lazy(() => import('./StalledDealMonitor'));

// Loading component for Suspense fallback
const ComponentLoader: React.FC = () => (
  <div className="component-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

interface NotificationRule {
  id: string;
  name: string;
  eventType: string;
  templateMode: 'simple' | 'compact' | 'detailed' | 'custom';
  targetSpace: string;
  filters: {
    // Value filters
    value_min?: number;
    value_max?: number;
    
    // Probability filters  
    probability_min?: number;
    probability_max?: number;
    
    // Pipeline/Stage filters
    pipeline_ids?: number[];
    stage_ids?: number[];
    
    // Owner filters
    owner_ids?: number[];
    
    // Time restrictions
    time_restrictions?: {
      business_hours_only?: boolean;
      start_hour?: number;
      end_hour?: number;
      weekdays_only?: boolean;
    };
    
    // Label filters
    labels?: string[];
    label_match_type?: 'any' | 'all';
    
    // Currency filters
    currencies?: string[];
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


const Dashboard: React.FC = React.memo(() => {

  // Network status detection
  React.useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Form validation
  const validateCreateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!createFormData.name.trim()) {
      errors.name = 'Rule name is required';
    } else if (createFormData.name.length < 3) {
      errors.name = 'Rule name must be at least 3 characters';
    }
    
    if (!createFormData.target_webhook_id) {
      errors.target_webhook_id = 'Please select a webhook';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Enhanced error handling with retry capability
  const handleApiError = (error: any, operation: string) => {
    let message = `Failed to ${operation}`;
    
    if (networkStatus === 'offline') {
      message = 'Network connection lost. Please check your internet connection.';
    } else if (error?.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error?.status === 403) {
      message = 'Permission denied. Please check your account permissions.';
    } else if (error?.status === 429) {
      message = 'Too many requests. Please wait a moment and try again.';
    } else if (error?.status >= 500) {
      message = 'Server error. Our team has been notified.';
    }
    
    setError(message);
  };
  // State management
  const [stats, setStats] = useState<DashboardStats>({
    totalNotifications: 0,
    successRate: 0,
    activeRules: 0,
    avgDeliveryTime: 0,
  });
  
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [tenantId, setTenantId] = useState<string>('1');
  
  // Filters and pagination
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [logsPage] = useState(1);
  const logsPerPage = 20;
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'logs' | 'webhooks' | 'routing' | 'quiet-hours' | 'stalled-deals' | 'analytics' | 'testing' | 'bulk-management' | 'onboarding' | 'settings'>('overview');
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string; 
    enabled: boolean;
    event_type: string;
    template_mode: 'simple' | 'compact' | 'detailed' | 'custom';
    target_webhook_id: string;
    filters: any;
  }>({
    name: '', 
    enabled: true,
    event_type: 'deal.updated',
    template_mode: 'compact',
    target_webhook_id: '',
    filters: {}
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    event_type: 'deal.updated',
    target_webhook_id: '',
    template_mode: 'compact' as 'simple' | 'compact' | 'detailed' | 'custom',
    custom_template: null as string | null,
    enabled: true,
    filters: {},
  });
  const [availableWebhooks, setAvailableWebhooks] = useState<Array<{id: string; name: string}>>([]);

  // Settings state
  const [settings, setSettings] = useState({
    // Notification Preferences
    emailNotifications: true,
    webhookRetries: true,
    maxRetryAttempts: '3',
    retryDelay: '30',
    
    // Google Chat Settings
    messageFormat: 'compact',
    includeCustomFields: false,
    mentionUsers: false,
    
    // Pipeline Settings
    eventPriority: 'all',
    minimumDealValue: '0',
    excludeTestDeals: true,
    
    // Display Settings
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    currencyDisplay: 'symbol',
    
    // Advanced Settings
    debugMode: false,
    logRetention: '30',
    rateLimiting: true,
  });

  // Retry mechanism
  const retryOperation = async (operation: () => Promise<void>, operationName: string) => {
    setIsRetrying(true);
    setError(null);
    try {
      await operation();
    } catch (error) {
      handleApiError(error, operationName);
    } finally {
      setIsRetrying(false);
    }
  };

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const token = getAuthToken();
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        window.location.href = '/onboarding';
        return;
      }

      const headers = getAuthHeaders();

      // Get tenant ID from JWT token
      const currentTenantId = getTenantId() || '1'; // Fallback
      setTenantId(currentTenantId);

      // Parallel API calls for better performance
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 1;
      const logsParams = new URLSearchParams({
        page: logsPage.toString(),
        limit: logsPerPage.toString(),
        status: statusFilter !== 'all' ? statusFilter : '',
        rule_id: ruleFilter !== 'all' ? ruleFilter : '',
      });

      const [statsResponse, rulesResponse, logsResponse, webhooksResponse] = await Promise.all([
        authenticatedFetch(`${apiUrl}/api/v1/monitoring/dashboard/${currentTenantId}?days=${days}`, { 
          signal: AbortSignal.timeout(10000) // 10 second timeout
        }).catch(() => null),
        authenticatedFetch(`${apiUrl}/api/v1/admin/rules`, { 
          signal: AbortSignal.timeout(10000)
        }).catch(() => null),
        authenticatedFetch(`${apiUrl}/api/v1/admin/logs?${logsParams}`, { 
          signal: AbortSignal.timeout(10000)
        }).catch(() => null),
        authenticatedFetch(`${apiUrl}/api/v1/admin/webhooks`, { 
          signal: AbortSignal.timeout(10000)
        }).catch(() => null),
      ]);

      // Process stats response
      if (statsResponse?.ok) {
        const statsData = await statsResponse.json();
        setStats({
          totalNotifications: statsData.summary?.channel_routing?.total_notifications || 0,
          successRate: statsData.summary?.channel_routing?.avg_success_rate || 0,
          activeRules: statsData.summary?.rule_filters?.total_rules || 0,
          avgDeliveryTime: 250, // Placeholder since monitoring doesn't track delivery time
        });
      } else {
        console.warn('Failed to load stats, using fallback data');
        setStats({
          totalNotifications: 0,
          successRate: 0,
          activeRules: 0,
          avgDeliveryTime: 0,
        });
      }

      // Process rules response
      if (rulesResponse?.ok) {
        const rulesData = await rulesResponse.json();
        const transformedRules = (rulesData.rules || []).map((rule: any) => ({
          id: rule.id,
          name: rule.name,
          eventType: rule.event_type,
          templateMode: rule.template_mode || 'compact',
          targetSpace: rule.webhook_name || 'Unknown',
          filters: rule.filters || {},
          enabled: rule.enabled,
          lastTriggered: rule.last_triggered,
          successRate: 95, // Placeholder - backend doesn't track this yet
          createdAt: rule.created_at,
        }));
        setRules(transformedRules);
        
        // Update stats with actual rule count
        setStats(prevStats => ({
          ...prevStats,
          activeRules: transformedRules.filter((rule: NotificationRule) => rule.enabled).length
        }));
      }

      // Process logs response
      if (logsResponse?.ok) {
        const logsData = await logsResponse.json();
        const transformedLogs = (logsData.logs || []).map((log: any) => ({
          id: log.id,
          ruleId: log.rule_id,
          ruleName: log.rule_name || 'Unknown Rule',
          targetSpace: log.webhook_name || 'Unknown Space',
          status: log.status === 'failed' ? 'error' : log.status === 'success' ? 'success' : 'pending',
          message: log.formatted_message?.text || 'Notification sent',
          errorDetails: log.error_message,
          timestamp: log.created_at,
          deliveryTime: log.response_time_ms,
        }));
        setLogs(transformedLogs);
      } else {
        console.warn('Failed to load logs, using empty array');
        setLogs([]);
      }

      // Process webhooks response
      if (webhooksResponse?.ok) {
        const webhooksData = await webhooksResponse.json();
        console.log('🔗 Webhooks response:', webhooksData);
        setAvailableWebhooks((webhooksData.webhooks || []).map((webhook: any) => ({
          id: webhook.id.toString(),
          name: webhook.name || webhook.url || 'Unnamed Webhook',
        })));
      } else {
        console.error('❌ Failed to load webhooks:', webhooksResponse?.status || 'Network error');
      }

    } catch (err) {
      handleApiError(err, 'load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, statusFilter, ruleFilter, logsPage]);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const toggleRule = async (ruleId: string) => {
    try {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const apiUrl = process.env.REACT_APP_API_URL;
      
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules/${ruleId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          name: rule.name,
          event_type: rule.eventType,
          target_webhook_id: parseInt(rule.targetSpace),
          template_mode: rule.templateMode,
          enabled: !rule.enabled,
          filters: rule.filters || {}
        }),
      });

      if (response.ok) {
        const updatedRules = rules.map(r => 
          r.id === ruleId 
            ? { ...r, enabled: !r.enabled }
            : r
        );
        setRules(updatedRules);
        
        // Update stats with new active rule count
        setStats(prevStats => ({
          ...prevStats,
          activeRules: updatedRules.filter((rule: NotificationRule) => rule.enabled).length
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(`Failed to toggle rule: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Failed to toggle rule');
    }
  };

  const testRule = async (ruleId: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules/${ruleId}/test`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Test notification sent successfully!');
        loadDashboardData(); // Refresh logs
      } else {
        alert('Test notification failed. Check logs for details.');
      }
    } catch (err) {
      alert('Failed to send test notification');
    }
  };

  const startEditRule = (rule: NotificationRule) => {
    setEditingRule(rule.id);
    setEditFormData({
      name: rule.name,
      enabled: rule.enabled,
      event_type: rule.eventType,
      template_mode: rule.templateMode,
      target_webhook_id: rule.targetSpace,
      filters: rule.filters || {}
    });
  };

  const cancelEditRule = () => {
    setEditingRule(null);
    setEditFormData({
      name: '', 
      enabled: true,
      event_type: 'deal.updated',
      template_mode: 'compact',
      target_webhook_id: '',
      filters: {}
    });
  };

  const saveEditRule = async (ruleId: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      
      const requestData = {
        name: editFormData.name,
        enabled: editFormData.enabled,
        event_type: editFormData.event_type,
        template_mode: editFormData.template_mode,
        target_webhook_id: parseInt(editFormData.target_webhook_id),
        filters: editFormData.filters
      };
      
      console.log('🔧 Saving rule with data:', JSON.stringify(requestData, null, 2));
      
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules/${ruleId}`, {
        method: 'PUT',
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        setRules(rules.map(r => 
          r.id === ruleId 
            ? { 
                ...r, 
                name: editFormData.name, 
                enabled: editFormData.enabled,
                eventType: editFormData.event_type,
                templateMode: editFormData.template_mode,
                targetSpace: editFormData.target_webhook_id,
                filters: editFormData.filters
              }
            : r
        ));
        setEditingRule(null);
        setEditFormData({
          name: '', 
          enabled: true,
          event_type: 'deal.updated',
          template_mode: 'compact',
          target_webhook_id: '',
          filters: {}
        });
      } else {
        setError('Failed to update rule');
      }
    } catch (err) {
      setError('Failed to update rule');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const updatedRules = rules.filter(r => r.id !== ruleId);
        setRules(updatedRules);
        setStats(prev => ({ ...prev, activeRules: updatedRules.filter(r => r.enabled).length }));
      }
    } catch (err) {
      setError('Failed to delete rule');
    }
  };

  const openCreateModal = () => {
    setCreateFormData({
      name: '',
      event_type: 'deal.updated',
      target_webhook_id: availableWebhooks[0]?.id || '',
      template_mode: 'compact',
      custom_template: null,
      enabled: true,
      filters: {},
    });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateFormData({
      name: '',
      event_type: 'deal.updated',
      target_webhook_id: '',
      template_mode: 'compact',
      custom_template: null,
      enabled: true,
      filters: {},
    });
  };

  // Settings handlers
  const handleSettingsChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    console.log('🔧 Settings: Save button clicked!');
    try {
      // In a real app, you'd save to backend
      alert('Settings saved successfully! 🎉\n\nNote: This is a demo - settings are not actually persisted.');
      console.log('Settings to save:', settings);
    } catch (error) {
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleResetSettings = () => {
    console.log('🔧 Settings: Reset button clicked!');
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      setSettings({
        // Notification Preferences
        emailNotifications: true,
        webhookRetries: true,
        maxRetryAttempts: '3',
        retryDelay: '30',
        
        // Google Chat Settings
        messageFormat: 'compact',
        includeCustomFields: false,
        mentionUsers: false,
        
        // Pipeline Settings
        eventPriority: 'all',
        minimumDealValue: '0',
        excludeTestDeals: true,
        
        // Display Settings
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        currencyDisplay: 'symbol',
        
        // Advanced Settings
        debugMode: false,
        logRetention: '30',
        rateLimiting: true,
      });
      alert('Settings reset to defaults successfully! 🔄');
    }
  };

  const handleTestConnection = () => {
    alert('🔌 Connection Test\n\nTesting Pipedrive → Google Chat connection...\nThis would verify webhooks, API access, and message delivery.');
  };

  const handleExportLogs = () => {
    alert('📊 Export Logs\n\nThis would export notification logs and analytics data as CSV.\nUseful for compliance and performance analysis.');
  };

  const handleClearCache = () => {
    if (window.confirm('Clear cached data? This will refresh webhook configurations and rule cache.')) {
      alert('🧹 Cache Cleared\n\nWebhook cache and rule configurations refreshed.');
    }
  };

  const testFullPipeline = async () => {
    try {
      console.log('🔍 Running comprehensive pipeline diagnosis...');
      const apiUrl = process.env.REACT_APP_API_URL;
      
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/debug/pipeline-diagnosis`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const diagnosis = await response.json();
        console.log('🔍 Full diagnosis result:', diagnosis);
        
        const summary = diagnosis.summary;
        let alertMessage = `🔍 Pipeline Diagnosis Complete!\n\n`;
        alertMessage += `Status: ${summary.overallStatus}\n`;
        alertMessage += `Steps Completed: ${summary.completedSteps}/${summary.totalSteps}\n`;
        
        if (diagnosis.errors.length > 0) {
          alertMessage += `\n❌ ERRORS (${diagnosis.errors.length}):\n`;
          diagnosis.errors.forEach((error: string, index: number) => {
            alertMessage += `${index + 1}. ${error}\n`;
          });
        }
        
        if (diagnosis.warnings.length > 0) {
          alertMessage += `\n⚠️ WARNINGS (${diagnosis.warnings.length}):\n`;
          diagnosis.warnings.forEach((warning: string, index: number) => {
            alertMessage += `${index + 1}. ${warning}\n`;
          });
        }
        
        if (diagnosis.testResult) {
          alertMessage += `\n🧪 TEST RESULTS:\n`;
          alertMessage += `Rules Matched: ${diagnosis.testResult.rulesMatched}\n`;
          alertMessage += `Notifications Sent: ${diagnosis.testResult.notificationsSent}\n`;
        }
        
        alertMessage += `\n📊 Check console for detailed diagnosis report.`;
        alert(alertMessage);
      } else {
        const errorData = await response.json();
        console.error('❌ Pipeline diagnosis failed:', errorData);
        alert(`Diagnosis failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Pipeline diagnosis error:', error);
      alert(`Diagnosis error: ${errorMessage}`);
    }
  };

  const createNewRule = async () => {
    // Clear previous validation errors
    setValidationErrors({});
    
    // Validate form
    if (!validateCreateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules`, {
        method: 'POST',
        body: JSON.stringify({
          name: createFormData.name.trim(),
          event_type: createFormData.event_type,
          target_webhook_id: parseInt(createFormData.target_webhook_id),
          template_mode: createFormData.template_mode,
          custom_template: createFormData.custom_template || null,
          enabled: createFormData.enabled,
          filters: createFormData.filters,
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout for create operations
      });

      if (response.ok) {
        // Refresh the dashboard data to show the new rule
        await loadDashboardData();
        setStats(prev => ({ ...prev, activeRules: prev.activeRules + 1 }));
        closeCreateModal();
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 422 && errorData.validation_errors) {
          setValidationErrors(errorData.validation_errors);
        } else {
          handleApiError({ status: response.status }, 'create rule');
        }
      }
    } catch (err) {
      handleApiError(err, 'create rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'success';
    if (rate >= 85) return 'warning';
    return 'error';
  };

  const renderOverview = () => (
    <div className="overview-section">
      <div className="stats-grid stats-2x2">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalNotifications.toLocaleString()}</div>
            <div className="stat-label">Total Notifications</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className={`stat-value ${getSuccessRateColor(stats.successRate)}`}>
              {stats.successRate.toFixed(1)}%
            </div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeRules}</div>
            <div className="stat-label">Active Rules</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🚀</div>
          <div className="stat-content">
            <div className="stat-value">{stats.avgDeliveryTime}ms</div>
            <div className="stat-label">Avg Delivery Time</div>
          </div>
        </div>
      </div>
      
      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {logs.slice(0, 5).map((log) => (
            <div key={log.id} className="activity-item">
              <div className="activity-icon">{getStatusIcon(log.status)}</div>
              <div className="activity-content">
                <div className="activity-title">{log.ruleName}</div>
                <div className="activity-subtitle">
                  {log.targetSpace} • {formatTimestamp(log.timestamp)}
                </div>
              </div>
              {log.status === 'error' && (
                <div className="activity-error" title={log.errorDetails}>
                  ⚠️
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRules = () => (
    <div className="rules-section">
      <div className="section-header">
        <h3>Notification Rules</h3>
        <button 
          className="create-rule-button"
          onClick={openCreateModal}
          aria-label="Create new notification rule"
          type="button"
        >
          + Create Rule
        </button>
      </div>
      
      <div className="rules-list">
        {rules.map((rule) => (
          <div key={rule.id} className="rule-card">
            <div className="rule-header">
              <div className="rule-info">
                {editingRule === rule.id ? (
                  <div className="edit-form">
                    <div className="form-group">
                      <label htmlFor="edit-rule-name">Rule Name *</label>
                      <input
                        id="edit-rule-name"
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                        placeholder="e.g., Deal Won Notifications"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="edit-event-type">Event Type *</label>
                      <select
                        id="edit-event-type"
                        value={editFormData.event_type}
                        onChange={(e) => setEditFormData({...editFormData, event_type: e.target.value})}
                        className="form-select"
                      >
                        <option value="deal.updated">Deal Updated</option>
                        <option value="deal.won">Deal Won</option>
                        <option value="deal.lost">Deal Lost</option>
                        <option value="deal.added">Deal Added</option>
                        <option value="person.added">Person Added</option>
                        <option value="person.updated">Person Updated</option>
                        <option value="activity.added">Activity Added</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="edit-target-webhook">Target Google Chat *</label>
                      <select
                        id="edit-target-webhook"
                        value={editFormData.target_webhook_id}
                        onChange={(e) => setEditFormData({...editFormData, target_webhook_id: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Select a webhook</option>
                        {availableWebhooks.length === 0 ? (
                          <option value="" disabled>No webhooks available - go through onboarding first</option>
                        ) : (
                          availableWebhooks.map(webhook => (
                            <option key={webhook.id} value={webhook.id}>
                              {webhook.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Message Template Editor */}
                    <TemplateEditor
                      value={{
                        template_mode: editFormData.template_mode,
                        custom_template: undefined
                      }}
                      onChange={(templateData) => setEditFormData({
                        ...editFormData,
                        template_mode: templateData.template_mode
                      })}
                      eventType={editFormData.event_type}
                    />

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editFormData.enabled}
                          onChange={(e) => setEditFormData({...editFormData, enabled: e.target.checked})}
                        />
                        <span>Enable rule</span>
                      </label>
                    </div>
                    
                    {/* Advanced Filters */}
                    <RuleFilters
                      filters={editFormData.filters}
                      onChange={(filters) => setEditFormData({...editFormData, filters})}
                    />

                    <div className="edit-actions">
                      <button
                        className="save-button"
                        onClick={() => saveEditRule(rule.id)}
                        disabled={!editFormData.name.trim() || !editFormData.target_webhook_id}
                        aria-label={`Save changes to rule ${rule.name}`}
                        type="button"
                      >
                        ✓ Save
                      </button>
                      <button
                        className="cancel-button"
                        onClick={cancelEditRule}
                        aria-label={`Cancel editing rule ${rule.name}`}
                        type="button"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4>{rule.name}</h4>
                    <div className="rule-meta">
                      <span className="event-type">{rule.eventType}</span>
                      <span className="template-mode">{rule.templateMode}</span>
                      <span className="target-space">→ {rule.targetSpace}</span>
                    </div>
                    
                    {/* Display filters if any exist */}
                    {(rule.filters && Object.keys(rule.filters).length > 0) && (
                      <div className="rule-filters">
                        <strong>Filters:</strong>
                        {rule.filters.value_min && <span className="filter">Min Value: ${rule.filters.value_min}</span>}
                        {rule.filters.value_max && <span className="filter">Max Value: ${rule.filters.value_max}</span>}
                        {rule.filters.probability_min && <span className="filter">Min Probability: {rule.filters.probability_min}%</span>}
                        {rule.filters.probability_max && <span className="filter">Max Probability: {rule.filters.probability_max}%</span>}
                        {rule.filters.pipeline_ids?.length && rule.filters.pipeline_ids.length > 0 && <span className="filter">Pipelines: {rule.filters.pipeline_ids.length} selected</span>}
                        {rule.filters.stage_ids?.length && rule.filters.stage_ids.length > 0 && <span className="filter">Stages: {rule.filters.stage_ids.length} selected</span>}
                        {rule.filters.owner_ids?.length && rule.filters.owner_ids.length > 0 && <span className="filter">Owners: {rule.filters.owner_ids.length} selected</span>}
                        {rule.filters.labels?.length && rule.filters.labels.length > 0 && <span className="filter">Labels: {rule.filters.labels.join(', ')}</span>}
                        {rule.filters.currencies?.length && rule.filters.currencies.length > 0 && <span className="filter">Currencies: {rule.filters.currencies.join(', ')}</span>}
                        {rule.filters.time_restrictions?.business_hours_only && <span className="filter">Business Hours Only</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="rule-controls">
                <div className="rule-stats">
                  <div className={`success-rate ${getSuccessRateColor(rule.successRate)}`}>
                    {rule.successRate.toFixed(1)}%
                  </div>
                  {rule.lastTriggered && (
                    <div className="last-triggered">
                      Last: {formatTimestamp(rule.lastTriggered)}
                    </div>
                  )}
                </div>
                
                <div className="rule-actions">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                      aria-label={`Toggle rule ${rule.name} ${rule.enabled ? 'on' : 'off'}`}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  
                  <button
                    className="test-button"
                    onClick={() => testRule(rule.id)}
                    aria-label={`Test rule ${rule.name}`}
                    type="button"
                  >
                    Test
                  </button>
                  
                  <button
                    className="edit-button"
                    onClick={() => startEditRule(rule)}
                    aria-label={`Edit rule ${rule.name}`}
                    disabled={editingRule !== null}
                    type="button"
                  >
                    Edit
                  </button>
                  
                  <button
                    className="delete-button"
                    onClick={() => deleteRule(rule.id)}
                    aria-label={`Delete rule ${rule.name}`}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            
            {(rule.filters && Object.keys(rule.filters).length > 0) && (
              <div className="rule-filters">
                <strong>Filters:</strong>
                {rule.filters.value_min && <span className="filter">Min Value: ${rule.filters.value_min}</span>}
                {rule.filters.value_max && <span className="filter">Max Value: ${rule.filters.value_max}</span>}
                {rule.filters.probability_min && <span className="filter">Min Probability: {rule.filters.probability_min}%</span>}
                {rule.filters.probability_max && <span className="filter">Max Probability: {rule.filters.probability_max}%</span>}
                {rule.filters.pipeline_ids?.length && rule.filters.pipeline_ids.length > 0 && <span className="filter">Pipelines: {rule.filters.pipeline_ids.length} selected</span>}
                {rule.filters.stage_ids?.length && rule.filters.stage_ids.length > 0 && <span className="filter">Stages: {rule.filters.stage_ids.length} selected</span>}
                {rule.filters.owner_ids?.length && rule.filters.owner_ids.length > 0 && <span className="filter">Owners: {rule.filters.owner_ids.length} selected</span>}
                {rule.filters.labels?.length && rule.filters.labels.length > 0 && <span className="filter">Labels: {rule.filters.labels.join(', ')}</span>}
                {rule.filters.currencies?.length && rule.filters.currencies.length > 0 && <span className="filter">Currencies: {rule.filters.currencies.join(', ')}</span>}
                {rule.filters.time_restrictions?.business_hours_only && <span className="filter">Business Hours Only</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {rules.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No notification rules yet</h3>
          <p>Create your first rule to start receiving notifications in Google Chat.</p>
          <button 
            className="create-first-rule"
            onClick={openCreateModal}
            aria-label="Create your first notification rule"
            type="button"
          >
            Create First Rule
          </button>
        </div>
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="logs-section">
      <div className="section-header">
        <h3>Delivery Logs</h3>
        <div className="logs-filters">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
          </select>
          
          <select 
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
          >
            <option value="all">All Rules</option>
            {rules.map(rule => (
              <option key={rule.id} value={rule.id}>{rule.name}</option>
            ))}
          </select>
          
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>
      
      <div className="logs-table">
        <div className="logs-header">
          <div className="log-timestamp">Timestamp</div>
          <div className="log-rule">Rule</div>
          <div className="log-target">Target</div>
          <div className="log-status">Status</div>
          <div className="log-message">Message</div>
        </div>
        
        <div className="logs-body">
          {logs.map((log) => (
            <div key={log.id} className={`log-row ${log.status}`}>
              <div className="log-timestamp">{formatTimestamp(log.timestamp)}</div>
              <div className="log-rule">{log.ruleName}</div>
              <div className="log-target">{log.targetSpace}</div>
              <div className="log-status">
                <span className={`status-badge ${log.status}`}>
                  {getStatusIcon(log.status)} {log.status}
                </span>
              </div>
              <div className="log-message">
                {log.message}
                {log.errorDetails && (
                  <details className="error-details">
                    <summary>Error Details</summary>
                    <pre>{log.errorDetails}</pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {logs.length === 0 && (
        <div className="empty-logs">
          <div className="empty-icon">📄</div>
          <h3>No logs found</h3>
          <p>No delivery logs match your current filters.</p>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard dashboard-with-sidebar">
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <div className="error-content">
            <span className="error-message">{error}</span>
            {networkStatus === 'offline' && (
              <div className="network-status">
                📶 You're currently offline. Check your connection and try again.
              </div>
            )}
          </div>
          <div className="error-actions">
            <button 
              className="retry-button"
              onClick={() => retryOperation(loadDashboardData, 'reload dashboard')}
              disabled={isRetrying}
              aria-label="Retry loading dashboard data"
              type="button"
            >
              {isRetrying ? '⏳' : '🔄'} Retry
            </button>
            <button 
              className="error-close"
              onClick={() => setError(null)}
              aria-label="Close error message"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h1>Pipedrive → Google Chat</h1>
          <p>Monitor and manage your notification rules and delivery logs</p>
        </div>
        
        <nav className="sidebar-nav" role="navigation" aria-label="Dashboard navigation">
          <button 
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            aria-label="Overview dashboard"
            aria-current={activeTab === 'overview' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">📊</span> Overview
          </button>
          <button 
            className={`nav-tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
            aria-label={`Rules management, ${stats.activeRules} active rules`}
            aria-current={activeTab === 'rules' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">⚙️</span> Rules ({stats.activeRules})
          </button>
          <button 
            className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
            aria-label="View notification logs"
            aria-current={activeTab === 'logs' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">📋</span> Logs
          </button>
          <button 
            className={`nav-tab ${activeTab === 'webhooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('webhooks')}
            aria-label={`Webhook management, ${availableWebhooks.length} webhooks`}
            aria-current={activeTab === 'webhooks' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">🔗</span> Webhooks ({availableWebhooks.length})
          </button>
          <button 
            className={`nav-tab ${activeTab === 'routing' ? 'active' : ''}`}
            onClick={() => setActiveTab('routing')}
            aria-label="Smart routing configuration"
            aria-current={activeTab === 'routing' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">🎯</span> Smart Routing
          </button>
          <button 
            className={`nav-tab ${activeTab === 'quiet-hours' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiet-hours')}
            aria-label="Quiet hours settings"
            aria-current={activeTab === 'quiet-hours' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">🔕</span> Quiet Hours
          </button>
          <button 
            className={`nav-tab ${activeTab === 'stalled-deals' ? 'active' : ''}`}
            onClick={() => setActiveTab('stalled-deals')}
            aria-label="Stalled deals monitoring"
            aria-current={activeTab === 'stalled-deals' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">📊</span> Stalled Deals
          </button>
          <button 
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
            aria-label="Analytics and reporting"
            aria-current={activeTab === 'analytics' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">📊</span> Analytics
          </button>
          <button 
            className={`nav-tab ${activeTab === 'testing' ? 'active' : ''}`}
            onClick={() => setActiveTab('testing')}
            aria-label="Notification testing"
            aria-current={activeTab === 'testing' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">🧪</span> Testing
          </button>
          <button 
            className={`nav-tab ${activeTab === 'bulk-management' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk-management')}
            aria-label="Bulk rule management"
            aria-current={activeTab === 'bulk-management' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">📋</span> Bulk Management
          </button>
          <button 
            className={`nav-tab ${activeTab === 'onboarding' ? 'active' : ''}`}
            onClick={() => setActiveTab('onboarding')}
            aria-label="Setup and onboarding"
            aria-current={activeTab === 'onboarding' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">🎓</span> Onboarding
          </button>
          <button 
            className="nav-tab"
            onClick={() => window.location.href = '/billing'}
            aria-label="Billing and subscription management"
            type="button"
          >
            <span aria-hidden="true">💳</span> Billing
          </button>
          <button 
            className="nav-tab"
            onClick={() => window.location.href = '/pricing'}
            aria-label="View pricing plans"
            type="button"
          >
            <span aria-hidden="true">💎</span> Pricing
          </button>
          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            aria-label="Application settings and preferences"
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            type="button"
          >
            <span aria-hidden="true">⚙️</span> Settings
          </button>
        </nav>
      </aside>
      
      <main className="dashboard-main" role="main" aria-label="Dashboard content">
        <div className="dashboard-content">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'rules' && renderRules()}
          {activeTab === 'logs' && renderLogs()}
          {activeTab === 'webhooks' && (
            <Suspense fallback={<ComponentLoader />}>
              <WebhookManager 
                onWebhooksChange={(webhooks) => {
                  setAvailableWebhooks(webhooks.map(w => ({ id: w.id, name: w.name })));
                }}
              />
            </Suspense>
          )}
          {activeTab === 'routing' && (
            <Suspense fallback={<ComponentLoader />}>
              <ChannelRouting 
                webhooks={availableWebhooks.map(w => ({ ...w, is_active: true, description: '' }))}
                onRefresh={loadDashboardData}
              />
            </Suspense>
          )}
          {activeTab === 'quiet-hours' && (
            <Suspense fallback={<ComponentLoader />}>
              <QuietHours 
                onRefresh={loadDashboardData}
              />
            </Suspense>
          )}
          {activeTab === 'stalled-deals' && (
            <Suspense fallback={<ComponentLoader />}>
              <StalledDealMonitor 
                webhooks={availableWebhooks.map(w => ({ ...w, is_active: true }))}
                onRefresh={loadDashboardData}
              />
            </Suspense>
          )}
          {activeTab === 'analytics' && (
            <Suspense fallback={<ComponentLoader />}>
              <AnalyticsPanel 
                tenantId={tenantId}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </Suspense>
          )}
          {activeTab === 'testing' && (
            <div className="testing-section">
              <div className="section-header">
                <h3>🧪 Pipeline Testing</h3>
                <p>Test the complete Pipedrive → Google Chat notification pipeline</p>
              </div>
              
              <div className="testing-content">
                <div className="test-card">
                  <h4>🔍 Pipeline Diagnosis</h4>
                  <p>Comprehensive diagnosis of the notification pipeline:</p>
                  <ul>
                    <li>🔍 Redis connection & queue status</li>
                    <li>🏢 Tenant lookup verification</li>
                    <li>📋 Active rules analysis</li>
                    <li>🔗 Google Chat webhook validation</li>
                    <li>🧪 End-to-end pipeline test</li>
                    <li>📊 Recent logs examination</li>
                  </ul>
                  <button 
                    className="button-primary test-pipeline-btn"
                    onClick={testFullPipeline}
                  >
                    🔍 Run Full Diagnosis
                  </button>
                </div>
                
                <div className="test-card">
                  <h4>🔍 Component Testing</h4>
                  <Suspense fallback={<ComponentLoader />}>
                    <NotificationPreview 
                      onRefresh={loadDashboardData}
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'bulk-management' && (
            <Suspense fallback={<ComponentLoader />}>
              <BulkRuleManager 
                onRefresh={loadDashboardData}
              />
            </Suspense>
          )}
          {activeTab === 'onboarding' && (
            <Suspense fallback={<ComponentLoader />}>
              <OnboardingWizard 
                onComplete={() => setActiveTab('overview')}
                onSkip={() => setActiveTab('overview')}
              />
            </Suspense>
          )}
          {activeTab === 'settings' && (
            <div className="settings-section">
              <div className="section-header">
                <h3>⚙️ Settings</h3>
                <p>Configure your Pipedrive → Google Chat integration preferences</p>
              </div>
              
              <div className="settings-content">
                <div className="settings-category">
                  <h4>🔔 Notification Preferences</h4>
                  <div className="setting-item">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={settings.emailNotifications}
                        onChange={(e) => handleSettingsChange('emailNotifications', e.target.checked)}
                      />
                      <span>Enable email notifications for system alerts</span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label htmlFor="message-format">Default message format</label>
                    <select 
                      id="message-format" 
                      className="form-select"
                      value={settings.messageFormat}
                      onChange={(e) => handleSettingsChange('messageFormat', e.target.value)}
                    >
                      <option value="simple">Simple</option>
                      <option value="compact">Compact</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={settings.includeCustomFields}
                        onChange={(e) => handleSettingsChange('includeCustomFields', e.target.checked)}
                      />
                      <span>Include custom fields in notifications</span>
                    </label>
                  </div>
                </div>

                <div className="settings-category">
                  <h4>🌐 Display & Formatting</h4>
                  <div className="setting-item">
                    <label htmlFor="timezone-select">Timezone</label>
                    <select 
                      id="timezone-select" 
                      className="form-select"
                      value={settings.timezone}
                      onChange={(e) => handleSettingsChange('timezone', e.target.value)}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (EST/EDT)</option>
                      <option value="America/Chicago">Central Time (CST/CDT)</option>
                      <option value="America/Denver">Mountain Time (MST/MDT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Berlin">Central Europe (CET/CEST)</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label htmlFor="date-format">Date format</label>
                    <select 
                      id="date-format" 
                      className="form-select"
                      value={settings.dateFormat}
                      onChange={(e) => handleSettingsChange('dateFormat', e.target.value)}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label htmlFor="currency-display">Currency display</label>
                    <select 
                      id="currency-display" 
                      className="form-select"
                      value={settings.currencyDisplay}
                      onChange={(e) => handleSettingsChange('currencyDisplay', e.target.value)}
                    >
                      <option value="symbol">Symbol ($1,234)</option>
                      <option value="code">Code (USD 1,234)</option>
                      <option value="name">Name (1,234 dollars)</option>
                    </select>
                  </div>
                </div>

                <div className="settings-category">
                  <h4>🔧 Integration Settings</h4>
                  <div className="setting-item">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={settings.webhookRetries}
                        onChange={(e) => handleSettingsChange('webhookRetries', e.target.checked)}
                      />
                      <span>Enable webhook retries on delivery failure</span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label htmlFor="retry-attempts">Maximum retry attempts</label>
                    <select 
                      id="retry-attempts" 
                      className="form-select"
                      value={settings.maxRetryAttempts}
                      onChange={(e) => handleSettingsChange('maxRetryAttempts', e.target.value)}
                    >
                      <option value="1">1 attempt</option>
                      <option value="3">3 attempts</option>
                      <option value="5">5 attempts</option>
                      <option value="10">10 attempts</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label htmlFor="retry-delay">Retry delay (seconds)</label>
                    <select 
                      id="retry-delay" 
                      className="form-select"
                      value={settings.retryDelay}
                      onChange={(e) => handleSettingsChange('retryDelay', e.target.value)}
                    >
                      <option value="10">10 seconds</option>
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                      <option value="300">5 minutes</option>
                    </select>
                  </div>
                </div>
                
                <div className="settings-category">
                  <h4>🛠️ Tools & Maintenance</h4>
                  <div className="setting-item">
                    <button className="button-secondary" onClick={handleTestConnection}>
                      🔌 Test Connection
                    </button>
                    <span className="setting-description">Test Pipedrive → Google Chat connectivity</span>
                  </div>
                  <div className="setting-item">
                    <button className="button-secondary" onClick={handleExportLogs}>
                      📊 Export Logs
                    </button>
                    <span className="setting-description">Download notification logs and analytics</span>
                  </div>
                  <div className="setting-item">
                    <button className="button-secondary" onClick={handleClearCache}>
                      🧹 Clear Cache
                    </button>
                    <span className="setting-description">Refresh webhook cache and configurations</span>
                  </div>
                </div>

                <div className="settings-actions">
                  <button className="button-primary" onClick={handleSaveSettings}>
                    💾 Save Settings
                  </button>
                  <button className="button-secondary" onClick={handleResetSettings}>
                    🔄 Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div 
          className="modal-overlay" 
          onClick={closeCreateModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="modal-title">Create New Rule</h3>
              <button 
                className="modal-close" 
                onClick={closeCreateModal}
                aria-label="Close dialog"
                type="button"
              >×</button>
            </div>
            
            <div className="modal-body" id="modal-description">
              <div className="form-group">
                <label htmlFor="rule-name">Rule Name *</label>
                <input
                  id="rule-name"
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                  placeholder="e.g., Deal Won Notifications"
                  className="form-input"
                  aria-required="true"
                  aria-describedby="rule-name-help"
                />
                <div id="rule-name-help" className="sr-only">Enter a descriptive name for your notification rule</div>
                {validationErrors.name && (
                  <div className="validation-error" role="alert">
                    {validationErrors.name}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="event-type">Event Type *</label>
                <select
                  id="event-type"
                  value={createFormData.event_type}
                  onChange={(e) => setCreateFormData({...createFormData, event_type: e.target.value})}
                  className="form-select"
                  aria-required="true"
                  aria-describedby="event-type-help"
                >
                  <option value="deal.updated">Deal Updated</option>
                  <option value="deal.won">Deal Won</option>
                  <option value="deal.lost">Deal Lost</option>
                  <option value="deal.added">Deal Added</option>
                  <option value="person.added">Person Added</option>
                  <option value="person.updated">Person Updated</option>
                  <option value="activity.added">Activity Added</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="target-webhook">Target Google Chat *</label>
                <select
                  id="target-webhook"
                  value={createFormData.target_webhook_id}
                  onChange={(e) => setCreateFormData({...createFormData, target_webhook_id: e.target.value})}
                  className="form-select"
                  aria-required="true"
                  aria-describedby="target-webhook-help"
                >
                  <option value="">Select a webhook</option>
                  {availableWebhooks.length === 0 ? (
                    <option value="" disabled>No webhooks available - go through onboarding first</option>
                  ) : (
                    availableWebhooks.map(webhook => (
                      <option key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </option>
                    ))
                  )}
                </select>
                <div id="target-webhook-help" className="sr-only">Select the Google Chat webhook where notifications will be sent</div>
                {validationErrors.target_webhook_id && (
                  <div className="validation-error" role="alert">
                    {validationErrors.target_webhook_id}
                  </div>
                )}
                {availableWebhooks.length === 0 && (
                  <div className="form-help">
                    <p style={{fontSize: '12px', color: '#6b7280', marginTop: '4px'}}>
                      No Google Chat webhooks found. Complete onboarding first to set up your Google Chat integration.
                    </p>
                    <button 
                      type="button"
                      onClick={() => window.location.href = '/onboarding'} 
                      className="button-secondary"
                      style={{marginTop: '8px', fontSize: '12px', padding: '6px 12px'}}
                    >
                      Go to Onboarding
                    </button>
                  </div>
                )}
              </div>

              {/* Message Template Editor */}
              <TemplateEditor
                value={{
                  template_mode: createFormData.template_mode,
                  custom_template: createFormData.custom_template
                }}
                onChange={(templateData) => setCreateFormData({
                  ...createFormData,
                  template_mode: templateData.template_mode,
                  custom_template: templateData.custom_template || null
                })}
                eventType={createFormData.event_type}
              />

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={createFormData.enabled}
                    onChange={(e) => setCreateFormData({...createFormData, enabled: e.target.checked})}
                  />
                  <span>Enable rule immediately</span>
                </label>
              </div>
              
              {/* Advanced Filters */}
              <RuleFilters
                filters={createFormData.filters}
                onChange={(filters) => setCreateFormData({...createFormData, filters})}
              />
            </div>

            <div className="modal-footer">
              <button className="button-secondary" onClick={closeCreateModal}>
                Cancel
              </button>
              <button 
                className="button-primary" 
                onClick={createNewRule}
                disabled={isSubmitting || !createFormData.name.trim() || !createFormData.target_webhook_id}
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <span className="loading-spinner-inline"></span>
                    Creating...
                  </>
                ) : (
                  'Create Rule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;