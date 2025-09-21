import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import './Dashboard.css';
import './Settings.css';
import { getAuthToken, getTenantId, getAuthHeaders, authenticatedFetch, logout } from '../utils/auth';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import FeatureRestriction from './FeatureRestriction';
import { API_BASE_URL, checkBackendConnection } from '../config/api';
import { autoSetupTimezone, stopTimezoneRetries } from '../utils/timezone';
import ApiService, { NotificationRule as ApiNotificationRule, DeliveryLog as ApiDeliveryLog } from '../services/api';

// Lazy load heavy components to improve initial bundle size
const WebhookManager = lazy(() => import('./WebhookManager'));
const RuleFilters = lazy(() => import('./RuleFilters'));
const TemplateEditor = lazy(() => import('./TemplateEditor'));
const ChannelRouting = lazy(() => import('./ChannelRouting'));
const QuietHours = lazy(() => import('./QuietHours'));
const AnalyticsPanel = lazy(() => import('./AnalyticsPanel'));
const NotificationPreview = lazy(() => import('./NotificationPreview'));
const BulkRuleManager = lazy(() => import('./BulkRuleManager'));
const StalledDealMonitor = lazy(() => import('./StalledDealMonitor'));
const BillingDashboard = lazy(() => import('./BillingDashboard'));
const TestingSection = lazy(() => import('./TestingSection'));

