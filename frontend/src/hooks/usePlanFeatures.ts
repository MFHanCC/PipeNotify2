import { useState, useEffect } from 'react';
import apiService, { PlanFeatures } from '../services/api';
import { getTenantId } from '../utils/auth';

export function usePlanFeatures() {
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('No tenant ID found');
      }

      setLoading(true);
      const featuresData = await apiService.getPlanFeatures(tenantId);
      setFeatures(featuresData);
      setError(null);
    } catch (err) {
      console.error('Failed to load plan features:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plan features');
      
      // Fallback to free plan features
      setFeatures({
        tenant_id: getTenantId() || 0,
        plan_tier: 'free',
        limits: {
          notifications: 100,
          webhooks: 1,
          rules: 3,
          log_retention_days: 7,
          advanced_rules: 0
        },
        features: {
          value_filtering: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
          enhanced_formatting: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
          stage_filtering: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
          activity_notifications: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
          usage_analytics: { available: false, available_in_plans: ['starter', 'pro', 'team'] },
          channel_routing: { available: false, available_in_plans: ['pro', 'team'] },
          stalled_alerts: { available: false, available_in_plans: ['pro', 'team'] },
          custom_templates: { available: false, available_in_plans: ['pro', 'team'] },
          rich_formatting: { available: false, available_in_plans: ['pro', 'team'] },
          quiet_hours: { available: false, available_in_plans: ['pro', 'team'] },
          priority_support: { available: false, available_in_plans: ['pro', 'team'] },
          advanced_filtering: { available: false, available_in_plans: ['pro', 'team'] },
          probability_filtering: { available: false, available_in_plans: ['pro', 'team'] },
          owner_filtering: { available: false, available_in_plans: ['pro', 'team'] },
          time_filtering: { available: false, available_in_plans: ['pro', 'team'] }
        },
        can_upgrade: true
      });
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (featureName: string): boolean => {
    return features?.features[featureName]?.available || false;
  };

  const getFeatureRequiredPlan = (featureName: string): string => {
    return features?.features[featureName]?.available_in_plans[0] || 'starter';
  };

  const isAtLimit = (resourceType: 'notifications' | 'webhooks' | 'rules' | 'advanced_rules'): boolean => {
    if (!features) return false;
    
    // You'd need to pass current usage from parent component
    // For now, returning false as a placeholder
    return false;
  };

  return {
    features,
    loading,
    error,
    hasFeature,
    getFeatureRequiredPlan,
    isAtLimit,
    planTier: features?.plan_tier || 'free',
    limits: features?.limits,
    canUpgrade: features?.can_upgrade || true
  };
}