import React, { useState } from 'react';
import './AdvancedAnalyticsDashboard.css';
import BasicAnalyticsDashboard from './BasicAnalyticsDashboard';
import ExecutiveReports from './ExecutiveReports';
import PredictiveAnalytics from './PredictiveAnalytics';
import TeamPerformance from './TeamPerformance';
import AnalyticsExport from './AnalyticsExport';

interface AdvancedAnalyticsDashboardProps {
  onRefresh?: () => void;
}

type AnalyticsView = 'overview' | 'executive' | 'predictive' | 'team' | 'export';

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({ onRefresh }) => {
  const [activeView, setActiveView] = useState<AnalyticsView>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const navigationItems = [
    { id: 'overview' as AnalyticsView, label: 'Overview', icon: '📊', description: 'Key metrics and trends' },
    { id: 'executive' as AnalyticsView, label: 'Executive Reports', icon: '📈', description: 'Summary & insights' },
    { id: 'predictive' as AnalyticsView, label: 'Predictive Analytics', icon: '🔮', description: 'Forecasts & predictions' },
    { id: 'team' as AnalyticsView, label: 'Team Performance', icon: '👥', description: 'Team metrics & benchmarks' },
    { id: 'export' as AnalyticsView, label: 'Data Export', icon: '📄', description: 'Download & share data' }
  ];

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      // Increment refresh token to trigger child component refreshes
      setRefreshToken(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return <BasicAnalyticsDashboard onRefresh={handleRefresh} refreshToken={refreshToken} />;
      case 'executive':
        return <ExecutiveReports refreshToken={refreshToken} />;
      case 'predictive':
        return <PredictiveAnalytics refreshToken={refreshToken} />;
      case 'team':
        return <TeamPerformance refreshToken={refreshToken} />;
      case 'export':
        return <AnalyticsExport refreshToken={refreshToken} />;
      default:
        return <BasicAnalyticsDashboard onRefresh={handleRefresh} refreshToken={refreshToken} />;
    }
  };

  return (
    <div className="advanced-analytics-dashboard">
      {/* Header */}
      <div className="advanced-analytics-header">
        <div className="header-content">
          <h2>Advanced Analytics & Insights</h2>
          <p>Comprehensive analytics suite for data-driven decision making</p>
          <div className="plan-badge">Team Plan Feature</div>
        </div>
        
        <div className="header-actions">
          <button 
            className={`refresh-btn ${isLoading ? 'loading' : ''}`}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <span className="btn-icon">🔄</span>
            {isLoading ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="analytics-nav">
        <div className="nav-tabs">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className={`nav-tab ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              <span className="tab-icon">{item.icon}</span>
              <div className="tab-content">
                <span className="tab-label">{item.label}</span>
                <span className="tab-description">{item.description}</span>
              </div>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="analytics-content">
        <div className="content-wrapper">
          {renderActiveView()}
        </div>
      </div>

      {/* Feature Benefits Footer */}
      <div className="analytics-benefits">
        <h4>🚀 Team Plan Analytics Benefits</h4>
        <div className="benefits-grid">
          <div className="benefit-item">
            <span className="benefit-icon">📊</span>
            <span>Executive summaries with AI-powered insights</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🔮</span>
            <span>Predictive analytics for pipeline forecasting</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">👥</span>
            <span>Team performance metrics & benchmarks</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">📈</span>
            <span>Advanced data export in multiple formats</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">⏰</span>
            <span>Automated reporting & scheduled insights</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🎯</span>
            <span>Custom KPI tracking & goal monitoring</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;