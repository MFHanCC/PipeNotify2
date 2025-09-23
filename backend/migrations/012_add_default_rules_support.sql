-- Migration 012: Add support for default rules tracking
-- Enables automatic rule provisioning based on subscription tiers

-- Add columns to track default rules and their templates
ALTER TABLE rules ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS rule_template_id VARCHAR(100);
ALTER TABLE rules ADD COLUMN IF NOT EXISTS auto_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20);

-- Add indexes for efficient querying of default rules
CREATE INDEX IF NOT EXISTS idx_rules_is_default ON rules(is_default);
CREATE INDEX IF NOT EXISTS idx_rules_template_id ON rules(rule_template_id);
CREATE INDEX IF NOT EXISTS idx_rules_plan_tier ON rules(plan_tier);
CREATE INDEX IF NOT EXISTS idx_rules_tenant_default ON rules(tenant_id, is_default);

-- Add comments for documentation
COMMENT ON COLUMN rules.is_default IS 'TRUE if this rule was auto-created as a default rule for the subscription tier';
COMMENT ON COLUMN rules.rule_template_id IS 'Identifier of the template used to create this default rule';
COMMENT ON COLUMN rules.auto_created_at IS 'Timestamp when this rule was automatically created';
COMMENT ON COLUMN rules.plan_tier IS 'Subscription tier when this rule was created (for upgrade tracking)';

-- Create a table to track rule provisioning history
CREATE TABLE IF NOT EXISTS rule_provisioning_log (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    plan_tier VARCHAR(20) NOT NULL,
    rules_created INTEGER DEFAULT 0,
    provisioning_type VARCHAR(50) NOT NULL, -- 'initial', 'upgrade', 'manual'
    from_plan VARCHAR(20), -- For upgrades
    to_plan VARCHAR(20), -- For upgrades
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_rules JSONB DEFAULT '[]', -- Array of created rule IDs and names
    errors JSONB DEFAULT '[]' -- Any errors that occurred during provisioning
);

-- Add indexes for provisioning log
CREATE INDEX IF NOT EXISTS idx_provisioning_log_tenant ON rule_provisioning_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_log_created_at ON rule_provisioning_log(created_at);

-- Add comments
COMMENT ON TABLE rule_provisioning_log IS 'Audit log of automatic rule provisioning for tenants';
COMMENT ON COLUMN rule_provisioning_log.provisioning_type IS 'Type of provisioning: initial, upgrade, or manual';
COMMENT ON COLUMN rule_provisioning_log.created_rules IS 'JSON array of rule IDs and names that were created';

-- Create a function to get default rule counts by plan
CREATE OR REPLACE FUNCTION get_default_rule_counts()
RETURNS TABLE(
    plan_tier TEXT,
    total_rules BIGINT,
    enabled_rules BIGINT,
    categories JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.plan_tier::TEXT,
        COUNT(*)::BIGINT as total_rules,
        COUNT(CASE WHEN r.enabled = true THEN 1 END)::BIGINT as enabled_rules,
        jsonb_agg(DISTINCT r.rule_template_id) FILTER (WHERE r.rule_template_id IS NOT NULL) as categories
    FROM rules r
    WHERE r.is_default = true 
    GROUP BY r.plan_tier;
END;
$$ LANGUAGE plpgsql;

-- Create migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Log completion
INSERT INTO migration_log (migration_name, executed_at) 
VALUES ('012_add_default_rules_support', NOW())
ON CONFLICT (migration_name) DO NOTHING;