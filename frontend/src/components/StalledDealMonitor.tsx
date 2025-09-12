import React, { useState, useEffect } from 'react';
import './StalledDealMonitor.css';
import StalledDealReports from './StalledDealReports';

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
  const [activeTab, setActiveTab] = useState<'settings' | 'stats' | 'reports' | 'history'>('settings');

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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
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
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
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
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
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
      <div className="settings-section">
        <div className="setting-header">
          <h4>🔄 Monitoring Status</h4>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({
                ...settings,
                enabled: e.target.checked
              })}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
        <p>Automatically monitor deals for inactivity and send alerts</p>
      </div>

      <div className="settings-section">
        <h4>⏱️ Alert Thresholds (Days)</h4>
        <p>Configure how many days of inactivity trigger different alert levels</p>
        
        <div className="threshold-grid">
          <div className="threshold-item">
            <label>⚠️ Warning</label>
            <input
              type="number"
              min="1"
              max="30"
              value={settings.thresholds.warning}
              onChange={(e) => setSettings({
                ...settings,
                thresholds: {
                  ...settings.thresholds,
                  warning: parseInt(e.target.value) || 3
                }
              })}
            />
            <span className="threshold-desc">Initial alert level</span>
          </div>
          
          <div className="threshold-item">
            <label>🟠 Stale</label>
            <input
              type="number"
              min="1"
              max="30"
              value={settings.thresholds.stale}
              onChange={(e) => setSettings({
                ...settings,
                thresholds: {
                  ...settings.thresholds,
                  stale: parseInt(e.target.value) || 7
                }
              })}
            />
            <span className="threshold-desc">Medium priority</span>
          </div>
          
          <div className="threshold-item">
            <label>🚨 Critical</label>
            <input
              type="number"
              min="1"
              max="90"
              value={settings.thresholds.critical}
              onChange={(e) => setSettings({
                ...settings,
                thresholds: {
                  ...settings.thresholds,
                  critical: parseInt(e.target.value) || 14
                }
              })}
            />
            <span className="threshold-desc">High priority alert</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h4>📢 Alert Channel</h4>
        <p>Choose which Google Chat channel receives stalled deal alerts</p>
        
        <select
          value={settings.alertChannel || ''}
          onChange={(e) => setSettings({
            ...settings,
            alertChannel: e.target.value || undefined
          })}
          className="channel-select"
        >
          <option value="">Select Alert Channel</option>
          {webhooks.filter(w => w.is_active).map(webhook => (
            <option key={webhook.id} value={webhook.id}>
              {webhook.name}
            </option>
          ))}
        </select>
        
        {settings.alertChannel && (
          <button
            className="test-alert-button"
            onClick={testAlert}
            disabled={isTestingAlert}
          >
            {isTestingAlert ? '⏳ Testing...' : '🧪 Test Alert'}
          </button>
        )}
      </div>

      <div className="settings-section">
        <h4>⏰ Schedule & Frequency</h4>
        <div className="schedule-grid">
          <div className="schedule-item">
            <label>Daily Check Time</label>
            <input
              type="time"
              value={settings.scheduleTime}
              onChange={(e) => setSettings({
                ...settings,
                scheduleTime: e.target.value
              })}
            />
          </div>
          
          <div className="schedule-item">
            <label>Summary Reports</label>
            <select
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
      </div>

      <div className="settings-section">
        <h4>💰 Minimum Deal Value (Optional)</h4>
        <p>Only monitor deals worth at least this amount</p>
        
        <div className="value-filter">
          <span className="currency-symbol">$</span>
          <input
            type="number"
            min="0"
            step="1000"
            value={settings.minDealValue || ''}
            onChange={(e) => setSettings({
              ...settings,
              minDealValue: e.target.value ? parseInt(e.target.value) : undefined
            })}
            placeholder="e.g., 5000"
          />
          <span className="value-desc">Leave blank to monitor all deals</span>
        </div>
      </div>

      <div className="settings-actions">
        <button
          className="save-settings-button"
          onClick={saveSettings}
          disabled={isSaving || !settings.alertChannel}
        >
          {isSaving ? '⏳ Saving...' : '💾 Save Settings'}
        </button>
        
        <button
          className="run-now-button"
          onClick={runMonitoringNow}
          disabled={!settings.enabled}
        >
          🚀 Run Monitoring Now
        </button>
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