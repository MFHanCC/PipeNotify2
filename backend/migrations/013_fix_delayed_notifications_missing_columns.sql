-- Migration: Add missing updated_at column to delayed_notifications table
-- Fixes cleanup endpoint that requires updated_at column

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delayed_notifications' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE delayed_notifications ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        
        -- Update existing rows to have created_at as updated_at
        UPDATE delayed_notifications SET updated_at = created_at WHERE updated_at IS NULL;
        
        -- Add trigger for auto-updating updated_at
        CREATE OR REPLACE FUNCTION update_delayed_notifications_updated_at()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $func$ language 'plpgsql';

        CREATE TRIGGER update_delayed_notifications_updated_at
          BEFORE UPDATE ON delayed_notifications
          FOR EACH ROW
          EXECUTE PROCEDURE update_delayed_notifications_updated_at();
          
        -- Add comment
        COMMENT ON COLUMN delayed_notifications.updated_at IS 'Timestamp when record was last updated';
        
        RAISE NOTICE 'Added updated_at column to delayed_notifications table';
    ELSE
        RAISE NOTICE 'Column updated_at already exists in delayed_notifications table';
    END IF;
END $$;