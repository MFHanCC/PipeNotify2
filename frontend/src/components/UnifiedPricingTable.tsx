import React, { useState } from 'react';
import apiService from '../services/api';
import './UnifiedPricingTable.css';

interface UnifiedPlan {
  name: string;
  tier: string;
  bestFor: string;
  monthlyPrice: number;
  annualPrice: number;
  cta: string;
  ctaType: 'primary' | 'secondary' | 'enterprise';
  popular?: boolean;
}

const unifiedPlans: UnifiedPlan[] = [
  {
    name: 'Free',
    tier: 'free',
    bestFor: 'Perfect for testing the waters',
    monthlyPrice: 0,
    annualPrice: 0,
    cta: 'Start Free',
    ctaType: 'secondary'
  },
  {
    name: 'Starter',
    tier: 'starter', 
    bestFor: 'Perfect for small teams',
    monthlyPrice: 19,
    annualPrice: 15,
    cta: 'Get Started',
    ctaType: 'primary'
  },
  {
    name: 'Professional',
    tier: 'pro',
    bestFor: 'Perfect for growing businesses',
    monthlyPrice: 49,
    annualPrice: 39,
    popular: true,
    cta: 'Get Started',
    ctaType: 'primary'
  },
  {
    name: 'Team', 
    tier: 'team',
    bestFor: 'Perfect for large organizations',
    monthlyPrice: 99,
    annualPrice: 79,
    cta: 'Get Started',
    ctaType: 'primary'
  }
];

interface PricingFeature {
  category: string;
  name: string;
  free: boolean | string;
  starter: boolean | string;
  pro: boolean | string;
  team: boolean | string;
  highlight?: boolean;
}

const pricingFeatures: PricingFeature[] = [
  // Limits & Pricing
  { category: 'Usage Limits', name: 'Notifications per month', free: '100', starter: '1,000', pro: '5,000', team: 'Unlimited', highlight: true },
  { category: 'Usage Limits', name: 'Rules', free: '3', starter: '10', pro: '50', team: 'Unlimited', highlight: true },
  { category: 'Usage Limits', name: 'Webhooks', free: '1', starter: '3', pro: '10', team: 'Unlimited', highlight: true },
  { category: 'Usage Limits', name: 'Log retention', free: '7 days', starter: '30 days', pro: '90 days', team: '1 year' },
  
  // Core Features
  { category: 'Core Features', name: 'Real-time deal notifications', free: true, starter: true, pro: true, team: true },
  { category: 'Core Features', name: 'Google Chat integration', free: true, starter: true, pro: true, team: true },
  { category: 'Core Features', name: 'Basic message templates', free: true, starter: true, pro: true, team: true },
  { category: 'Core Features', name: 'Deal Updated notifications', free: false, starter: true, pro: true, team: true },
  { category: 'Core Features', name: 'Value & stage filtering', free: false, starter: true, pro: true, team: true },
  { category: 'Core Features', name: 'Enhanced message formatting', free: false, starter: true, pro: true, team: true },
  { category: 'Core Features', name: 'Activity notifications', free: false, starter: true, pro: true, team: true },
  
  // Analytics & Reporting  
  { category: 'Analytics & Reporting', name: 'Analytics Dashboard', free: false, starter: '📈 Basic', pro: '📈 Basic', team: '🎯 Enhanced', highlight: true },
  { category: 'Analytics & Reporting', name: 'Date range selection', free: false, starter: 'Dropdown presets', pro: 'Dropdown presets', team: 'Custom calendar picker' },
  { category: 'Analytics & Reporting', name: 'Real-time data updates', free: false, starter: false, pro: false, team: true },
  { category: 'Analytics & Reporting', name: 'Interactive charts', free: false, starter: false, pro: false, team: true },
  { category: 'Analytics & Reporting', name: 'Advanced data tables', free: false, starter: false, pro: false, team: true },
  { category: 'Analytics & Reporting', name: 'CSV export', free: false, starter: true, pro: true, team: true },
  { category: 'Analytics & Reporting', name: 'Scheduled Reports', free: false, starter: false, pro: false, team: true, highlight: true },
  
  // Advanced Features
  { category: 'Advanced Features', name: 'Rule Templates Library', free: false, starter: false, pro: true, team: true, highlight: true },
  { category: 'Advanced Features', name: 'Custom Message Templates', free: false, starter: false, pro: true, team: true },
  { category: 'Advanced Features', name: 'Smart Channel Routing', free: false, starter: false, pro: true, team: true, highlight: true },
  { category: 'Advanced Features', name: 'Quiet Hours Scheduling', free: false, starter: false, pro: true, team: true },
  { category: 'Advanced Features', name: 'Stalled Deal Alerts', free: false, starter: false, pro: true, team: true },
  { category: 'Advanced Features', name: 'Bulk Rule Management', free: false, starter: false, pro: true, team: true },
  { category: 'Advanced Features', name: 'Advanced filtering (probability, owner, time)', free: false, starter: false, pro: true, team: true },
  { category: 'Advanced Features', name: 'Rule Backup & Restore', free: false, starter: false, pro: false, team: true, highlight: true },
  
  // Support
  { category: 'Support', name: 'Community support', free: true, starter: true, pro: true, team: true },
  { category: 'Support', name: 'Email support', free: false, starter: true, pro: true, team: true },
  { category: 'Support', name: 'Priority support', free: false, starter: false, pro: true, team: true },
  { category: 'Support', name: 'Dedicated account manager', free: false, starter: false, pro: false, team: true }
];

interface UnifiedPricingTableProps {
  onPlanSelect?: (planTier: string) => void;
}

const UnifiedPricingTable: React.FC<UnifiedPricingTableProps> = ({ onPlanSelect }) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const handlePlanSelection = async (planTier: string) => {
    try {
      setProcessingPlan(planTier);
      
      if (planTier === 'free') {
        if (onPlanSelect) {
          onPlanSelect(planTier);
        } else {
          window.location.href = '/signup';
        }
      } else {
        const { checkout_url } = await apiService.createCheckoutSession(planTier);
        
        if (onPlanSelect) {
          onPlanSelect(planTier);
        } else {
          window.location.href = checkout_url;
        }
      }
    } catch (error) {
      console.error('Error handling plan selection:', error);
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatPrice = (plan: UnifiedPlan) => {
    const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
    return price === 0 ? 'Free' : `$${price}`;
  };

  const formatFeatureValue = (value: boolean | string): { text: string; icon: string } => {
    if (value === true) return { text: '', icon: '✅' };
    if (value === false) return { text: '', icon: '❌' };
    return { text: value as string, icon: '' };
  };

  const groupedFeatures = pricingFeatures.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, PricingFeature[]>);

  return (
    <div className="unified-pricing-table">
      <div className="pricing-header">
        <h2>Choose Your Plan</h2>
        <p>Simple, transparent pricing that grows with your business</p>
        
        <div className="billing-toggle">
          <span className={!isAnnual ? 'active' : ''}>Monthly</span>
          <button 
            className={`toggle-switch ${isAnnual ? 'annual' : 'monthly'}`}
            onClick={() => setIsAnnual(!isAnnual)}
          >
            <div className="toggle-slider"></div>
          </button>
          <span className={isAnnual ? 'active' : ''}>
            Annual <span className="discount-badge">Save 20%</span>
          </span>
        </div>
      </div>

      <div className="pricing-cards-grid">
        {unifiedPlans.map((plan) => (
          <div key={plan.tier} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
            {plan.popular && <div className="popular-badge">Most Popular</div>}
            
            <div className="card-header">
              <h3>{plan.name}</h3>
              <p className="best-for">{plan.bestFor}</p>
              <div className="price">
                <span className="price-amount">{formatPrice(plan)}</span>
                {plan.monthlyPrice > 0 && (
                  <span className="price-period">/{isAnnual ? 'year' : 'month'}</span>
                )}
              </div>
              {isAnnual && plan.monthlyPrice > 0 && (
                <div className="annual-savings">
                  Save ${(plan.monthlyPrice - plan.annualPrice) * 12}/year
                </div>
              )}
            </div>

            <div className="card-features">
              <ul>
                {/* Show only the most essential features for each plan */}
                {plan.tier === 'free' && (
                  <>
                    <li>100 notifications/month</li>
                    <li>3 rules, 1 webhook</li>
                    <li>Basic notifications</li>
                  </>
                )}
                {plan.tier === 'starter' && (
                  <>
                    <li>1,000 notifications/month</li>
                    <li>10 rules, 3 webhooks</li>
                    <li>Advanced filtering</li>
                  </>
                )}
                {plan.tier === 'pro' && (
                  <>
                    <li>5,000 notifications/month</li>
                    <li>50 rules, 10 webhooks</li>
                    <li>Rule templates & smart routing</li>
                  </>
                )}
                {plan.tier === 'team' && (
                  <>
                    <li>Unlimited everything</li>
                    <li>Advanced analytics</li>
                    <li>Priority support</li>
                  </>
                )}
              </ul>
            </div>

            <button
              className={`cta-button ${plan.ctaType} ${processingPlan === plan.tier ? 'processing' : ''}`}
              onClick={() => handlePlanSelection(plan.tier)}
              disabled={processingPlan === plan.tier}
            >
              {processingPlan === plan.tier ? 'Processing...' : plan.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="detailed-comparison">
        <h3>Detailed Feature Comparison</h3>
        <div className="comparison-table">
          <div className="comparison-header">
            <span className="header-feature">Features</span>
            <span className="header-plan">Free</span>
            <span className="header-plan">Starter</span>
            <span className="header-plan">Pro</span>
            <span className="header-plan">Team</span>
          </div>
          {Object.entries(groupedFeatures).map(([category, features]) => (
            <div key={category} className="feature-category">
              <h4 className="category-title">{category}</h4>
              <div className="category-rows">
                {features.slice(0, 4).map((feature) => (
                  <div key={feature.name} className="feature-row">
                    <span className="feature-name">{feature.name}</span>
                    <div className="feature-values">
                      {['free', 'starter', 'pro', 'team'].map((planType) => {
                        const value = feature[planType as keyof Omit<PricingFeature, 'category' | 'name' | 'highlight'>];
                        const formatted = formatFeatureValue(value);
                        return (
                          <span key={planType} className="feature-value">
                            {formatted.icon || formatted.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pricing-footer">
        <p>All plans include 14-day free trial • No setup fees • Cancel anytime</p>
        <div className="pricing-help">
          <p>Need help choosing? <a href="/contact">Contact our sales team</a></p>
        </div>
      </div>
    </div>
  );
};

export default UnifiedPricingTable;