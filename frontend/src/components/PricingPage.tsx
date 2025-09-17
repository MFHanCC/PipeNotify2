import React, { useState, useEffect } from 'react';
import apiService, { PlanDetails, Subscription, UsageStats } from '../services/api';
import './PricingPage.css';

interface PricingToggleProps {
  billingCycle: 'monthly' | 'annual';
  onToggle: (cycle: 'monthly' | 'annual') => void;
}

const PricingToggle: React.FC<PricingToggleProps> = ({ billingCycle, onToggle }) => {
  return (
    <div className="pricing-toggle">
      <div className="toggle-container">
        <button 
          className={`toggle-option ${billingCycle === 'monthly' ? 'active' : ''}`}
          onClick={() => onToggle('monthly')}
        >
          Monthly
        </button>
        <button 
          className={`toggle-option ${billingCycle === 'annual' ? 'active' : ''}`}
          onClick={() => onToggle('annual')}
        >
          Annual
          <span className="savings-badge">Save 20%</span>
        </button>
      </div>
    </div>
  );
};

const getFeatureList = (tier: string) => {
  const features = [
    // Core features for all tiers
    { name: 'Real-time notifications', available: true },
    { name: 'Google Chat integration', available: true },
    { name: 'Basic templates', available: true },
    { name: 'Deal filtering', available: tier !== 'free' },
    { name: 'Custom templates', available: tier === 'pro' || tier === 'team' },
    { name: 'Advanced routing', available: tier === 'pro' || tier === 'team' },
    { name: 'Team analytics', available: tier === 'team' },
    { name: 'Priority support', available: tier === 'team' },
  ];

  // Show compact feature list for each tier
  if (tier === 'free') {
    return features.slice(0, 4);
  } else if (tier === 'starter') {
    return features.slice(0, 4);
  } else if (tier === 'pro') {
    return features.slice(0, 6);
  } else if (tier === 'team') {
    return features.slice(0, 8);
  }
  
  return features;
};

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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      setLoading(true);
      const [plansData, subscriptionData] = await Promise.all([
        apiService.getPlans(),
        apiService.getCurrentSubscription().catch(() => ({ subscription: null, usage: { plan_tier: 'free', notifications_used: 0, notifications_limit: 100, webhooks_used: 0, webhooks_limit: 1, rules_used: 0, rules_limit: 3, usage_percentage: 0 } }))
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
    const adjustedPrice = billingCycle === 'annual' ? price * 0.8 * 12 : price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(adjustedPrice);
  };

  const getOriginalPrice = (price: number) => {
    if (billingCycle === 'annual' && price > 0) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
      }).format(price * 12);
    }
    return null;
  };

  const getCurrentPlanTier = () => {
    return currentSubscription?.plan_tier || usage?.plan_tier || 'free';
  };

  const formatLimit = (value: number, type: 'notifications' | 'webhooks' | 'rules') => {
    if (value >= 999999) return 'Unlimited';
    if (value >= 999) {
      if (type === 'notifications') return 'Unlimited';
      return 'Unlimited';
    }
    if (type === 'notifications' && value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const getButtonText = (plan: PlanDetails) => {
    if (plan.tier === 'free') {
      return 'Get Started';
    }
    return 'Choose Plan';
  };

  const getButtonClass = (plan: PlanDetails) => {
    return 'upgrade';
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
          <div className="hero-section">
            <h1>Transform Your Pipedrive Notifications</h1>
            <p className="hero-subtitle">Streamline deal updates with intelligent Google Chat integration</p>
            <div className="hero-features">
              <div className="hero-feature">
                <span className="feature-icon">⚡</span>
                <span>Real-time Alerts</span>
              </div>
              <div className="hero-feature">
                <span className="feature-icon">🎯</span>
                <span>Smart Filtering</span>
              </div>
              <div className="hero-feature">
                <span className="feature-icon">🔄</span>
                <span>Multi-channel Routing</span>
              </div>
            </div>
          </div>
          
          <PricingToggle 
            billingCycle={billingCycle} 
            onToggle={setBillingCycle} 
          />
          
          {usage && usage.notifications_used > 0 && (
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
            className={`plan-card ${plan.tier} ${plan.tier === 'pro' ? 'popular' : ''}`}
          >
            
            <div className="plan-header">
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                {getOriginalPrice(plan.price) && (
                  <span className="original-price">{getOriginalPrice(plan.price)}</span>
                )}
                <span className="price">{formatPrice(plan.price)}</span>
                {plan.price > 0 && (
                  <span className="period">/{billingCycle === 'annual' ? 'year' : 'month'}</span>
                )}
                {billingCycle === 'annual' && plan.price > 0 && (
                  <div className="savings-indicator">
                    Save {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0
                    }).format(plan.price * 12 * 0.2)} annually
                  </div>
                )}
              </div>
              <p className="plan-description">
                {plan.tier === 'free' && 'Basic notifications for essential deal events'}
                {plan.tier === 'starter' && 'Smart filtering and Deal Updated notifications'}
                {plan.tier === 'pro' && 'Advanced automation with custom templates'}
                {plan.tier === 'team' && 'Enterprise features with priority support'}
              </p>
            </div>

            <div className="plan-features">
              <div className="key-limits">
                <div className="limit-item">
                  <strong>{formatLimit(plan.notifications_limit, 'notifications')}</strong> notifications/month
                </div>
                <div className="limit-item">
                  <strong>{formatLimit(plan.webhooks_limit, 'webhooks')}</strong> webhooks
                </div>
                <div className="limit-item">
                  <strong>{formatLimit(plan.rules_limit, 'rules')}</strong> custom rules
                </div>
              </div>

              <ul className="feature-list">
                {getFeatureList(plan.tier).map((feature, index) => (
                  <li key={index} className={`feature-item ${feature.available ? '' : 'unavailable'}`}>
                    <span className={`feature-check ${feature.available ? 'available' : 'unavailable'}`}>
                      {feature.available ? '✓' : '✗'}
                    </span>
                    {feature.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="plan-footer">
              <button
                className={`plan-button ${getButtonClass(plan)}`}
                onClick={() => handlePlanSelection(plan.tier)}
                disabled={processingPlan === plan.tier}
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
              <p>Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately and billing is prorated.</p>
            </div>
            <div className="faq-item">
              <h4>What happens if I exceed my limits?</h4>
              <p>Notifications will be paused until the next billing cycle or you can upgrade to a higher plan instantly.</p>
            </div>
            <div className="faq-item">
              <h4>Do you offer refunds?</h4>
              <p>We offer a 30-day money-back guarantee for all paid plans. Contact support for assistance.</p>
            </div>
            <div className="faq-item">
              <h4>Is there a setup fee?</h4>
              <p>No setup fees. All plans include free onboarding and setup assistance.</p>
            </div>
            <div className="faq-item">
              <h4>How secure is my Pipedrive data?</h4>
              <p>We use industry-standard encryption and only access the data necessary for notifications. Your data never leaves secure channels.</p>
            </div>
            <div className="faq-item">
              <h4>Can I use multiple Google Chat channels?</h4>
              <p>Yes! Higher plans support multiple webhooks to route different notifications to different channels.</p>
            </div>
            <div className="faq-item">
              <h4>What if I need custom features?</h4>
              <p>Team plan includes priority support and custom integration assistance. Contact us for enterprise needs.</p>
            </div>
            <div className="faq-item">
              <h4>Is there a free trial?</h4>
              <p>Yes! Start with our Free plan to test the integration, then upgrade when you need more features.</p>
            </div>
          </div>
        </div>

        <div className="trust-section">
          <div className="trust-badges">
            <div className="trust-badge">
              <span className="trust-icon">🔒</span>
              <div className="trust-content">
                <h4>Enterprise Security</h4>
                <p>SOC 2 compliant</p>
              </div>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">💯</span>
              <div className="trust-content">
                <h4>30-Day Guarantee</h4>
                <p>Full money back</p>
              </div>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">⚡</span>
              <div className="trust-content">
                <h4>99.9% Uptime</h4>
                <p>Reliable delivery</p>
              </div>
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