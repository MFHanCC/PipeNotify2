import React, { useState, useEffect } from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';

interface UsageData {
  notifications: { used: number; limit: number; percentage: number };
  webhooks: { used: number; limit: number; percentage: number };
  rules: { used: number; limit: number; percentage: number };
}

interface AdaptiveBillingDashboardProps {
  onNavigateToTab?: (tab: 'overview' | 'rules' | 'logs' | 'webhooks' | 'routing' | 'quiet-hours' | 'stalled-deals' | 'analytics' | 'testing' | 'bulk-management' | 'billing' | 'pricing' | 'settings') => void;
}

const AdaptiveBillingDashboard: React.FC<AdaptiveBillingDashboardProps> = ({ onNavigateToTab }) => {
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
          limit: limits?.notifications === -1 ? 5000 : (limits?.notifications || 100),
          percentage: limits?.notifications === -1 ? 5 : Math.min((240 / (limits?.notifications || 100)) * 100, 100)
        },
        webhooks: {
          used: 0, // No webhooks for clean screenshots
          limit: limits?.webhooks === -1 ? -1 : (limits?.webhooks || 1),
          percentage: 0 // Empty state for professional screenshots
        },
        rules: {
          used: 7,
          limit: limits?.rules === -1 ? 50 : (limits?.rules || 3),
          percentage: limits?.rules === -1 ? 14 : Math.min((7 / (limits?.rules || 3)) * 100, 100)
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

  const formatLimit = (limit: number) => {
    return limit === -1 ? '∞' : limit.toString();
  };

  const handleUpgrade = () => {
    // Navigate to pricing section in dashboard
    if (onNavigateToTab) {
      onNavigateToTab('pricing');
    } else {
      // Fallback for when navigation function is not available
      window.open('https://pipenotify.com/pricing', '_blank');
    }
  };

  const handleViewPlans = () => {
    // Navigate to pricing section in dashboard
    if (onNavigateToTab) {
      onNavigateToTab('pricing');
    } else {
      // Fallback for when navigation function is not available  
      window.open('https://pipenotify.com/pricing', '_blank');
    }
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
    <div style={{
      maxWidth: 'none',
      width: '100%',
      padding: '0',
      margin: '0',
      background: '#f8fafc'
    }}>
      <div style={{
        padding: '1.5rem',
        paddingLeft: '3rem',
        marginLeft: '1rem'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 0.5rem 0'
        }}>💳 Billing Dashboard</h1>
        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280',
          margin: '0'
        }}>Monitor your usage and plan features</p>
      </div>

      {/* Current Plan Card */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '2rem',
        color: 'white',
        marginBottom: '2rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
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
            }}>Current Plan</h2>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              margin: '0 0 0.5rem 0'
            }}>
              {getPlanDisplayName(planTier || 'free')}
            </div>
            <span style={{
              fontSize: '0.875rem',
              padding: '0.375rem 1rem',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              {planTier === 'free' ? 'Free Tier' : 'Active'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {canUpgrade && (
              <button 
                onClick={handleUpgrade}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                🚀 Upgrade
              </button>
            )}
            <button 
              onClick={handleViewPlans}
              style={{
                background: 'white',
                color: '#667eea',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}>
              View Plans
            </button>
          </div>
        </div>
        
        {/* Usage Stats in Plan Card */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '1rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
              Notifications
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
              {usageData.notifications.used}/{formatLimit(usageData.notifications.limit)}
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '1rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
              Webhooks
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
              {usageData.webhooks.used}/{formatLimit(usageData.webhooks.limit)}
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '1rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
              Rules
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
              {usageData.rules.used}/{formatLimit(usageData.rules.limit)}
            </div>
          </div>
        </div>
      </div>


      {/* Feature Access */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          margin: '0 0 1.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🔑 Feature Access
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {[
            { name: 'Rule Templates', enabled: planTier === 'pro' || planTier === 'team', required: 'Pro+' },
            { name: 'Smart Channel Routing', enabled: planTier === 'pro' || planTier === 'team', required: 'Pro+' },
            { name: 'Custom Message Templates', enabled: planTier === 'pro' || planTier === 'team', required: 'Pro+' },
            { name: 'Quiet Hours Scheduling', enabled: planTier === 'pro' || planTier === 'team', required: 'Pro+' },
            { name: 'Stalled Deal Alerts', enabled: planTier === 'pro' || planTier === 'team', required: 'Pro+' },
            { name: 'Bulk Rule Management', enabled: planTier === 'team', required: 'Team' },
            { name: 'Team Analytics', enabled: planTier === 'team', required: 'Team' },
            { name: 'Priority Support', enabled: planTier === 'pro' || planTier === 'team', required: 'Pro+' }
          ].map((feature, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              border: `1px solid ${feature.enabled ? '#d1fae5' : '#fef3c7'}`,
              borderRadius: '8px',
              background: feature.enabled ? '#f0fdf4' : '#fffbeb'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: feature.enabled ? '#10b981' : '#f59e0b',
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
                color: '#374151',
                flex: 1
              }}>{feature.name}</span>
              {!feature.enabled && (
                <span style={{
                  fontSize: '0.75rem',
                  color: '#667eea',
                  fontWeight: '500',
                  background: '#ede9fe',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  {feature.required}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}

      {/* Help Section - Horizontal at Bottom */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#1f2937',
          margin: '0 0 1.5rem 0',
          textAlign: 'center'
        }}>💬 Need Help?</h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <details style={{ background: 'white' }}>
              <summary style={{
                padding: '1rem',
                background: '#f9fafb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                listStyle: 'none',
                borderBottom: '1px solid #e5e7eb'
              }}>
                How does billing work?
              </summary>
              <p style={{
                padding: '1rem',
                margin: '0',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: '#6b7280'
              }}>
                You're charged monthly based on your selected plan. Usage is tracked in real-time and resets each billing cycle.
              </p>
            </details>
          </div>
          
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <details style={{ background: 'white' }}>
              <summary style={{
                padding: '1rem',
                background: '#f9fafb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                listStyle: 'none',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Can I upgrade or downgrade?
              </summary>
              <p style={{
                padding: '1rem',
                margin: '0',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: '#6b7280'
              }}>
                Yes, you can change your plan at any time. Changes take effect immediately and are prorated.
              </p>
            </details>
          </div>
          
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <details style={{ background: 'white' }}>
              <summary style={{
                padding: '1rem',
                background: '#f9fafb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                listStyle: 'none',
                borderBottom: '1px solid #e5e7eb'
              }}>
                What happens if I exceed limits?
              </summary>
              <p style={{
                padding: '1rem',
                margin: '0',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: '#6b7280'
              }}>
                Free tier users will see notifications paused. Paid plans have overage protection and will continue working.
              </p>
            </details>
          </div>
        </div>
        
        <div style={{
          textAlign: 'center',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <h4 style={{
            margin: '0 0 0.75rem 0',
            color: '#1f2937',
            fontSize: '1.125rem',
            fontWeight: '600'
          }}>📧 Billing Support</h4>
          <p style={{
            margin: '0 0 1rem 0',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            Questions about your subscription or billing?
          </p>
          <a href="mailto:billing@pipenotify.com" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white',
            textDecoration: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}>
            Contact Billing Team
          </a>
        </div>
      </div>
      </div>
    </div>
  );
};

export default AdaptiveBillingDashboard;