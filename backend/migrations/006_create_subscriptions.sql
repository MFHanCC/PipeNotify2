-- Migration: Create subscriptions table for billing management
-- This table tracks Stripe subscriptions and plan limits for each tenant

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  monthly_notification_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_tenant_subscription UNIQUE (tenant_id),
  CONSTRAINT valid_plan_tier CHECK (plan_tier IN ('free', 'starter', 'pro', 'team')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'incomplete'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_tier ON subscriptions(plan_tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE PROCEDURE update_subscriptions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE subscriptions IS 'Stores Stripe subscription and billing information for each tenant';
COMMENT ON COLUMN subscriptions.tenant_id IS 'Foreign key to tenants table';
COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe subscription ID (null for free plan)';
COMMENT ON COLUMN subscriptions.plan_tier IS 'Current subscription plan: free, starter, pro, team';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status from Stripe';
COMMENT ON COLUMN subscriptions.monthly_notification_count IS 'Current month notification usage count';

-- Initialize existing tenants with free subscriptions
INSERT INTO subscriptions (tenant_id, plan_tier, status)
SELECT id, 'free', 'active' 
FROM tenants 
WHERE id NOT IN (SELECT tenant_id FROM subscriptions)
ON CONFLICT (tenant_id) DO NOTHING;