import { API_BASE_URL } from '../config/api';
import React, { useState, useEffect } from 'react';
import './ChannelRouting.css';

interface Webhook {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface RoutingConfig {
  highValueChannel?: string;
  highValueThreshold?: number;
  winsChannel?: string;
  leadsChannel?: string;
  urgentChannel?: string;
  lostAnalysisChannel?: string;
}

interface RoutingSuggestion {
  type: 'setup' | 'channel-type';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  channels?: string[];
  suggestedNames?: string[];
}

interface RoutingStats {
  channel_name: string;
  channel_id: string;
  notifications_sent: number;
  success_rate: number;
  avg_response_time_ms: number;
  rules_count: number;
}

interface ChannelRoutingProps {
  webhooks: Webhook[];
  onRefresh?: () => void;
}

const ChannelRouting: React.FC<ChannelRoutingProps> = ({ webhooks, onRefresh }) => {
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig>({
    highValueThreshold: 10000,
  });
  const [suggestions, setSuggestions] = useState<RoutingSuggestion[]>([]);
  const [stats, setStats] = useState<RoutingStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'suggestions'>('config');
  const [isCreatingRules, setIsCreatingRules] = useState(false);

  useEffect(() => {
    loadRoutingData();
  }, [webhooks]);

  const loadRoutingData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadSuggestions(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading routing data:', error);
    }
    setIsLoading(false);
  };

  const loadSuggestions = async () => {
    try {
      // Mock suggestions based on webhook setup
      const activehooks = webhooks.filter(w => w.is_active);
      const mockSuggestions: RoutingSuggestion[] = [];

      if (activehooks.length === 1) {
        mockSuggestions.push({
          type: 'setup',
          priority: 'high',
          title: 'Add specialized channels',
          description: 'Consider creating separate channels for high-value deals, wins, and urgent notifications',
          channels: ['High Value Deals', 'Wins & Celebrations', 'Urgent Notifications']
        });
      }

      // Check for missing channel types
      const channelTypes = {
        'high-value': ['executive', 'vip', 'high-value', 'leadership'],
        'wins': ['wins', 'celebrations', 'closed-won', 'success'],
        'leads': ['leads', 'new-business', 'prospects', 'new-deals'],
        'urgent': ['urgent', 'alerts', 'hot-deals'],
        'lost-analysis': ['lost-deals', 'analysis', 'review']
      };

      Object.entries(channelTypes).forEach(([type, keywords]) => {
        const hasChannelType = activehooks.some(w => 
          keywords.some(keyword => 
            w.name?.toLowerCase().includes(keyword) ||
            w.description?.toLowerCase().includes(keyword)
          )
        );

        if (!hasChannelType && activehooks.length >= 2) {
          mockSuggestions.push({
            type: 'channel-type',
            priority: 'medium',
            title: `Consider adding ${type.replace('-', ' ')} channel`,
            description: `Create a dedicated channel for ${type.replace('-', ' ')} notifications`,
            suggestedNames: keywords.slice(0, 2)
          });
        }
      });

      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Mock stats data - in production this would be from API
      const mockStats: RoutingStats[] = webhooks
        .filter(w => w.is_active)
        .map((webhook, index) => ({
          channel_name: webhook.name,
          channel_id: webhook.id,
          notifications_sent: Math.floor(Math.random() * 100) + 10,
          success_rate: Math.floor(Math.random() * 20) + 80, // 80-100%
          avg_response_time_ms: Math.floor(Math.random() * 300) + 150, // 150-450ms
          rules_count: Math.floor(Math.random() * 3) + 1
        }));

      setStats(mockStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const createRoutingRules = async () => {
    try {
      setIsCreatingRules(true);
      
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${apiUrl}/api/v1/admin/routing/create-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(routingConfig),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Successfully created ${result.rulesCreated || 0} routing rules!`);
        if (onRefresh) onRefresh();
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to create routing rules: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating routing rules:', error);
      alert('❌ Failed to create routing rules');
    }
    setIsCreatingRules(false);
  };

  const getChannelsByType = (keywords: string[]) => {
    return webhooks.filter(w => 
      w.is_active && keywords.some(keyword => 
        w.name?.toLowerCase().includes(keyword.toLowerCase()) ||
        w.description?.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  };

  const renderConfigTab = () => (
    <div className="routing-config">
      <div className="config-section">
        <h4>🏆 High-Value Deals</h4>
        <p>Route high-value deals to executive or leadership channels</p>
        
        <div className="config-row">
          <div className="config-field">
            <label>Value Threshold ($)</label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={routingConfig.highValueThreshold || ''}
              onChange={(e) => setRoutingConfig({
                ...routingConfig,
                highValueThreshold: parseInt(e.target.value) || undefined
              })}
              placeholder="10000"
            />
          </div>
          
          <div className="config-field">
            <label>Target Channel</label>
            <select
              value={routingConfig.highValueChannel || ''}
              onChange={(e) => setRoutingConfig({
                ...routingConfig,
                highValueChannel: e.target.value || undefined
              })}
            >
              <option value="">Select Channel</option>
              {webhooks.filter(w => w.is_active).map(webhook => (
                <option key={webhook.id} value={webhook.name}>
                  {webhook.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {routingConfig.highValueThreshold && (
          <div className="config-preview">
            💡 Deals worth ${routingConfig.highValueThreshold?.toLocaleString()} or more will be routed to {routingConfig.highValueChannel || 'the selected channel'}
          </div>
        )}
      </div>

      <div className="config-section">
        <h4>🎉 Won Deals</h4>
        <p>Route won deals to celebration or wins channels</p>
        
        <div className="config-field">
          <label>Wins Channel</label>
          <select
            value={routingConfig.winsChannel || ''}
            onChange={(e) => setRoutingConfig({
              ...routingConfig,
              winsChannel: e.target.value || undefined
            })}
          >
            <option value="">Select Channel</option>
            {webhooks.filter(w => w.is_active).map(webhook => (
              <option key={webhook.id} value={webhook.name}>
                {webhook.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="suggested-channels">
          {getChannelsByType(['wins', 'celebrations', 'success']).map(channel => (
            <button
              key={channel.id}
              className="suggested-channel"
              onClick={() => setRoutingConfig({
                ...routingConfig,
                winsChannel: channel.name
              })}
            >
              ✨ {channel.name}
            </button>
          ))}
        </div>
      </div>

      <div className="config-section">
        <h4>🆕 New Leads</h4>
        <p>Route new deals and leads to prospecting channels</p>
        
        <div className="config-field">
          <label>Leads Channel</label>
          <select
            value={routingConfig.leadsChannel || ''}
            onChange={(e) => setRoutingConfig({
              ...routingConfig,
              leadsChannel: e.target.value || undefined
            })}
          >
            <option value="">Select Channel</option>
            {webhooks.filter(w => w.is_active).map(webhook => (
              <option key={webhook.id} value={webhook.name}>
                {webhook.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="suggested-channels">
          {getChannelsByType(['leads', 'new-business', 'prospects']).map(channel => (
            <button
              key={channel.id}
              className="suggested-channel"
              onClick={() => setRoutingConfig({
                ...routingConfig,
                leadsChannel: channel.name
              })}
            >
              🎯 {channel.name}
            </button>
          ))}
        </div>
      </div>

      <div className="config-section">
        <h4>🔥 Urgent Deals</h4>
        <p>Route high-probability deals (80%+) to urgent channels</p>
        
        <div className="config-field">
          <label>Urgent Channel</label>
          <select
            value={routingConfig.urgentChannel || ''}
            onChange={(e) => setRoutingConfig({
              ...routingConfig,
              urgentChannel: e.target.value || undefined
            })}
          >
            <option value="">Select Channel</option>
            {webhooks.filter(w => w.is_active).map(webhook => (
              <option key={webhook.id} value={webhook.name}>
                {webhook.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="suggested-channels">
          {getChannelsByType(['urgent', 'alerts', 'hot-deals']).map(channel => (
            <button
              key={channel.id}
              className="suggested-channel"
              onClick={() => setRoutingConfig({
                ...routingConfig,
                urgentChannel: channel.name
              })}
            >
              ⚡ {channel.name}
            </button>
          ))}
        </div>
      </div>

      <div className="config-actions">
        <button
          className="create-rules-button"
          onClick={createRoutingRules}
          disabled={isCreatingRules || !Object.values(routingConfig).some(v => v)}
        >
          {isCreatingRules ? '⏳ Creating Rules...' : '🚀 Create Routing Rules'}
        </button>
        <p className="config-help">
          This will create notification rules based on your routing configuration
        </p>
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className="routing-stats">
      {stats.length === 0 ? (
        <div className="empty-stats">
          <div className="empty-icon">📊</div>
          <h4>No routing statistics yet</h4>
          <p>Statistics will appear once notifications start flowing through your channels</p>
        </div>
      ) : (
        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.channel_id} className="stat-card">
              <div className="stat-header">
                <h5>{stat.channel_name}</h5>
                <span className="rules-count">{stat.rules_count} rules</span>
              </div>
              
              <div className="stat-metrics">
                <div className="metric">
                  <span className="metric-label">Notifications Sent</span>
                  <span className="metric-value">{stat.notifications_sent}</span>
                </div>
                
                <div className="metric">
                  <span className="metric-label">Success Rate</span>
                  <span className={`metric-value ${stat.success_rate >= 95 ? 'good' : stat.success_rate >= 85 ? 'warning' : 'error'}`}>
                    {stat.success_rate}%
                  </span>
                </div>
                
                <div className="metric">
                  <span className="metric-label">Avg Response Time</span>
                  <span className="metric-value">{stat.avg_response_time_ms}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSuggestionsTab = () => (
    <div className="routing-suggestions">
      {suggestions.length === 0 ? (
        <div className="empty-suggestions">
          <div className="empty-icon">💡</div>
          <h4>No routing suggestions</h4>
          <p>Your channel routing setup looks good!</p>
        </div>
      ) : (
        <div className="suggestions-list">
          {suggestions.map((suggestion, index) => (
            <div key={index} className={`suggestion-card ${suggestion.priority}`}>
              <div className="suggestion-header">
                <h5>{suggestion.title}</h5>
                <span className={`priority-badge ${suggestion.priority}`}>
                  {suggestion.priority}
                </span>
              </div>
              
              <p className="suggestion-description">{suggestion.description}</p>
              
              {suggestion.channels && (
                <div className="suggested-channels">
                  <span>Suggested channels:</span>
                  {suggestion.channels.map(channel => (
                    <span key={channel} className="channel-suggestion">{channel}</span>
                  ))}
                </div>
              )}
              
              {suggestion.suggestedNames && (
                <div className="suggested-names">
                  <span>Suggested names:</span>
                  {suggestion.suggestedNames.map(name => (
                    <span key={name} className="name-suggestion">{name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="channel-routing-loading">
        <div className="loading-spinner"></div>
        <p>Loading channel routing...</p>
      </div>
    );
  }

  return (
    <div className="channel-routing">
      <div className="routing-header">
        <h3>Smart Channel Routing</h3>
        <p>Automatically route notifications to the right Google Chat channels</p>
      </div>

      <div className="routing-tabs">
        <button
          className={`tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          ⚙️ Configuration
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
        <button
          className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          💡 Suggestions
        </button>
      </div>

      <div className="routing-content">
        {activeTab === 'config' && renderConfigTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'suggestions' && renderSuggestionsTab()}
      </div>

      <div className="routing-info">
        <h5>How Smart Routing Works</h5>
        <ul>
          <li><strong>Deal Value:</strong> High-value deals go to executive channels</li>
          <li><strong>Event Type:</strong> Won deals go to celebration channels</li>
          <li><strong>Probability:</strong> Hot deals (90%+) go to urgent channels</li>
          <li><strong>Time-based:</strong> After-hours notifications go to alert channels</li>
          <li><strong>Owner-based:</strong> Route to user-specific channels when available</li>
        </ul>
      </div>
    </div>
  );
};

export default ChannelRouting;