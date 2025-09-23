-- Migration: Create guaranteed delivery system tables
-- Supports multi-tier delivery tracking and batch processing

-- Notification queue for batch processing and manual recovery
CREATE TABLE IF NOT EXISTS notification_queue (
  id SERIAL PRIMARY KEY,
  delivery_id VARCHAR(50) NOT NULL,
  webhook_data JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  tier VARCHAR(20) NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  scheduled_for TIMESTAMP,
  processed_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'manual_recovery', 'cancelled')),
  CONSTRAINT valid_tier CHECK (tier IN ('queue', 'direct', 'batch', 'manual')),
  CONSTRAINT valid_retry_count CHECK (retry_count >= 0)
);

-- Delivery log for tracking all delivery attempts
CREATE TABLE IF NOT EXISTS delivery_log (
  id SERIAL PRIMARY KEY,
  delivery_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50),
  company_id INTEGER,
  tenant_id INTEGER,
  status VARCHAR(20) NOT NULL,
  tier VARCHAR(20),
  result_data JSONB,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_delivery_status CHECK (status IN ('started', 'success', 'failed', 'queued_batch', 'manual_recovery')),
  CONSTRAINT valid_delivery_tier CHECK (tier IN ('queue', 'direct', 'batch', 'manual', 'all_tiers'))
);

-- Monitoring metrics for system health
CREATE TABLE IF NOT EXISTS monitoring_metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(50) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_type VARCHAR(20) NOT NULL DEFAULT 'gauge',
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_metric_type CHECK (metric_type IN ('gauge', 'counter', 'histogram', 'rate'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_tier ON notification_queue(status, tier);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_delivery_id ON notification_queue(delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_log_delivery_id ON delivery_log(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_created_at ON delivery_log(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status_tier ON delivery_log(status, tier);
CREATE INDEX IF NOT EXISTS idx_delivery_log_company_id ON delivery_log(company_id);

CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_name_timestamp ON monitoring_metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp ON monitoring_metrics(timestamp);

-- Add updated_at trigger for notification_queue
CREATE OR REPLACE FUNCTION update_notification_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.processed_at = CASE 
    WHEN NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status != NEW.status 
    THEN NOW() 
    ELSE NEW.processed_at 
  END;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_notification_queue_status ON notification_queue;
CREATE TRIGGER update_notification_queue_status
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE PROCEDURE update_notification_queue_updated_at();

-- Add comments for documentation
COMMENT ON TABLE notification_queue IS 'Queue for batch processing and manual recovery of failed notifications';
COMMENT ON COLUMN notification_queue.delivery_id IS 'Unique identifier for tracking delivery across tiers';
COMMENT ON COLUMN notification_queue.webhook_data IS 'Complete webhook data for processing';
COMMENT ON COLUMN notification_queue.status IS 'Current processing status';
COMMENT ON COLUMN notification_queue.tier IS 'Which delivery tier this notification is in';
COMMENT ON COLUMN notification_queue.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN notification_queue.scheduled_for IS 'When this notification should be processed';

COMMENT ON TABLE delivery_log IS 'Complete log of all delivery attempts for analytics and debugging';
COMMENT ON COLUMN delivery_log.delivery_id IS 'Links to notification_queue.delivery_id';
COMMENT ON COLUMN delivery_log.tier IS 'Which delivery tier was used for this attempt';
COMMENT ON COLUMN delivery_log.result_data IS 'Detailed result information from delivery attempt';

COMMENT ON TABLE monitoring_metrics IS 'System health and performance metrics';
COMMENT ON COLUMN monitoring_metrics.metric_name IS 'Name of the metric (e.g., notifications_per_minute)';
COMMENT ON COLUMN monitoring_metrics.metric_value IS 'Numerical value of the metric';
COMMENT ON COLUMN monitoring_metrics.metric_type IS 'Type of metric for proper aggregation';
COMMENT ON COLUMN monitoring_metrics.tags IS 'Additional metadata tags for filtering and grouping';

-- Insert initial monitoring metrics
INSERT INTO monitoring_metrics (metric_name, metric_value, metric_type, tags) VALUES
('delivery_system_version', 1.0, 'gauge', '{"component": "guaranteed_delivery"}'),
('max_retry_attempts', 5, 'gauge', '{"component": "batch_processor"}'),
('batch_processing_interval_minutes', 5, 'gauge', '{"component": "batch_processor"}')
ON CONFLICT DO NOTHING;