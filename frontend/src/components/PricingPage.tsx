import React, { useState, useEffect } from 'react';
import apiService, { PlanDetails, Subscription, UsageStats } from '../services/api';
import './PricingPage.css';

interface PricingPageProps {
  onPlanSelect?: (planTier: string) => void;
  currentSubscription?: Subscription | null;
  showHeader?: boolean;
}

const PricingPage: React.FC<PricingPageProps> = ({ 
  onPlanSelect, 
  currentSubscription, 
  showHeader = true 
}) => {
  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      setLoading(true);
      const [plansData, subscriptionData] = await Promise.all([
        apiService.getPlans(),
        apiService.getCurrentSubscription().catch(() => ({ subscription: null, usage: null }))
      ]);
      
      setPlans(plansData);
      setUsage(subscriptionData.usage);
      setError(null);
    } catch (err) {
      console.error('Failed to load pricing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pricing information');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelection = async (planTier: string) => {
    if (currentSubscription?.plan_tier === planTier) {
      return; // Already on this plan
    }

    try {
      setProcessingPlan(planTier);
      
      if (planTier === 'free') {
        // Handle downgrade to free plan
        const result = await apiService.cancelSubscription();
        if (result.success) {
          window.location.reload(); // Refresh to update subscription status
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
      setError(err instanceof Error ? err.message : 'Failed to process plan selection');
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getCurrentPlanTier = () => {
    return currentSubscription?.plan_tier || usage?.plan_tier || 'free';
  };

  const isPlanCurrent = (planTier: string) => {
    return getCurrentPlanTier() === planTier;
  };

  const isUpgrade = (planTier: string) => {
    const currentTier = getCurrentPlanTier();
    const tierOrder = ['free', 'starter', 'pro', 'team'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(planTier);
    return targetIndex > currentIndex;
  };

  const getButtonText = (plan: PlanDetails) => {
    if (isPlanCurrent(plan.tier)) {
      return 'Current Plan';
    }
    if (isUpgrade(plan.tier)) {
      return 'Upgrade';
    }
    return 'Downgrade';
  };

  const getButtonClass = (plan: PlanDetails) => {
    if (isPlanCurrent(plan.tier)) {
      return 'current';
    }
    if (isUpgrade(plan.tier)) {
      return 'upgrade';
    }
    return 'downgrade';
  };

  if (loading) {
    return (
      <div className="pricing-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading pricing information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pricing-page">
        <div className="error-state">
          <h3>Unable to load pricing</h3>
          <p>{error}</p>
          <button onClick={loadPricingData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-page">
      {showHeader && (
        <div className="pricing-header">
          <h1>Choose Your Plan</h1>
          <p>Select the perfect plan for your notification needs</p>
          
          {usage && (
            <div className="current-usage">
              <div className="usage-card">
                <h3>Current Usage</h3>
                <div className="usage-stats">
                  <div className="usage-item">
                    <span className="usage-number">{usage.notifications_used.toLocaleString()}</span>
                    <span className="usage-limit">/ {usage.notifications_limit.toLocaleString()}</span>
                    <span className="usage-label">Notifications</span>
                  </div>
                  <div className="usage-item">
                    <span className="usage-number">{usage.webhooks_used}</span>
                    <span className="usage-limit">/ {usage.webhooks_limit}</span>
                    <span className="usage-label">Webhooks</span>
                  </div>
                  <div className="usage-item">
                    <span className="usage-number">{usage.rules_used}</span>
                    <span className="usage-limit">/ {usage.rules_limit}</span>
                    <span className="usage-label">Rules</span>
                  </div>
                </div>
                <div className="usage-bar">
                  <div 
                    className={`usage-fill ${usage.usage_percentage > 80 ? 'high' : usage.usage_percentage > 60 ? 'medium' : 'low'}`}
                    style={{ width: `${Math.min(usage.usage_percentage, 100)}%` }}
                  ></div>
                </div>
                <span className="usage-percentage">{usage.usage_percentage.toFixed(1)}% used</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="plans-grid">
        {plans.map((plan) => (
          <div 
            key={plan.tier} 
            className={`plan-card ${plan.tier} ${isPlanCurrent(plan.tier) ? 'current' : ''} ${plan.tier === 'pro' ? 'popular' : ''}`}
          >
            {plan.tier === 'pro' && <div className="popular-badge">Most Popular</div>}
            
            <div className="plan-header">
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="price">{formatPrice(plan.price)}</span>
                {plan.price > 0 && <span className="period">/month</span>}
              </div>
              <p className="plan-description">
                {plan.tier === 'free' && 'Perfect for trying out Pipenotify'}
                {plan.tier === 'starter' && 'Great for small teams and individuals'}
                {plan.tier === 'pro' && 'Ideal for growing businesses'}
                {plan.tier === 'team' && 'Enterprise-grade features and support'}
              </p>
            </div>

            <div className="plan-features">
              <div className="feature-limits">
                <div className="limit-item">
                  <span className="limit-number">{plan.notifications_limit.toLocaleString()}</span>
                  <span className="limit-label">notifications/month</span>
                </div>
                <div className="limit-item">
                  <span className="limit-number">{plan.webhooks_limit}</span>
                  <span className="limit-label">Google Chat webhooks</span>
                </div>
                <div className="limit-item">
                  <span className="limit-number">{plan.rules_limit}</span>
                  <span className="limit-label">notification rules</span>
                </div>
              </div>

              <ul className="feature-list">
                {plan.features.map((feature, index) => (
                  <li key={index} className="feature-item">
                    <span className="feature-check">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="plan-footer">
              <button
                className={`plan-button ${getButtonClass(plan)}`}
                onClick={() => handlePlanSelection(plan.tier)}
                disabled={processingPlan === plan.tier || isPlanCurrent(plan.tier)}
              >
                {processingPlan === plan.tier ? (
                  <span className="processing">
                    <div className="spinner-small"></div>
                    Processing...
                  </span>
                ) : (
                  getButtonText(plan)
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pricing-footer">
        <div className="faq-section">
          <h3>Frequently Asked Questions</h3>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>Can I change plans anytime?</h4>
              <p>Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="faq-item">
              <h4>What happens if I exceed my limits?</h4>
              <p>Notifications will be paused until the next billing cycle or you can upgrade to a higher plan.</p>
            </div>
            <div className="faq-item">
              <h4>Do you offer refunds?</h4>
              <p>We offer a 30-day money-back guarantee for all paid plans. Contact support for assistance.</p>
            </div>
            <div className="faq-item">
              <h4>Is there a setup fee?</h4>
              <p>No setup fees. All plans include free onboarding and setup assistance.</p>
            </div>
          </div>
        </div>

        <div className="contact-section">
          <h3>Need Help Choosing?</h3>
          <p>Our team is here to help you find the perfect plan for your needs.</p>
          <a href="mailto:support@pipenotify.com" className="contact-button">
            Contact Sales
          </a>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;