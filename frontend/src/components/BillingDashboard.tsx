import React from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';

const BillingDashboard: React.FC = () => {
  const { planTier, limits, canUpgrade } = usePlanFeatures();

  const getPlanDisplayName = (tier: string) => {
    const plans: { [key: string]: string } = {
      'free': 'Free',
      'starter': 'Starter',
      'pro': 'Professional',
      'team': 'Team'
    };
    return plans[tier] || tier;
  };

  return (
    <div className="billing-dashboard">
      <div className="current-plan-card" style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, color: '#111827' }}>Current Plan</h4>
          <span style={{
            background: planTier === 'free' ? '#fef3c7' : '#dcfce7',
            color: planTier === 'free' ? '#92400e' : '#166534',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            {getPlanDisplayName(planTier || 'free')}
          </span>
        </div>
        
        <div className="plan-limits" style={{ marginBottom: '20px' }}>
          <h5 style={{ color: '#374151', marginBottom: '12px' }}>Your Limits</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="limit-item">
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Monthly Notifications</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                {(limits?.notifications === -1 || (limits?.notifications && limits.notifications >= 999)) ? 'Unlimited' : limits?.notifications || 100}
              </div>
            </div>
            <div className="limit-item">
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Webhooks</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                {(limits?.webhooks === -1 || (limits?.webhooks && limits.webhooks >= 999)) ? 'Unlimited' : limits?.webhooks || 1}
              </div>
            </div>
            <div className="limit-item">
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Notification Rules</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                {(limits?.rules === -1 || (limits?.rules && limits.rules >= 999)) ? 'Unlimited' : limits?.rules || 3}
              </div>
            </div>
          </div>
        </div>

        {canUpgrade && (
          <div className="upgrade-section" style={{
            background: '#f9fafb',
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h5 style={{ margin: 0, marginBottom: '4px', color: '#111827' }}>Ready to upgrade?</h5>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                  Get more features and higher limits with a paid plan.
                </p>
              </div>
              <button 
                onClick={() => window.location.href = '/pricing'}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                View Pricing
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="billing-info" style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <h5 style={{ margin: 0, marginBottom: '12px', color: '#111827' }}>Billing Information</h5>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
          {planTier === 'free' 
            ? 'You are currently on the free plan. No payment method required.'
            : 'Billing and payment management features are coming soon. Contact support for billing inquiries.'
          }
        </p>
      </div>
    </div>
  );
};

export default BillingDashboard;