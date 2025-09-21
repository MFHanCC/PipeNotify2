import React, { useState } from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import './FeatureGate.css';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  showUpgrade?: boolean;
  className?: string;
  disableOnly?: boolean; // If true, only disable but don't overlay
  fallbackMessage?: string;
}

const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  showUpgrade = true,
  className = '',
  disableOnly = false,
  fallbackMessage
}) => {
  const { hasFeature, getFeatureRequiredPlan, planTier, loading } = usePlanFeatures();
  const [showTooltip, setShowTooltip] = useState(false);
  
  if (loading) {
    return <div className="feature-gate-loading">{children}</div>;
  }

  const isAvailable = hasFeature(feature);
  const requiredPlan = getFeatureRequiredPlan(feature);
  
  // If feature is available, render children normally
  if (isAvailable) {
    return <>{children}</>;
  }

  // Feature is not available - show restricted version
  const getPlanName = (plan: string) => {
    const planNames: { [key: string]: string } = {
      'starter': 'Starter',
      'pro': 'Professional', 
      'team': 'Team'
    };
    return planNames[plan] || plan;
  };

  const handleUpgradeClick = () => {
    window.location.href = '/pricing';
  };

  const renderRestrictedContent = () => {
    if (disableOnly) {
      // Just disable the content, don't add overlay
      return (
        <div className={`feature-disabled ${className}`}>
          {children}
        </div>
      );
    }

    return (
      <div 
        className={`feature-gate-container ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="feature-gate-overlay">
          <div className="feature-gate-content">
            <div className="feature-gate-lock">🔒</div>
            <div className="feature-gate-message">
              {fallbackMessage || `Available in ${getPlanName(requiredPlan)} plan`}
            </div>
            {showUpgrade && (
              <button 
                className="feature-gate-upgrade-btn"
                onClick={handleUpgradeClick}
              >
                Upgrade Now
              </button>
            )}
          </div>
        </div>
        <div className="feature-gate-preview">
          {children}
        </div>
        
        {showTooltip && (
          <div className="feature-gate-tooltip">
            <div className="tooltip-header">
              <span className="tooltip-icon">⭐</span>
              <span>Premium Feature</span>
            </div>
            <div className="tooltip-body">
              <p>This feature is available in the {getPlanName(requiredPlan)} plan and above.</p>
              <p>Your current plan: <strong>{getPlanName(planTier)}</strong></p>
            </div>
            <div className="tooltip-footer">
              <button 
                className="tooltip-upgrade-btn"
                onClick={handleUpgradeClick}
              >
                View Plans
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return renderRestrictedContent();
};

export default FeatureGate;