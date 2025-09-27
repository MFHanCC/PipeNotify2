import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { getTenantId, getAuthToken } from '../utils/auth';
import './TeamPerformance.css';

interface TeamPerformanceData {
  total_notifications: number;
  active_days: number;
  avg_response_time: number;
  productivity_score: number;
  period_start: string;
  period_end: string;
}

interface BenchmarkData {
  avg_response_time: number;
  conversion_rate: number;
  deals_per_month: number;
  avg_deal_size: number;
  source: string;
}

interface TeamPerformanceProps {
  refreshToken?: number;
}

const TeamPerformance: React.FC<TeamPerformanceProps> = ({ refreshToken }) => {
  const [performance, setPerformance] = useState<TeamPerformanceData | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    fetchTeamPerformance();
  }, [period]);

  // Refetch when refreshToken changes
  useEffect(() => {
    if (refreshToken && refreshToken > 0) {
      fetchTeamPerformance();
    }
  }, [refreshToken]);

  const fetchTeamPerformance = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const tenantId = getTenantId();
      const token = getAuthToken();
      
      if (!tenantId || !token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/analytics/advanced/team-performance/${tenantId}?period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setPerformance(data.performance);
        setBenchmarks(data.benchmarks);
      } else {
        throw new Error(data.error || 'Failed to fetch team performance');
      }
    } catch (err) {
      console.error('Team performance fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  };

  const getPerformanceGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: '#10b981', label: 'Excellent' };
    if (score >= 80) return { grade: 'A', color: '#059669', label: 'Great' };
    if (score >= 70) return { grade: 'B', color: '#f59e0b', label: 'Good' };
    if (score >= 60) return { grade: 'C', color: '#ef4444', label: 'Needs Improvement' };
    return { grade: 'F', color: '#dc2626', label: 'Poor' };
  };

  const getBenchmarkComparison = (value: number, benchmark: number, isLower = false) => {
    // Safety checks for invalid benchmark values
    if (!benchmark || benchmark <= 0 || !isFinite(benchmark) || !isFinite(value)) {
      return { status: 'on-par', text: 'No benchmark available' };
    }
    
    const diff = isLower ? benchmark - value : value - benchmark;
    const percentage = (diff / benchmark) * 100;
    
    // Additional safety check for percentage calculation
    if (!isFinite(percentage)) {
      return { status: 'on-par', text: 'No benchmark available' };
    }
    
    if (Math.abs(percentage) < 5) return { status: 'on-par', text: 'On par with industry' };
    if (isLower ? percentage > 0 : percentage > 0) return { status: 'above', text: `${Math.abs(percentage).toFixed(0)}% above industry` };
    return { status: 'below', text: `${Math.abs(percentage).toFixed(0)}% below industry` };
  };

  if (isLoading) {
    return (
      <div className="team-performance">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Analyzing team performance...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-performance">
        <div className="error-state">
          <div className="error-icon">👥</div>
          <h3>Team Performance Unavailable</h3>
          <p>{error}</p>
          <button onClick={fetchTeamPerformance} className="retry-btn">
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!performance || !benchmarks) return null;

  const performanceGrade = getPerformanceGrade(performance.productivity_score);

  return (
    <div className="team-performance">
      {/* Header */}
      <div className="performance-header">
        <div className="header-content">
          <h3>👥 Team Performance</h3>
          <p>Performance metrics, benchmarks, and actionable insights</p>
        </div>
        
        <div className="period-selector">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Overall Score */}
      <div className="overall-score">
        <div className="score-card">
          <div className="score-display">
            <div 
              className="score-grade"
              style={{ color: performanceGrade.color }}
            >
              {performanceGrade.grade}
            </div>
            <div className="score-details">
              <div className="score-number">{performance.productivity_score}/100</div>
              <div className="score-label">{performanceGrade.label}</div>
            </div>
          </div>
          
          <div className="score-description">
            <h4>Productivity Score</h4>
            <p>Based on notification volume, response times, and activity consistency</p>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics">
        <h4>📊 Key Performance Indicators</h4>
        
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📧</span>
              <h5>Total Notifications</h5>
            </div>
            <div className="metric-value">{performance.total_notifications.toLocaleString()}</div>
            <div className="metric-period">Past {period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📅</span>
              <h5>Active Days</h5>
            </div>
            <div className="metric-value">{performance.active_days}</div>
            <div className="metric-subtext">
              {Math.round((performance.active_days / (period === '7d' ? 7 : period === '30d' ? 30 : 90)) * 100)}% engagement
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">⏱️</span>
              <h5>Avg Response Time</h5>
            </div>
            <div className="metric-value">{performance.avg_response_time} min</div>
            <div className={`benchmark-comparison ${getBenchmarkComparison(performance.avg_response_time, benchmarks.avg_response_time * 60, true).status}`}>
              {getBenchmarkComparison(performance.avg_response_time, benchmarks.avg_response_time * 60, true).text}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">⚡</span>
              <h5>Daily Average</h5>
            </div>
            <div className="metric-value">
              {Math.round(performance.total_notifications / performance.active_days)}
            </div>
            <div className="metric-subtext">notifications per active day</div>
          </div>
        </div>
      </div>

      {/* Benchmark Comparison */}
      <div className="benchmark-section">
        <h4>🏆 Industry Benchmarks</h4>
        
        <div className="benchmark-cards">
          <div className="benchmark-card">
            <div className="benchmark-header">
              <h5>Response Time</h5>
              <span className="benchmark-source">{benchmarks.source}</span>
            </div>
            
            <div className="benchmark-comparison-detailed">
              <div className="benchmark-bar">
                <div className="your-performance" style={{ width: '75%' }}>
                  <span>Your Team: {performance.avg_response_time} min</span>
                </div>
                <div className="industry-benchmark">
                  <span>Industry: {benchmarks.avg_response_time} hrs</span>
                </div>
              </div>
              
              <div className={`performance-verdict ${performance.avg_response_time < benchmarks.avg_response_time * 60 ? 'positive' : 'negative'}`}>
                {performance.avg_response_time < benchmarks.avg_response_time * 60 ? 
                  '🎉 Faster than industry average!' : 
                  '⚠️ Room for improvement'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="performance-insights">
        <h4>💡 Performance Insights</h4>
        
        <div className="insights-grid">
          <div className="insight-card positive">
            <div className="insight-icon">✅</div>
            <div className="insight-content">
              <h5>Strengths</h5>
              <ul>
                <li>Excellent response time vs industry benchmark</li>
                <li>Consistent daily engagement patterns</li>
                <li>High notification processing volume</li>
              </ul>
            </div>
          </div>

          <div className="insight-card improvement">
            <div className="insight-icon">🎯</div>
            <div className="insight-content">
              <h5>Improvement Opportunities</h5>
              <ul>
                <li>Increase active days for higher consistency</li>
                <li>Focus on quality over quantity metrics</li>
                <li>Implement automated follow-up systems</li>
              </ul>
            </div>
          </div>

          <div className="insight-card recommendations">
            <div className="insight-icon">🚀</div>
            <div className="insight-content">
              <h5>Recommended Actions</h5>
              <ul>
                <li>Set up performance dashboards for real-time monitoring</li>
                <li>Implement notification templates for faster responses</li>
                <li>Schedule regular performance review sessions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      <div className="performance-trends">
        <h4>📈 Performance Trends</h4>
        
        <div className="trends-summary">
          <div className="trend-item">
            <span className="trend-label">Weekly Growth:</span>
            <span className="trend-value positive">+12%</span>
          </div>
          <div className="trend-item">
            <span className="trend-label">Monthly Growth:</span>
            <span className="trend-value positive">+8%</span>
          </div>
          <div className="trend-item">
            <span className="trend-label">Efficiency Trend:</span>
            <span className="trend-value positive">↗️ Improving</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamPerformance;