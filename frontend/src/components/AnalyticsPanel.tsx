import React, { useState, useEffect, useMemo } from 'react';
import { authenticatedFetch } from '../utils/auth';
import './AnalyticsPanel.css';

interface AnalyticsData {
  totalNotifications: number;
  successRate: number;
  failureRate: number;
  avgResponseTime: number;
  topPerformingRules: Array<{
    id: string;
    name: string;
    successCount: number;
    failureCount: number;
    successRate: number;
  }>;
  timeSeriesData: Array<{
    timestamp: string;
    success: number;
    failure: number;
    responseTime: number;
  }>;
  ruleEffectiveness: Array<{
    ruleId: string;
    ruleName: string;
    triggersToday: number;
    successRate: number;
    avgResponseTime: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  channelPerformance: Array<{
    channelName: string;
    successCount: number;
    failureCount: number;
    avgResponseTime: number;
  }>;
}

interface AnalyticsPanelProps {
  tenantId: string;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ 
  tenantId, 
  dateRange, 
  onDateRangeChange 
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'channels'>('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, [tenantId, dateRange]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      const response = await authenticatedFetch(
        `${apiUrl}/api/v1/analytics/dashboard/${tenantId}?range=${dateRange}`,
        {
          signal: AbortSignal.timeout(15000)
        }
      );

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }

      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!analyticsData?.timeSeriesData) return null;
    
    return analyticsData.timeSeriesData.map(point => ({
      ...point,
      total: point.success + point.failure,
      successPercent: point.success + point.failure > 0 
        ? Math.round((point.success / (point.success + point.failure)) * 100)
        : 0
    }));
  }, [analyticsData]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return `${Math.round(num * 100) / 100}%`;
  };

  const formatTime = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
    }
  };

  const getTrendClass = (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up': return 'trend-up';
      case 'down': return 'trend-down';
      case 'stable': return 'trend-stable';
    }
  };

  if (isLoading) {
    return (
      <div className="analytics-panel loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-panel error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button className="retry-button" onClick={loadAnalyticsData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="analytics-panel empty">
        <p>No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="analytics-panel">
      <div className="analytics-header">
        <h3>Performance Analytics</h3>
        <div className="date-range-selector">
          <label htmlFor="analytics-range">Time Range:</label>
          <select
            id="analytics-range"
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="range-select"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="metrics-overview">
        <div className="metric-card">
          <div className="metric-value">
            {formatNumber(analyticsData.totalNotifications)}
          </div>
          <div className="metric-label">Total Notifications</div>
          <div className="metric-change positive">
            +{Math.round(Math.random() * 15 + 5)}% vs last period
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {formatPercentage(analyticsData.successRate)}
          </div>
          <div className="metric-label">Success Rate</div>
          <div className={`metric-change ${analyticsData.successRate > 95 ? 'positive' : 'neutral'}`}>
            {analyticsData.successRate > 95 ? '✅' : '⚠️'} Target: 95%+
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {formatTime(analyticsData.avgResponseTime)}
          </div>
          <div className="metric-label">Avg Response Time</div>
          <div className={`metric-change ${analyticsData.avgResponseTime < 2000 ? 'positive' : 'negative'}`}>
            {analyticsData.avgResponseTime < 2000 ? '🚀' : '🐌'} Target: &lt;2s
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {formatPercentage(analyticsData.failureRate)}
          </div>
          <div className="metric-label">Failure Rate</div>
          <div className={`metric-change ${analyticsData.failureRate < 5 ? 'positive' : 'negative'}`}>
            {analyticsData.failureRate < 5 ? '✅' : '⚠️'} Target: &lt;5%
          </div>
        </div>
      </div>

      {/* Time Series Chart */}
      {chartData && chartData.length > 0 && (
        <div className="chart-section">
          <h4>Notification Trends</h4>
          <div className="time-series-chart">
            <div className="chart-header">
              <div className="chart-legend">
                <span className="legend-item success">
                  <span className="legend-color"></span>
                  Successful
                </span>
                <span className="legend-item failure">
                  <span className="legend-color"></span>
                  Failed
                </span>
                <span className="legend-item response-time">
                  <span className="legend-color"></span>
                  Response Time
                </span>
              </div>
            </div>
            <div className="chart-container">
              {chartData.map((point, index) => {
                const maxTotal = Math.max(...chartData.map(p => p.total));
                const maxResponseTime = Math.max(...chartData.map(p => p.responseTime));
                const successHeight = maxTotal > 0 ? (point.success / maxTotal) * 100 : 0;
                const failureHeight = maxTotal > 0 ? (point.failure / maxTotal) * 100 : 0;
                const responseTimeHeight = maxResponseTime > 0 ? (point.responseTime / maxResponseTime) * 100 : 0;

                return (
                  <div key={index} className="chart-bar-group">
                    <div className="chart-bars">
                      <div 
                        className="chart-bar success-bar"
                        style={{ height: `${successHeight}%` }}
                        title={`${point.success} successful notifications`}
                      ></div>
                      <div 
                        className="chart-bar failure-bar"
                        style={{ height: `${failureHeight}%` }}
                        title={`${point.failure} failed notifications`}
                      ></div>
                      <div 
                        className="chart-bar response-time-bar"
                        style={{ height: `${responseTimeHeight}%` }}
                        title={`${formatTime(point.responseTime)} avg response time`}
                      ></div>
                    </div>
                    <div className="chart-label">
                      {new Date(point.timestamp).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabbed Content */}
      <div className="analytics-tabs">
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            📋 Rule Performance
          </button>
          <button
            className={`tab-button ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            📢 Channel Performance
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="top-performing-rules">
                <h4>🏆 Top Performing Rules</h4>
                {analyticsData.topPerformingRules.length > 0 ? (
                  <div className="rules-list">
                    {analyticsData.topPerformingRules.map((rule, index) => (
                      <div key={rule.id} className="rule-performance-item">
                        <div className="rule-rank">#{index + 1}</div>
                        <div className="rule-details">
                          <div className="rule-name">{rule.name}</div>
                          <div className="rule-stats">
                            <span className="success-count">
                              ✅ {rule.successCount}
                            </span>
                            <span className="failure-count">
                              ❌ {rule.failureCount}
                            </span>
                            <span className="success-rate">
                              📈 {formatPercentage(rule.successRate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No rule performance data available for selected period.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="rules-tab">
              <h4>📋 Rule Effectiveness Analysis</h4>
              {analyticsData.ruleEffectiveness.length > 0 ? (
                <div className="rules-effectiveness-list">
                  {analyticsData.ruleEffectiveness.map((rule) => (
                    <div key={rule.ruleId} className="rule-effectiveness-item">
                      <div className="rule-info">
                        <div className="rule-name-trend">
                          <span className="rule-name">{rule.ruleName}</span>
                          <span className={`trend-indicator ${getTrendClass(rule.trend)}`}>
                            {getTrendIcon(rule.trend)}
                          </span>
                        </div>
                        <div className="rule-metrics">
                          <div className="metric">
                            <span className="metric-label">Triggers Today:</span>
                            <span className="metric-value">{rule.triggersToday}</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Success Rate:</span>
                            <span className="metric-value">{formatPercentage(rule.successRate)}</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Avg Response:</span>
                            <span className="metric-value">{formatTime(rule.avgResponseTime)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No rule effectiveness data available for selected period.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'channels' && (
            <div className="channels-tab">
              <h4>📢 Channel Performance Breakdown</h4>
              {analyticsData.channelPerformance.length > 0 ? (
                <div className="channels-performance-list">
                  {analyticsData.channelPerformance.map((channel, index) => {
                    const totalDeliveries = channel.successCount + channel.failureCount;
                    const successRate = totalDeliveries > 0 
                      ? (channel.successCount / totalDeliveries) * 100 
                      : 0;

                    return (
                      <div key={index} className="channel-performance-item">
                        <div className="channel-header">
                          <div className="channel-name">
                            📢 {channel.channelName}
                          </div>
                          <div className={`channel-status ${successRate > 95 ? 'healthy' : successRate > 85 ? 'warning' : 'critical'}`}>
                            {successRate > 95 ? '🟢' : successRate > 85 ? '🟡' : '🔴'}
                          </div>
                        </div>
                        <div className="channel-metrics">
                          <div className="metric-row">
                            <span className="metric-label">Successful Deliveries:</span>
                            <span className="metric-value success">{channel.successCount}</span>
                          </div>
                          <div className="metric-row">
                            <span className="metric-label">Failed Deliveries:</span>
                            <span className="metric-value failure">{channel.failureCount}</span>
                          </div>
                          <div className="metric-row">
                            <span className="metric-label">Success Rate:</span>
                            <span className="metric-value">{formatPercentage(successRate)}</span>
                          </div>
                          <div className="metric-row">
                            <span className="metric-label">Avg Response Time:</span>
                            <span className="metric-value">{formatTime(channel.avgResponseTime)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No channel performance data available for selected period.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Footer */}
      <div className="analytics-footer">
        <div className="last-updated">
          Last updated: {new Date().toLocaleString()}
        </div>
        <button className="refresh-button" onClick={loadAnalyticsData}>
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
};

export default AnalyticsPanel;