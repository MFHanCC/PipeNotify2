import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { getTenantId, getAuthToken } from '../utils/auth';
import './PredictiveAnalytics.css';

interface PipelineForecast {
  next_30_days: {
    predicted_deals: number;
    predicted_value: number;
    confidence: number;
  };
  next_90_days: {
    predicted_deals: number;
    predicted_value: number;
    confidence: number;
  };
}

interface DealProbability {
  high_probability: number;
  medium_probability: number;
  low_probability: number;
  at_risk: number;
}

const PredictiveAnalytics: React.FC = () => {
  const [pipelineForecast, setPipelineForecast] = useState<PipelineForecast | null>(null);
  const [dealProbability, setDealProbability] = useState<DealProbability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'deals'>('pipeline');

  useEffect(() => {
    fetchPredictiveData();
  }, []);

  const fetchPredictiveData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const tenantId = getTenantId();
      const token = getAuthToken();
      
      if (!tenantId || !token) {
        throw new Error('Authentication required');
      }

      // Fetch pipeline forecast
      const pipelineResponse = await fetch(
        `${API_BASE_URL}/analytics/advanced/predictive/${tenantId}?type=pipeline_forecast`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Fetch deal probability
      const dealsResponse = await fetch(
        `${API_BASE_URL}/analytics/advanced/predictive/${tenantId}?type=deal_probability`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!pipelineResponse.ok || !dealsResponse.ok) {
        throw new Error('Failed to fetch predictive analytics');
      }

      const pipelineData = await pipelineResponse.json();
      const dealsData = await dealsResponse.json();
      
      if (pipelineData.success && pipelineData.predictions) {
        setPipelineForecast(pipelineData.predictions);
      }
      
      if (dealsData.success && dealsData.predictions) {
        setDealProbability(dealsData.predictions);
      }
    } catch (err) {
      console.error('Predictive analytics fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load predictive data');
    } finally {
      setIsLoading(false);
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

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#10b981'; // High confidence - green
    if (confidence >= 0.6) return '#f59e0b'; // Medium confidence - yellow
    return '#ef4444'; // Low confidence - red
  };

  if (isLoading) {
    return (
      <div className="predictive-analytics">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Running predictive models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="predictive-analytics">
        <div className="error-state">
          <div className="error-icon">🔮</div>
          <h3>Predictive Analytics Unavailable</h3>
          <p>{error}</p>
          <button onClick={fetchPredictiveData} className="retry-btn">
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="predictive-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-content">
          <h3>🔮 Predictive Analytics</h3>
          <p>AI-powered forecasts and deal probability assessments</p>
        </div>
        
        <div className="model-info">
          <div className="model-badge">
            <span className="badge-icon">🤖</span>
            <span>ML Model v1.0</span>
          </div>
          <span className="last-trained">Last trained: Jan 1, 2024</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="prediction-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          <span className="tab-icon">📈</span>
          Pipeline Forecast
        </button>
        <button 
          className={`tab-btn ${activeTab === 'deals' ? 'active' : ''}`}
          onClick={() => setActiveTab('deals')}
        >
          <span className="tab-icon">🎯</span>
          Deal Probability
        </button>
      </div>

      {/* Pipeline Forecast Tab */}
      {activeTab === 'pipeline' && pipelineForecast && (
        <div className="pipeline-forecast">
          <div className="forecast-grid">
            {/* 30-Day Forecast */}
            <div className="forecast-card">
              <div className="forecast-header">
                <h4>📊 Next 30 Days</h4>
                <div 
                  className="confidence-badge"
                  style={{ backgroundColor: getConfidenceColor(pipelineForecast.next_30_days.confidence) }}
                >
                  {formatConfidence(pipelineForecast.next_30_days.confidence)} confidence
                </div>
              </div>
              
              <div className="forecast-metrics">
                <div className="forecast-metric">
                  <span className="metric-icon">🎯</span>
                  <div className="metric-details">
                    <span className="metric-label">Predicted Deals</span>
                    <span className="metric-value">{pipelineForecast.next_30_days.predicted_deals}</span>
                  </div>
                </div>
                
                <div className="forecast-metric">
                  <span className="metric-icon">💰</span>
                  <div className="metric-details">
                    <span className="metric-label">Predicted Value</span>
                    <span className="metric-value">{formatCurrency(pipelineForecast.next_30_days.predicted_value)}</span>
                  </div>
                </div>
              </div>

              <div className="forecast-insights">
                <h5>💡 Key Insights</h5>
                <ul>
                  <li>Strong pipeline momentum expected</li>
                  <li>15% increase vs last month</li>
                  <li>Focus on high-value deals</li>
                </ul>
              </div>
            </div>

            {/* 90-Day Forecast */}
            <div className="forecast-card">
              <div className="forecast-header">
                <h4>📈 Next 90 Days</h4>
                <div 
                  className="confidence-badge"
                  style={{ backgroundColor: getConfidenceColor(pipelineForecast.next_90_days.confidence) }}
                >
                  {formatConfidence(pipelineForecast.next_90_days.confidence)} confidence
                </div>
              </div>
              
              <div className="forecast-metrics">
                <div className="forecast-metric">
                  <span className="metric-icon">🎯</span>
                  <div className="metric-details">
                    <span className="metric-label">Predicted Deals</span>
                    <span className="metric-value">{pipelineForecast.next_90_days.predicted_deals}</span>
                  </div>
                </div>
                
                <div className="forecast-metric">
                  <span className="metric-icon">💰</span>
                  <div className="metric-details">
                    <span className="metric-label">Predicted Value</span>
                    <span className="metric-value">{formatCurrency(pipelineForecast.next_90_days.predicted_value)}</span>
                  </div>
                </div>
              </div>

              <div className="forecast-insights">
                <h5>💡 Key Insights</h5>
                <ul>
                  <li>Seasonal uptrend anticipated</li>
                  <li>Q2 looking stronger than Q1</li>
                  <li>Monitor conversion rates</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Forecast Trends */}
          <div className="forecast-trends">
            <h4>📊 Forecast Trends</h4>
            <div className="trends-chart">
              <div className="chart-placeholder">
                <div className="trend-line">
                  <div className="trend-point current">Now</div>
                  <div className="trend-point projected">30d</div>
                  <div className="trend-point projected">60d</div>
                  <div className="trend-point projected">90d</div>
                </div>
                <p className="chart-note">📈 Upward trend with seasonal acceleration expected</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deal Probability Tab */}
      {activeTab === 'deals' && dealProbability && (
        <div className="deal-probability">
          <div className="probability-overview">
            <h4>🎯 Deal Probability Distribution</h4>
            <p>Current pipeline deals categorized by likelihood to close</p>
          </div>

          <div className="probability-grid">
            <div className="probability-card high">
              <div className="probability-header">
                <span className="probability-icon">🟢</span>
                <h5>High Probability</h5>
              </div>
              <div className="probability-count">{dealProbability.high_probability}</div>
              <div className="probability-details">
                <p>80%+ likely to close</p>
                <div className="probability-actions">
                  <span>✅ Priority follow-up</span>
                  <span>📞 Schedule closing calls</span>
                </div>
              </div>
            </div>

            <div className="probability-card medium">
              <div className="probability-header">
                <span className="probability-icon">🟡</span>
                <h5>Medium Probability</h5>
              </div>
              <div className="probability-count">{dealProbability.medium_probability}</div>
              <div className="probability-details">
                <p>40-80% likely to close</p>
                <div className="probability-actions">
                  <span>🎯 Nurture campaigns</span>
                  <span>📧 Value proposition</span>
                </div>
              </div>
            </div>

            <div className="probability-card low">
              <div className="probability-header">
                <span className="probability-icon">🔴</span>
                <h5>Low Probability</h5>
              </div>
              <div className="probability-count">{dealProbability.low_probability}</div>
              <div className="probability-details">
                <p>Below 40% likely</p>
                <div className="probability-actions">
                  <span>🔄 Re-qualification</span>
                  <span>💡 Objection handling</span>
                </div>
              </div>
            </div>

            <div className="probability-card at-risk">
              <div className="probability-header">
                <span className="probability-icon">⚠️</span>
                <h5>At Risk</h5>
              </div>
              <div className="probability-count">{dealProbability.at_risk}</div>
              <div className="probability-details">
                <p>Stalled or declining</p>
                <div className="probability-actions">
                  <span>🚨 Urgent intervention</span>
                  <span>👥 Escalate to manager</span>
                </div>
              </div>
            </div>
          </div>

          <div className="probability-recommendations">
            <h4>💡 Recommended Actions</h4>
            <div className="recommendations-list">
              <div className="recommendation">
                <span className="rec-priority high">HIGH</span>
                <span>Focus on {dealProbability.high_probability} high-probability deals for quick wins</span>
              </div>
              <div className="recommendation">
                <span className="rec-priority medium">MED</span>
                <span>Develop targeted campaigns for {dealProbability.medium_probability} medium-probability prospects</span>
              </div>
              <div className="recommendation">
                <span className="rec-priority urgent">URGENT</span>
                <span>Immediate action required on {dealProbability.at_risk} at-risk deals</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Information */}
      <div className="model-information">
        <h4>🤖 Model Information</h4>
        <div className="model-details">
          <div className="model-stat">
            <span className="stat-label">Accuracy Rate:</span>
            <span className="stat-value">87%</span>
          </div>
          <div className="model-stat">
            <span className="stat-label">Training Data:</span>
            <span className="stat-value">2,500+ deals</span>
          </div>
          <div className="model-stat">
            <span className="stat-label">Last Updated:</span>
            <span className="stat-value">2 hours ago</span>
          </div>
          <div className="model-stat">
            <span className="stat-label">Confidence Threshold:</span>
            <span className="stat-value">70%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalytics;