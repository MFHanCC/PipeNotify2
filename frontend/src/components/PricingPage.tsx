import React, { useState } from 'react';
import apiService from '../services/api';
import './PricingPage.css';

interface Plan {
  name: string;
  tier: string;
  bestFor: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  cta: string;
  ctaType: 'primary' | 'secondary' | 'enterprise';
  popular?: boolean;
  limits: {
    notifications: string;
    webhooks: string;
    rules: string;
  };
}

const plans: Plan[] = [
  {
    name: 'Free',
    tier: 'free',
    bestFor: 'Best for testing the waters',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Real-time deal notifications',
      'Google Chat integration',
      'Basic message templates',
      'Email support',
      '7-day log retention'
    ],
    cta: 'Start free',
    ctaType: 'secondary',
    limits: {
      notifications: '100/month',
      webhooks: '1',
      rules: '3 rules total'
    }
  },
  {
    name: 'Starter',
    tier: 'starter',
    bestFor: 'Best for small teams',
    monthlyPrice: 19,
    annualPrice: 15,
    features: [
      'Everything in Free',
      '1,000 notifications/month',
      '3 webhooks',
      '10 rules',
      'Value filtering',
      'Enhanced formatting',
      'Basic analytics dashboard',
      'CSV export of logs',
      'Basic templates (3 pre-built)'
    ],
    cta: 'Get started',
    ctaType: 'primary',
    limits: {
      notifications: '1,000/month',
      webhooks: '3',
      rules: '10 rules total'
    }
  },
  {
    name: 'Professional',
    tier: 'pro',
    bestFor: 'Best for growing businesses',
    monthlyPrice: 49,
    annualPrice: 39,
    popular: true,
    features: [
      'Everything in Starter',
      '5,000 notifications/month',
      '10 webhooks',
      '50 rules total',
      'Full rule templates library',
      'Custom message templates',
      'Smart channel routing',
      'Quiet hours scheduling',
      'Stalled deal alerts',
      'Basic analytics dashboard',
      'Bulk rule management',
      '90-day log retention'
    ],
    cta: 'Get started',
    ctaType: 'primary',
    limits: {
      notifications: '5,000/month',
      webhooks: '10',
      rules: '50 rules total'
    }
  },
  {
    name: 'Team',
    tier: 'team',
    bestFor: 'Best for large organizations',
    monthlyPrice: 99,
    annualPrice: 79,
    features: [
      'Everything in Professional',
      'Unlimited notifications',
      'Unlimited webhooks',
      'Unlimited rules',
      'Advanced analytics & insights',
      'Scheduled reports (daily/weekly)',
      'Rule backup & restore',
      'Priority support',
      '1-year log retention'
    ],
    cta: 'Get started',
    ctaType: 'primary',
    limits: {
      notifications: 'Unlimited',
      webhooks: 'Unlimited',
      rules: 'Unlimited'
    }
  }
];

const comparisonFeatures = [
  { category: 'Core Features', features: [
    { name: 'Real-time notifications', free: true, starter: true, pro: true, team: true },
    { name: 'Google Chat integration', free: true, starter: true, pro: true, team: true },
    { name: 'Basic templates', free: true, starter: true, pro: true, team: true },
    { name: 'Deal filtering', free: false, starter: true, pro: true, team: true },
    { name: 'Enhanced message formatting', free: false, starter: true, pro: true, team: true },
  ]},
  { category: 'Advanced Features', features: [
    { name: 'Rule templates library', free: false, starter: false, pro: true, team: true },
    { name: 'Custom message templates', free: false, starter: false, pro: true, team: true },
    { name: 'Smart channel routing', free: false, starter: false, pro: true, team: true },
    { name: 'Quiet hours scheduling', free: false, starter: false, pro: true, team: true },
    { name: 'Stalled deal alerts', free: false, starter: false, pro: true, team: true },
    { name: 'Basic analytics dashboard', free: false, starter: true, pro: true, team: true },
    { name: 'Advanced analytics & insights', free: false, starter: false, pro: false, team: true },
    { name: 'Bulk rule management', free: false, starter: false, pro: false, team: true },
    { name: 'Team insights', free: false, starter: false, pro: false, team: true },
    { name: 'Daily/weekly summaries', free: false, starter: false, pro: false, team: true },
  ]},
  { category: 'Support & Limits', features: [
    { name: 'Community support', free: true, starter: true, pro: true, team: true },
    { name: 'Email support', free: false, starter: true, pro: true, team: true },
    { name: 'Priority support', free: false, starter: false, pro: true, team: true },
    { name: '1-year log retention', free: false, starter: false, pro: false, team: true },
  ]}
];

