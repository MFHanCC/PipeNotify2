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

      {/* Current Plan Section */}
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
              
              {subscription && subscription.plan_tier !== 'free' && (
                <div className="billing-cycle">
                  <p>
                    <strong>Current Period:</strong><br />
                    {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                  </p>
                  {subscription.cancel_at_period_end && (
                    <div className="cancellation-notice">
                      <span className="warning-icon">⚠️</span>
                      Subscription will end on {formatDate(subscription.current_period_end)}
                    </div>
                  )}
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
                
                {!subscription.cancel_at_period_end && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={processingCancel}
                    className="danger-button"
                  >
                    {processingCancel ? 'Canceling...' : 'Cancel Subscription'}
                  </button>
                )}
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

      {/* Usage Overview */}
      {usage && (
        <div className="usage-overview">
          <h2>Current Usage</h2>
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

            <div className="usage-card">
              <div className="usage-header">
                <h3>Webhooks</h3>
                <span className="usage-percentage">
                  {usage.webhooks_limit > 0 ? Math.round((usage.webhooks_used / usage.webhooks_limit) * 100) : 0}%
                </span>
              </div>
              <div className="usage-bar">
                <div 
                  className="usage-fill"
                  style={{ 
                    width: `${usage.webhooks_limit > 0 ? (usage.webhooks_used / usage.webhooks_limit) * 100 : 0}%`,
                    backgroundColor: '#667eea'
                  }}
                ></div>
              </div>
              <div className="usage-numbers">
                <span className="used">{usage.webhooks_used}</span>
                <span className="limit">/ {usage.webhooks_limit}</span>
              </div>
            </div>

            <div className="usage-card">
              <div className="usage-header">
                <h3>Rules</h3>
                <span className="usage-percentage">
                  {usage.rules_limit > 0 ? Math.round((usage.rules_used / usage.rules_limit) * 100) : 0}%
                </span>
              </div>
              <div className="usage-bar">
                <div 
                  className="usage-fill"
                  style={{ 
                    width: `${usage.rules_limit > 0 ? (usage.rules_used / usage.rules_limit) * 100 : 0}%`,
                    backgroundColor: '#10b981'
                  }}
                ></div>
              </div>
              <div className="usage-numbers">
                <span className="used">{usage.rules_used}</span>
                <span className="limit">/ {usage.rules_limit}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage History */}
      {usageHistory.length > 0 && (
        <div className="usage-history">
          <h2>Usage History</h2>
          <div className="history-chart">
            <div className="chart-container">
              {usageHistory.map((month, index) => (
                <div key={index} className="chart-bar">
                  <div 
                    className="bar"
                    style={{ 
                      height: `${Math.max((month.usage_percentage / 100) * 200, 4)}px`,
                      backgroundColor: getUsageColor(month.usage_percentage)
                    }}
                    title={`${month.month}: ${month.notifications_used.toLocaleString()} / ${month.notifications_limit.toLocaleString()} (${month.usage_percentage.toFixed(1)}%)`}
                  ></div>
                  <span className="month-label">{month.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feature Access */}
      {Object.keys(featureAccess).length > 0 && (
        <div className="feature-access">
          <h2>Feature Access</h2>
          <div className="features-grid">
            {Object.entries(featureAccess).map(([featureName, access]) => (
              <div key={featureName} className={`feature-item ${access.has_access ? 'enabled' : 'disabled'}`}>
                <div className="feature-status">
                  <span className={`status-icon ${access.has_access ? 'enabled' : 'disabled'}`}>
                    {access.has_access ? '✓' : '✗'}
                  </span>
                  <span className="feature-name">
                    {featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                {!access.has_access && (
                  <span className="required-plan">
                    Requires {getPlanName(access.plan_required)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Section */}
      <div className="support-section">
        <h2>Need Help?</h2>
        <div className="support-cards">
          <div className="support-card">
            <h3>📧 Email Support</h3>
            <p>Get help with billing, technical issues, or general questions.</p>
            <a href="mailto:support@pipenotify.com" className="support-link">
              Contact Support
            </a>
          </div>
          <div className="support-card">
            <h3>📚 Documentation</h3>
            <p>Learn how to get the most out of Pipenotify with our guides.</p>
            <a href="/docs" className="support-link" target="_blank" rel="noopener noreferrer">
              View Docs
            </a>
          </div>
          <div className="support-card">
            <h3>💬 Live Chat</h3>
            <p>Chat with our team for immediate assistance during business hours.</p>
            <button className="support-link" onClick={() => alert('Chat support coming soon!')}>
              Start Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;