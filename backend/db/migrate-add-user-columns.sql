-- Migration: Add pipedrive_user_id and pipedrive_user_name columns to tenants table
-- This fixes the OAuth 500 error

-- Add columns if they don't exist
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS pipedrive_user_id INTEGER,
ADD COLUMN IF NOT EXISTS pipedrive_user_name TEXT;

-- Add unique constraint on pipedrive_user_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tenants_pipedrive_user_id_key'
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_pipedrive_user_id_key UNIQUE (pipedrive_user_id);
    END IF;
END $$;

-- Add index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_tenants_pipedrive_user_id ON tenants(pipedrive_user_id);

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN ('pipedrive_user_id', 'pipedrive_user_name');