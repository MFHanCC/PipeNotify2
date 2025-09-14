-- Migration: Fix missing columns that cause errors in production
-- This addresses Railway deployment errors

-- Add target_channel_id column if it doesn't exist
ALTER TABLE rules ADD COLUMN IF NOT EXISTS target_channel_id INTEGER REFERENCES chat_webhooks(id);

-- Add filters column if it doesn't exist 
ALTER TABLE rules ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';

-- Add index on filters for better query performance
CREATE INDEX IF NOT EXISTS idx_rules_filters ON rules USING GIN (filters);

-- Add comments for documentation
COMMENT ON COLUMN rules.target_channel_id IS 'Optional specific webhook for this rule, overrides default webhook';
COMMENT ON COLUMN rules.filters IS 'JSONB column storing advanced filters';

-- Fix any existing NULL values
UPDATE rules SET filters = '{}' WHERE filters IS NULL;

-- Ensure all rules have proper target webhook references
UPDATE rules SET target_webhook_id = 1 WHERE target_webhook_id IS NULL AND EXISTS (SELECT 1 FROM chat_webhooks LIMIT 1);

-- Log completion
INSERT INTO migration_log (migration_name, executed_at) 
VALUES ('011_fix_missing_columns', NOW())
ON CONFLICT (migration_name) DO NOTHING;