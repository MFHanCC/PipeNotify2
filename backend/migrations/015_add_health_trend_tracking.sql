-- Migration: Add health trend tracking and historical metrics
-- Supports health monitoring trends and predictive analytics

-- Health status history table for tracking system health over time
CREATE TABLE IF NOT EXISTS health_status_history (
  id SERIAL PRIMARY KEY,
  overall_status VARCHAR(20) NOT NULL,
  health_score INTEGER NOT NULL DEFAULT 100,
  database_status VARCHAR(20) NOT NULL,
  database_latency_ms INTEGER,
  queue_status VARCHAR(20) NOT NULL,
  queue_backlog_size INTEGER DEFAULT 0,
  queue_processing_rate INTEGER DEFAULT 0,
  self_healing_status VARCHAR(20) NOT NULL,
  self_healing_issues_found INTEGER DEFAULT 0,
  self_healing_fixes_applied INTEGER DEFAULT 0,
  delivery_success_rate DECIMAL(5,2) DEFAULT 100.00,
  response_time_ms INTEGER,
  uptime_seconds INTEGER,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_overall_status CHECK (overall_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  CONSTRAINT valid_database_status CHECK (database_status IN ('connected', 'disconnected', 'error')),
  CONSTRAINT valid_queue_status CHECK (queue_status IN ('healthy', 'degraded', 'error')),
  CONSTRAINT valid_self_healing_status CHECK (self_healing_status IN ('active', 'inactive', 'error')),
  CONSTRAINT valid_health_score CHECK (health_score >= 0 AND health_score <= 100),
  CONSTRAINT valid_success_rate CHECK (delivery_success_rate >= 0 AND delivery_success_rate <= 100)
);

-- Performance trends for tracking system performance over time
CREATE TABLE IF NOT EXISTS performance_trends (
  id SERIAL PRIMARY KEY,
  metric_category VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  metric_unit VARCHAR(20),
  baseline_value DECIMAL(10,2),
  trend_direction VARCHAR(10), -- 'up', 'down', 'stable'
  severity_level VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_trend_direction CHECK (trend_direction IN ('up', 'down', 'stable', 'unknown')),
  CONSTRAINT valid_severity_level CHECK (severity_level IN ('info', 'warning', 'critical'))
);

-- Health alerts for significant status changes
CREATE TABLE IF NOT EXISTS health_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  component VARCHAR(50), -- 'database', 'queue', 'self_healing', 'delivery'
  metric_name VARCHAR(100),
  current_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_alert_severity CHECK (severity IN ('info', 'warning', 'critical', 'emergency'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_status_history_timestamp ON health_status_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_health_status_history_overall_status ON health_status_history(overall_status);
CREATE INDEX IF NOT EXISTS idx_health_status_history_health_score ON health_status_history(health_score);

CREATE INDEX IF NOT EXISTS idx_performance_trends_category_name ON performance_trends(metric_category, metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_trends_timestamp ON performance_trends(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_trends_severity ON performance_trends(severity_level);

CREATE INDEX IF NOT EXISTS idx_health_alerts_component ON health_alerts(component);
CREATE INDEX IF NOT EXISTS idx_health_alerts_severity ON health_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_health_alerts_acknowledged ON health_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_health_alerts_resolved ON health_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_health_alerts_created_at ON health_alerts(created_at);

-- Add table comments
COMMENT ON TABLE health_status_history IS 'Historical tracking of system health status and metrics';
COMMENT ON COLUMN health_status_history.health_score IS 'Overall health score from 0-100';
COMMENT ON COLUMN health_status_history.delivery_success_rate IS 'Percentage of successful deliveries';

COMMENT ON TABLE performance_trends IS 'Performance metrics tracking and trend analysis';
COMMENT ON COLUMN performance_trends.baseline_value IS 'Baseline value for comparison and trend calculation';
COMMENT ON COLUMN performance_trends.trend_direction IS 'Direction of trend compared to baseline';

COMMENT ON TABLE health_alerts IS 'Health-related alerts and notifications for system issues';
COMMENT ON COLUMN health_alerts.threshold_value IS 'Threshold value that triggered this alert';

-- Insert initial health tracking metrics
INSERT INTO monitoring_metrics (metric_name, metric_value, metric_type, tags) VALUES
('health_tracking_enabled', 1, 'gauge', '{"component": "health_monitor", "version": "2.0"}'),
('trend_analysis_interval_minutes', 15, 'gauge', '{"component": "trend_analyzer"}'),
('health_history_retention_days', 90, 'gauge', '{"component": "health_monitor"}'),
('alert_threshold_critical', 70, 'gauge', '{"component": "health_alerts"}'),
('alert_threshold_warning', 85, 'gauge', '{"component": "health_alerts"}')
ON CONFLICT DO NOTHING;

-- Function to calculate health score based on components
CREATE OR REPLACE FUNCTION calculate_health_score(
  p_database_status VARCHAR,
  p_database_latency INTEGER,
  p_queue_status VARCHAR,
  p_queue_backlog INTEGER,
  p_self_healing_status VARCHAR,
  p_delivery_success_rate DECIMAL
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 100;
BEGIN
  -- Database health (30% weight)
  CASE p_database_status
    WHEN 'connected' THEN
      IF p_database_latency > 1000 THEN score := score - 15;
      ELSIF p_database_latency > 500 THEN score := score - 8;
      END IF;
    WHEN 'error' THEN score := score - 30;
    ELSE NULL; -- Handle unknown status
  END CASE;
  
  -- Queue health (25% weight)  
  CASE p_queue_status
    WHEN 'healthy' THEN 
      IF p_queue_backlog > 100 THEN score := score - 10;
      ELSIF p_queue_backlog > 50 THEN score := score - 5;
      END IF;
    WHEN 'degraded' THEN score := score - 15;
    WHEN 'error' THEN score := score - 25;
    ELSE NULL; -- Handle unknown status
  END CASE;
  
  -- Self-healing health (20% weight)
  CASE p_self_healing_status  
    WHEN 'inactive' THEN score := score - 10;
    WHEN 'error' THEN score := score - 20;
    ELSE NULL; -- Handle unknown status
  END CASE;
  
  -- Delivery success rate (25% weight)
  IF p_delivery_success_rate < 90 THEN
    score := score - (25 * (90 - p_delivery_success_rate) / 90)::INTEGER;
  END IF;
  
  -- Ensure score stays within bounds
  RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql;