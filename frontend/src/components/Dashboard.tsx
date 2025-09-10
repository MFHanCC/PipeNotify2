import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'logs'>('overview');

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

      // Load stats
      const statsResponse = await fetch(`${apiUrl}/api/v1/dashboard/stats?range=${dateRange}`, { headers });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load rules
      const rulesResponse = await fetch(`${apiUrl}/api/v1/rules`, { headers });
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData);
      }

      // Load logs
      const logsParams = new URLSearchParams({
        page: logsPage.toString(),
        limit: logsPerPage.toString(),
        status: statusFilter !== 'all' ? statusFilter : '',
        rule: ruleFilter !== 'all' ? ruleFilter : '',
        range: dateRange,
      });
      
      const logsResponse = await fetch(`${apiUrl}/api/v1/logs?${logsParams}`, { headers });
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData.logs || []);
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
      
      const response = await fetch(`${apiUrl}/api/v1/rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });

      if (response.ok) {
        setRules(rules.map(r => 
          r.id === ruleId 
            ? { ...r, enabled: !r.enabled }
            : r
        ));
      }
    } catch (err) {
      setError('Failed to toggle rule');
    }
  };

  const testRule = async (ruleId: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/rules/${ruleId}/test`, {
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

  const deleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/rules/${ruleId}`, {
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
          onClick={() => window.location.href = '/onboarding'}
        >
          + Create Rule
        </button>
      </div>
      
      <div className="rules-list">
        {rules.map((rule) => (
          <div key={rule.id} className="rule-card">
            <div className="rule-header">
              <div className="rule-info">
                <h4>{rule.name}</h4>
                <div className="rule-meta">
                  <span className="event-type">{rule.eventType}</span>
                  <span className="template-mode">{rule.templateMode}</span>
                  <span className="target-space">→ {rule.targetSpace}</span>
                </div>
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
                    🧪
                  </button>
                  
                  <button
                    className="edit-button"
                    onClick={() => alert('Edit functionality coming soon!')}
                    title="Edit rule"
                  >
                    ✏️
                  </button>
                  
                  <button
                    className="delete-button"
                    onClick={() => deleteRule(rule.id)}
                    title="Delete rule"
                  >
                    🗑️
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
            onClick={() => window.location.href = '/onboarding'}
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
      </div>
    </div>
  );
};

export default Dashboard;