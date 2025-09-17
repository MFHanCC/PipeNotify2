import React, { useState, useEffect } from 'react';
import apiService, { PlanDetails, Subscription, UsageStats } from '../services/api';
import './PricingPage.css';

const plans = [
  {
    name: 'Free',
    price: 0,
    tier: 'free',
    description: 'Perfect for trying out',
    limits: { notifications: '100/month', webhooks: '1', rules: '3' },
    features: ['Real-time notifications', 'Google Chat integration', 'Basic templates']
  },
  {
    name: 'Starter',
    price: 9,
    tier: 'starter', 
    description: 'For small teams',
    limits: { notifications: 'Unlimited', webhooks: '3', rules: '10' },
    features: ['Everything in Free', 'Deal filtering', 'Advanced notifications', 'Email support']
  },
  {
    name: 'Professional',
    price: 29,
    tier: 'pro',
    description: 'Most popular choice',
    popular: true,
    limits: { notifications: 'Unlimited', webhooks: 'Unlimited', rules: 'Unlimited' },
    features: ['Everything in Starter', 'Custom templates', 'Advanced routing', 'Priority support']
  },
  {
    name: 'Team',
    price: 79,
    tier: 'team',
    description: 'For large organizations', 
    limits: { notifications: 'Unlimited', webhooks: 'Unlimited', rules: 'Unlimited' },
    features: ['Everything in Professional', 'Team analytics', 'API access', 'Dedicated support']
  }
];

interface PricingPageProps {
  onPlanSelect?: (planTier: string) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onPlanSelect }) => {
  const [loading, setLoading] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const handlePlanSelection = async (planTier: string) => {
    try {
      setProcessingPlan(planTier);
      
      if (planTier === 'free') {
        // Handle free plan
        if (onPlanSelect) {
          onPlanSelect(planTier);
        } else {
          // Redirect to signup/login
          window.location.href = '/';
        }
      } else {
        // Create checkout session for paid plans
        const { checkout_url } = await apiService.createCheckoutSession(planTier);
        
        if (onPlanSelect) {
          onPlanSelect(planTier);
        } else {
          // Redirect to Stripe checkout
          window.location.href = checkout_url;
        }
      }
    } catch (err) {
      console.error('Failed to process plan selection:', err);
    } finally {
      setProcessingPlan(null);
    }
  };

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Simple, transparent pricing</h1>
        <p>Choose the perfect plan for your team</p>
      </div>

      <div className="plans-grid">
        {plans.map((plan) => (
          <div 
            key={plan.tier} 
            className={`plan-card ${plan.popular ? 'popular' : ''}`}
          >
            {plan.popular && <div className="popular-badge">Most Popular</div>}
            
            <div className="plan-header">
              <h3>{plan.name}</h3>
              <div className="plan-price">
                <span className="price">${plan.price}</span>
                {plan.price > 0 && <span className="period">/month</span>}
              </div>
              <p className="plan-description">{plan.description}</p>
            </div>

            <div className="plan-limits">
              <div className="limit-item">
                <strong>{plan.limits.notifications}</strong> notifications
              </div>
              <div className="limit-item">
                <strong>{plan.limits.webhooks}</strong> webhooks
              </div>
              <div className="limit-item">
                <strong>{plan.limits.rules}</strong> custom rules
              </div>
            </div>

            <ul className="feature-list">
              {plan.features.map((feature, index) => (
                <li key={index}>
                  <span className="checkmark">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className={`plan-button ${plan.tier === 'free' ? 'secondary' : 'primary'}`}
              onClick={() => handlePlanSelection(plan.tier)}
              disabled={processingPlan === plan.tier}
            >
              {processingPlan === plan.tier ? 'Processing...' : plan.tier === 'free' ? 'Get Started' : 'Choose Plan'}
            </button>
          </div>
        ))}
      </div>

      <div className="simple-faq">
        <h2>Frequently asked questions</h2>
        <div className="faq-list">
          <div className="faq-item">
            <h4>Can I change plans anytime?</h4>
            <p>Yes, upgrade or downgrade anytime. Changes are immediate.</p>
          </div>
          <div className="faq-item">
            <h4>What happens if I exceed limits?</h4>
            <p>Notifications pause until next billing cycle or upgrade.</p>
          </div>
          <div className="faq-item">
            <h4>Is there a free trial?</h4>
            <p>Yes! Start with our Free plan, no credit card required.</p>
          </div>
          <div className="faq-item">
            <h4>Need help?</h4>
            <p>Contact us at support@pipenotify.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;