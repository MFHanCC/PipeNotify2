import React, { useState } from 'react';
import MetricCard from './MetricCard';
import InteractiveChart from './InteractiveChart';
import AdvancedDataTable from './AdvancedDataTable';
import DateRangePicker from './DateRangePicker';
import { 
  useAnalyticsMetrics, 
  useAnalyticsTimeSeries, 
  useAnalyticsRules, 
  useAnalyticsChannels,
  useInvalidateAnalytics
} from '../hooks/useQueries';
import './BasicAnalyticsDashboard.css';

interface NotificationMetrics {
  totalNotifications: number;
  successfulNotifications: number;
  failedNotifications: number;
  successRate: number;
  avgResponseTime: number;
}

interface TimeSeriesData {
  timestamp: string;
  success: number;
  failure: number;
  responseTime: number;
}

interface RulePerformance {
  id: string;
  name: string;
  totalTriggers: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgResponseTime: number;
}

interface ChannelMetrics {
  channelName: string;
  successCount: number;
  failureCount: number;
  avgResponseTime: number;
}

interface EnhancedAnalyticsDashboardProps {
  onRefresh?: () => void;
  refreshToken?: number;
}

const EnhancedAnalyticsDashboard: React.FC<EnhancedAnalyticsDashboardProps> = ({ onRefresh, refreshToken }) => {
  const [dateRange, setDateRange] = useState('7d');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const invalidateAnalytics = useInvalidateAnalytics();

  // Build query parameters based on date range type
  const queryParams = (() => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return {
        start_date: customStartDate.toISOString().split('T')[0],
        end_date: customEndDate.toISOString().split('T')[0]
      };
    } else {
      return { period: dateRange };
    }
  })();

  // React Query hooks
  const { data: metrics, isLoading: metricsLoading } = useAnalyticsMetrics(queryParams);
  const { data: timeSeriesData = [], isLoading: timeSeriesLoading } = useAnalyticsTimeSeries(queryParams);
  const { data: rulePerformance = [], isLoading: rulesLoading } = useAnalyticsRules(queryParams);
  const { data: channelMetrics = [], isLoading: channelsLoading } = useAnalyticsChannels(queryParams);

  const isLoading = metricsLoading || timeSeriesLoading || rulesLoading || channelsLoading;

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateAnalytics();
    setRefreshing(false);
    if (onRefresh) onRefresh();
  };

  const handleDateRangeChange = (startDate: Date | null, endDate: Date | null, preset?: string) => {
    if (preset && preset !== 'custom') {
      setDateRange(preset);
      setCustomStartDate(null);
      setCustomEndDate(null);
    } else if (startDate && endDate) {
      setDateRange('custom');
      setCustomStartDate(startDate);
      setCustomEndDate(endDate);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const calculateTrend = (current: number, previous: number): { trend: 'up' | 'down' | 'stable', value: string } => {
    if (previous === 0) return { trend: 'stable', value: 'N/A' };
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 2) return { trend: 'stable', value: '0%' };
    return {
      trend: change > 0 ? 'up' : 'down',
      value: `${Math.abs(change).toFixed(1)}%`
    };
  };

  const getGradientForMetric = (type: string) => {
    switch (type) {
      case 'total':
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      case 'success':
        return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      case 'failure':
        return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      case 'response':
        return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
      default:
        return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
    }
  };

  // Mock previous metrics for trend calculation
  const mockPreviousMetrics = metrics ? {
    totalNotifications: Math.max(0, metrics.totalNotifications - Math.floor(Math.random() * 100)),
    successRate: Math.max(0, metrics.successRate - Math.random() * 5),
    avgResponseTime: Math.max(0, metrics.avgResponseTime + Math.random() * 100 - 50)
  } : null;

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div className="header-content">
          <h2>Analytics</h2>
          <p>Monitor notification delivery performance with advanced insights</p>
        </div>
        <div className="header-controls">
          <DateRangePicker
            onDateRangeChange={handleDateRangeChange}
            selectedPreset={dateRange}
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-button"
          >
            {refreshing ? '🔄' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Modern Metric Cards */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Notifications"
          value={metrics ? formatNumber(metrics.totalNotifications) : '0'}
          subtitle="All notifications sent"
          icon=""
          gradient={getGradientForMetric('total')}
          trend={metrics && mockPreviousMetrics ? calculateTrend(metrics.totalNotifications, mockPreviousMetrics.totalNotifications).trend : undefined}
          trendValue={metrics && mockPreviousMetrics ? calculateTrend(metrics.totalNotifications, mockPreviousMetrics.totalNotifications).value : undefined}
          isLoading={isLoading}
        />
        
        <MetricCard
          title="Success Rate"
          value={metrics ? `${Math.round(metrics.successRate)}%` : '0%'}
          subtitle="Delivery success rate"
          icon=""
          gradient={getGradientForMetric('success')}
          trend={metrics && mockPreviousMetrics ? calculateTrend(metrics.successRate, mockPreviousMetrics.successRate).trend : undefined}
          trendValue={metrics && mockPreviousMetrics ? calculateTrend(metrics.successRate, mockPreviousMetrics.successRate).value : undefined}
          isLoading={isLoading}
        />
        
        <MetricCard
          title="Failed Notifications"
          value={metrics ? formatNumber(metrics.failedNotifications) : '0'}
          subtitle="Failed deliveries"
          icon=""
          gradient={getGradientForMetric('failure')}
          isLoading={isLoading}
        />
        
        <MetricCard
          title="Response Time"
          value={metrics ? formatResponseTime(metrics.avgResponseTime) : '0ms'}
          subtitle="Average delivery time"
          icon=""
          gradient={getGradientForMetric('response')}
          trend={metrics && mockPreviousMetrics ? (calculateTrend(metrics.avgResponseTime, mockPreviousMetrics.avgResponseTime).trend === 'up' ? 'down' : 'up') : undefined}
          trendValue={metrics && mockPreviousMetrics ? calculateTrend(metrics.avgResponseTime, mockPreviousMetrics.avgResponseTime).value : undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Interactive Chart */}
      <div className="analytics-section">
        <InteractiveChart
          data={timeSeriesData}
          title="Notification Delivery Trends"
          type="area"
          height={350}
          isLoading={isLoading}
          showTooltip={true}
          allowZoom={true}
        />
      </div>

      {/* Rule Performance Table */}
      {rulePerformance.length > 0 && (
        <div className="analytics-section">
          <AdvancedDataTable
            data={rulePerformance}
            title="Rule Performance"
            columns={[
              {
                key: 'name',
                title: 'Rule Name',
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: rulePerformance.map((rule: any) => rule.name),
                align: 'left',
                width: '30%'
              },
              {
                key: 'totalTriggers',
                title: 'Triggers',
                sortable: true,
                align: 'center',
                width: '15%',
                formatter: (value) => formatNumber(value)
              },
              {
                key: 'performance',
                title: 'Success / Failed',
                sortable: false,
                align: 'center',
                width: '20%',
                formatter: (value, row) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>{formatNumber(row.successCount)}</span>
                    <span style={{ color: '#94a3b8' }}>/</span>
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>{formatNumber(row.failureCount)}</span>
                  </div>
                )
              },
              {
                key: 'successRate',
                title: 'Success Rate',
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: ['95-100%', '80-94%', '50-79%', '0-49%'],
                align: 'center',
                width: '20%',
                formatter: (value) => {
                  const percentage = Math.round(value * 100);
                  const color = percentage >= 95 ? '#10b981' : percentage >= 80 ? '#f59e0b' : '#ef4444';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                      <div style={{ width: '30px', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: '2px' }}></div>
                      </div>
                      <span style={{ color, fontWeight: '600', fontSize: '0.8rem' }}>{percentage}%</span>
                    </div>
                  );
                }
              },
              {
                key: 'avgResponseTime',
                title: 'Response',
                sortable: true,
                align: 'center',
                width: '15%',
                formatter: (value) => (
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    {formatResponseTime(value)}
                  </span>
                )
              }
            ]}
            searchable={true}
            exportable={true}
            pagination={true}
            itemsPerPage={8}
            isLoading={isLoading}
            emptyMessage="No rule performance data available"
          />
        </div>
      )}

      {/* Channel Performance */}
      {channelMetrics.length > 0 && (
        <div className="analytics-section">
          <AdvancedDataTable
            data={channelMetrics.map((channel: any) => ({
              ...channel,
              totalNotifications: channel.successCount + channel.failureCount,
              successRate: ((channel.successCount / (channel.successCount + channel.failureCount)) * 100) || 0
            }))}
            title="Channel Performance"
            columns={[
              {
                key: 'channelName',
                title: 'Channel Name',
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: channelMetrics.map((channel: any) => channel.channelName),
                align: 'left',
                width: '30%',
                formatter: (value) => (
                  <span style={{ fontWeight: '500' }}>{value}</span>
                )
              },
              {
                key: 'totalNotifications',
                title: 'Total',
                sortable: true,
                align: 'center',
                width: '15%',
                formatter: (value) => (
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    {formatNumber(value)}
                  </span>
                )
              },
              {
                key: 'performance',
                title: 'Success / Failed',
                sortable: false,
                align: 'center',
                width: '20%',
                formatter: (value, row) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>{formatNumber(row.successCount)}</span>
                    <span style={{ color: '#94a3b8' }}>/</span>
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>{formatNumber(row.failureCount)}</span>
                  </div>
                )
              },
              {
                key: 'successRate',
                title: 'Success Rate',
                sortable: true,
                align: 'center',
                width: '20%',
                formatter: (value) => {
                  const percentage = Math.round(value);
                  const color = percentage >= 95 ? '#10b981' : percentage >= 80 ? '#f59e0b' : '#ef4444';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                      <div style={{ width: '30px', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: '2px' }}></div>
                      </div>
                      <span style={{ color, fontWeight: '600', fontSize: '0.8rem' }}>{percentage}%</span>
                    </div>
                  );
                }
              },
              {
                key: 'avgResponseTime',
                title: 'Response',
                sortable: true,
                align: 'center',
                width: '15%',
                formatter: (value) => (
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    {formatResponseTime(value)}
                  </span>
                )
              }
            ]}
            searchable={true}
            exportable={true}
            pagination={true}
            itemsPerPage={6}
            isLoading={isLoading}
            emptyMessage="No channel performance data available"
          />
        </div>
      )}

      {/* Analytics Info */}
      <div className="analytics-info">
        <h4>Analytics Information</h4>
        <ul>
          <li><strong>Real-time Data:</strong> Analytics are updated in real-time as notifications are processed</li>
          <li><strong>Performance Tracking:</strong> Success rates, response times, and delivery statistics</li>
          <li><strong>Historical Trends:</strong> Compare performance across different time periods</li>
          <li><strong>Channel Insights:</strong> Monitor performance across all notification channels</li>
        </ul>
      </div>
    </div>
  );
};

export default EnhancedAnalyticsDashboard;