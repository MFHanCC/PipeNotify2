import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './StalledDealMonitor.css';
import StalledDealReports from './StalledDealReports';
import { API_BASE_URL } from '../config/api';

interface StalledDealThresholds {
  warning: number;
  stale: number;
  critical: number;
}

interface StalledDealSettings {
  enabled: boolean;
  thresholds: StalledDealThresholds;
  alertChannel?: string;
  scheduleTime: string; // Format: "HH:MM"
  summaryFrequency: 'daily' | 'weekly';
  minDealValue?: number;
}

interface StalledDealStats {
  totalDealsMonitored: number;
  stalledDealsFound: number;
  alertsSentToday: number;
  lastRunTime?: string;
  breakdown: {
    warning: number;
    stale: number;
    critical: number;
  };
}

interface Webhook {
  id: string;
  name: string;
  is_active: boolean;
}

interface StalledDealMonitorProps {
  webhooks: Webhook[];
  onRefresh?: () => void;
}

const StalledDealMonitor: React.FC<StalledDealMonitorProps> = ({ webhooks, onRefresh }) => {
  const [settings, setSettings] = useState<StalledDealSettings>({
    enabled: false,
    thresholds: {
      warning: 3,
      stale: 7,
      critical: 14
    },
    scheduleTime: '09:00',
    summaryFrequency: 'daily'
  });

  const [stats, setStats] = useState<StalledDealStats>({
    totalDealsMonitored: 0,
    stalledDealsFound: 0,
    alertsSentToday: 0,
    breakdown: {
      warning: 0,
      stale: 0,
      critical: 0
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [activeTab, setActiveTab] = useState<'settings' | 'stats' | 'reports' | 'history'>('settings');

  // Enhanced error handling
  const handleApiError = useCallback((error: any, operation: string) => {
    let message = `Failed to ${operation}`;
    if (error?.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error?.status === 403) {
      message = 'Permission denied.';
    } else if (error?.message) {
      message = error.message;
    }
    setError(message);
  }, []);

  // Settings validation
  const validationResults = useMemo(() => {
    const errors: {[key: string]: string} = {};
    
    if (settings.thresholds.warning >= settings.thresholds.stale) {
      errors.warning = 'Warning threshold must be less than stale threshold';
    }
    
    if (settings.thresholds.stale >= settings.thresholds.critical) {
      errors.stale = 'Stale threshold must be less than critical threshold';
    }
    
    if (settings.minDealValue && settings.minDealValue < 0) {
      errors.minDealValue = 'Minimum deal value must be positive';
    }
    
    return errors;
  }, [settings]);

  // Memoized webhook options
  const webhookOptions = useMemo(() => 
    webhooks?.filter(w => w.is_active) || [], 
    [webhooks]
  );

  useEffect(() => {
    loadStalledDealData();
  }, []);

  const loadStalledDealData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadSettings(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading stalled deal data:', error);
    }
    setIsLoading(false);
  };

  const loadSettings = async () => {
    try {
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/stalled-deals/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error('Error loading stalled deal settings:', error);
    }
  };

  const loadStats = async () => {
    try {
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/stalled-deals/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Error loading stalled deal stats:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/stalled-deals/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        alert('✅ Stalled deal settings saved successfully!');
        if (onRefresh) onRefresh();
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to save settings: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving stalled deal settings:', error);
      alert('❌ Failed to save settings');
    }
    setIsSaving(false);
  };

  const testAlert = async () => {
    try {
      setIsTestingAlert(true);
      
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/stalled-deals/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ channelId: settings.alertChannel }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Test alert sent successfully! Found ${result.stalledDealsCount} stalled deals.`);
      } else {
        const errorData = await response.json();
        alert(`❌ Test failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing stalled deal alert:', error);
      alert('❌ Test alert failed');
    }
    setIsTestingAlert(false);
  };

  const runMonitoringNow = async () => {
    try {
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/stalled-deals/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Stalled deal monitoring completed! Processed ${result.tenantsProcessed} tenants, found ${result.totalStalledDeals} stalled deals.`);
        loadStats(); // Refresh stats
      } else {
        const errorData = await response.json();
        alert(`❌ Monitoring failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error running stalled deal monitoring:', error);
      alert('❌ Failed to run monitoring');
    }
  };

  const renderSettingsTab = () => (
    <div className="stalled-settings">
      <div className="settings-hero">
        <h2>⚙️ Stalled Deal Settings</h2>
        <p>Configure automated monitoring for deals with no recent activity</p>
      </div>
      
      <div className="settings-layout">
        <div className="settings-main">
          <div className="settings-grid">
            <div className="settings-category compact">
              <h4>🔄 Monitoring</h4>
              <div className="setting-item compact">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      enabled: e.target.checked
                    })}
                  />
                  <span>Enable monitoring</span>
                </label>
              </div>
              <div className="setting-item compact">
                <label htmlFor="alert-channel">Alert channel</label>
                <select
                  id="alert-channel"
                  className="form-select compact"
                  value={settings.alertChannel || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    alertChannel: e.target.value || undefined
                  })}
                >
                  <option value="">Select channel</option>
                  {webhooks.filter(w => w.is_active).map(webhook => (
                    <option key={webhook.id} value={webhook.id}>
                      {webhook.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-category compact">
              <h4>⏱️ Thresholds</h4>
              <div className="setting-item compact">
                <label htmlFor="warning-days">Warning (days)</label>
                <input
                  id="warning-days"
                  type="number"
                  min="1"
                  max="30"
                  className="form-input compact"
                  value={settings.thresholds.warning}
                  onChange={(e) => setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      warning: parseInt(e.target.value) || 3
                    }
                  })}
                />
              </div>
              <div className="setting-item compact">
                <label htmlFor="stale-days">Stale (days)</label>
                <input
                  id="stale-days"
                  type="number"
                  min="1"
                  max="30"
                  className="form-input compact"
                  value={settings.thresholds.stale}
                  onChange={(e) => setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      stale: parseInt(e.target.value) || 7
                    }
                  })}
                />
              </div>
              <div className="setting-item compact">
                <label htmlFor="critical-days">Critical (days)</label>
                <input
                  id="critical-days"
                  type="number"
                  min="1"
                  max="90"
                  className="form-input compact"
                  value={settings.thresholds.critical}
                  onChange={(e) => setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      critical: parseInt(e.target.value) || 14
                    }
                  })}
                />
              </div>
            </div>

            <div className="settings-category compact">
              <h4>⏰ Schedule</h4>
              <div className="setting-item compact">
                <label htmlFor="check-time">Daily check time</label>
                <input
                  id="check-time"
                  type="time"
                  className="form-input compact"
                  value={settings.scheduleTime}
                  onChange={(e) => setSettings({
                    ...settings,
                    scheduleTime: e.target.value
                  })}
                />
              </div>
              <div className="setting-item compact">
                <label htmlFor="summary-frequency">Summary reports</label>
                <select
                  id="summary-frequency"
                  className="form-select compact"
                  value={settings.summaryFrequency}
                  onChange={(e) => setSettings({
                    ...settings,
                    summaryFrequency: e.target.value as 'daily' | 'weekly'
                  })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            
            <div className="settings-category compact">
              <h4>💰 Value Filter</h4>
              <div className="setting-item compact">
                <label htmlFor="min-deal-value">Minimum deal value ($)</label>
                <input
                  id="min-deal-value"
                  type="number"
                  min="0"
                  step="1000"
                  className="form-input compact"
                  value={settings.minDealValue || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    minDealValue: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                  placeholder="Leave blank for all deals"
                />
              </div>
            </div>
            
            <div className="settings-category compact">
              <h4>🛠️ Tools</h4>
              <div className="setting-tools">
                <button 
                  className="tool-button" 
                  onClick={testAlert}
                  disabled={isTestingAlert || !settings.alertChannel}
                >
                  {isTestingAlert ? '⏳ Testing' : '🧪 Test'}
                </button>
                <button 
                  className="tool-button" 
                  onClick={runMonitoringNow}
                  disabled={!settings.enabled}
                >
                  🚀 Run Now
                </button>
              </div>
            </div>
          </div>

          <div className="settings-actions compact">
            <button
              className="button-primary"
              onClick={saveSettings}
              disabled={isSaving || !settings.alertChannel}
            >
              {isSaving ? (
                <>
                  <span className="loading-spinner-inline"></span>
                  Saving...
                </>
              ) : (
                '💾 Save Settings'
              )}
            </button>
          </div>
        </div>

        <div className="settings-sidebar">
          <div className="help-section">
            <h3>How It Works</h3>
            <div className="faq-compact">
              <details className="faq-item">
                <summary>What are the alert levels?</summary>
                <p>Warning (3+ days), Stale (7+ days), Critical (14+ days) - alerts trigger when deals haven't been updated for these periods.</p>
              </details>
              <details className="faq-item">
                <summary>When do checks run?</summary>
                <p>Automated checks run daily at your specified time. You can also trigger manual checks using "Run Now".</p>
              </details>
              <details className="faq-item">
                <summary>Can I filter by deal value?</summary>
                <p>Yes, set a minimum deal value to only monitor high-value deals. Leave blank to monitor all deals.</p>
              </details>
            </div>
          </div>

          <div className="support-section">
            <h3>Need Help?</h3>
            <p>Configure thresholds based on your sales cycle and team preferences.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className="stalled-stats">
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h5>Deals Monitored</h5>
            <span className="stat-number">{stats.totalDealsMonitored}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h5>Stalled Deals</h5>
            <span className="stat-number">{stats.stalledDealsFound}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📢</div>
          <div className="stat-content">
            <h5>Alerts Today</h5>
            <span className="stat-number">{stats.alertsSentToday}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🕐</div>
          <div className="stat-content">
            <h5>Last Run</h5>
            <span className="stat-time">
              {stats.lastRunTime ? new Date(stats.lastRunTime).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      <div className="breakdown-section">
        <h4>📈 Stalled Deal Breakdown</h4>
        <div className="breakdown-grid">
          <div className="breakdown-item warning">
            <div className="breakdown-icon">⚠️</div>
            <div className="breakdown-content">
              <h5>Warning</h5>
              <span className="breakdown-count">{stats.breakdown.warning}</span>
              <span className="breakdown-desc">{settings.thresholds.warning}+ days</span>
            </div>
          </div>
          
          <div className="breakdown-item stale">
            <div className="breakdown-icon">🟠</div>
            <div className="breakdown-content">
              <h5>Stale</h5>
              <span className="breakdown-count">{stats.breakdown.stale}</span>
              <span className="breakdown-desc">{settings.thresholds.stale}+ days</span>
            </div>
          </div>
          
          <div className="breakdown-item critical">
            <div className="breakdown-icon">🚨</div>
            <div className="breakdown-content">
              <h5>Critical</h5>
              <span className="breakdown-count">{stats.breakdown.critical}</span>
              <span className="breakdown-desc">{settings.thresholds.critical}+ days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="stalled-history">
      <div className="history-header">
        <h4>📋 Monitoring History</h4>
        <button className="refresh-button" onClick={loadStalledDealData}>
          🔄 Refresh
        </button>
      </div>
      
      <div className="history-placeholder">
        <div className="placeholder-icon">📊</div>
        <h5>History tracking coming soon</h5>
        <p>Detailed monitoring history and trend analysis will be available in the next update.</p>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="stalled-deal-monitor-loading">
        <div className="loading-spinner"></div>
        <p>Loading stalled deal monitoring...</p>
      </div>
    );
  }

  return (
    <div className="stalled-deal-monitor">
      <div className="stalled-header">
        <h3>📊 Stalled Deal Monitoring</h3>
        <p>Automatically track deals with no recent activity and send proactive alerts</p>
        {!settings.enabled && (
          <div className="status-banner disabled">
            ⚠️ Monitoring is currently disabled
          </div>
        )}
        {settings.enabled && !settings.alertChannel && (
          <div className="status-banner warning">
            🔧 Please select an alert channel to complete setup
          </div>
        )}
        {settings.enabled && settings.alertChannel && (
          <div className="status-banner active">
            ✅ Monitoring is active and configured
          </div>
        )}
      </div>

      <div className="stalled-tabs">
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
        <button
          className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📈 Reports
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 History
        </button>
      </div>

      <div className="stalled-content">
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'reports' && <StalledDealReports onRefresh={loadStalledDealData} />}
        {activeTab === 'history' && renderHistoryTab()}
      </div>

      <div className="stalled-info">
        <h5>How Stalled Deal Monitoring Works</h5>
        <ul>
          <li><strong>Activity Tracking:</strong> Monitors when deals were last updated in Pipedrive</li>
          <li><strong>Smart Alerts:</strong> Different severity levels based on days of inactivity</li>
          <li><strong>Automated Schedule:</strong> Runs daily checks at your specified time</li>
          <li><strong>Value Filtering:</strong> Optional minimum deal value threshold</li>
          <li><strong>Channel Routing:</strong> Sends alerts to your designated Google Chat channel</li>
        </ul>
      </div>
    </div>
  );
};

export default StalledDealMonitor;