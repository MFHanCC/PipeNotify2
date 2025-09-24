import React from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import './LimitWarning.css';

interface LimitWarningProps {
  resourceType: 'notifications' | 'webhooks' | 'rules' | 'advanced_rules';
  currentUsage: number;
  className?: string;
  showUpgrade?: boolean;
  compact?: boolean;
}

const LimitWarning: React.FC<LimitWarningProps> = ({
  resourceType,
  currentUsage,
  className = '',
  showUpgrade = true,
  compact = false
}) => {
  const { limits, planTier } = usePlanFeatures();
  
  if (!limits) return null;

  const limit = limits[resourceType];
  if (!limit || limit === -1 || limit >= 999) return null; // No limit or unlimited

  const percentage = (currentUsage / limit) * 100;
  const isAtLimit = currentUsage >= limit;
  const isNearLimit = percentage >= 80;
  
  // Don't show warning if usage is low
  if (percentage < 60 && !isAtLimit) return null;

  const getWarningLevel = () => {
    if (isAtLimit) return 'critical';
    if (isNearLimit) return 'warning';
    return 'info';
  };

  const getIcon = () => {
    if (isAtLimit) return '🚨';
    if (isNearLimit) return '⚠️';
    return '📊';
  };

  const getMessage = () => {
    const resourceName = resourceType.replace('_', ' ');
    
    if (isAtLimit) {
      return `${getPlanName(planTier)} plan limit reached`;
    }
    if (isNearLimit) {
      return `Approaching limit (${currentUsage}/${limit})`;
    }
    return `${currentUsage}/${limit} ${resourceName}`;
  };

  const getPlanName = (plan: string) => {
    const planNames: { [key: string]: string } = {
      'free': 'Free',
      'starter': 'Starter',
      'pro': 'Professional', 
      'team': 'Team'
    };
    return planNames[plan] || plan;
  };

  const getUpgradeTarget = () => {
    if (resourceType === 'rules') {
      if (planTier === 'free') return 'starter';
      if (planTier === 'starter') return 'pro';
    }
    if (resourceType === 'webhooks') {
      if (planTier === 'free') return 'starter';
    }
    return 'pro';
  };

  const handleUpgradeClick = () => {
    window.location.href = '/pricing';
  };

  if (compact) {
    return (
      <div className={`limit-warning-compact ${getWarningLevel()} ${className}`}>
        <span className="limit-icon">{getIcon()}</span>
        <span className="limit-text">{currentUsage}/{limit}</span>
        {isAtLimit && showUpgrade && (
          <button 
            className="limit-upgrade-btn-compact"
            onClick={handleUpgradeClick}
            title="Upgrade to increase limits"
          >
            ⬆️
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`limit-warning-minimal ${getWarningLevel()} ${className}`}>
      {isAtLimit ? (
        <div className="limit-at-warning">
          <span className="limit-text">{getMessage()}</span>
          {showUpgrade && (
            <button 
              className="limit-upgrade-link"
              onClick={handleUpgradeClick}
            >
              Upgrade
            </button>
          )}
        </div>
      ) : (
        <div className="limit-info">
          <span className="limit-text">{getMessage()}</span>
        </div>
      )}
    </div>
  );
};

export default LimitWarning;