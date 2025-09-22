import React, { useState, useEffect } from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import './BillingDashboard.css';

interface UsageData {
  notifications: { used: number; limit: number; percentage: number };
  webhooks: { used: number; limit: number; percentage: number };
  rules: { used: number; limit: number; percentage: number };
}

interface HistoryData {
  month: string;
  notifications: number;
  webhooks: number;
  rules: number;
}

const EnhancedBillingDashboard: React.FC = () => {
  const { planTier, limits, canUpgrade } = usePlanFeatures();
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData>({
    notifications: { used: 0, limit: 0, percentage: 0 },
    webhooks: { used: 0, limit: 0, percentage: 0 },
    rules: { used: 0, limit: 0, percentage: 0 }
  });
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [timePeriod, setTimePeriod] = useState('6months');

  useEffect(() => {
    const loadBillingData = async () => {
      setLoading(true);
      
      // Simulate API loading delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock usage data
      const mockUsage: UsageData = {
        notifications: {
          used: 240,
          limit: limits?.notifications === -1 ? -1 : (limits?.notifications || 100),
          percentage: limits?.notifications === -1 ? 0 : Math.min((240 / (limits?.notifications || 100)) * 100, 100)
        },
        webhooks: {
          used: 2,
          limit: limits?.webhooks === -1 ? -1 : (limits?.webhooks || 1),
          percentage: limits?.webhooks === -1 ? 0 : Math.min((2 / (limits?.webhooks || 1)) * 100, 100)
        },
        rules: {
          used: 7,
          limit: limits?.rules === -1 ? -1 : (limits?.rules || 3),
          percentage: limits?.rules === -1 ? 0 : Math.min((7 / (limits?.rules || 3)) * 100, 100)
        }
      };

      // Mock history data
      const mockHistory: HistoryData[] = [
        { month: 'Jan', notifications: 180, webhooks: 1, rules: 5 },
        { month: 'Feb', notifications: 220, webhooks: 2, rules: 6 },
        { month: 'Mar', notifications: 195, webhooks: 2, rules: 7 },
        { month: 'Apr', notifications: 240, webhooks: 2, rules: 7 },
        { month: 'May', notifications: 210, webhooks: 2, rules: 6 },
        { month: 'Jun', notifications: 240, webhooks: 2, rules: 7 }
      ];

      setUsageData(mockUsage);
      setHistoryData(mockHistory);
      setLoading(false);
    };

    loadBillingData();
  }, [limits]);

  const getPlanDisplayName = (tier: string) => {
    const plans: { [key: string]: string } = {
      'free': 'Free',
      'starter': 'Starter',
      'pro': 'Professional',
      'team': 'Team'
    };
    return plans[tier] || tier;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#dc2626';
    if (percentage >= 70) return '#f59e0b';
    return '#10b981';
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Unlimited' : limit.toString();
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <h3>Loading billing information...</h3>
        <p>Please wait while we fetch your account details</p>
      </div>
    );
  }

  return (
    <div className="billing-dashboard">
      {/* Header */}
      <div className="billing-header">
        <h1>Billing & Usage</h1>
        <p>Manage your subscription and monitor your usage across all features</p>
      </div>

      {/* Current Plan Overview */}
      <div className="plan-overview">
        <div className="plan-card">
          <div className="plan-info">
            <h2>Current Plan</h2>
            <h3 className="plan-name">
              {getPlanDisplayName(planTier || 'free')}
              <span className="plan-status" style={{ 
                color: planTier === 'free' ? '#92400e' : '#166534',
                borderColor: planTier === 'free' ? '#92400e' : '#166534'
              }}>
                {planTier === 'free' ? 'Free Tier' : 'Active'}
              </span>
            </h3>
            <div className="inline-usage">
              <span className="usage-stat">
                {usageData.notifications.limit === -1 ? 'Unlimited' : usageData.notifications.used} notifications this month
              </span>
              <span className="usage-stat">
                {usageData.webhooks.used} of {formatLimit(usageData.webhooks.limit)} webhooks
              </span>
              <span className="usage-stat">
                {usageData.rules.used} of {formatLimit(usageData.rules.limit)} rules
              </span>
            </div>
          </div>
          <div className="plan-actions">
            {canUpgrade && (
              <button 
                className="upgrade-button"
                onClick={() => {
                  const billingSection = document.querySelector('.billing-dashboard');
                  if (billingSection) {
                    billingSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                🚀 Upgrade Plan
              </button>
            )}
            <button 
              className="primary-button"
              onClick={() => {
                const billingSection = document.querySelector('.billing-dashboard');
                if (billingSection) {
                  billingSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              View All Plans
            </button>
          </div>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="usage-overview">
        <h2>📊 Current Usage</h2>
        <div className="usage-grid">
          <div className="usage-card">
            <div className="usage-header">
              <h3>Monthly Notifications</h3>
              {usageData.notifications.limit !== -1 && (
                <span 
                  className="usage-percentage"
                  style={{ color: getUsageColor(usageData.notifications.percentage) }}
                >
                  {Math.round(usageData.notifications.percentage)}%
                </span>
              )}
            </div>
            {usageData.notifications.limit !== -1 && (
              <div className="usage-bar">
                <div 
                  className="usage-fill"
                  style={{ 
                    width: `${usageData.notifications.percentage}%`,
                    backgroundColor: getUsageColor(usageData.notifications.percentage)
                  }}
                />
              </div>
            )}
            <div className="usage-numbers">
              <span className="used">{usageData.notifications.used}</span>
              <span className="limit">/ {formatLimit(usageData.notifications.limit)}</span>
            </div>
            {usageData.notifications.percentage >= 90 && usageData.notifications.limit !== -1 && (
              <div className="usage-warning">
                ⚠️ You're approaching your monthly limit
              </div>
            )}
          </div>

          <div className="usage-card">
            <div className="usage-header">
              <h3>Active Webhooks</h3>
              {usageData.webhooks.limit !== -1 && (
                <span 
                  className="usage-percentage"
                  style={{ color: getUsageColor(usageData.webhooks.percentage) }}
                >
                  {Math.round(usageData.webhooks.percentage)}%
                </span>
              )}
            </div>
            {usageData.webhooks.limit !== -1 && (
              <div className="usage-bar">
                <div 
                  className="usage-fill"
                  style={{ 
                    width: `${usageData.webhooks.percentage}%`,
                    backgroundColor: getUsageColor(usageData.webhooks.percentage)
                  }}
                />
              </div>
            )}
            <div className="usage-numbers">
              <span className="used">{usageData.webhooks.used}</span>
              <span className="limit">/ {formatLimit(usageData.webhooks.limit)}</span>
            </div>
          </div>

          <div className="usage-card">
            <div className="usage-header">
              <h3>Notification Rules</h3>
              {usageData.rules.limit !== -1 && (
                <span 
                  className="usage-percentage"
                  style={{ color: getUsageColor(usageData.rules.percentage) }}
                >
                  {Math.round(usageData.rules.percentage)}%
                </span>
              )}
            </div>
            {usageData.rules.limit !== -1 && (
              <div className="usage-bar">
                <div 
                  className="usage-fill"
                  style={{ 
                    width: `${usageData.rules.percentage}%`,
                    backgroundColor: getUsageColor(usageData.rules.percentage)
                  }}
                />
              </div>
            )}
            <div className="usage-numbers">
              <span className="used">{usageData.rules.used}</span>
              <span className="limit">/ {formatLimit(usageData.rules.limit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage History */}
      <div className="usage-history">
        <div className="history-header">
          <h2>📈 Usage History</h2>
          <div className="time-selector">
            <select 
              className="time-period-select"
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
            >
              <option value="3months">Last 3 months</option>
              <option value="6months">Last 6 months</option>
              <option value="12months">Last 12 months</option>
            </select>
          </div>
        </div>
        
        <div className="history-chart">
          <div className="chart-header">
            <span className="chart-label">Monthly Notifications Sent</span>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-dot low"></div>
                <span>Low (0-50)</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot medium"></div>
                <span>Medium (51-150)</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot high"></div>
                <span>High (150+)</span>
              </div>
            </div>
          </div>
          
          <div className="chart-container">
            {historyData.map((data, index) => (
              <div key={index} className="chart-bar">
                <div className="bar-container">
                  <div 
                    className="bar"
                    style={{ 
                      height: `${Math.max((data.notifications / 300) * 100, 5)}%`,
                      backgroundColor: data.notifications > 150 ? '#dc2626' : 
                                     data.notifications > 50 ? '#f59e0b' : '#10b981'
                    }}
                  >
                    <span className="bar-value">{data.notifications}</span>
                  </div>
                </div>
                <span className="month-label">{data.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Access */}
      <div className="feature-access">
        <h2>🔑 Feature Access</h2>
        <div className="features-grid">
          <div className={`feature-item ${planTier !== 'free' ? 'enabled' : 'disabled'}`}>
            <div className="feature-status">
              <div className={`status-icon ${planTier !== 'free' ? 'enabled' : 'disabled'}`}>
                {planTier !== 'free' ? '✓' : '✗'}
              </div>
              <span className="feature-name">Advanced Routing</span>
            </div>
            {planTier === 'free' && <span className="required-plan">Starter+</span>}
          </div>
          
          <div className={`feature-item ${planTier === 'pro' || planTier === 'team' ? 'enabled' : 'disabled'}`}>
            <div className="feature-status">
              <div className={`status-icon ${planTier === 'pro' || planTier === 'team' ? 'enabled' : 'disabled'}`}>
                {planTier === 'pro' || planTier === 'team' ? '✓' : '✗'}
              </div>
              <span className="feature-name">Custom Templates</span>
            </div>
            {planTier !== 'pro' && planTier !== 'team' && <span className="required-plan">Pro+</span>}
          </div>
          
          <div className={`feature-item ${planTier === 'team' ? 'enabled' : 'disabled'}`}>
            <div className="feature-status">
              <div className={`status-icon ${planTier === 'team' ? 'enabled' : 'disabled'}`}>
                {planTier === 'team' ? '✓' : '✗'}
              </div>
              <span className="feature-name">Team Analytics</span>
            </div>
            {planTier !== 'team' && <span className="required-plan">Team</span>}
          </div>
        </div>
      </div>

      {/* Support Section */}
      <div className="support-section">
        <h2>💬 Need Help?</h2>
        <div className="support-cards">
          <div className="support-card">
            <div className="support-icon">📧</div>
            <div className="support-content">
              <h3>Email Support</h3>
              <p>Get help with your account and billing questions</p>
              <a href="mailto:support@pipenotify.com" className="support-link">
                Contact Support
              </a>
            </div>
          </div>
          
          <div className="support-card">
            <div className="support-icon">📚</div>
            <div className="support-content">
              <h3>Documentation</h3>
              <p>Learn how to maximize your PipeNotify experience</p>
              <a href="/docs" className="support-link">
                View Docs
              </a>
            </div>
          </div>
          
          <div className="support-card">
            <div className="support-icon">💰</div>
            <div className="support-content">
              <h3>Billing Help</h3>
              <p>Questions about pricing, invoices, or subscriptions</p>
              <a href="mailto:billing@pipenotify.com" className="support-link">
                Billing Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedBillingDashboard;