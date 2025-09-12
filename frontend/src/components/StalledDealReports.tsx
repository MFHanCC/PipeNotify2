import React, { useState, useEffect } from 'react';
import './StalledDealReports.css';

interface ReportData {
  date: string;
  stalledDeals: number;
  alertsSent: number;
  breakdown: {
    warning: number;
    stale: number;
    critical: number;
  };
  avgResolutionTime?: number;
}

interface SummaryStats {
  totalStalledDeals: number;
  totalAlertsThisWeek: number;
  avgDailyStalled: number;
  trendDirection: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface StalledDealReportsProps {
  onRefresh?: () => void;
}

const StalledDealReports: React.FC<StalledDealReportsProps> = ({ onRefresh }) => {
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalStalledDeals: 0,
    totalAlertsThisWeek: 0,
    avgDailyStalled: 0,
    trendDirection: 'stable',
    trendPercentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    loadReportData();
  }, [reportPeriod, reportType]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      
      // Generate mock report data for now
      const mockData = generateMockReportData();
      setReportData(mockData);
      
      // Calculate summary stats
      const stats = calculateSummaryStats(mockData);
      setSummaryStats(stats);
      
    } catch (error) {
      console.error('Error loading report data:', error);
    }
    setIsLoading(false);
  };

  const generateMockReportData = (): ReportData[] => {
    const days = reportPeriod === '7d' ? 7 : reportPeriod === '30d' ? 30 : 90;
    const data: ReportData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const stalledCount = Math.floor(Math.random() * 15) + 5; // 5-20 stalled deals
      const warningCount = Math.floor(stalledCount * 0.6);
      const staleCount = Math.floor(stalledCount * 0.3);
      const criticalCount = stalledCount - warningCount - staleCount;
      
      data.push({
        date: date.toISOString().split('T')[0],
        stalledDeals: stalledCount,
        alertsSent: Math.floor(stalledCount * 0.8), // 80% alert rate
        breakdown: {
          warning: warningCount,
          stale: staleCount,
          critical: criticalCount
        },
        avgResolutionTime: Math.floor(Math.random() * 48) + 12 // 12-60 hours
      });
    }
    
    return data;
  };

  const calculateSummaryStats = (data: ReportData[]): SummaryStats => {
    const totalStalled = data.reduce((sum, d) => sum + d.stalledDeals, 0);
    const totalAlerts = data.reduce((sum, d) => sum + d.alertsSent, 0);
    const avgDaily = data.length > 0 ? Math.round(totalStalled / data.length) : 0;
    
    // Calculate trend (comparing first half to second half)
    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.stalledDeals, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.stalledDeals, 0) / secondHalf.length;
    
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    let trendPercentage = 0;
    
    if (firstHalfAvg > 0) {
      const change = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      trendPercentage = Math.abs(Math.round(change));
      
      if (change > 5) trendDirection = 'up';
      else if (change < -5) trendDirection = 'down';
      else trendDirection = 'stable';
    }
    
    return {
      totalStalledDeals: totalStalled,
      totalAlertsThisWeek: totalAlerts,
      avgDailyStalled: avgDaily,
      trendDirection,
      trendPercentage
    };
  };

  const getTrendIcon = () => {
    switch (summaryStats.trendDirection) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
    }
  };

  const getTrendColor = () => {
    switch (summaryStats.trendDirection) {
      case 'up': return '#dc2626'; // Red (bad - more stalled deals)
      case 'down': return '#16a34a'; // Green (good - fewer stalled deals)
      case 'stable': return '#6b7280'; // Gray (neutral)
    }
  };

  const exportReport = () => {
    const csvData = [
      ['Date', 'Total Stalled', 'Alerts Sent', 'Warning', 'Stale', 'Critical', 'Avg Resolution (hrs)'],
      ...reportData.map(d => [
        d.date,
        d.stalledDeals.toString(),
        d.alertsSent.toString(),
        d.breakdown.warning.toString(),
        d.breakdown.stale.toString(),
        d.breakdown.critical.toString(),
        (d.avgResolutionTime || 0).toString()
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `stalled-deals-report-${reportPeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="stalled-reports-loading">
        <div className="loading-spinner"></div>
        <p>Loading stalled deal reports...</p>
      </div>
    );
  }

  return (
    <div className="stalled-deal-reports">
      <div className="reports-header">
        <div className="header-content">
          <h3>📊 Stalled Deal Reports</h3>
          <p>Historical analysis and trends for stalled deal monitoring</p>
        </div>
        
        <div className="report-controls">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as 'daily' | 'weekly')}
            className="report-type-select"
          >
            <option value="daily">Daily Reports</option>
            <option value="weekly">Weekly Reports</option>
          </select>
          
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value as '7d' | '30d' | '90d')}
            className="report-period-select"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <button className="export-button" onClick={exportReport}>
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h5>Total Stalled Deals</h5>
            <span className="stat-number">{summaryStats.totalStalledDeals}</span>
            <span className="stat-period">Last {reportPeriod === '7d' ? '7 days' : reportPeriod === '30d' ? '30 days' : '90 days'}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📢</div>
          <div className="stat-content">
            <h5>Alerts Sent</h5>
            <span className="stat-number">{summaryStats.totalAlertsThisWeek}</span>
            <span className="stat-period">Total alerts sent</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h5>Daily Average</h5>
            <span className="stat-number">{summaryStats.avgDailyStalled}</span>
            <span className="stat-period">Stalled deals per day</span>
          </div>
        </div>
        
        <div className="stat-card trend-card">
          <div className="stat-icon">{getTrendIcon()}</div>
          <div className="stat-content">
            <h5>Trend</h5>
            <span 
              className="stat-number trend-number" 
              style={{ color: getTrendColor() }}
            >
              {summaryStats.trendDirection === 'stable' ? 'Stable' : `${summaryStats.trendPercentage}%`}
            </span>
            <span className="stat-period">
              {summaryStats.trendDirection === 'up' ? 'Increase' : 
               summaryStats.trendDirection === 'down' ? 'Decrease' : 
               'No change'}
            </span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="reports-table">
        <div className="table-header">
          <h4>Detailed {reportType === 'daily' ? 'Daily' : 'Weekly'} Breakdown</h4>
        </div>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Total Stalled</th>
                <th>Alerts Sent</th>
                <th>⚠️ Warning</th>
                <th>🟠 Stale</th>
                <th>🚨 Critical</th>
                <th>Avg Resolution</th>
                <th>Alert Rate</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((report, index) => {
                const alertRate = report.stalledDeals > 0 
                  ? Math.round((report.alertsSent / report.stalledDeals) * 100) 
                  : 0;
                
                return (
                  <tr key={index}>
                    <td className="date-cell">
                      {new Date(report.date).toLocaleDateString()}
                    </td>
                    <td className="number-cell">
                      <span className="stalled-total">{report.stalledDeals}</span>
                    </td>
                    <td className="number-cell">
                      <span className="alerts-sent">{report.alertsSent}</span>
                    </td>
                    <td className="number-cell warning">
                      <span className="breakdown-count">{report.breakdown.warning}</span>
                    </td>
                    <td className="number-cell stale">
                      <span className="breakdown-count">{report.breakdown.stale}</span>
                    </td>
                    <td className="number-cell critical">
                      <span className="breakdown-count">{report.breakdown.critical}</span>
                    </td>
                    <td className="number-cell">
                      <span className="resolution-time">{report.avgResolutionTime || '--'}h</span>
                    </td>
                    <td className="number-cell">
                      <span className={`alert-rate ${alertRate >= 90 ? 'high' : alertRate >= 70 ? 'medium' : 'low'}`}>
                        {alertRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights Section */}
      <div className="insights-section">
        <h4>📋 Key Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-icon">🎯</div>
            <div className="insight-content">
              <h5>Alert Effectiveness</h5>
              <p>
                Your stalled deal alerts are being sent consistently with an average alert rate of{' '}
                {Math.round((summaryStats.totalAlertsThisWeek / summaryStats.totalStalledDeals) * 100)}%.
                {summaryStats.trendDirection === 'down' && (
                  <span className="positive"> Great job reducing stalled deals!</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-icon">⚡</div>
            <div className="insight-content">
              <h5>Response Time</h5>
              <p>
                Most stalled deals are being addressed within 24-48 hours of alerts being sent. 
                Consider adjusting thresholds if resolution times are consistently longer.
              </p>
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-icon">📊</div>
            <div className="insight-content">
              <h5>Pattern Analysis</h5>
              <p>
                {summaryStats.trendDirection === 'up' 
                  ? 'Stalled deals are increasing. Review your sales process and consider shorter follow-up intervals.'
                  : summaryStats.trendDirection === 'down'
                  ? 'Excellent! Stalled deals are decreasing, indicating improved pipeline management.'
                  : 'Stalled deals remain consistent. Monitor for seasonal patterns and process improvements.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Features */}
      <div className="coming-soon-section">
        <h4>🚀 Coming Soon</h4>
        <div className="coming-soon-grid">
          <div className="coming-soon-item">
            <div className="coming-soon-icon">📈</div>
            <div className="coming-soon-content">
              <h5>Interactive Charts</h5>
              <p>Visual trend analysis with interactive graphs and charts</p>
            </div>
          </div>
          
          <div className="coming-soon-item">
            <div className="coming-soon-icon">🤖</div>
            <div className="coming-soon-content">
              <h5>AI Insights</h5>
              <p>Machine learning-powered predictions and recommendations</p>
            </div>
          </div>
          
          <div className="coming-soon-item">
            <div className="coming-soon-icon">📧</div>
            <div className="coming-soon-content">
              <h5>Scheduled Reports</h5>
              <p>Automated weekly and monthly reports delivered to your inbox</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StalledDealReports;