interface PricingPageProps {
  onPlanSelect?: (planTier: string) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onPlanSelect }) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);

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
    } catch (err) {
      console.error('Failed to process plan selection:', err);
    } finally {
      setProcessingPlan(null);
    }
  };

  const getPrice = (plan: Plan) => {
    return isAnnual ? plan.annualPrice : plan.monthlyPrice;
  };

  const getSavings = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return 0;
    return Math.round(((plan.monthlyPrice * 12 - plan.annualPrice * 12) / (plan.monthlyPrice * 12)) * 100);
  };

  return (
    <div className="pricing-page">
      {/* Header */}
      <header className="pricing-header">
        <h1>Simple, transparent pricing</h1>
        <p>Choose the perfect plan for your team. Start free, upgrade anytime.</p>
        
        {/* Billing Toggle */}
        <div className="billing-toggle">
          <button 
            className={`toggle-option ${!isAnnual ? 'active' : ''}`}
            onClick={() => setIsAnnual(false)}
            aria-pressed={!isAnnual}
          >
            Monthly
          </button>
          <button 
            className={`toggle-option ${isAnnual ? 'active' : ''}`}
            onClick={() => setIsAnnual(true)}
            aria-pressed={isAnnual}
          >
            Annual
            <span className="savings-badge">Save up to 20%</span>
          </button>
        </div>
      </header>

      {/* Plan Cards */}
      <section className="plans-section" aria-label="Pricing plans">
        <div className="plans-grid">
          {plans.map((plan) => (
            <div 
              key={plan.tier}
              className={`plan-card ${plan.popular ? 'popular' : ''}`}
            >
              {plan.popular && (
                <div className="popular-badge" aria-label="Most popular plan">
                  Most popular
                </div>
              )}
              
              <div className="plan-header">
                <h3>{plan.name}</h3>
                <p className="best-for">{plan.bestFor}</p>
                
                <div className="price-section">
                  <div className="price-display">
                    <span className="currency">$</span>
                    <span className="price">{getPrice(plan)}</span>
                    {plan.monthlyPrice > 0 && (
                      <span className="period">/{isAnnual ? 'month, billed annually' : 'month'}</span>
                    )}
                  </div>
                  
                  {isAnnual && plan.monthlyPrice > 0 && getSavings(plan) > 0 && (
                    <div className="savings-info">
                      Save {getSavings(plan)}% with annual billing
                    </div>
                  )}
                </div>
              </div>

              <ul className="features-list" role="list">
                {plan.features.map((feature, index) => (
                  <li key={index} role="listitem">
                    <span className="checkmark" aria-hidden="true">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`cta-button ${plan.ctaType}`}
                onClick={() => handlePlanSelection(plan.tier)}
                disabled={processingPlan === plan.tier}
                aria-describedby={`${plan.tier}-description`}
              >
                {processingPlan === plan.tier ? (
                  <span className="processing">
                    <span className="spinner" aria-hidden="true"></span>
                    Processing...
                  </span>
                ) : (
                  plan.cta
                )}
              </button>
              
              <div id={`${plan.tier}-description`} className="sr-only">
                {plan.name} plan: {plan.bestFor}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Elements */}
      <section className="trust-section" aria-label="Trust indicators">
        <div className="trust-grid">
          <div className="trust-item">
            <div className="trust-icon" aria-hidden="true">🔒</div>
            <div className="trust-content">
              <h4>Enterprise Security</h4>
              <p>SOC 2 compliant, 256-bit encryption</p>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon" aria-hidden="true">💯</div>
            <div className="trust-content">
              <h4>30-Day Money Back</h4>
              <p>Full refund, no questions asked</p>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon" aria-hidden="true">⚡</div>
            <div className="trust-content">
              <h4>99.9% Uptime SLA</h4>
              <p>Reliable delivery guaranteed</p>
            </div>
          </div>
          <div className="trust-item testimonial">
            <div className="trust-content">
              <p>"PipeNotify transformed our sales workflow. Essential tool for any Pipedrive team."</p>
              <cite>— Sarah K., Sales Director</cite>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="comparison-section">
        <div className="comparison-header">
          <h2>Compare all features</h2>
          <div className="comparison-controls">
            <button
              className={`toggle-btn ${showComparison ? 'active' : ''}`}
              onClick={() => setShowComparison(!showComparison)}
              aria-expanded={showComparison}
            >
              {showComparison ? 'Hide' : 'Show'} detailed comparison
            </button>
            {showComparison && (
              <button
                className={`filter-btn ${showDifferencesOnly ? 'active' : ''}`}
                onClick={() => setShowDifferencesOnly(!showDifferencesOnly)}
              >
                {showDifferencesOnly ? 'Show all' : 'Show differences only'}
              </button>
            )}
          </div>
        </div>

        {showComparison && (
          <div className="comparison-table-wrapper">
            <table className="comparison-table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" className="feature-col">Features</th>
                  <th scope="col">Free</th>
                  <th scope="col">Starter</th>
                  <th scope="col">Professional</th>
                  <th scope="col">Team</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {comparisonFeatures.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="category-row" role="row">
                      <td colSpan={5} className="category-header">{category.category}</td>
                    </tr>
                    {category.features
                      .filter(feature => !showDifferencesOnly || !(feature.free && feature.starter && feature.pro && feature.team))
                      .map((feature) => (
                        <tr key={feature.name} role="row">
                          <th scope="row" className="feature-name">{feature.name}</th>
                          <td className="feature-cell">
                            <span className={`feature-status ${feature.free ? 'included' : 'not-included'}`}>
                              {feature.free ? '✓' : '—'}
                            </span>
                          </td>
                          <td className="feature-cell">
                            <span className={`feature-status ${feature.starter ? 'included' : 'not-included'}`}>
                              {feature.starter ? '✓' : '—'}
                            </span>
                          </td>
                          <td className="feature-cell">
                            <span className={`feature-status ${feature.pro ? 'included' : 'not-included'}`}>
                              {feature.pro ? '✓' : '—'}
                            </span>
                          </td>
                          <td className="feature-cell">
                            <span className={`feature-status ${feature.team ? 'included' : 'not-included'}`}>
                              {feature.team ? '✓' : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* FAQ Section */}
      <section className="faq-section" aria-label="Frequently asked questions">
        <h2>Frequently asked questions</h2>
        <div className="faq-list">
          <details className="faq-item">
            <summary>Can I upgrade or downgrade anytime?</summary>
            <p>Yes, change plans instantly from your account settings.</p>
          </details>
          <details className="faq-item">
            <summary>What are default rules?</summary>
            <p>Ready-to-use rules we provide for ease of use. You can customize, delete, or replace them with your own rules within your plan's limit.</p>
          </details>
          <details className="faq-item">
            <summary>What are rule templates?</summary>
            <p>Professional and Team plans include pre-built rule templates for common notification patterns like high-value deals, won celebrations, and stalled deal monitoring.</p>
          </details>
          <details className="faq-item">
            <summary>Is my Pipedrive data secure?</summary>
            <p>Yes, enterprise-grade encryption and SOC 2 compliance protect your data.</p>
          </details>
          <details className="faq-item">
            <summary>30-day money-back guarantee?</summary>
            <p>Full refund on all paid plans, no questions asked.</p>
          </details>
        </div>
        
        <div className="enterprise-note">
          <p>Need custom features or enterprise-level support? <a href="mailto:team@primedevlabs.com">Contact our sales team</a> for custom pricing and dedicated onboarding.</p>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;