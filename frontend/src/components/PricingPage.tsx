import React from 'react';
import UnifiedPricingTable from './UnifiedPricingTable';
import './PricingPage.css';

interface PricingPageProps {
  onPlanSelect?: (planTier: string) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onPlanSelect }) => {
  return (
    <div className="pricing-page">
      <UnifiedPricingTable onPlanSelect={onPlanSelect} />
    </div>
  );
};

export default PricingPage;