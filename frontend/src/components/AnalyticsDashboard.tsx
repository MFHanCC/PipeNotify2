import React, { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';

interface NotificationMetrics {
  total_sent: number;
  successful: number;
  failed: number;
  pending: number;
  success_rate: number;
  avg_response_time: number;
}

interface TimeSeriesData {
  date: string;
  sent: number;
  successful: number;
  failed: number;
}

interface RulePerformance {
  rule_id: number;
  rule_name: string;
  total_triggered: number;
  successful: number;
  failed: number;
  success_rate: number;
}

interface ChannelMetrics {
  channel_name: string;
  total_sent: number;
  successful: number;
  failed: number;
  success_rate: number;
  avg_response_time: number;
}

interface AnalyticsDashboardProps {
  onRefresh?: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onRefresh }) => {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [rulePerformance, setRulePerformance] = useState<RulePerformance[]>([]);
  const [channelMetrics, setChannelMetrics] = useState<ChannelMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch all analytics data in parallel
      const [
        metricsResponse,
        timeSeriesResponse,
        rulesResponse,
        channelsResponse
      ] = await Promise.all([
        fetch(`${apiUrl}/api/v1/analytics/metrics?period=${dateRange}`, { headers }),
        fetch(`${apiUrl}/api/v1/analytics/timeseries?period=${dateRange}`, { headers }),
        fetch(`${apiUrl}/api/v1/analytics/rules?period=${dateRange}`, { headers }),
        fetch(`${apiUrl}/api/v1/analytics/channels?period=${dateRange}`, { headers })
      ]);

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.metrics);
      }

      if (timeSeriesResponse.ok) {
        const timeSeriesData = await timeSeriesResponse.json();
        setTimeSeriesData(timeSeriesData.data || []);
      }

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRulePerformance(rulesData.rules || []);
      }

      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        setChannelMetrics(channelsData.channels || []);
      }

    } catch (error) {
      console.error('Error loading analytics:', error);
    }
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
    if (onRefresh) onRefresh();
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getHealthStatus = (successRate: number) => {
    if (successRate >= 0.95) return 'excellent';
    if (successRate >= 0.90) return 'good';
    if (successRate >= 0.80) return 'warning';
    return 'critical';
  };

  if (isLoading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div className="header-content">
          <h2>Analytics Dashboard</h2>
          <p>Monitor notification delivery performance and system health</p>
        </div>
        <div className="header-controls">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="date-range-selector"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-button"
          >
            {refreshing ? '=' : '�'} Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">=�</span>
              <span className="metric-title">Total Sent</span>
            </div>
            <div className="metric-value">{formatNumber(metrics.total_sent)}</div>
            <div className="metric-subtitle">
              {metrics.successful} successful " {metrics.failed} failed
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon"></span>
              <span className="metric-title">Success Rate</span>
            </div>
            <div className={`metric-value ${getHealthStatus(metrics.success_rate)}`}>
              {formatPercentage(metrics.success_rate)}
            </div>
            <div className="metric-subtitle">
              {metrics.pending > 0 && `${metrics.pending} pending`}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">�</span>
              <span className="metric-title">Avg Response Time</span>
            </div>
            <div className="metric-value">{formatResponseTime(metrics.avg_response_time)}</div>
            <div className="metric-subtitle">
              Delivery performance
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">🏥</span>
              <span className="metric-title">System Health</span>
            </div>
            <div className={`metric-value ${getHealthStatus(metrics.success_rate)}`}>
              {getHealthStatus(metrics.success_rate).toUpperCase()}
            </div>
            <div className="metric-subtitle">
              Overall system status
            </div>
          </div>
        </div>
      )}

      {/* Time Series Chart */}
      {timeSeriesData.length > 0 && (
        <div className="analytics-section">
          <div className="section-header">
            <h3>=� Delivery Trends</h3>
            <p>Daily notification volume and success rates</p>
          </div>
          <div className="chart-container">
            <div className="simple-chart">
              {timeSeriesData.map((point, index) => {
                const maxValue = Math.max(...timeSeriesData.map(p => p.sent));
                const height = maxValue > 0 ? (point.sent / maxValue) * 100 : 0;
                const successRate = point.sent > 0 ? (point.successful / point.sent) * 100 : 0;
                
                return (
                  <div key={index} className="chart-bar-container">
                    <div 
                      className={`chart-bar ${successRate < 80 ? 'bar-warning' : successRate < 95 ? 'bar-good' : 'bar-excellent'}`}
                      style={{ height: `${height}%` }}
                      title={`${point.date}: ${point.sent} sent, ${point.successful} successful (${successRate.toFixed(1)}%)`}
                    ></div>
                    <div className="chart-label">{point.date}</div>
                  </div>
                );
              })}
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color bar-excellent"></div>
                <span>95%+ Success Rate</span>
              </div>
              <div className="legend-item">
                <div className="legend-color bar-good"></div>
                <span>80-94% Success Rate</span>
              </div>
              <div className="legend-item">
                <div className="legend-color bar-warning"></div>
                <span>&lt;80% Success Rate</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rule Performance */}
      {rulePerformance.length > 0 && (
        <div className="analytics-section">
          <div className="section-header">
            <h3>=� Rule Performance</h3>
            <p>Individual rule trigger rates and success metrics</p>
          </div>
          <div className="performance-table">
            <div className="table-header">
              <div className="header-cell">Rule Name</div>
              <div className="header-cell">Triggered</div>
              <div className="header-cell">Successful</div>
              <div className="header-cell">Failed</div>
              <div className="header-cell">Success Rate</div>
            </div>
            {rulePerformance.map((rule) => (
              <div key={rule.rule_id} className="table-row">
                <div className="cell rule-name">{rule.rule_name}</div>
                <div className="cell">{formatNumber(rule.total_triggered)}</div>
                <div className="cell success-count">{formatNumber(rule.successful)}</div>
                <div className="cell failed-count">{formatNumber(rule.failed)}</div>
                <div className={`cell success-rate ${getHealthStatus(rule.success_rate)}`}>
                  {formatPercentage(rule.success_rate)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel Performance */}
      {channelMetrics.length > 0 && (
        <div className="analytics-section">
          <div className="section-header">
            <h3>=� Channel Performance</h3>
            <p>Google Chat webhook performance by channel</p>
          </div>
          <div className="channels-grid">
            {channelMetrics.map((channel, index) => (
              <div key={index} className="channel-card">
                <div className="channel-header">
                  <span className="channel-icon">=�</span>
                  <span className="channel-name">{channel.channel_name}</span>
                </div>
                <div className="channel-stats">
                  <div className="stat">
                    <span className="stat-value">{formatNumber(channel.total_sent)}</span>
                    <span className="stat-label">Total Sent</span>
                  </div>
                  <div className="stat">
                    <span className={`stat-value ${getHealthStatus(channel.success_rate)}`}>
                      {formatPercentage(channel.success_rate)}
                    </span>
                    <span className="stat-label">Success Rate</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatResponseTime(channel.avg_response_time)}</span>
                    <span className="stat-label">Avg Response</span>
                  </div>
                </div>
                <div className="channel-breakdown">
                  <div className="breakdown-bar">
                    <div 
                      className="successful-bar"
                      style={{ width: `${channel.success_rate * 100}%` }}
                    ></div>
                    <div 
                      className="failed-bar"
                      style={{ width: `${(1 - channel.success_rate) * 100}%` }}
                    ></div>
                  </div>
                  <div className="breakdown-text">
                    {formatNumber(channel.successful)} successful " {formatNumber(channel.failed)} failed
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tips */}
      <div className="analytics-info">
        <h4>=� Analytics Insights</h4>
        <ul>
          <li><strong>Success Rate:</strong> Aim for 95%+ for healthy notification delivery</li>
          <li><strong>Response Time:</strong> Lower values indicate faster Google Chat webhook processing</li>
          <li><strong>Failed Notifications:</strong> Check rule filters and webhook URLs if failures increase</li>
          <li><strong>Channel Performance:</strong> Monitor individual channel health for targeted troubleshooting</li>
          <li><strong>Time Trends:</strong> Identify patterns to optimize notification scheduling</li>
        </ul>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;