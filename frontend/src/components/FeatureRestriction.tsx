import React from 'react';
import './FeatureRestriction.css';

interface FeatureRestrictionProps {
  isAvailable: boolean;
  requiredPlan: string;
  currentPlan: string;
  featureName: string;
  children: React.ReactNode;
  upgradeHint?: string;
}

const FeatureRestriction: React.FC<FeatureRestrictionProps> = ({
  isAvailable,
  requiredPlan,
  currentPlan,
  featureName,
  children,
  upgradeHint
}) => {
  if (isAvailable) {
    return <>{children}</>;
  }

  const planNames = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    team: 'Team'
  };

  return (
    <div className="feature-restriction">
      <div className="feature-content disabled">
        {children}
      </div>
      <div className="upgrade-overlay">
        <div className="upgrade-tooltip">
          <div className="upgrade-text">
            <div><span className="upgrade-icon">🔒</span><strong>{featureName}</strong></div>
            <p>{planNames[requiredPlan as keyof typeof planNames]}+ plan required</p>
            {upgradeHint && <p className="upgrade-hint">{upgradeHint}</p>}
          </div>
          <button 
            className="upgrade-button"
            onClick={() => {
              // Navigate to pricing page
              window.location.href = '/pricing';
            }}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureRestriction;