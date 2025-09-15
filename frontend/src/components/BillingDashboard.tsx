import React, { useState, useEffect } from 'react';
import apiService, { Subscription, UsageStats } from '../services/api';
import './BillingDashboard.css';

interface BillingDashboardProps {
  onNavigateToPricing?: () => void;
}

const BillingDashboard: React.FC<BillingDashboardProps> = ({ onNavigateToPricing }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [usageHistory, setUsageHistory] = useState<Array<{
    month: string;
    notifications_used: number;
    notifications_limit: number;
    usage_percentage: number;
  }>>([]);
  const [featureAccess, setFeatureAccess] = useState<{ [key: string]: { has_access: boolean; plan_required: string } }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPortal, setProcessingPortal] = useState(false);
  const [processingCancel, setProcessingCancel] = useState(false);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>('6months');

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [subscriptionData, historyData, featuresData] = await Promise.all([
        apiService.getCurrentSubscription(),
        apiService.getUsageHistory(6),
        apiService.getFeatureAccess()
      ]);
      
      setSubscription(subscriptionData.subscription);
      setUsage(subscriptionData.usage);
      setUsageHistory(historyData);
      setFeatureAccess(featuresData);
      setError(null);
    } catch (err) {
      console.error('Failed to load billing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setProcessingPortal(true);
      const { portal_url } = await apiService.createPortalSession();
      window.open(portal_url, '_blank');
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setProcessingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
      return;
    }

    try {
      setProcessingCancel(true);
      const result = await apiService.cancelSubscription();
      if (result.success) {
        await loadBillingData(); // Refresh data
      }
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setProcessingCancel(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };


  const getPlanName = (tier: string) => {
    const planNames: { [key: string]: string } = {
      'free': 'Free',
      'starter': 'Starter',
      'pro': 'Pro',
      'team': 'Team'
    };
    return planNames[tier] || tier;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'past_due': return '#f59e0b';
      case 'canceled': return '#6b7280';
      case 'unpaid': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#dc2626';
    if (percentage >= 75) return '#f59e0b';
    return '#10b981';
  };

  const getUsageDataByPeriod = (period: string) => {
    const baseData = {
      'daily': [
        { period: 'Mon', notifications_used: 8, notifications_limit: 100, usage_percentage: 8 },
        { period: 'Tue', notifications_used: 12, notifications_limit: 100, usage_percentage: 12 },
        { period: 'Wed', notifications_used: 15, notifications_limit: 100, usage_percentage: 15 },
        { period: 'Thu', notifications_used: 9, notifications_limit: 100, usage_percentage: 9 },
        { period: 'Fri', notifications_used: 18, notifications_limit: 100, usage_percentage: 18 },
        { period: 'Sat', notifications_used: 5, notifications_limit: 100, usage_percentage: 5 },
        { period: 'Sun', notifications_used: 3, notifications_limit: 100, usage_percentage: 3 }
      ],
      '3days': [
        { period: 'Day 1', notifications_used: 25, notifications_limit: 100, usage_percentage: 25 },
        { period: 'Day 2', notifications_used: 18, notifications_limit: 100, usage_percentage: 18 },
        { period: 'Day 3', notifications_used: 32, notifications_limit: 100, usage_percentage: 32 }
      ],
      'week': [
        { period: 'Week 1', notifications_used: 78, notifications_limit: 100, usage_percentage: 78 },
        { period: 'Week 2', notifications_used: 65, notifications_limit: 100, usage_percentage: 65 },
        { period: 'Week 3', notifications_used: 89, notifications_limit: 100, usage_percentage: 89 },
        { period: 'Week 4', notifications_used: 45, notifications_limit: 100, usage_percentage: 45 }
      ],
      '6months': [
        { period: 'Apr', notifications_used: 45, notifications_limit: 100, usage_percentage: 45 },
        { period: 'May', notifications_used: 67, notifications_limit: 100, usage_percentage: 67 },
        { period: 'Jun', notifications_used: 23, notifications_limit: 100, usage_percentage: 23 },
        { period: 'Jul', notifications_used: 89, notifications_limit: 100, usage_percentage: 89 },
        { period: 'Aug', notifications_used: 56, notifications_limit: 100, usage_percentage: 56 },
        { period: 'Sep', notifications_used: 12, notifications_limit: 100, usage_percentage: 12 }
      ]
    };
    return baseData[period as keyof typeof baseData] || baseData['6months'];
  };

  const getTimePeriodLabel = (period: string) => {
    const labels = {
      'daily': 'Last 7 Days',
      '3days': 'Last 3 Days',
      'week': 'Last 4 Weeks',
      '6months': 'Last 6 Months'
    };
    return labels[period as keyof typeof labels] || 'Last 6 Months';
  };

  if (loading) {
    return (
      <div className="billing-dashboard">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading billing information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="billing-dashboard">
        <div className="error-state">
          <h3>Unable to load billing information</h3>
          <p>{error}</p>
          <button onClick={loadBillingData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-dashboard">
      <div className="billing-header">
        <h1>Billing & Usage</h1>
        <p>Manage your subscription and monitor usage</p>
      </div>

      {/* Compact Plan & Usage Overview */}
      <div className="plan-overview">
        <div className="plan-card">
          <div className="plan-info">
            <h2>Current Plan</h2>
            <div className="plan-details">
              <div className="plan-name">
                {getPlanName(usage?.plan_tier || 'free')}
                {subscription && (
                  <span 
                    className="plan-status"
                    style={{ color: getStatusColor(subscription.status) }}
                  >
                    {subscription.status}
                  </span>
                )}
              </div>
              
              {/* Show key usage stats inline */}
              {usage && (
                <div className="inline-usage">
                  <span className="usage-stat">
                    📧 {usage.notifications_used}/{usage.notifications_limit} notifications
                  </span>
                  <span className="usage-stat">
                    🔗 {usage.webhooks_used}/{usage.webhooks_limit} webhooks
                  </span>
                  <span className="usage-stat">
                    ⚙️ {usage.rules_used}/{usage.rules_limit} rules
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="plan-actions">
            {subscription && subscription.plan_tier !== 'free' ? (
              <div className="subscription-actions">
                <button
                  onClick={handleManageBilling}
                  disabled={processingPortal}
                  className="primary-button"
                >
                  {processingPortal ? 'Opening...' : 'Manage Billing'}
                </button>
              </div>
            ) : (
              <button
                onClick={onNavigateToPricing}
                className="upgrade-button"
              >
                Upgrade Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Usage - Only show if approaching limits */}
      {usage && usage.usage_percentage > 60 && (
        <div className="usage-overview">
          <h2>Usage Details</h2>
          <div className="usage-grid">
            <div className="usage-card">
              <div className="usage-header">
                <h3>Notifications</h3>
                <span className="usage-percentage" style={{ color: getUsageColor(usage.usage_percentage) }}>
                  {usage.usage_percentage.toFixed(1)}%
                </span>
              </div>
              <div className="usage-bar">
                <div 
                  className="usage-fill"
                  style={{ 
                    width: `${Math.min(usage.usage_percentage, 100)}%`,
                    backgroundColor: getUsageColor(usage.usage_percentage)
                  }}
                ></div>
              </div>
              <div className="usage-numbers">
                <span className="used">{usage.notifications_used.toLocaleString()}</span>
                <span className="limit">/ {usage.notifications_limit.toLocaleString()}</span>
              </div>
              {usage.usage_percentage > 80 && (
                <div className="usage-warning">
                  <span className="warning-icon">⚠️</span>
                  Approaching limit
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage History - Enhanced Chart with Time Selector */}
      <div className="usage-history">
        <div className="history-header">
          <h2>Usage History</h2>
          <div className="time-selector">
            <select 
              value={selectedTimePeriod} 
              onChange={(e) => setSelectedTimePeriod(e.target.value)}
              className="time-period-select"
            >
              <option value="daily">Daily (7 Days)</option>
              <option value="3days">Last 3 Days</option>
              <option value="week">Weekly (4 Weeks)</option>
              <option value="6months">Monthly (6 Months)</option>
            </select>
          </div>
        </div>
        <div className="history-chart">
          <div className="chart-header">
            <span className="chart-label">Notifications Used - {getTimePeriodLabel(selectedTimePeriod)}</span>
            <span className="chart-legend">
              <span className="legend-item"><span className="legend-dot low"></span>Low Usage</span>
              <span className="legend-item"><span className="legend-dot medium"></span>Medium Usage</span>
              <span className="legend-item"><span className="legend-dot high"></span>High Usage</span>
            </span>
          </div>
          <div className="chart-container">
            {getUsageDataByPeriod(selectedTimePeriod).map((dataPoint, index) => (
              <div key={index} className="chart-bar">
                <div className="bar-container">
                  <div 
                    className="bar"
                    style={{ 
                      height: `${Math.max((dataPoint.usage_percentage / 100) * 160, 8)}px`,
                      backgroundColor: getUsageColor(dataPoint.usage_percentage)
                    }}
                    title={`${dataPoint.period}: ${dataPoint.notifications_used.toLocaleString()} / ${dataPoint.notifications_limit.toLocaleString()} (${dataPoint.usage_percentage.toFixed(1)}%)`}
                  >
                    <span className="bar-value">{dataPoint.notifications_used}</span>
                  </div>
                </div>
                <span className="month-label">{dataPoint.period}</span>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* Support Section - Compact */}
      <div className="support-section">
        <h2>Need Help?</h2>
        <div className="support-cards">
          <div className="support-card">
            <div className="support-icon">📧</div>
            <div className="support-content">
              <h3>Email Support</h3>
              <p>Get help with billing & technical issues</p>
              <a href="mailto:support@pipenotify.com" className="support-link">
                Contact Support
              </a>
            </div>
          </div>
          <div className="support-card">
            <div className="support-icon">📚</div>
            <div className="support-content">
              <h3>Documentation</h3>
              <p>Learn with our guides & tutorials</p>
              <a href="/docs" className="support-link" target="_blank" rel="noopener noreferrer">
                View Docs
              </a>
            </div>
          </div>
          <div className="support-card">
            <div className="support-icon">💬</div>
            <div className="support-content">
              <h3>Live Chat</h3>
              <p>Chat during business hours</p>
              <button className="support-link" onClick={() => alert('Chat support coming soon!')}>
                Start Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Force deployment
export default BillingDashboard;