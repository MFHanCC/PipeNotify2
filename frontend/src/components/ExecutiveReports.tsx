import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { getTenantId, getAuthToken } from '../utils/auth';
import './ExecutiveReports.css';

interface ExecutiveReport {
  id: string;
  tenant_id: number;
  summary: string;
  metrics: {
    total_deals: number;
    total_value: number;
    conversion_rate: number;
    avg_deal_size: number;
    response_time_avg: string;
  };
  recommendations: string[];
  generated_at: string;
  period: string;
}

interface ExecutiveReportsProps {
  refreshToken?: number;
}

const ExecutiveReports: React.FC<ExecutiveReportsProps> = ({ refreshToken }) => {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchExecutiveReport();
  }, [period]);

  // Refetch when refreshToken changes
  useEffect(() => {
    if (refreshToken && refreshToken > 0) {
      fetchExecutiveReport();
    }
  }, [refreshToken]);

  const fetchExecutiveReport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const tenantId = getTenantId();
      const token = getAuthToken();
      
      if (!tenantId || !token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/analytics/advanced/executive/${tenantId}?period=${period}`,
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
      
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        throw new Error(data.error || 'Failed to fetch executive report');
      }
    } catch (err) {
      console.error('Executive report fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewReport = async () => {
    try {
      setIsGenerating(true);
      // Force a new report generation by clearing cache (in a real implementation)
      await fetchExecutiveReport();
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      default: return 'Custom Period';
    }
  };

  if (isLoading) {
    return (
      <div className="executive-reports">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Generating executive report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="executive-reports">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Failed to Load Executive Report</h3>
          <p>{error}</p>
          <button onClick={fetchExecutiveReport} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="executive-reports">
      {/* Header & Controls */}
      <div className="reports-header">
        <div className="header-content">
          <h3>📈 Executive Summary</h3>
          <p>AI-powered insights and recommendations for leadership</p>
        </div>
        
        <div className="header-controls">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="period-selector"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          
          <button 
            onClick={generateNewReport}
            disabled={isGenerating}
            className="generate-btn"
          >
            {isGenerating ? (
              <>
                <span className="spinner"></span>
                Generating...
              </>
            ) : (
              <>
                <span className="icon">🔄</span>
                Regenerate
              </>
            )}
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* Key Metrics Overview */}
          <div className="metrics-overview">
            <h4>Key Metrics - {getPeriodLabel(period)}</h4>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">🎯</div>
                <div className="metric-content">
                  <span className="metric-label">Total Deals</span>
                  <span className="metric-value">{report.metrics.total_deals}</span>
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">💰</div>
                <div className="metric-content">
                  <span className="metric-label">Total Value</span>
                  <span className="metric-value">{formatCurrency(report.metrics.total_value)}</span>
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">📊</div>
                <div className="metric-content">
                  <span className="metric-label">Conversion Rate</span>
                  <span className="metric-value">{formatPercentage(report.metrics.conversion_rate)}</span>
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">⚡</div>
                <div className="metric-content">
                  <span className="metric-label">Avg Response Time</span>
                  <span className="metric-value">{report.metrics.response_time_avg}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="executive-summary">
            <h4>📋 Executive Summary</h4>
            <div className="summary-content">
              <p>{report.summary}</p>
            </div>
          </div>

          {/* Strategic Recommendations */}
          <div className="recommendations">
            <h4>💡 Strategic Recommendations</h4>
            <div className="recommendations-list">
              {report.recommendations.map((recommendation, index) => (
                <div key={index} className="recommendation-item">
                  <div className="recommendation-number">{index + 1}</div>
                  <div className="recommendation-content">
                    <p>{recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Metadata */}
          <div className="report-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Generated:</span>
              <span className="metadata-value">
                {new Date(report.generated_at).toLocaleString()}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Report ID:</span>
              <span className="metadata-value">{report.id}</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Period:</span>
              <span className="metadata-value">{getPeriodLabel(report.period)}</span>
            </div>
          </div>

          {/* Action Items */}
          <div className="action-items">
            <h4>🎯 Next Steps</h4>
            <div className="actions-grid">
              <button className="action-btn">
                <span className="action-icon">📧</span>
                <span>Email Report</span>
              </button>
              <button className="action-btn">
                <span className="action-icon">📄</span>
                <span>Export PDF</span>
              </button>
              <button className="action-btn">
                <span className="action-icon">📅</span>
                <span>Schedule Reports</span>
              </button>
              <button className="action-btn">
                <span className="action-icon">👥</span>
                <span>Share with Team</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExecutiveReports;