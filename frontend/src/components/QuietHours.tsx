import { API_BASE_URL } from '../config/api';
import React, { useState, useEffect } from 'react';
import FeatureGate from './FeatureGate';
import './QuietHours.css';

interface QuietHoursConfig {
  timezone: string;
  start_time: string;
  end_time: string;
  weekends_enabled: boolean;
  holidays: string[];
  configured: boolean;
}

interface QuietHoursStatus {
  is_quiet: boolean;
  reason?: string;
  next_allowed?: string;
  tenant_time?: string;
}

interface QuietHoursProps {
  onRefresh?: () => void;
}

const DEFAULT_CONFIG: QuietHoursConfig = {
  timezone: 'UTC',
  start_time: '18:00',
  end_time: '09:00',
  weekends_enabled: false,
  holidays: [],
  configured: false
};

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' }
];

const QuietHours: React.FC<QuietHoursProps> = ({ onRefresh }) => {
  const [config, setConfig] = useState<QuietHoursConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<QuietHoursStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editConfig, setEditConfig] = useState<QuietHoursConfig>(DEFAULT_CONFIG);
  const [newHoliday, setNewHoliday] = useState('');

  useEffect(() => {
    loadQuietHours();
  }, []);

  const loadQuietHours = async () => {
    try {
      setIsLoading(true);
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const [configResponse, statusResponse] = await Promise.all([
        fetch(`${apiUrl}/api/v1/settings/quiet-hours`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${apiUrl}/api/v1/settings/quiet-hours/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (configResponse.ok) {
        const configData = await configResponse.json();
        setConfig(configData.quiet_hours);
        setEditConfig(configData.quiet_hours);
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setStatus(statusData);
      }

    } catch (error) {
      console.error('Error loading quiet hours:', error);
    }
    setIsLoading(false);
  };

  const saveQuietHours = async () => {
    try {
      setIsSaving(true);
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');

      const response = await fetch(`${apiUrl}/api/v1/settings/quiet-hours`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editConfig)
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.quiet_hours);
        setIsEditing(false);
        await loadQuietHours(); // Refresh status
        if (onRefresh) onRefresh();
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to save quiet hours: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error saving quiet hours:', error);
      alert('❌ Failed to save quiet hours');
    }
    setIsSaving(false);
  };

  const deleteQuietHours = async () => {
    if (!window.confirm('Remove quiet hours configuration? Notifications will be sent at any time.')) {
      return;
    }

    try {
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');

      const response = await fetch(`${apiUrl}/api/v1/settings/quiet-hours`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await loadQuietHours();
        if (onRefresh) onRefresh();
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to remove quiet hours: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error removing quiet hours:', error);
      alert('❌ Failed to remove quiet hours');
    }
  };

  const addHoliday = () => {
    if (!newHoliday.trim()) return;
    
    const holidays = [...editConfig.holidays, newHoliday];
    setEditConfig({ ...editConfig, holidays });
    setNewHoliday('');
  };

  const removeHoliday = (index: number) => {
    const holidays = editConfig.holidays.filter((_, i) => i !== index);
    setEditConfig({ ...editConfig, holidays });
  };

  const getStatusColor = () => {
    if (!status) return 'neutral';
    if (status.is_quiet) return 'quiet';
    return 'active';
  };

  const getStatusText = () => {
    if (!status) return 'Unknown';
    if (status.is_quiet) {
      const reason = status.reason;
      if (reason === 'weekend') return 'Weekend (Quiet)';
      if (reason === 'holiday') return 'Holiday (Quiet)';
      if (reason === 'quiet_hours') return 'Quiet Hours';
      return 'Quiet Time';
    }
    return 'Active';
  };

  const formatNextAllowed = (nextAllowed?: string) => {
    if (!nextAllowed) return 'N/A';
    const date = new Date(nextAllowed);
    return date.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="quiet-hours-loading">
        <div className="loading-spinner"></div>
        <p>Loading quiet hours...</p>
      </div>
    );
  }

  return (
    <FeatureGate 
      feature="quiet_hours"
      fallbackMessage="Quiet Hours is available in Professional and Team plans"
    >
      <div className="quiet-hours">
        <div className="quiet-hours-header">
          <h3>Quiet Hours</h3>
          <p>Control when notifications can be sent to avoid disrupting your team</p>
        </div>

      {status && (
        <div className={`quiet-status ${getStatusColor()}`}>
          <div className="status-indicator">
            {status.is_quiet ? '🔕' : '🔔'}
          </div>
          <div className="status-content">
            <div className="status-title">Current Status: {getStatusText()}</div>
            {status.is_quiet && status.next_allowed && (
              <div className="status-subtitle">
                Next notifications allowed: {formatNextAllowed(status.next_allowed)}
              </div>
            )}
            {status.tenant_time && (
              <div className="status-time">
                Current time: {new Date(status.tenant_time).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="quiet-hours-content">
        {!isEditing ? (
          <div className="quiet-hours-display">
            <div className="config-section">
              <h4>Configuration</h4>
              {config.configured ? (
                <div className="config-details">
                  <div className="config-row">
                    <span className="config-label">Timezone:</span>
                    <span className="config-value">{config.timezone}</span>
                  </div>
                  <div className="config-row">
                    <span className="config-label">Quiet Period:</span>
                    <span className="config-value">{config.start_time} - {config.end_time}</span>
                  </div>
                  <div className="config-row">
                    <span className="config-label">Weekend Notifications:</span>
                    <span className="config-value">{config.weekends_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  {config.holidays.length > 0 && (
                    <div className="config-row">
                      <span className="config-label">Holidays:</span>
                      <div className="config-holidays">
                        {config.holidays.map((holiday, index) => (
                          <span key={index} className="holiday-badge">{holiday}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-config">
                  <div className="no-config-icon">⏰</div>
                  <p>No quiet hours configured</p>
                  <p>Notifications will be sent immediately at any time</p>
                </div>
              )}
            </div>

            <div className="quiet-actions">
              <button
                className="edit-button"
                onClick={() => setIsEditing(true)}
              >
                {config.configured ? '✏️ Edit' : '⚙️ Configure'} Quiet Hours
              </button>
              {config.configured && (
                <button
                  className="delete-button"
                  onClick={deleteQuietHours}
                >
                  🗑️ Remove
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="quiet-hours-form">
            <div className="form-section">
              <h4>⏰ Quiet Period</h4>
              
              <div className="form-row">
                <div className="form-field">
                  <label>Timezone</label>
                  <select
                    value={editConfig.timezone}
                    onChange={(e) => setEditConfig({ ...editConfig, timezone: e.target.value })}
                  >
                    {COMMON_TIMEZONES.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={editConfig.start_time}
                    onChange={(e) => setEditConfig({ ...editConfig, start_time: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={editConfig.end_time}
                    onChange={(e) => setEditConfig({ ...editConfig, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-info">
                💡 Quiet period from {editConfig.start_time} to {editConfig.end_time} ({editConfig.timezone})
                {editConfig.start_time > editConfig.end_time && 
                  <span className="overnight-note"> (spans overnight)</span>
                }
              </div>
            </div>

            <div className="form-section">
              <h4>📅 Weekend Settings</h4>
              <div className="checkbox-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editConfig.weekends_enabled}
                    onChange={(e) => setEditConfig({ ...editConfig, weekends_enabled: e.target.checked })}
                  />
                  <span className="checkmark"></span>
                  Send notifications on weekends
                </label>
                <p className="field-help">
                  {editConfig.weekends_enabled 
                    ? 'Notifications will be sent on weekends during active hours'
                    : 'All weekend notifications will be delayed until Monday'
                  }
                </p>
              </div>
            </div>

            <div className="form-section">
              <h4>🏖️ Holidays</h4>
              <div className="holidays-list">
                {editConfig.holidays.map((holiday, index) => (
                  <div key={index} className="holiday-item">
                    <span className="holiday-date">{holiday}</span>
                    <button
                      type="button"
                      className="remove-holiday"
                      onClick={() => removeHoliday(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="add-holiday">
                <input
                  type="date"
                  value={newHoliday}
                  onChange={(e) => setNewHoliday(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
                <button
                  type="button"
                  onClick={addHoliday}
                  disabled={!newHoliday.trim()}
                >
                  Add Holiday
                </button>
              </div>
              <p className="field-help">
                Notifications on these dates will be delayed until the next business day
              </p>
            </div>

            <div className="form-actions">
              <button
                className="save-button"
                onClick={saveQuietHours}
                disabled={isSaving}
              >
                {isSaving ? '⏳ Saving...' : '💾 Save Configuration'}
              </button>
              <button
                className="cancel-button"
                onClick={() => {
                  setIsEditing(false);
                  setEditConfig(config);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="quiet-hours-info">
        <h5>How Quiet Hours Work</h5>
        <ul>
          <li><strong>Delayed Notifications:</strong> During quiet hours, notifications are queued and sent when allowed</li>
          <li><strong>Weekend Control:</strong> Choose whether to send notifications on weekends</li>
          <li><strong>Holiday Support:</strong> Add specific dates when notifications should be delayed</li>
          <li><strong>Timezone Aware:</strong> All times are calculated in your specified timezone</li>
          <li><strong>Automatic Processing:</strong> Delayed notifications are automatically sent when quiet hours end</li>
        </ul>
      </div>
      </div>
    </FeatureGate>
  );
};

export default QuietHours;