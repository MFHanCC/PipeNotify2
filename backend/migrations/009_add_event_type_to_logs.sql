-- Migration 009: Add event_type column to logs table
-- This improves query performance and provides better consistency

BEGIN;

-- Add event_type column
ALTER TABLE logs ADD COLUMN IF NOT EXISTS event_type TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);

-- Update existing records to populate event_type from payload
UPDATE logs 
SET event_type = payload->>'event' 
WHERE event_type IS NULL 
  AND payload ? 'event';

-- Add a trigger to automatically populate event_type for new records
CREATE OR REPLACE FUNCTION populate_log_event_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract event type from payload
    IF NEW.payload ? 'event' THEN
        NEW.event_type := NEW.payload->>'event';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_populate_log_event_type ON logs;
CREATE TRIGGER trigger_populate_log_event_type
    BEFORE INSERT ON logs
    FOR EACH ROW
    EXECUTE FUNCTION populate_log_event_type();

COMMIT;