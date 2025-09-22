import React, { useState, useEffect } from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';

interface UsageData {
  notifications: { used: number; limit: number; percentage: number };
  webhooks: { used: number; limit: number; percentage: number };
  rules: { used: number; limit: number; percentage: number };
}

const FullWidthBillingDashboard: React.FC = () => {
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
    <>
      <style>
        {`
          @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
          }
          
          .full-width-billing {
            position: relative !important;
            left: 50% !important;
            right: 50% !important;
            margin-left: -50vw !important;
            margin-right: -50vw !important;
            width: 100vw !important;
            max-width: 100vw !important;
            box-sizing: border-box !important;
          }
          
          .billing-content {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 1rem 2rem !important;
          }
          
          .billing-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
            width: 100% !important;
          }
          
          .usage-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) !important;
            gap: 1.5rem !important;
            width: 100% !important;
          }
          
          .bottom-row {
            display: grid !important;
            grid-template-columns: 2fr 1fr !important;
            gap: 1.5rem !important;
            width: 100% !important;
          }
          
          @media (max-width: 1024px) {
            .bottom-row {
              grid-template-columns: 1fr !important;
            }
          }
          
          @media (max-width: 768px) {
            .usage-grid {
              grid-template-columns: 1fr !important;
            }
            .billing-content {
              padding: 1rem !important;
            }
          }
        `}
      </style>
      
      <div className="full-width-billing" style={{
        background: '#f8fafc',
        minHeight: '100vh'
      }}>
        <div className="billing-content">
          {/* Header */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 0.5rem 0'
            }}>
              🚀 Edge-to-Edge Billing Dashboard
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#6b7280',
              margin: 0
            }}>
              Full viewport width billing and usage monitoring
            </p>
          </div>

          <div className="billing-grid">
            {/* Hero Plan Card */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '2rem',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <h2 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    margin: '0 0 0.5rem 0',
                    opacity: 0.9
                  }}>
                    Current Plan
                  </h2>
                  <h3 style={{
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    margin: '0 0 0.5rem 0'
                  }}>
                    {getPlanDisplayName(planTier || 'free')}
                  </h3>
                  <span style={{
                    fontSize: '1rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '25px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    {planTier === 'free' ? 'Free Tier' : 'Active Subscription'}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  {canUpgrade && (
                    <button style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      padding: '1rem 2rem',
                      borderRadius: '12px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s ease'
                    }}>
                      🚀 Upgrade Plan
                    </button>
                  )}
                  <button style={{
                    background: 'white',
                    color: '#667eea',
                    border: 'none',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}>
                    View All Plans
                  </button>
                </div>
              </div>
              
              {/* Quick Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                    📧 Notifications
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
                    {usageData.notifications.used}/{formatLimit(usageData.notifications.limit)}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                    🔗 Webhooks
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
                    {usageData.webhooks.used}/{formatLimit(usageData.webhooks.limit)}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                    ⚙️ Rules
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
                    {usageData.rules.used}/{formatLimit(usageData.rules.limit)}
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Details Grid */}
            <div className="usage-grid">
              {[
                { name: 'Monthly Notifications', data: usageData.notifications, icon: '📧', color: '#3b82f6' },
                { name: 'Active Webhooks', data: usageData.webhooks, icon: '🔗', color: '#10b981' },
                { name: 'Notification Rules', data: usageData.rules, icon: '⚙️', color: '#f59e0b' }
              ].map((item, index) => (
                <div key={index} style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2rem',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e5e7eb',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: item.color
                  }} />
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <span style={{ fontSize: '2rem' }}>{item.icon}</span>
                      <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#1f2937',
                        margin: 0
                      }}>
                        {item.name}
                      </h3>
                    </div>
                    {item.data.limit !== -1 && (
                      <span style={{
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: getUsageColor(item.data.percentage),
                        padding: '0.5rem 1rem',
                        borderRadius: '25px',
                        background: `${getUsageColor(item.data.percentage)}20`
                      }}>
                        {Math.round(item.data.percentage)}%
                      </span>
                    )}
                  </div>
                  
                  {item.data.limit !== -1 && (
                    <div style={{
                      height: '8px',
                      background: '#f3f4f6',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${item.data.percentage}%`,
                        background: getUsageColor(item.data.percentage),
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  )}
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      fontSize: '2.5rem',
                      fontWeight: '700',
                      color: '#1f2937'
                    }}>
                      {item.data.used}
                    </span>
                    <span style={{
                      fontSize: '1.25rem',
                      color: '#6b7280'
                    }}>
                      / {formatLimit(item.data.limit)}
                    </span>
                  </div>
                  
                  {item.data.percentage >= 90 && item.data.limit !== -1 && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: '#fef3c7',
                      border: '1px solid #f59e0b',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      color: '#92400e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      ⚠️ Approaching usage limit
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Row */}
            <div className="bottom-row">
              {/* Feature Access */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: '0 0 1.5rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  🔑 Feature Access
                </h2>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '1rem'
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
                      padding: '1rem',
                      background: feature.enabled ? '#f0fdf4' : '#f9fafb',
                      border: `2px solid ${feature.enabled ? '#10b981' : '#d1d5db'}`,
                      borderRadius: '12px',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: feature.enabled ? '#10b981' : '#9ca3af',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '700'
                        }}>
                          {feature.enabled ? '✓' : '✗'}
                        </div>
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: '500',
                          color: '#1f2937'
                        }}>
                          {feature.name}
                        </span>
                      </div>
                      {!feature.enabled && (
                        <span style={{
                          fontSize: '0.875rem',
                          color: '#667eea',
                          fontWeight: '500',
                          padding: '0.25rem 0.75rem',
                          background: '#667eea20',
                          borderRadius: '12px'
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
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: '0 0 1.5rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  💬 Need Help?
                </h2>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {[
                    { icon: '📧', title: 'Email Support', desc: 'Get help with billing issues', link: 'mailto:support@pipenotify.com' },
                    { icon: '📚', title: 'Documentation', desc: 'Learn about all features', link: '/docs' },
                    { icon: '💰', title: 'Billing Help', desc: 'Questions about pricing', link: 'mailto:billing@pipenotify.com' }
                  ].map((item, index) => (
                    <a key={index} href={item.link} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.3s ease',
                      border: '1px solid #e5e7eb'
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                      <div>
                        <div style={{
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#1f2937',
                          marginBottom: '0.25rem'
                        }}>
                          {item.title}
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
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
        </div>
      </div>
    </>
  );
};

export default FullWidthBillingDashboard;