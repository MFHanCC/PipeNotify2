import React, { useState, useEffect } from 'react';
import apiService, { UsageStats } from '../services/api';
import './UsageWidget.css';

interface UsageWidgetProps {
  compact?: boolean;
  showUpgrade?: boolean;
  onUpgradeClick?: () => void;
}

const UsageWidget: React.FC<UsageWidgetProps> = ({ 
  compact = false, 
  showUpgrade = true,
  onUpgradeClick 
}) => {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      setLoading(true);
      const { usage: usageData } = await apiService.getCurrentSubscription();
      setUsage(usageData);
      setError(null);
    } catch (err) {
      console.error('Failed to load usage:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#dc2626';
    if (percentage >= 75) return '#f59e0b';
    return '#10b981';
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

  const shouldShowUpgradePrompt = () => {
    return usage && (
      usage.usage_percentage >= 80 || 
      usage.plan_tier === 'free'
    );
  };

  if (loading) {
    return (
      <div className={`usage-widget ${compact ? 'compact' : ''}`}>
        <div className="usage-loading">
          <div className="spinner-small"></div>
          <span>Loading usage...</span>
        </div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className={`usage-widget ${compact ? 'compact' : ''} error`}>
        <div className="usage-error">
          <span className="error-icon">⚠️</span>
          <span>Unable to load usage</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="usage-widget compact">
        <div className="usage-header">
          <span className="plan-badge">{getPlanName(usage.plan_tier)}</span>
          <span 
            className="usage-percentage"
            style={{ color: getUsageColor(usage.usage_percentage) }}
          >
            {usage.usage_percentage.toFixed(0)}%
          </span>
        </div>
        
        <div className="usage-bar-small">
          <div 
            className="usage-fill"
            style={{ 
              width: `${Math.min(usage.usage_percentage, 100)}%`,
              backgroundColor: getUsageColor(usage.usage_percentage)
            }}
          ></div>
        </div>
        
        <div className="usage-text">
          {usage.notifications_used.toLocaleString()} / {usage.notifications_limit.toLocaleString()} notifications
        </div>

        {shouldShowUpgradePrompt() && showUpgrade && (
          <button 
            className="upgrade-prompt"
            onClick={onUpgradeClick || (() => window.location.href = '/pricing')}
          >
            {usage.plan_tier === 'free' ? 'Upgrade Plan' : 'Need More?'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="usage-widget">
      <div className="usage-header">
        <h3>Usage & Limits</h3>
        <span className="plan-badge large">{getPlanName(usage.plan_tier)}</span>
      </div>

      <div className="usage-metrics">
        <div className="metric">
          <div className="metric-header">
            <span className="metric-label">Notifications</span>
            <span 
              className="metric-percentage"
              style={{ color: getUsageColor(usage.usage_percentage) }}
            >
              {usage.usage_percentage.toFixed(1)}%
            </span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill"
              style={{ 
                width: `${Math.min(usage.usage_percentage, 100)}%`,
                backgroundColor: getUsageColor(usage.usage_percentage)
              }}
            ></div>
          </div>
          <div className="metric-numbers">
            <span className="metric-used">{usage.notifications_used.toLocaleString()}</span>
            <span className="metric-limit">/ {usage.notifications_limit.toLocaleString()}</span>
          </div>
          {usage.usage_percentage >= 90 && (
            <div className="metric-warning">
              <span className="warning-icon">⚠️</span>
              Near limit - consider upgrading
            </div>
          )}
        </div>

        <div className="metric">
          <div className="metric-header">
            <span className="metric-label">Webhooks</span>
            <span className="metric-percentage">
              {usage.webhooks_limit > 0 ? Math.round((usage.webhooks_used / usage.webhooks_limit) * 100) : 0}%
            </span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill"
              style={{ 
                width: `${usage.webhooks_limit > 0 ? (usage.webhooks_used / usage.webhooks_limit) * 100 : 0}%`,
                backgroundColor: '#667eea'
              }}
            ></div>
          </div>
          <div className="metric-numbers">
            <span className="metric-used">{usage.webhooks_used}</span>
            <span className="metric-limit">/ {usage.webhooks_limit}</span>
          </div>
        </div>

        <div className="metric">
          <div className="metric-header">
            <span className="metric-label">Rules</span>
            <span className="metric-percentage">
              {usage.rules_limit > 0 ? Math.round((usage.rules_used / usage.rules_limit) * 100) : 0}%
            </span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill"
              style={{ 
                width: `${usage.rules_limit > 0 ? (usage.rules_used / usage.rules_limit) * 100 : 0}%`,
                backgroundColor: '#10b981'
              }}
            ></div>
          </div>
          <div className="metric-numbers">
            <span className="metric-used">{usage.rules_used}</span>
            <span className="metric-limit">/ {usage.rules_limit}</span>
          </div>
        </div>
      </div>

      {shouldShowUpgradePrompt() && showUpgrade && (
        <div className="upgrade-section">
          <div className="upgrade-message">
            {usage.plan_tier === 'free' ? (
              <>
                <h4>Ready to unlock more?</h4>
                <p>Upgrade to get more notifications, webhooks, and premium features.</p>
              </>
            ) : (
              <>
                <h4>Running low on notifications?</h4>
                <p>Upgrade to a higher plan for increased limits and additional features.</p>
              </>
            )}
          </div>
          <button 
            className="upgrade-button"
            onClick={onUpgradeClick || (() => window.location.href = '/pricing')}
          >
            View Plans
          </button>
        </div>
      )}
    </div>
  );
};

export default UsageWidget;