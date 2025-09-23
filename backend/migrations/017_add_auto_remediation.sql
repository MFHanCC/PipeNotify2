-- Migration: Add auto-remediation tracking and management tables
-- Supports automated issue remediation, action tracking, and remediation history

-- Remediation history for tracking all auto-fix attempts
CREATE TABLE IF NOT EXISTS remediation_history (
  id SERIAL PRIMARY KEY,
  issue_id VARCHAR(100) NOT NULL,
  issue_type VARCHAR(50) NOT NULL,
  issue_severity VARCHAR(20) NOT NULL,
  remediation_actions JSONB DEFAULT '[]',
  success BOOLEAN NOT NULL,
  error_message TEXT,
  execution_duration_ms INTEGER,
  executed_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT valid_remediation_severity CHECK (issue_severity IN ('info', 'warning', 'critical'))
);

-- Remediation rules for configuring auto-fix behavior
CREATE TABLE IF NOT EXISTS remediation_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL UNIQUE,
  issue_type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL, -- Conditions that must be met to trigger
  actions JSONB NOT NULL, -- Array of actions to execute
  risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
  auto_execute BOOLEAN DEFAULT TRUE,
  max_executions_per_hour INTEGER DEFAULT 5,
  max_executions_per_day INTEGER DEFAULT 20,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_modified TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_remediation_risk_level CHECK (risk_level IN ('low', 'medium', 'high'))
);

-- Remediation rate limiting to prevent over-execution
CREATE TABLE IF NOT EXISTS remediation_rate_limits (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES remediation_rules(id) ON DELETE CASCADE,
  time_window VARCHAR(20) NOT NULL, -- 'hour', 'day', 'week'
  execution_count INTEGER DEFAULT 0,
  window_start TIMESTAMP DEFAULT NOW(),
  last_execution TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_time_window CHECK (time_window IN ('hour', 'day', 'week'))
);

-- Remediation effectiveness tracking
CREATE TABLE IF NOT EXISTS remediation_effectiveness (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES remediation_rules(id) ON DELETE CASCADE,
  issue_type VARCHAR(50) NOT NULL,
  total_attempts INTEGER DEFAULT 0,
  successful_attempts INTEGER DEFAULT 0,
  average_execution_time_ms DECIMAL(10,2),
  effectiveness_score DECIMAL(5,2), -- 0-100 score based on success rate
  last_calculated TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint per rule
  UNIQUE(rule_id, issue_type)
);

-- Remediation blacklist for issues that should not be auto-fixed
CREATE TABLE IF NOT EXISTS remediation_blacklist (
  id SERIAL PRIMARY KEY,
  issue_pattern VARCHAR(200) NOT NULL, -- Pattern to match issue types/descriptions
  reason TEXT NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Optional expiration
  active BOOLEAN DEFAULT TRUE
);

-- Remediation configuration for system-wide settings
CREATE TABLE IF NOT EXISTS remediation_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  data_type VARCHAR(20) DEFAULT 'string', -- 'string', 'integer', 'boolean', 'json'
  description TEXT,
  last_modified TIMESTAMP DEFAULT NOW(),
  modified_by VARCHAR(100)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_remediation_history_executed_at ON remediation_history(executed_at);
CREATE INDEX IF NOT EXISTS idx_remediation_history_issue_type ON remediation_history(issue_type);
CREATE INDEX IF NOT EXISTS idx_remediation_history_success ON remediation_history(success);
CREATE INDEX IF NOT EXISTS idx_remediation_history_issue_id ON remediation_history(issue_id);

CREATE INDEX IF NOT EXISTS idx_remediation_rules_issue_type ON remediation_rules(issue_type);
CREATE INDEX IF NOT EXISTS idx_remediation_rules_enabled ON remediation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_remediation_rules_risk_level ON remediation_rules(risk_level);

CREATE INDEX IF NOT EXISTS idx_rate_limits_rule_time ON remediation_rate_limits(rule_id, time_window);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON remediation_rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_effectiveness_rule_issue ON remediation_effectiveness(rule_id, issue_type);
CREATE INDEX IF NOT EXISTS idx_effectiveness_score ON remediation_effectiveness(effectiveness_score);

CREATE INDEX IF NOT EXISTS idx_blacklist_active ON remediation_blacklist(active);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON remediation_blacklist(expires_at);

-- Add table comments
COMMENT ON TABLE remediation_history IS 'Complete history of all automated remediation attempts';
COMMENT ON TABLE remediation_rules IS 'Configuration rules for automated issue remediation';
COMMENT ON TABLE remediation_rate_limits IS 'Rate limiting to prevent excessive auto-remediation';
COMMENT ON TABLE remediation_effectiveness IS 'Tracking effectiveness of remediation rules';
COMMENT ON TABLE remediation_blacklist IS 'Issues that should not be automatically remediated';
COMMENT ON TABLE remediation_config IS 'System-wide configuration for auto-remediation';

-- Insert default remediation rules
INSERT INTO remediation_rules (rule_name, issue_type, conditions, actions, risk_level, auto_execute) VALUES
('memory_cleanup', 'memory_exhaustion', '{"memory_usage_threshold": 90}', '["memory_garbage_collection", "cache_cleanup"]', 'low', true),
('cpu_throttling', 'cpu_exhaustion', '{"cpu_usage_threshold": 85}', '["process_priority_adjustment", "background_task_throttling"]', 'medium', true),
('db_optimization', 'database_performance', '{"response_time_threshold": 2000}', '["connection_pool_optimization", "query_cache_refresh"]', 'medium', true),
('queue_scaling', 'queue_backlog', '{"waiting_jobs_threshold": 100}', '["worker_scaling", "failed_job_cleanup"]', 'low', true),
('log_maintenance', 'log_file_size', '{"file_size_mb_threshold": 100}', '["log_rotation", "log_cleanup"]', 'low', true)
ON CONFLICT DO NOTHING;

-- Insert default configuration
INSERT INTO remediation_config (config_key, config_value, data_type, description) VALUES
('max_auto_fixes_per_hour', '10', 'integer', 'Maximum number of auto-fixes allowed per hour'),
('max_auto_fixes_per_day', '50', 'integer', 'Maximum number of auto-fixes allowed per day'),
('cool_down_period_minutes', '5', 'integer', 'Minutes to wait between auto-fix attempts'),
('enable_auto_remediation', 'true', 'boolean', 'Global enable/disable for auto-remediation'),
('enable_high_risk_auto_fixes', 'false', 'boolean', 'Allow auto-execution of high-risk fixes'),
('remediation_notification_threshold', 'warning', 'string', 'Minimum severity to send notifications'),
('effectiveness_calculation_interval_hours', '24', 'integer', 'How often to recalculate effectiveness scores')
ON CONFLICT DO NOTHING;

-- Function to check if remediation is allowed for a rule
CREATE OR REPLACE FUNCTION check_remediation_allowed(
  p_rule_id INTEGER,
  p_time_window VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
  rule_record RECORD;
  rate_limit_record RECORD;
  max_executions INTEGER;
  window_duration INTERVAL;
BEGIN
  -- Get the rule details
  SELECT * INTO rule_record FROM remediation_rules WHERE id = p_rule_id AND enabled = TRUE;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Determine max executions and window duration
  CASE p_time_window
    WHEN 'hour' THEN
      max_executions := rule_record.max_executions_per_hour;
      window_duration := INTERVAL '1 hour';
    WHEN 'day' THEN  
      max_executions := rule_record.max_executions_per_day;
      window_duration := INTERVAL '1 day';
    ELSE
      RETURN FALSE;
  END CASE;
  
  -- Check current rate limits
  SELECT * INTO rate_limit_record 
  FROM remediation_rate_limits 
  WHERE rule_id = p_rule_id AND time_window = p_time_window;
  
  IF FOUND THEN
    -- Check if we're still in the same window
    IF rate_limit_record.window_start + window_duration > NOW() THEN
      -- In the same window, check if we're under the limit
      RETURN rate_limit_record.execution_count < max_executions;
    ELSE
      -- New window, reset the counter
      UPDATE remediation_rate_limits 
      SET execution_count = 0, window_start = NOW()
      WHERE id = rate_limit_record.id;
      RETURN TRUE;
    END IF;
  ELSE
    -- No rate limit record exists, create one
    INSERT INTO remediation_rate_limits (rule_id, time_window, execution_count, window_start)
    VALUES (p_rule_id, p_time_window, 0, NOW());
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to record a remediation execution
CREATE OR REPLACE FUNCTION record_remediation_execution(
  p_rule_id INTEGER,
  p_issue_id VARCHAR(100),
  p_success BOOLEAN,
  p_execution_time_ms INTEGER
) RETURNS VOID AS $$
BEGIN
  -- Update rate limits for both hour and day
  UPDATE remediation_rate_limits 
  SET execution_count = execution_count + 1, last_execution = NOW()
  WHERE rule_id = p_rule_id AND time_window IN ('hour', 'day');
  
  -- Update effectiveness tracking
  INSERT INTO remediation_effectiveness (rule_id, issue_type, total_attempts, successful_attempts, average_execution_time_ms)
  SELECT 
    p_rule_id,
    rh.issue_type,
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    p_execution_time_ms
  FROM remediation_history rh 
  WHERE rh.issue_id = p_issue_id
  LIMIT 1
  ON CONFLICT (rule_id, issue_type) DO UPDATE SET
    total_attempts = remediation_effectiveness.total_attempts + 1,
    successful_attempts = remediation_effectiveness.successful_attempts + CASE WHEN p_success THEN 1 ELSE 0 END,
    average_execution_time_ms = (
      (remediation_effectiveness.average_execution_time_ms * remediation_effectiveness.total_attempts + p_execution_time_ms) / 
      (remediation_effectiveness.total_attempts + 1)
    ),
    effectiveness_score = (
      (remediation_effectiveness.successful_attempts + CASE WHEN p_success THEN 1 ELSE 0 END) * 100.0 / 
      (remediation_effectiveness.total_attempts + 1)
    ),
    last_calculated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old remediation data
CREATE OR REPLACE FUNCTION cleanup_remediation_data() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Clean up old remediation history (keep 90 days)
  DELETE FROM remediation_history 
  WHERE executed_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up expired blacklist entries
  DELETE FROM remediation_blacklist 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old rate limit windows (keep 1 week)
  DELETE FROM remediation_rate_limits 
  WHERE window_start < NOW() - INTERVAL '1 week';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;