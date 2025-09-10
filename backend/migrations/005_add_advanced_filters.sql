-- Migration: Add advanced filters support to rules table
-- This enables value-based filtering, probability thresholds, and other advanced filtering

-- Add filters column to rules table (JSONB for flexible filter storage)
ALTER TABLE rules ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';

-- Add index on filters for better query performance
CREATE INDEX IF NOT EXISTS idx_rules_filters ON rules USING GIN (filters);

-- Add target_channel_id for channel routing (optional webhook override)
ALTER TABLE rules ADD COLUMN IF NOT EXISTS target_channel_id INTEGER REFERENCES chat_webhooks(id);

-- Add comments for documentation
COMMENT ON COLUMN rules.filters IS 'JSONB column storing advanced filters: value_min, value_max, probability_min, probability_max, stage_ids, pipeline_ids, owner_ids, time_restrictions, labels, currencies';
COMMENT ON COLUMN rules.target_channel_id IS 'Optional specific webhook for this rule, overrides default webhook';

-- Example filter structures (for documentation):
/*
Example filters JSON structure:
{
  "value_min": 1000,
  "value_max": 50000,
  "probability_min": 70,
  "probability_max": 100,
  "stage_ids": [1, 2, 3],
  "pipeline_ids": [1],
  "owner_ids": [123, 456],
  "currencies": ["USD", "EUR"],
  "labels": ["hot", "priority"],
  "label_match_type": "any",
  "time_restrictions": {
    "business_hours_only": true,
    "start_hour": 9,
    "end_hour": 17,
    "weekdays_only": true
  }
}
*/