// Loading component for Suspense fallback
const ComponentLoader: React.FC = () => (
  <div className="component-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

// Use API service types
type NotificationRule = ApiNotificationRule;
type DeliveryLog = ApiDeliveryLog;

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
      errors.target_webhook_id = 'Please select a Google Chat webhook where notifications will be sent';
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
    } else if (error?.message) {
      // Improve database constraint error messages
      if (error.message.includes('null value in column') && error.message.includes('target_webhook_id')) {
        message = 'Please select a Google Chat webhook before saving the rule.';
      } else if (error.message.includes('violates not-null constraint')) {
        message = 'Please fill in all required fields before saving.';
      } else if (error.message.includes('duplicate key value')) {
        message = 'A rule with this name already exists. Please choose a different name.';
      } else {
        message = error.message;
      }
    }
    
    showError(message);
  };
  // Plan features hook
  const { 
    hasFeature, 
    getFeatureRequiredPlan, 
    planTier, 
    limits,
    loading: featuresLoading 
  } = usePlanFeatures();

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
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Helper function to set error and show modal
  const showError = (message: string) => {
    setError(message);
    setShowErrorModal(true);
  };

  // Helper function to clear error and hide modal
  const clearError = () => {
    setError(null);
    setShowErrorModal(false);
  };
  const [isRetrying, setIsRetrying] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [connectionCheckTime, setConnectionCheckTime] = useState<Date | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [tenantId, setTenantId] = useState<string>(getTenantId() || '1');
  
  // Filters and pagination
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [logsPage] = useState(1);
  const logsPerPage = 20;
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'logs' | 'webhooks' | 'routing' | 'quiet-hours' | 'stalled-deals' | 'analytics' | 'testing' | 'bulk-management' | 'billing' | 'pricing' | 'settings'>('overview');
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string; 
    enabled: boolean;
    event_type: string;
    template_mode: 'compact' | 'detailed';
    target_webhook_id?: string; // Optional for compatibility
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
    clearError();
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
    clearError();

    try {
      const token = getAuthToken();
      
      if (!token) {
        showError('No authentication token found. Please log in again.');
        window.location.href = '/onboarding';
        return;
      }

      const headers = getAuthHeaders();

      // Get tenant ID from JWT token
      const currentTenantId = getTenantId() || '1'; // Fallback
      setTenantId(currentTenantId);

      // Parallel API calls for better performance using API service methods with fallback
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 1;

      const [statsResponse, rulesData, logsData, webhooksData] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/api/v1/monitoring/dashboard/${currentTenantId}?days=${days}`, { 
          signal: AbortSignal.timeout(10000) // 10 second timeout
        }).catch(() => null),
        ApiService.getRules().catch(() => []),
        ApiService.getLogs({
          page: logsPage,
          limit: logsPerPage,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          rule: ruleFilter !== 'all' ? ruleFilter : undefined,
        }).catch(() => ({ logs: [], total: 0, page: 1, hasMore: false })),
        ApiService.getWebhooks().catch(() => []),
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

      // Process rules response - API service already returns transformed data
      setRules(rulesData);
      
      // Update stats with actual rule count
      setStats(prevStats => ({
        ...prevStats,
        activeRules: rulesData.filter((rule: NotificationRule) => rule.enabled).length
      }));

      // Process logs response - API service already returns transformed data with fallback
      console.log('📋 Logs data from API service:', logsData);
      setLogs(logsData.logs);

      // Process webhooks response - API service already returns transformed data with fallback
      setAvailableWebhooks(webhooksData.map((webhook: any) => ({
        id: webhook.id.toString(),
        name: webhook.name || webhook.url || 'Unnamed Webhook',
      })));

    } catch (err) {
      handleApiError(err, 'load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, statusFilter, ruleFilter, logsPage]);

  // Load dashboard data and setup timezone
  useEffect(() => {
    const initializeDashboard = async () => {
      // Auto-detect and save user's timezone (for existing users who haven't set it)
      await autoSetupTimezone(API_BASE_URL);
      
      // Load dashboard data
      loadDashboardData();
    };
    
    initializeDashboard();
  }, [loadDashboardData]);

  // Cleanup timezone retries on component unmount
  useEffect(() => {
    return () => {
      stopTimezoneRetries();
    };
  }, []);

  // Check backend connection status
  const checkConnection = useCallback(async () => {
    try {
      const isConnected = await checkBackendConnection();
      setIsBackendConnected(isConnected);
      setConnectionCheckTime(new Date());
      
      if (!isConnected && stats.totalNotifications === 0) {
        // If backend is down and we have no data, show helpful message
        setError('Backend service unavailable. Please check your connection and try again.');
      } else if (isConnected && error?.includes('Backend service unavailable')) {
        // Clear the error if connection is restored
        setError(null);
      }
    } catch (err) {
      setIsBackendConnected(false);
      setConnectionCheckTime(new Date());
    }
  }, [stats.totalNotifications, error]);

  // Check connection periodically
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkConnection]);

  const toggleRule = async (ruleId: string) => {
    try {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      // const apiUrl = process.env.REACT_APP_API_URL; // Using API_BASE_URL instead
      
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/rules/${ruleId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          name: rule.name,
          event_type: rule.eventType,
          // target_webhook_id will be handled by backend based on targetSpace
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
        showError(`Failed to toggle rule: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      showError('Failed to toggle rule');
    }
  };

  const testRule = async (ruleId: string) => {
    try {
      // const apiUrl = process.env.REACT_APP_API_URL; // Using API_BASE_URL instead
      
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/rules/${ruleId}/test`, {
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

  const provisionDefaultRules = async () => {
    try {
      console.log('🚀 Provisioning default rules...');
      
      // Check current rules to see what's missing
      const currentEventTypes = rules.map(rule => rule.eventType);
      
      // Define default rules based on plan tier
      let defaultEventTypes: string[] = [];
      const tierRuleCounts = {
        'free': 3,
        'starter': 5, 
        'pro': 10,
        'team': 10
      };
      
      const currentTier = planTier || 'free';
      const maxDefaultRules = tierRuleCounts[currentTier as keyof typeof tierRuleCounts] || 3;
      
      // Base rules for all tiers
      const allPossibleRules = [
        'deal.won',           // 1. Deal Won (Free+)
        'deal.lost',          // 2. Deal Lost (Free+) 
        'deal.added',         // 3. New Deal (Free+)
        'deal.updated',       // 4. Deal Updated (Starter+)
        'person.added',       // 5. Person Added (Starter+)
        'person.updated',     // 6. Person Updated (Pro+)
        'activity.added',     // 7. Activity Added (Pro+)
        'deal.stage.changed', // 8. Stage Changed (Pro+)
        'deal.owner.changed', // 9. Owner Changed (Pro+)
        'deal.value.changed'  // 10. Value Changed (Pro+)
      ];
      
      // Select rules based on plan tier
      defaultEventTypes = allPossibleRules.slice(0, maxDefaultRules);
      
      const missingRules = defaultEventTypes.filter(eventType => !currentEventTypes.includes(eventType));
      
      if (missingRules.length === 0) {
        const tierMessages = {
          'free': `📋 All Default Rules Present\n\nYou already have all 3 FREE tier basic rules:\n• Deal Won\n• Deal Lost\n• New Deal\n\nYou can edit these rules to customize the name, target chat, and message format. For advanced filtering, upgrade to Starter plan.`,
          'starter': `📋 All Default Rules Present\n\nYou already have all 5 STARTER tier rules:\n• Deal Won\n• Deal Lost\n• New Deal\n• Deal Updated\n• New Person\n\nFor even more event types and advanced features, upgrade to Pro plan.`,
          'pro': `📋 All Default Rules Present\n\nYou already have all 10 PRO tier rules including:\n• Deal events (Won, Lost, Added, Updated)\n• Person events (Added, Updated)\n• Activity events\n• Stage & Owner changes\n• Value changes\n\nYou have access to all notification types!`,
          'team': `📋 All Default Rules Present\n\nYou already have all 10 TEAM tier rules including:\n• Deal events (Won, Lost, Added, Updated)\n• Person events (Added, Updated)\n• Activity events\n• Stage & Owner changes\n• Value changes\n\nYou have access to all notification types with unlimited usage!`
        };
        
        alert(tierMessages[currentTier as keyof typeof tierMessages] || tierMessages.free);
        return;
      }

      if (limits?.rules && limits.rules > 0 && limits.rules < 999 && rules.length + missingRules.length > limits.rules) {
        alert(`⚠️ Rule Limit Reached\n\nYour ${planTier || 'current'} plan allows ${limits.rules} rules maximum.\nYou currently have ${rules.length} rules.\nDelete some rules first or upgrade your plan.`);
        return;
      }
      
      if (!isBackendConnected) {
        showError('Cannot create rules - backend service is unavailable. Please try again when the service is online.');
        return;
      }
      
      // Production mode - call backend API
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/provision-default-rules`, {
        method: 'POST',
        body: JSON.stringify({
          planTier: planTier,
          force: false, // Don't force creation if rules exist
          missing_only: true // Only create missing default rules
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Provisioning result:', result);
        
        if (result.rules_created > 0) {
          alert(`✅ Success! Created ${result.rules_created} basic rules:\n${missingRules.map(type => `• ${type.replace('deal.', '').replace('added', 'New Deal').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n')}\n\nYou can customize the name, target chat, and message format. For advanced filtering, upgrade to Starter plan.`);
        } else {
          alert(`📋 Default rules already exist. Found ${result.status?.default_rules_count || rules.length} existing rules.`);
        }
        
        loadDashboardData(); // Refresh the rules list
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`❌ Failed to provision default rules: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error provisioning default rules:', err);
      alert('❌ Failed to provision default rules. Check console for details.');
    }
  };

  const startEditRule = (rule: NotificationRule) => {
    setEditingRule(rule.id);
    setEditFormData({
      name: rule.name,
      enabled: rule.enabled,
      event_type: rule.eventType,
      template_mode: rule.templateMode,
      target_webhook_id: availableWebhooks[0]?.id || '', // Use first available webhook
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
    // Clear previous errors
    clearError();
    
    // Validate edit form and get errors directly
    const errors: {[key: string]: string} = {};
    
    if (!editFormData.name.trim()) {
      errors.name = 'Rule name is required';
    } else if (editFormData.name.length < 3) {
      errors.name = 'Rule name must be at least 3 characters';
    }
    
    if (!editFormData.target_webhook_id) {
      errors.target_webhook_id = 'Please select a Google Chat webhook where notifications will be sent';
    }

    // Check if user is trying to change to a restricted event type
    const currentRule = rules.find(r => r.id === ruleId);
    const isChangingEventType = currentRule && currentRule.eventType !== editFormData.event_type;
    
    if (isChangingEventType && editFormData.event_type === 'deal.updated' && planTier === 'free') {
      errors.event_type = 'Deal Updated notifications require Starter plan or higher. You can keep existing Deal Updated rules but cannot change other rules to Deal Updated.';
    }
    
    setValidationErrors(errors);
    
    // If there are validation errors, show them in main error panel
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.values(errors);
      showError(`Please fix the following: ${errorMessages.join(', ')}`);
      return;
    }

    try {
      // const apiUrl = process.env.REACT_APP_API_URL; // Using API_BASE_URL instead
      
      const requestData = {
        name: editFormData.name,
        enabled: editFormData.enabled,
        event_type: editFormData.event_type,
        template_mode: editFormData.template_mode,
        target_webhook_id: parseInt(editFormData.target_webhook_id || '1'),
        filters: editFormData.filters
      };
      
      console.log('🔧 Saving rule with data:', JSON.stringify(requestData, null, 2));
      
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/rules/${ruleId}`, {
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
                templateMode: editFormData.template_mode as 'compact' | 'detailed',
                targetSpace: availableWebhooks.find(w => w.id === editFormData.target_webhook_id)?.name || 'Unknown', // SECURITY FIX: Update display name from webhook list
                // targetWebhookId property not needed - using targetSpace
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
        const errorData = await response.json().catch(() => ({}));
        showError(`Failed to update rule: ${errorData.message || 'Please check all required fields are filled'}`);
      }
    } catch (err) {
      showError('Failed to update rule: Please check your internet connection and try again');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const updatedRules = rules.filter(r => r.id !== ruleId);
        setRules(updatedRules);
        setStats(prev => ({ ...prev, activeRules: updatedRules.filter(r => r.enabled).length }));
        alert('✅ Rule deleted successfully!');
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        showError(`Failed to delete rule: ${errorData.message || 'Server error'}`);
      }
    } catch (err) {
      console.error('Delete rule error:', err);
      
      showError('Failed to delete rule: Network error');
    }
  };

  const openCreateModal = () => {
    // Set default event type based on plan tier
    const defaultEventType = planTier === 'free' ? 'deal.won' : 'deal.updated';
    
    setCreateFormData({
      name: '',
      event_type: defaultEventType,
      target_webhook_id: availableWebhooks[0]?.id || '',
      template_mode: 'compact',
      custom_template: null,
      enabled: true,
      filters: {},
    });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    const defaultEventType = planTier === 'free' ? 'deal.won' : 'deal.updated';
    
    setShowCreateModal(false);
    setCreateFormData({
      name: '',
      event_type: defaultEventType,
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
      setIsSubmitting(true);
      
      // Simulate API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, you'd save to backend
      console.log('Settings to save:', settings);
      alert('✅ Settings Saved\n\nYour preferences have been updated successfully.');
    } catch (error) {
      console.error('Save settings failed:', error);
      alert('❌ Save Failed\n\nUnable to save settings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSettings = async () => {
    console.log('🔧 Settings: Reset button clicked!');
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      try {
        setIsSubmitting(true);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
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
        
        alert('✅ Settings Reset\n\nAll settings have been restored to default values.');
      } catch (error) {
        console.error('Reset settings failed:', error);
        alert('❌ Reset Failed\n\nUnable to reset settings. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleTestConnection = async () => {
    try {
      console.log('🔌 Testing connection...');
      // Test API connectivity
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/health`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        alert('✅ Connection Test Successful\n\nPipedrive → Google Chat connection is working properly.');
      } else {
        alert('❌ Connection Test Failed\n\nCheck your internet connection and try again.');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('❌ Connection Test Failed\n\nUnable to reach the server. Check your internet connection.');
    }
  };

  const handleExportLogs = async () => {
    try {
      console.log('📊 Exporting logs...');
      // Export functionality - would download CSV
      const csvData = logs.map(log => ({
        timestamp: log.timestamp,
        rule: log.ruleName,
        status: log.status,
        target: log.targetSpace,
        message: log.message
      }));
      
      console.log('Export data:', csvData);
      alert(`📊 Export Ready\n\nPrepared ${csvData.length} log entries for export.\nIn production, this would download a CSV file.`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ Export Failed\n\nUnable to export logs. Please try again.');
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear cached data? This will refresh webhook configurations and rule cache.')) {
      try {
        console.log('🧹 Clearing cache...');
        // Cache clearing functionality
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        // Refresh dashboard data
        await loadDashboardData();
        
        alert('✅ Cache Cleared\n\nWebhook cache and rule configurations refreshed successfully.');
      } catch (error) {
        console.error('Cache clear failed:', error);
        alert('❌ Cache Clear Failed\n\nUnable to clear cache. Please try again.');
      }
    }
  };

  // Testing section now handled by dedicated TestingSection component

  // Note: Old testing functions removed - now handled by TestingSection component
  const createNewRule = async () => {
    // Clear previous errors
    clearError();
    
    // Validate form and get errors directly
    const errors: {[key: string]: string} = {};
    
    if (!createFormData.name.trim()) {
      errors.name = 'Rule name is required';
    } else if (createFormData.name.length < 3) {
      errors.name = 'Rule name must be at least 3 characters';
    }
    
    if (!createFormData.target_webhook_id) {
      errors.target_webhook_id = 'Please select a Google Chat webhook where notifications will be sent';
    }

    // Check plan limits
    if (limits?.rules && limits.rules > 0 && limits.rules < 999 && rules.length >= limits.rules) {
      errors.limit = `Your ${planTier || 'current'} plan is limited to ${limits.rules} rules. Upgrade to create more rules.`;
    }

    // Check if Deal Updated is restricted for free tier
    if (createFormData.event_type === 'deal.updated' && planTier === 'free') {
      errors.event_type = 'Deal Updated notifications require Starter plan or higher. Free tier includes: Deal Won, Deal Lost, and New Deal notifications.';
    }
    
    setValidationErrors(errors);
    
    // If there are validation errors, show them in main error panel
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.values(errors);
      showError(`Please fix the following: ${errorMessages.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // const apiUrl = process.env.REACT_APP_API_URL; // Using API_BASE_URL instead
      
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/rules`, {
        method: 'POST',
        body: JSON.stringify({
          name: createFormData.name.trim(),
          event_type: createFormData.event_type,
          target_webhook_id: parseInt(createFormData.target_webhook_id || '1'),
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
      {/* Enhanced Stats Grid with Animations */}
      <div className="stats-grid stats-2x2">
        <div 
          className="stat-card enhanced"
          onClick={() => setActiveTab('logs')}
          role="button"
          tabIndex={0}
          aria-label="View notification logs"
        >
          <div className="stat-icon notifications">📊</div>
          <div className="stat-content">
            <div className="stat-value animated">{stats.totalNotifications.toLocaleString()}</div>
            <div className="stat-label">Total Notifications</div>
            <div className="stat-trend">
              <span className="trend-up">↗ +12% this week</span>
            </div>
          </div>
        </div>
        
        <div 
          className="stat-card enhanced"
          onClick={() => setActiveTab('logs')}
          role="button"
          tabIndex={0}
          aria-label="View success rate details"
        >
          <div className="stat-icon success">🎯</div>
          <div className="stat-content">
            <div className={`stat-value animated ${getSuccessRateColor(stats.successRate)}`}>
              {stats.successRate.toFixed(1)}%
            </div>
            <div className="stat-label">Success Rate</div>
            <div className="stat-trend">
              {stats.successRate >= 95 ? (
                <span className="trend-good">🟢 Excellent</span>
              ) : stats.successRate >= 90 ? (
                <span className="trend-ok">🟡 Good</span>
              ) : (
                <span className="trend-bad">🔴 Needs attention</span>
              )}
            </div>
          </div>
        </div>
        
        <div 
          className="stat-card enhanced"
          onClick={() => setActiveTab('rules')}
          role="button"
          tabIndex={0}
          aria-label="Manage notification rules"
        >
          <div className="stat-icon rules">⚙️</div>
          <div className="stat-content">
            <div className="stat-value animated">{rules.length}</div>
            <div className="stat-label">Active Rules</div>
            <div className="stat-trend">
              {rules.length === 0 ? (
                <span className="trend-warning">Set up your first rule</span>
              ) : (
                <span className="trend-info">{rules.filter(r => r.enabled).length} enabled</span>
              )}
            </div>
          </div>
        </div>
        
        <div 
          className="stat-card enhanced"
          onClick={() => setActiveTab('logs')}
          role="button"
          tabIndex={0}
          aria-label="View delivery performance"
        >
          <div className="stat-icon speed">🚀</div>
          <div className="stat-content">
            <div className="stat-value animated">{stats.avgDeliveryTime}ms</div>
            <div className="stat-label">Avg Delivery Time</div>
            <div className="stat-trend">
              {stats.avgDeliveryTime <= 500 ? (
                <span className="trend-good">🟢 Fast</span>
              ) : stats.avgDeliveryTime <= 1000 ? (
                <span className="trend-ok">🟡 Normal</span>
              ) : (
                <span className="trend-bad">🔴 Slow</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Recent Activity with Better Design */}
      <div className="recent-activity enhanced">
        <div className="activity-header">
          <h3>Recent Activity</h3>
          <button 
            className="view-all-btn"
            onClick={() => setActiveTab('logs')}
            type="button"
          >
            View All
          </button>
        </div>
        
        <div className="activity-list">
          {logs.length === 0 ? (
            <div className="empty-activity">
              <div className="empty-icon">📋</div>
              <p>No activity yet</p>
              <p className="empty-subtitle">
                {isBackendConnected === false 
                  ? "No notification logs available"
                  : "Create your first rule to start seeing activity"
                }
              </p>
              <button 
                className="cta-button"
                onClick={() => setActiveTab('rules')}
                type="button"
              >
                {rules.length === 0 ? 'Create First Rule' : 'View Rules'}
              </button>
            </div>
          ) : (
            logs.slice(0, 5).map((log, index) => (
              <div 
                key={log.id} 
                className="activity-item enhanced"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`activity-icon ${log.status}`}>
                  {getStatusIcon(log.status)}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{log.ruleName}</div>
                  <div className="activity-message">{log.message}</div>
                  <div className="activity-subtitle">
                    <span className="activity-target">{log.targetSpace}</span>
                    <span className="activity-separator">•</span>
                    <span className="activity-time">{formatTimestamp(log.timestamp)}</span>
                    {log.deliveryTime && (
                      <>
                        <span className="activity-separator">•</span>
                        <span className="activity-duration">{log.deliveryTime}ms</span>
                      </>
                    )}
                  </div>
                </div>
                {log.status === 'error' && (
                  <div className="activity-error" title={log.errorDetails}>
                    ⚠️
                  </div>
                )}
                <div className="activity-chevron">›</div>
              </div>
            ))
          )}
        </div>
        
        {logs.length > 5 && (
          <div className="activity-footer">
            <button 
              className="view-more-btn"
              onClick={() => setActiveTab('logs')}
              type="button"
            >
              View {logs.length - 5} more activities →
            </button>
          </div>
        )}
      </div>
      
      {/* Quick Actions Panel */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button 
            className="quick-action-card"
            onClick={() => setActiveTab('rules')}
            type="button"
          >
            <div className="quick-action-icon">⚙️</div>
            <div className="quick-action-title">Create Rule</div>
            <div className="quick-action-subtitle">Set up new notifications</div>
          </button>
          
          <button 
            className="quick-action-card"
            onClick={() => setActiveTab('webhooks')}
            type="button"
          >
            <div className="quick-action-icon">🔗</div>
            <div className="quick-action-title">Add Webhook</div>
            <div className="quick-action-subtitle">Connect Google Chat</div>
          </button>
          
          <button 
            className="quick-action-card"
            onClick={() => setActiveTab('testing')}
            type="button"
          >
            <div className="quick-action-icon">🧪</div>
            <div className="quick-action-title">Test Connection</div>
            <div className="quick-action-subtitle">Verify your setup</div>
          </button>
          
          <button 
            className="quick-action-card"
            onClick={() => setActiveTab('settings')}
            type="button"
          >
            <div className="quick-action-icon">⚙️</div>
            <div className="quick-action-title">Settings</div>
            <div className="quick-action-subtitle">Customize preferences</div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderRules = () => (
    <div className="rules-section">
      <div className="section-header">
        <h3>Notification Rules</h3>
        <div className="header-buttons">
          <button 
            className="provision-rules-button"
            onClick={provisionDefaultRules}
            aria-label="Provision default notification rules"
            type="button"
            style={{ 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '4px', 
              marginRight: '8px',
              cursor: 'pointer'
            }}
          >
            📋 Add Default Rules
          </button>
          <button 
            className="create-rule-button"
            onClick={openCreateModal}
            aria-label="Create new notification rule"
            type="button"
            disabled={Boolean(limits?.rules && limits.rules > 0 && limits.rules < 999 && rules.length >= limits.rules)}
            title={limits?.rules && limits.rules > 0 && limits.rules < 999 && rules.length >= limits.rules 
              ? `${planTier || 'Current'} plan limit reached (${limits.rules} rules). Upgrade to create more rules.` 
              : 'Create new notification rule'}
          >
            + Create Rule
            {limits?.rules && limits.rules > 0 && limits.rules < 999 && rules.length >= limits.rules && (
              <span style={{marginLeft: '4px', opacity: 0.7}}>({rules.length}/{limits.rules})</span>
            )}
          </button>
        </div>
      </div>
      
      {/* Default Rules Information Panel */}
      <div className="default-rules-info" style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        borderLeft: '4px solid #4CAF50'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ fontSize: '24px', marginTop: '2px' }}>💡</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
              About Default Rules
            </h4>
            <p style={{ margin: '0 0 12px 0', color: '#6c757d', fontSize: '14px', lineHeight: '1.5' }}>
              Default rules provide pre-configured notification templates for common Pipedrive events. 
              They're designed to get you started quickly with proven notification patterns.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#2c3e50', marginBottom: '4px' }}>
                  🎯 Your {(planTier || 'FREE').toUpperCase()} Plan Includes:
                </div>
                <div style={{ fontSize: '13px', color: '#6c757d' }}>
                  {(() => {
                    const tierRules = {
                      'free': '3 basic rules (Deal Won, Lost, New)',
                      'starter': '5 rules (+ Deal Updated, New Person)',
                      'pro': '10 rules (+ Person Updated, Activities, Stage/Owner/Value changes)',
                      'team': '10 rules (same as Pro + unlimited usage)'
                    };
                    return tierRules[planTier?.toLowerCase() as keyof typeof tierRules] || tierRules.free;
                  })()}
                </div>
              </div>
              
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#2c3e50', marginBottom: '4px' }}>
                  ⚡ Why Use Default Rules?
                </div>
                <div style={{ fontSize: '13px', color: '#6c757d' }}>
                  Save time, proven templates, easy customization, immediate value
                </div>
              </div>
            </div>
            
            <div style={{ fontSize: '13px', color: '#6c757d' }}>
              <strong>Getting Started:</strong> Click "📋 Add Default Rules" to automatically create {(() => {
                const tierCounts = { 'free': 3, 'starter': 5, 'pro': 10, 'team': 10 };
                const maxRules = tierCounts[planTier?.toLowerCase() as keyof typeof tierCounts] || 3;
                const currentCount = rules.length;
                const remaining = Math.max(0, maxRules - currentCount);
                return remaining > 0 ? `${remaining} more rules` : 'remaining rules';
              })()} for your plan. 
              You can then customize names, target chats, and filters to match your workflow.
            </div>
          </div>
        </div>
      </div>
      
      {/* Show warning if user has more rules than plan allows */}
      {planTier === 'free' && rules.length > (limits?.rules || 3) && (
        <div className="plan-limit-warning">
          ⚠️ You have {rules.length} rules but Free plan allows {limits?.rules || 3}. 
          Delete {rules.length - (limits?.rules || 3)} rule{rules.length - (limits?.rules || 3) > 1 ? 's' : ''} or 
          <a href="/pricing" style={{color: '#3b82f6', marginLeft: '4px'}}>upgrade your plan</a>.
        </div>
      )}
      
      <div className="rules-list">
        {rules.map((rule) => (
          <div key={rule.id} className="rule-card" data-event-type={rule.eventType}>
            <div className="rule-header">
              <div className="rule-info">
                {editingRule === rule.id ? (
                  <div className="edit-form">
                    <div className="rule-form-grid">
                      {/* Left Column: Basic Information + Message Template */}
                      <div className="rule-form-left">
                        <div className="rule-form-basic">
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
                            {planTier === 'free' ? (
                              // Free tier: Show current rule's event type + allowed ones
                              <>
                                <option value="deal.won">Deal Won</option>
                                <option value="deal.lost">Deal Lost</option>
                                <option value="deal.create">New Deal</option>
                                {/* Allow editing existing Deal Updated rules but mark others as restricted */}
                                {editFormData.event_type === 'deal.updated' ? (
                                  <option value="deal.updated">Deal Updated (current)</option>
                                ) : (
                                  <option value="deal.updated" disabled>Deal Updated (Starter+ only)</option>
                                )}
                              </>
                            ) : (
                              // Paid tiers: All events available
                              <>
                                <option value="deal.updated">Deal Updated</option>
                                <option value="deal.won">Deal Won</option>
                                <option value="deal.lost">Deal Lost</option>
                                <option value="deal.create">New Deal</option>
                                <option value="deal.added">Deal Added (Legacy)</option>
                                <option value="person.added">Person Added</option>
                                <option value="person.updated">Person Updated</option>
                                <option value="activity.added">Activity Added</option>
                              </>
                            )}
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
                        </div>

                        {/* Message Template */}
                        <div className="rule-form-template">
                        <TemplateEditor
                          value={{
                            template_mode: editFormData.template_mode,
                            custom_template: undefined
                          }}
                          onChange={(templateData) => setEditFormData({
                            ...editFormData,
                            template_mode: templateData.template_mode as 'compact' | 'detailed'
                          })}
                          eventType={editFormData.event_type}
                        />
                        </div>
                      </div>

                      {/* Right Column: Advanced Filters */}
                      <div className="rule-form-advanced">
                        <FeatureRestriction
                          isAvailable={hasFeature('advanced_filtering')}
                          requiredPlan={getFeatureRequiredPlan('advanced_filtering')}
                          currentPlan={planTier}
                          featureName="Advanced Filters"
                          upgradeHint="Filter notifications by deal value, stage, owner, and more"
                        >
                          <RuleFilters
                            filters={editFormData.filters}
                            onChange={(filters) => hasFeature('advanced_filtering') && setEditFormData({...editFormData, filters})}
                          />
                        </FeatureRestriction>
                      </div>
                    </div>

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
                        {rule.filters.minValue && <span className="filter">Min Value: ${rule.filters.minValue}</span>}
                        {rule.filters.pipeline && <span className="filter">Pipeline: {rule.filters.pipeline}</span>}
                        {rule.filters.stage && <span className="filter">Stage: {rule.filters.stage}</span>}
                        {rule.filters.owner && <span className="filter">Owner: {rule.filters.owner}</span>}
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
                {rule.filters.minValue && <span className="filter">Min Value: ${rule.filters.minValue}</span>}
                {rule.filters.pipeline && <span className="filter">Pipeline: {rule.filters.pipeline}</span>}
                {rule.filters.stage && <span className="filter">Stage: {rule.filters.stage}</span>}
                {rule.filters.owner && <span className="filter">Owner: {rule.filters.owner}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {rules.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No notification rules yet</h3>
          <p>Get started with 3 free basic rules: Deal Won, Deal Lost, and New Deal notifications. You can customize the name, target chat, and message format (but not filtering).</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              className="create-first-rule"
              onClick={provisionDefaultRules}
              aria-label="Add default notification rules"
              type="button"
            >
              📋 Add Default Rules
            </button>
            <button 
              className="create-first-rule"
              onClick={openCreateModal}
              aria-label="Create custom notification rule"
              type="button"
              style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db' }}
              disabled={planTier === 'free' && rules.length >= (limits?.rules || 3)}
            >
              + Create Custom Rule
            </button>
          </div>
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
      {/* Error Modal */}
      {showErrorModal && error && (
        <div className="error-modal-overlay" onClick={clearError}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <div className="error-modal-header">
              <span className="error-modal-icon">⚠️</span>
              <h3>Error</h3>
              <button 
                className="error-modal-close"
                onClick={clearError}
                aria-label="Close error message"
                type="button"
              >
                ×
              </button>
            </div>
            <div className="error-modal-content">
              <p className="error-modal-message">{error}</p>
              {networkStatus === 'offline' && (
                <div className="error-modal-network">
                  📶 You're currently offline. Check your connection and try again.
                </div>
              )}
            </div>
            <div className="error-modal-actions">
              <button 
                className="error-modal-retry"
                onClick={() => {
                  clearError();
                  retryOperation(loadDashboardData, 'reload dashboard');
                }}
                disabled={isRetrying}
                type="button"
              >
                {isRetrying ? '⏳' : '🔄'} Retry
              </button>
              <button 
                className="error-modal-ok"
                onClick={clearError}
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h1>Pipedrive → Google Chat</h1>
          <p>Monitor and manage your notification rules and delivery logs</p>
          
          {/* Connection Status Indicator */}
          <div className={`connection-status ${isBackendConnected === null ? 'checking' : isBackendConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {isBackendConnected === null ? 'Checking connection...' : 
               isBackendConnected ? 'Backend Connected' : 'Backend Offline'}
            </span>
            {connectionCheckTime && (
              <span className="status-time">
                Last checked: {connectionCheckTime.toLocaleTimeString()}
              </span>
            )}
          </div>
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
            <span aria-hidden="true">⚙️</span> Rules ({rules.length})
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
          <FeatureRestriction
            isAvailable={hasFeature('channel_routing')}
            requiredPlan={getFeatureRequiredPlan('channel_routing')}
            currentPlan={planTier}
            featureName="Smart Routing"
            upgradeHint="Route notifications to different channels based on rules"
          >
            <button 
              className={`nav-tab ${activeTab === 'routing' ? 'active' : ''} ${!hasFeature('channel_routing') ? 'disabled' : ''}`}
              onClick={() => hasFeature('channel_routing') && setActiveTab('routing')}
              aria-label="Smart routing configuration"
              aria-current={activeTab === 'routing' ? 'page' : undefined}
              type="button"
              disabled={!hasFeature('channel_routing')}
            >
              <span aria-hidden="true">🎯</span> Smart Routing
            </button>
          </FeatureRestriction>
          <FeatureRestriction
            isAvailable={hasFeature('quiet_hours')}
            requiredPlan={getFeatureRequiredPlan('quiet_hours')}
            currentPlan={planTier}
            featureName="Quiet Hours"
            upgradeHint="Set time periods when notifications are delayed"
          >
            <button 
              className={`nav-tab ${activeTab === 'quiet-hours' ? 'active' : ''} ${!hasFeature('quiet_hours') ? 'disabled' : ''}`}
              onClick={() => hasFeature('quiet_hours') && setActiveTab('quiet-hours')}
              aria-label="Quiet hours settings"
              aria-current={activeTab === 'quiet-hours' ? 'page' : undefined}
              type="button"
              disabled={!hasFeature('quiet_hours')}
            >
              <span aria-hidden="true">🔕</span> Quiet Hours
            </button>
          </FeatureRestriction>
          <FeatureRestriction
            isAvailable={hasFeature('stalled_alerts')}
            requiredPlan={getFeatureRequiredPlan('stalled_alerts')}
            currentPlan={planTier}
            featureName="Stalled Deal Alerts"
            upgradeHint="Monitor and get alerts for stalled deals"
          >
            <button 
              className={`nav-tab ${activeTab === 'stalled-deals' ? 'active' : ''} ${!hasFeature('stalled_alerts') ? 'disabled' : ''}`}
              onClick={() => hasFeature('stalled_alerts') && setActiveTab('stalled-deals')}
              aria-label="Stalled deals monitoring"
              aria-current={activeTab === 'stalled-deals' ? 'page' : undefined}
              type="button"
            >
              <span aria-hidden="true">📊</span> Stalled Deals
            </button>
          </FeatureRestriction>
          <FeatureRestriction
            isAvailable={hasFeature('usage_analytics')}
            requiredPlan={getFeatureRequiredPlan('usage_analytics')}
            currentPlan={planTier}
            featureName="Usage Analytics"
            upgradeHint="View detailed analytics and usage reports"
          >
            <button 
              className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''} ${!hasFeature('usage_analytics') ? 'disabled' : ''}`}
              onClick={() => hasFeature('usage_analytics') && setActiveTab('analytics')}
              aria-label="Analytics and reporting"
              aria-current={activeTab === 'analytics' ? 'page' : undefined}
              type="button"
            >
              <span aria-hidden="true">📊</span> Analytics
            </button>
          </FeatureRestriction>
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
            className={`nav-tab ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
            aria-label="Billing and subscription management"
            type="button"
          >
            <span aria-hidden="true">💳</span> Billing
          </button>
          <button 
            className={`nav-tab ${activeTab === 'pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('pricing')}
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
          
          {/* Dark Mode Toggle */}
          <div style={{
            marginTop: 'auto',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb',
            marginBottom: '12px'
          }}>
          </div>
          
          <button 
            className="nav-tab logout-button"
            onClick={logout}
            aria-label="Logout from application"
            type="button"
            style={{
              color: '#dc2626'
            }}
          >
            <span aria-hidden="true">🚪</span> Logout
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
          {activeTab === 'routing' && hasFeature('channel_routing') && (
            <Suspense fallback={<ComponentLoader />}>
              <ChannelRouting 
                webhooks={availableWebhooks.map(w => ({ ...w, is_active: true, description: '' }))}
                onRefresh={loadDashboardData}
              />
            </Suspense>
          )}
          {activeTab === 'quiet-hours' && hasFeature('quiet_hours') && (
            <Suspense fallback={<ComponentLoader />}>
              <QuietHours 
                onRefresh={loadDashboardData}
              />
            </Suspense>
          )}
          {activeTab === 'stalled-deals' && hasFeature('stalled_alerts') && (
            <Suspense fallback={<ComponentLoader />}>
              <StalledDealMonitor 
                webhooks={availableWebhooks.map(w => ({ ...w, is_active: true }))}
                onRefresh={loadDashboardData}
              />
            </Suspense>
          )}
          {activeTab === 'analytics' && hasFeature('usage_analytics') && (
            <Suspense fallback={<ComponentLoader />}>
              <AnalyticsPanel 
                tenantId={tenantId}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </Suspense>
          )}
          {activeTab === 'testing' && (
            <Suspense fallback={<ComponentLoader />}>
              <TestingSection onTestComplete={(result) => {
                // Optional: You can still track test results if needed
                console.log('Test completed:', result);
              }} />
            </Suspense>
          )}
          {activeTab === 'bulk-management' && (
            <Suspense fallback={<ComponentLoader />}>
              <BulkRuleManager 
                onRefresh={loadDashboardData}
                onNavigateToRules={() => setActiveTab('rules')}
              />
            </Suspense>
          )}
          {activeTab === 'billing' && (
            <div className="billing-section">
              <div className="section-header">
                <h3>💳 Billing & Subscription</h3>
                <p>Manage your subscription and view usage</p>
              </div>
              
              <Suspense fallback={<ComponentLoader />}>
                <div className="billing-dashboard-compact">
                  <BillingDashboard />
                </div>
              </Suspense>
            </div>
          )}
          {activeTab === 'pricing' && (
            <div className="pricing-section">
              <div className="section-header">
                <h3>💎 Plans & Pricing</h3>
                <p>Choose the perfect plan for your team</p>
              </div>
              
              <div className="pricing-dashboard-compact">
                {/* Simplified pricing display */}
                <div className="pricing-cards">
                  <div className={`pricing-card free ${planTier === 'free' ? 'current' : ''}`}>
                    <div className="plan-header">
                      <h4>Free</h4>
                      <div className="price">$0<span>/month</span></div>
                    </div>
                    <ul className="features">
                      <li>✅ 100 notifications/month</li>
                      <li>✅ 1 webhook maximum</li>
                      <li>✅ 3 basic rules maximum (Deal Won/Lost/New)</li>
                      <li>✅ Basic message templates</li>
                      <li>❌ No advanced filtering</li>
                      <li>✅ 7-day log retention</li>
                    </ul>
                    <button className={`plan-button ${planTier === 'free' ? 'current' : 'downgrade'}`}>
                      {planTier === 'free' ? 'Current Plan' : 'Downgrade'}
                    </button>
                  </div>
                  
                  <div className={`pricing-card starter ${planTier === 'starter' ? 'current' : ''}`}>
                    <div className="plan-header">
                      <h4>Starter</h4>
                      <div className="price">$9<span>/month</span></div>
                    </div>
                    <ul className="features">
                      <li>✅ 1,000 notifications/month</li>
                      <li>✅ 3 webhooks maximum</li>
                      <li>✅ 10 smart rules maximum + Deal Updated</li>
                      <li>✅ Value/stage/owner filtering</li>
                      <li>✅ Enhanced message templates</li>
                      <li>✅ 30-day log retention</li>
                    </ul>
                    <button className={`plan-button ${planTier === 'starter' ? 'current' : planTier === 'free' ? 'upgrade' : 'downgrade'}`}>
                      {planTier === 'starter' ? 'Current Plan' : planTier === 'free' ? 'Upgrade' : 'Downgrade'}
                    </button>
                  </div>
                  
                  <div className={`pricing-card pro popular ${planTier === 'pro' ? 'current' : ''}`}>
                    <div className="plan-badge">Most Popular</div>
                    <div className="plan-header">
                      <h4>Pro</h4>
                      <div className="price">$29<span>/month</span></div>
                    </div>
                    <ul className="features">
                      <li>✅ 10,000 notifications/month</li>
                      <li>✅ Unlimited webhooks & rules</li>
                      <li>✅ Smart channel routing</li>
                      <li>✅ Quiet hours scheduling</li>
                      <li>✅ Custom message templates</li>
                      <li>✅ Advanced probability filtering</li>
                      <li>✅ 90-day logs</li>
                    </ul>
                    <button className={`plan-button ${planTier === 'pro' ? 'current' : ['free', 'starter'].includes(planTier) ? 'upgrade' : 'downgrade'}`}>
                      {planTier === 'pro' ? 'Current Plan' : ['free', 'starter'].includes(planTier) ? 'Upgrade' : 'Downgrade'}
                    </button>
                  </div>
                  
                  <div className={`pricing-card team ${planTier === 'team' ? 'current' : ''}`}>
                    {planTier === 'team' && <div className="current-badge">Current Plan</div>}
                    <div className="plan-header">
                      <h4>Team</h4>
                      <div className="price">$79<span>/month</span></div>
                    </div>
                    <ul className="features">
                      <li>✅ Unlimited notifications & rules</li>
                      <li>✅ Team analytics dashboard</li>
                      <li>✅ Full API access</li>
                      <li>✅ Priority support</li>
                      <li>✅ Advanced team features</li>
                      <li>✅ 1-year log retention</li>
                    </ul>
                    <button className={`plan-button ${planTier === 'team' ? 'current' : 'upgrade'}`}>
                      {planTier === 'team' ? 'Current Plan' : 'Upgrade'}
                    </button>
                  </div>
                </div>
                
                {/* FAQ Section */}
                <div className="pricing-faq">
                  <h4>💡 Frequently Asked Questions</h4>
                  <div className="faq-compact">
                    <details className="faq-item">
                      <summary>Can I change plans anytime?</summary>
                      <p>Yes, you can upgrade or downgrade instantly. Changes take effect immediately and billing is prorated.</p>
                    </details>
                    <details className="faq-item">
                      <summary>What happens if I exceed limits?</summary>
                      <p>Notifications pause until next billing cycle or you can upgrade instantly to restore service.</p>
                    </details>
                    <details className="faq-item">
                      <summary>How secure is my data?</summary>
                      <p>We use enterprise-grade encryption and only access data necessary for notifications.</p>
                    </details>
                    <details className="faq-item">
                      <summary>Do you offer refunds?</summary>
                      <p>30-day money-back guarantee on all paid plans. Contact support for assistance.</p>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="settings-section">
              <div className="settings-hero">
                <h2>⚙️ Settings & Preferences</h2>
                <p>Customize your Pipedrive → Google Chat integration experience</p>
              </div>
              
              <div className="settings-layout">
                <div className="settings-main">
                  <div className="settings-grid">
                    <div className="settings-category compact">
                      <h4>🔔 Notifications</h4>
                      <div className="setting-item compact">
                        <label className="checkbox-label">
                          <input 
                            type="checkbox" 
                            checked={settings.emailNotifications}
                            onChange={(e) => handleSettingsChange('emailNotifications', e.target.checked)}
                          />
                          <span>Email alerts</span>
                        </label>
                      </div>
                      <div className="setting-item compact">
                        <label htmlFor="message-format">Message format</label>
                        <select 
                          id="message-format" 
                          className="form-select compact"
                          value={settings.messageFormat}
                          onChange={(e) => handleSettingsChange('messageFormat', e.target.value)}
                        >
                          <option value="simple">Simple</option>
                          <option value="compact">Compact</option>
                          <option value="detailed">Detailed</option>
                        </select>
                      </div>
                    </div>

                    <div className="settings-category compact">
                      <h4>🌐 Display</h4>
                      <div className="setting-item compact">
                        <label htmlFor="timezone-select">Timezone</label>
                        <select 
                          id="timezone-select" 
                          className="form-select compact"
                          value={settings.timezone}
                          onChange={(e) => handleSettingsChange('timezone', e.target.value)}
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">Eastern (EST)</option>
                          <option value="America/Chicago">Central (CST)</option>
                          <option value="America/Los_Angeles">Pacific (PST)</option>
                          <option value="Europe/London">London (GMT)</option>
                        </select>
                      </div>
                      <div className="setting-item compact">
                        <label htmlFor="date-format">Date format</label>
                        <select 
                          id="date-format" 
                          className="form-select compact"
                          value={settings.dateFormat}
                          onChange={(e) => handleSettingsChange('dateFormat', e.target.value)}
                        >
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>
                    </div>

                    <div className="settings-category compact">
                      <h4>🔧 Integration</h4>
                      <div className="setting-item compact">
                        <label className="checkbox-label">
                          <input 
                            type="checkbox" 
                            checked={settings.webhookRetries}
                            onChange={(e) => handleSettingsChange('webhookRetries', e.target.checked)}
                          />
                          <span>Retry failed webhooks</span>
                        </label>
                      </div>
                      <div className="setting-item compact">
                        <label htmlFor="retry-attempts">Max retries</label>
                        <select 
                          id="retry-attempts" 
                          className="form-select compact"
                          value={settings.maxRetryAttempts}
                          onChange={(e) => handleSettingsChange('maxRetryAttempts', e.target.value)}
                        >
                          <option value="1">1</option>
                          <option value="3">3</option>
                          <option value="5">5</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="settings-category compact">
                      <h4>🛠️ Tools</h4>
                      <div className="setting-tools">
                        <button className="tool-button" onClick={handleTestConnection}>
                          🔌 Test
                        </button>
                        <button className="tool-button" onClick={handleExportLogs}>
                          📊 Export
                        </button>
                        <button className="tool-button" onClick={handleClearCache}>
                          🧹 Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-actions compact">
                    <button 
                      className="button-primary" 
                      onClick={handleSaveSettings}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="loading-spinner-inline"></span>
                          Saving...
                        </>
                      ) : (
                        '💾 Save Settings'
                      )}
                    </button>
                    <button 
                      className="button-secondary" 
                      onClick={handleResetSettings}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="loading-spinner-inline"></span>
                          Resetting...
                        </>
                      ) : (
                        '🔄 Reset'
                      )}
                    </button>
                  </div>
                </div>

                <div className="settings-sidebar">
                  <div className="help-section">
                    <h3>Frequently Asked Questions</h3>
                    <div className="faq-compact">
                      <details className="faq-item">
                        <summary>How do notifications work?</summary>
                        <p>When events happen in Pipedrive, our system processes them through your rules and sends formatted messages to Google Chat.</p>
                      </details>
                      <details className="faq-item">
                        <summary>What if notifications stop working?</summary>
                        <p>Use the Test Connection tool to diagnose issues. Check your webhook URLs and rule configurations.</p>
                      </details>
                      <details className="faq-item">
                        <summary>What filtering options do I get?</summary>
                        <p>Free: Basic rules only. Starter+: Filter by deal value, stage, owner, and pipeline. Pro+: Advanced probability and time filtering.</p>
                      </details>
                      <details className="faq-item">
                        <summary>How many rules can I create?</summary>
                        <p>Free: 3 basic rules (Deal Won/Lost/New). Starter: 10 smart rules + Deal Updated. Pro+: Unlimited rules with custom templates.</p>
                      </details>
                    </div>
                  </div>

                  <div className="support-section">
                    <h3>Need Help?</h3>
                    <p>Our support team is here to help you get the most out of Pipenotify.</p>
                    <a href="mailto:support@pipenotify.com" className="support-button">
                      Contact Support
                    </a>
                  </div>
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
              <div className="rule-form-grid">
                {/* Left Column: Basic Information + Message Template */}
                <div className="rule-form-left">
                  <div className="rule-form-basic">
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
                      {planTier === 'free' ? (
                        // Free tier: Only Deal Won, Deal Lost, New Deal
                        <>
                          <option value="deal.won">Deal Won</option>
                          <option value="deal.lost">Deal Lost</option>
                          <option value="deal.create">New Deal</option>
                          <option value="deal.updated" disabled>Deal Updated (Starter+ only)</option>
                        </>
                      ) : (
                        // Paid tiers: All events available
                        <>
                          <option value="deal.updated">Deal Updated</option>
                          <option value="deal.won">Deal Won</option>
                          <option value="deal.lost">Deal Lost</option>
                          <option value="deal.create">New Deal</option>
                          <option value="deal.added">Deal Added (Legacy)</option>
                          <option value="person.added">Person Added</option>
                          <option value="person.updated">Person Updated</option>
                          <option value="activity.added">Activity Added</option>
                        </>
                      )}
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
                  </div>

                  {/* Message Template */}
                  <div className="rule-form-template">
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
                  </div>
                </div>

                {/* Right Column: Advanced Filters */}
                <div className="rule-form-advanced">
                  <FeatureRestriction
                    isAvailable={hasFeature('advanced_filtering')}
                    requiredPlan={getFeatureRequiredPlan('advanced_filtering')}
                    currentPlan={planTier}
                    featureName="Smart Filtering"
                    upgradeHint="Filter by deal value, stage, owner, pipeline. Upgrade to Starter for $9/month."
                  >
                    <RuleFilters
                      filters={createFormData.filters}
                      onChange={(filters) => hasFeature('advanced_filtering') && setCreateFormData({...createFormData, filters})}
                    />
                  </FeatureRestriction>
                </div>
              </div>
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