import React, { useState, useEffect } from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';

interface UsageData {
  notifications: { used: number; limit: number; percentage: number };
  webhooks: { used: number; limit: number; percentage: number };
  rules: { used: number; limit: number; percentage: number };
}

const ModernBillingDashboard: React.FC = () => {
  const { planTier, limits, canUpgrade } = usePlanFeatures();
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData>({
    notifications: { used: 0, limit: 0, percentage: 0 },
    webhooks: { used: 0, limit: 0, percentage: 0 },
    rules: { used: 0, limit: 0, percentage: 0 }
  });

  useEffect(() => {
    const loadBillingData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockUsage: UsageData = {
        notifications: {
          used: 240,
          limit: limits?.notifications === -1 ? -1 : (limits?.notifications || 100),
          percentage: limits?.notifications === -1 ? 0 : Math.min((240 / (limits?.notifications || 100)) * 100, 100)
        },
        webhooks: {
          used: 2,
          limit: limits?.webhooks === -1 ? -1 : (limits?.webhooks || 1),
          percentage: limits?.webhooks === -1 ? 0 : Math.min((2 / (limits?.webhooks || 1)) * 100, 100)
        },
        rules: {
          used: 7,
          limit: limits?.rules === -1 ? -1 : (limits?.rules || 3),
          percentage: limits?.rules === -1 ? 0 : Math.min((7 / (limits?.rules || 3)) * 100, 100)
        }
      };

      setUsageData(mockUsage);
      setLoading(false);
    };

    loadBillingData();
  }, [limits]);

  const getPlanDisplayName = (tier: string) => {
    const plans: { [key: string]: string } = {
      'free': 'Free',
      'starter': 'Starter',
      'pro': 'Professional',
      'team': 'Team'
    };
    return plans[tier] || tier;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 70) return '#f59e0b';
    return '#10b981';
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Unlimited' : limit.toString();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        gap: '1rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <h3 style={{ margin: 0, color: '#374151' }}>Loading billing information...</h3>
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
      </div>
    );
  }

  return (
    <div className="billing-container" style={{
      width: '100%',
      margin: '0 -1rem',
      padding: '1rem',
      background: '#f8fafc',
      minHeight: '100vh',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <style>
        {`
          @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
          }
          * {
            box-sizing: border-box !important;
          }
          .billing-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .plan-card-hero,
          .bottom-grid,
          .main-grid {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
          }
          /* Override any parent max-width constraints */
          .billing-container {
            max-width: none !important;
            width: calc(100% + 2rem) !important;
          }
          .plan-card-hero {
            margin-left: 0 !important;
            margin-right: 0 !important;
            width: 100% !important;
          }
          @media (max-width: 1024px) {
            .bottom-grid { 
              grid-template-columns: 1fr !important; 
            }
          }
          @media (max-width: 768px) {
            .main-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem', width: '100%' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 0.5rem 0'
        }}>
          🔥 Full-Width Modern Billing
        </h1>
        <p style={{
          fontSize: '1rem',
          color: '#6b7280',
          margin: 0
        }}>
          Monitor your subscription and usage across all features
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="main-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1rem',
        marginBottom: '1.5rem',
        width: '100%'
      }}>
        {/* Current Plan Card */}
        <div className="plan-card-hero" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '1.5rem',
          color: 'white',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                margin: '0 0 0.5rem 0',
                opacity: 0.9
              }}>
                Current Plan
              </h2>
              <h3 style={{
                fontSize: '1.875rem',
                fontWeight: '700',
                margin: '0 0 0.5rem 0'
              }}>
                {getPlanDisplayName(planTier || 'free')}
              </h3>
              <span style={{
                fontSize: '0.875rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                {planTier === 'free' ? 'Free Tier' : 'Active'}
              </span>
            </div>
            <div style={{
              display: 'flex',
              gap: '0.75rem'
            }}>
              {canUpgrade && (
                <button style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)'
                }}>
                  🚀 Upgrade
                </button>
              )}
              <button style={{
                background: 'white',
                color: '#667eea',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                View Plans
              </button>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginTop: '1rem'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.75rem',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                Notifications
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                {usageData.notifications.used}/{formatLimit(usageData.notifications.limit)}
              </div>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.75rem',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                Webhooks
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                {usageData.webhooks.used}/{formatLimit(usageData.webhooks.limit)}
              </div>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.75rem',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                Rules
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                {usageData.rules.used}/{formatLimit(usageData.rules.limit)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Details Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
        width: '100%'
      }}>
        {[
          { name: 'Monthly Notifications', data: usageData.notifications, icon: '📧' },
          { name: 'Active Webhooks', data: usageData.webhooks, icon: '🔗' },
          { name: 'Notification Rules', data: usageData.rules, icon: '⚙️' }
        ].map((item, index) => (
          <div key={index} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  {item.name}
                </h3>
              </div>
              {item.data.limit !== -1 && (
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: getUsageColor(item.data.percentage)
                }}>
                  {Math.round(item.data.percentage)}%
                </span>
              )}
            </div>
            
            {item.data.limit !== -1 && (
              <div style={{
                height: '6px',
                background: '#f3f4f6',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '1rem'
              }}>
                <div style={{
                  height: '100%',
                  width: `${item.data.percentage}%`,
                  background: getUsageColor(item.data.percentage),
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}
            
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.25rem'
            }}>
              <span style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1f2937'
              }}>
                {item.data.used}
              </span>
              <span style={{
                fontSize: '1rem',
                color: '#6b7280'
              }}>
                / {formatLimit(item.data.limit)}
              </span>
            </div>
            
            {item.data.percentage >= 90 && item.data.limit !== -1 && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                ⚠️ Approaching limit
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Row - Features and Support */}
      <div className="bottom-grid" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1rem',
        width: '100%'
      }}>
        {/* Feature Access */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 1rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🔑 Feature Access
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem'
          }}>
            {[
              { name: 'Advanced Routing', enabled: planTier !== 'free', required: 'Starter+' },
              { name: 'Custom Templates', enabled: planTier === 'pro' || planTier === 'team', required: 'Pro+' },
              { name: 'Team Analytics', enabled: planTier === 'team', required: 'Team' }
            ].map((feature, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                background: feature.enabled ? '#f0fdf4' : '#f9fafb',
                border: `1px solid ${feature.enabled ? '#10b981' : '#d1d5db'}`,
                borderRadius: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: feature.enabled ? '#10b981' : '#9ca3af',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '700'
                  }}>
                    {feature.enabled ? '✓' : '✗'}
                  </div>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#1f2937'
                  }}>
                    {feature.name}
                  </span>
                </div>
                {!feature.enabled && (
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#667eea',
                    fontWeight: '500'
                  }}>
                    {feature.required}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Support */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 1rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            💬 Need Help?
          </h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {[
              { icon: '📧', title: 'Email Support', desc: 'Get help with billing', link: 'mailto:support@pipenotify.com' },
              { icon: '📚', title: 'Documentation', desc: 'Learn more about features', link: '/docs' },
              { icon: '💰', title: 'Billing Help', desc: 'Questions about pricing', link: 'mailto:billing@pipenotify.com' }
            ].map((item, index) => (
              <a key={index} href={item.link} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: '#f8fafc',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.2s ease'
              }}>
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '0.125rem'
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    {item.desc}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernBillingDashboard;