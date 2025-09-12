import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';
import WebhookManager from './WebhookManager';
import RuleFilters from './RuleFilters';
import TemplateEditor from './TemplateEditor';
import ChannelRouting from './ChannelRouting';
import QuietHours from './QuietHours';
import AnalyticsDashboard from './AnalyticsDashboard';
import NotificationPreview from './NotificationPreview';
import BulkRuleManager from './BulkRuleManager';
import OnboardingWizard from './OnboardingWizard';
import StalledDealMonitor from './StalledDealMonitor';

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

// JWT Token utilities
const decodeJWTPayload = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const Dashboard: React.FC = () => {
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
  
  // Filters and pagination
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [logsPage] = useState(1);
  const logsPerPage = 20;
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'logs' | 'webhooks' | 'routing' | 'quiet-hours' | 'stalled-deals' | 'analytics' | 'testing' | 'bulk-management' | 'onboarding'>('overview');
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{name: string; enabled: boolean}>({name: '', enabled: true});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    event_type: 'deal.updated',
    target_webhook_id: '',
    template_mode: 'compact' as 'simple' | 'compact' | 'detailed' | 'custom',
    custom_template: undefined as string | undefined,
    enabled: true,
    filters: {},
  });
  const [availableWebhooks, setAvailableWebhooks] = useState<Array<{id: string; name: string}>>([]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // Get tenant ID from JWT token
      let tenantId = '1'; // Fallback
      if (token) {
        const payload = decodeJWTPayload(token);
        if (payload && payload.tenantId) {
          tenantId = payload.tenantId.toString();
        }
      }

      // Load stats from monitoring dashboard
      const statsResponse = await fetch(`${apiUrl}/api/v1/monitoring/dashboard/${tenantId}?days=${dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 1}`, { headers });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        // Transform monitoring data to dashboard stats format
        setStats({
          totalNotifications: statsData.summary?.channel_routing?.total_notifications || 0,
          successRate: statsData.summary?.channel_routing?.avg_success_rate || 0,
          activeRules: statsData.summary?.rule_filters?.total_rules || 0,
          avgDeliveryTime: 250, // Placeholder since monitoring doesn't track delivery time
        });
      } else {
        console.warn('Failed to load stats, using fallback data');
        // Set fallback stats if monitoring endpoint fails
        setStats({
          totalNotifications: 0,
          successRate: 0,
          activeRules: 0,
          avgDeliveryTime: 0,
        });
      }

      // Load rules from admin endpoint
      const rulesResponse = await fetch(`${apiUrl}/api/v1/admin/rules`, { headers });
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        // Transform backend rule format to frontend format
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
          activeRules: transformedRules.filter(rule => rule.enabled).length
        }));
      }

      // Load logs from admin endpoint
      const logsParams = new URLSearchParams({
        page: logsPage.toString(),
        limit: logsPerPage.toString(),
        status: statusFilter !== 'all' ? statusFilter : '',
        rule_id: ruleFilter !== 'all' ? ruleFilter : '',
      });
      
      const logsResponse = await fetch(`${apiUrl}/api/v1/admin/logs?${logsParams}`, { headers });
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        // Transform backend log format to frontend format
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

      // Load webhooks for create rule form
      const webhooksResponse = await fetch(`${apiUrl}/api/v1/admin/webhooks`, { headers });
      if (webhooksResponse.ok) {
        const webhooksData = await webhooksResponse.json();
        console.log('🔗 Webhooks response:', webhooksData);
        setAvailableWebhooks((webhooksData.webhooks || []).map((webhook: any) => ({
          id: webhook.id.toString(),
          name: webhook.name || webhook.url || 'Unnamed Webhook',
        })));
      } else {
        console.error('❌ Failed to load webhooks:', webhooksResponse.status, await webhooksResponse.text());
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
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

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: rule.name,
          event_type: rule.eventType,
          target_webhook_id: rule.targetSpace,
          template_mode: rule.templateMode,
          enabled: !rule.enabled 
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
          activeRules: updatedRules.filter(rule => rule.enabled).length
        }));
      }
    } catch (err) {
      setError('Failed to toggle rule');
    }
  };

  const testRule = async (ruleId: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/rules/${ruleId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
    });
  };

  const cancelEditRule = () => {
    setEditingRule(null);
    setEditFormData({name: '', enabled: true});
  };

  const saveEditRule = async (ruleId: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editFormData.name,
          enabled: editFormData.enabled,
        }),
      });

      if (response.ok) {
        setRules(rules.map(r => 
          r.id === ruleId 
            ? { ...r, name: editFormData.name, enabled: editFormData.enabled }
            : r
        ));
        setEditingRule(null);
        setEditFormData({name: '', enabled: true});
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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setRules(rules.filter(r => r.id !== ruleId));
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
      custom_template: undefined,
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
      custom_template: undefined,
      enabled: true,
      filters: {},
    });
  };

  const createNewRule = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createFormData.name,
          event_type: createFormData.event_type,
          target_webhook_id: parseInt(createFormData.target_webhook_id),
          template_mode: createFormData.template_mode,
          custom_template: createFormData.custom_template,
          enabled: createFormData.enabled,
          filters: createFormData.filters,
        }),
      });

      if (response.ok) {
        // Refresh the dashboard data to show the new rule
        await loadDashboardData();
        closeCreateModal();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create rule');
      }
    } catch (err) {
      setError('Failed to create rule');
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
      <div className="stats-grid">
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
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                      className="edit-name-input"
                      placeholder="Rule name"
                    />
                    <div className="edit-actions">
                      <button
                        className="save-button"
                        onClick={() => saveEditRule(rule.id)}
                        disabled={!editFormData.name.trim()}
                      >
                        ✓ Save
                      </button>
                      <button
                        className="cancel-button"
                        onClick={cancelEditRule}
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
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  
                  <button
                    className="test-button"
                    onClick={() => testRule(rule.id)}
                    title="Send test notification"
                  >
                    Test
                  </button>
                  
                  <button
                    className="edit-button"
                    onClick={() => startEditRule(rule)}
                    title="Edit rule"
                    disabled={editingRule !== null}
                  >
                    Edit
                  </button>
                  
                  <button
                    className="delete-button"
                    onClick={() => deleteRule(rule.id)}
                    title="Delete rule"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            
            <div className="rule-filters">
              <strong>Filters:</strong>
              {rule.filters.pipeline && <span className="filter">Pipeline: {rule.filters.pipeline}</span>}
              {rule.filters.stage && <span className="filter">Stage: {rule.filters.stage}</span>}
              {rule.filters.owner && <span className="filter">Owner: {rule.filters.owner}</span>}
              {rule.filters.minValue && <span className="filter">Min Value: ${rule.filters.minValue}</span>}
            </div>
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
    <div className="dashboard">
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button 
            className="error-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
      
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Pipedrive → Google Chat</h1>
          <p>Monitor and manage your notification rules and delivery logs</p>
        </div>
        
        <nav className="dashboard-nav">
          <button 
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`nav-tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            ⚙️ Rules ({stats.activeRules})
          </button>
          <button 
            className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            📋 Logs
          </button>
          <button 
            className={`nav-tab ${activeTab === 'webhooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('webhooks')}
          >
            🔗 Webhooks ({availableWebhooks.length})
          </button>
          <button 
            className={`nav-tab ${activeTab === 'routing' ? 'active' : ''}`}
            onClick={() => setActiveTab('routing')}
          >
            🎯 Smart Routing
          </button>
          <button 
            className={`nav-tab ${activeTab === 'quiet-hours' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiet-hours')}
          >
            🔕 Quiet Hours
          </button>
          <button 
            className={`nav-tab ${activeTab === 'stalled-deals' ? 'active' : ''}`}
            onClick={() => setActiveTab('stalled-deals')}
          >
            📊 Stalled Deals
          </button>
          <button 
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>
          <button 
            className={`nav-tab ${activeTab === 'testing' ? 'active' : ''}`}
            onClick={() => setActiveTab('testing')}
          >
            🧪 Testing
          </button>
          <button 
            className={`nav-tab ${activeTab === 'bulk-management' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk-management')}
          >
            📋 Bulk Management
          </button>
          <button 
            className={`nav-tab ${activeTab === 'onboarding' ? 'active' : ''}`}
            onClick={() => setActiveTab('onboarding')}
          >
            🎓 Onboarding
          </button>
          <button 
            className="nav-tab"
            onClick={() => window.location.href = '/billing'}
          >
            💳 Billing
          </button>
          <button 
            className="nav-tab"
            onClick={() => window.location.href = '/pricing'}
          >
            💎 Pricing
          </button>
        </nav>
      </div>
      
      <div className="dashboard-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'rules' && renderRules()}
        {activeTab === 'logs' && renderLogs()}
        {activeTab === 'webhooks' && (
          <WebhookManager 
            onWebhooksChange={(webhooks) => {
              setAvailableWebhooks(webhooks.map(w => ({ id: w.id, name: w.name })));
            }}
          />
        )}
        {activeTab === 'routing' && (
          <ChannelRouting 
            webhooks={availableWebhooks.map(w => ({ ...w, is_active: true, description: '' }))}
            onRefresh={loadDashboardData}
          />
        )}
        {activeTab === 'quiet-hours' && (
          <QuietHours 
            onRefresh={loadDashboardData}
          />
        )}
        {activeTab === 'stalled-deals' && (
          <StalledDealMonitor 
            webhooks={availableWebhooks.map(w => ({ ...w, is_active: true }))}
            onRefresh={loadDashboardData}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard 
            onRefresh={loadDashboardData}
          />
        )}
        {activeTab === 'testing' && (
          <NotificationPreview 
            onRefresh={loadDashboardData}
          />
        )}
        {activeTab === 'bulk-management' && (
          <BulkRuleManager 
            onRefresh={loadDashboardData}
          />
        )}
        {activeTab === 'onboarding' && (
          <OnboardingWizard 
            onComplete={() => setActiveTab('overview')}
            onSkip={() => setActiveTab('overview')}
          />
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Rule</h3>
              <button className="modal-close" onClick={closeCreateModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Rule Name *</label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                  placeholder="e.g., Deal Won Notifications"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Event Type *</label>
                <select
                  value={createFormData.event_type}
                  onChange={(e) => setCreateFormData({...createFormData, event_type: e.target.value})}
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
                <label>Target Google Chat *</label>
                <select
                  value={createFormData.target_webhook_id}
                  onChange={(e) => setCreateFormData({...createFormData, target_webhook_id: e.target.value})}
                  className="form-select"
                >
                  {availableWebhooks.length === 0 ? (
                    <option value="">No webhooks available - go through onboarding first</option>
                  ) : (
                    availableWebhooks.map(webhook => (
                      <option key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </option>
                    ))
                  )}
                </select>
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
                  custom_template: templateData.custom_template
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
                disabled={!createFormData.name.trim() || !createFormData.target_webhook_id}
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;