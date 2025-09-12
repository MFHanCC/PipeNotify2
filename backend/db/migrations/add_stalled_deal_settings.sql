-- Migration: Add stalled deal monitoring settings table
-- Created: 2025-09-12
-- Description: Adds table for persistent stalled deal monitoring configuration per tenant

-- Stalled deal monitoring settings - per tenant configuration
CREATE TABLE stalled_deal_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    
    -- Alert thresholds in days
    warning_threshold INTEGER DEFAULT 3 CHECK (warning_threshold > 0),
    stale_threshold INTEGER DEFAULT 7 CHECK (stale_threshold > warning_threshold),
    critical_threshold INTEGER DEFAULT 14 CHECK (critical_threshold > stale_threshold),
    
    -- Alert channel configuration
    alert_channel_id INTEGER REFERENCES chat_webhooks(id) ON DELETE SET NULL,
    
    -- Schedule configuration
    schedule_time TIME DEFAULT '09:00:00', -- Daily check time
    summary_frequency TEXT DEFAULT 'daily' CHECK (summary_frequency IN ('daily', 'weekly')),
    
    -- Optional filters
    min_deal_value DECIMAL(15,2), -- Minimum deal value to monitor
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one setting per tenant
    UNIQUE(tenant_id)
);

-- Index for efficient tenant lookups
CREATE INDEX idx_stalled_deal_settings_tenant_id ON stalled_deal_settings(tenant_id);

-- Index for enabled settings (for background job queries)
CREATE INDEX idx_stalled_deal_settings_enabled ON stalled_deal_settings(enabled) WHERE enabled = true;

-- Update trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stalled_deal_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stalled_deal_settings_updated_at
    BEFORE UPDATE ON stalled_deal_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_stalled_deal_settings_updated_at();

-- Insert default settings for existing tenants
INSERT INTO stalled_deal_settings (tenant_id, enabled, warning_threshold, stale_threshold, critical_threshold)
SELECT id, false, 3, 7, 14 
FROM tenants 
ON CONFLICT (tenant_id) DO NOTHING;

COMMIT;