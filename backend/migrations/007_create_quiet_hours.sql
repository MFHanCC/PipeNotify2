-- Migration: Create quiet hours and delayed notifications tables
-- Supports business hours, weekend restrictions, and holiday scheduling

-- Create quiet_hours table
CREATE TABLE IF NOT EXISTS quiet_hours (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  start_time TIME NOT NULL DEFAULT '18:00',
  end_time TIME NOT NULL DEFAULT '09:00',
  weekends_enabled BOOLEAN NOT NULL DEFAULT false,
  holidays JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_tenant_quiet_hours UNIQUE (tenant_id),
  CONSTRAINT valid_time_format CHECK (
    start_time IS NOT NULL AND end_time IS NOT NULL
  )
);

-- Create delayed_notifications table for queuing notifications during quiet hours
CREATE TABLE IF NOT EXISTS delayed_notifications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_data JSONB NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiet_hours_tenant_id ON quiet_hours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delayed_notifications_tenant_id ON delayed_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delayed_notifications_scheduled ON delayed_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_delayed_notifications_status ON delayed_notifications(status);
CREATE INDEX IF NOT EXISTS idx_delayed_notifications_ready ON delayed_notifications(scheduled_for, status) WHERE status = 'pending';

-- Add updated_at trigger for quiet_hours
CREATE OR REPLACE FUNCTION update_quiet_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_quiet_hours_updated_at ON quiet_hours;
CREATE TRIGGER update_quiet_hours_updated_at
  BEFORE UPDATE ON quiet_hours
  FOR EACH ROW
  EXECUTE PROCEDURE update_quiet_hours_updated_at();

-- Add comments for documentation
COMMENT ON TABLE quiet_hours IS 'Stores quiet hours configuration for each tenant';
COMMENT ON COLUMN quiet_hours.tenant_id IS 'Foreign key to tenants table';
COMMENT ON COLUMN quiet_hours.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN quiet_hours.start_time IS 'Start of quiet period (notifications disabled)';
COMMENT ON COLUMN quiet_hours.end_time IS 'End of quiet period (notifications resume)';
COMMENT ON COLUMN quiet_hours.weekends_enabled IS 'Whether to send notifications on weekends';
COMMENT ON COLUMN quiet_hours.holidays IS 'Array of holiday dates in YYYY-MM-DD format';

COMMENT ON TABLE delayed_notifications IS 'Stores notifications delayed due to quiet hours';
COMMENT ON COLUMN delayed_notifications.tenant_id IS 'Foreign key to tenants table';
COMMENT ON COLUMN delayed_notifications.notification_data IS 'Complete notification payload for delayed sending';
COMMENT ON COLUMN delayed_notifications.scheduled_for IS 'When this notification should be sent';
COMMENT ON COLUMN delayed_notifications.sent_at IS 'When this notification was actually sent (null if not sent)';
COMMENT ON COLUMN delayed_notifications.status IS 'Current status: pending, sent, failed, cancelled';

-- Example configurations for documentation:
/*
Business hours examples:

1. Standard business hours (9 AM - 5 PM, weekdays only):
   - start_time: '17:00' (5 PM - start quiet period)
   - end_time: '09:00' (9 AM - end quiet period)
   - weekends_enabled: false

2. 24/7 except late night (11 PM - 7 AM):
   - start_time: '23:00' (11 PM)
   - end_time: '07:00' (7 AM)
   - weekends_enabled: true

3. Business hours with weekend mornings (9 AM - 6 PM, weekends 10 AM - 2 PM):
   - start_time: '18:00' (6 PM)
   - end_time: '09:00' (9 AM weekdays, 10 AM weekends - needs logic adjustment)
   - weekends_enabled: true

Holiday examples:
- holidays: ['2025-01-01', '2025-07-04', '2025-12-25']

Timezone examples:
- 'America/New_York'
- 'Europe/London'
- 'Asia/Tokyo'
- 'UTC'
*/