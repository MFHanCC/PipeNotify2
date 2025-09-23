-- Migration: Add performance analysis and advanced monitoring tables
-- Supports system performance tracking, bottleneck detection, and optimization recommendations

-- Performance metrics storage for detailed system monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  metric_category VARCHAR(50) NOT NULL, -- 'cpu', 'memory', 'database', 'queue', 'api'
  metric_data JSONB NOT NULL,
  
  -- Indexes for performance
  CONSTRAINT valid_metric_category CHECK (metric_category IN ('cpu', 'memory', 'database', 'queue', 'api', 'network'))
);

-- Performance bottlenecks detected by the analyzer
CREATE TABLE IF NOT EXISTS performance_bottlenecks (
  id SERIAL PRIMARY KEY,
  detected_at TIMESTAMP DEFAULT NOW(),
  bottleneck_type VARCHAR(50) NOT NULL, -- 'cpu', 'memory', 'database', 'queue'
  severity VARCHAR(20) NOT NULL, -- 'warning', 'critical'
  description TEXT NOT NULL,
  impact_assessment TEXT,
  recommendations JSONB DEFAULT '[]',
  metrics_snapshot JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  -- Constraints
  CONSTRAINT valid_bottleneck_type CHECK (bottleneck_type IN ('cpu', 'memory', 'database', 'queue', 'network', 'disk')),
  CONSTRAINT valid_bottleneck_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Performance optimization recommendations
CREATE TABLE IF NOT EXISTS performance_optimizations (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
  title VARCHAR(200) NOT NULL,
  description TEXT,
  actions JSONB DEFAULT '[]', -- Array of recommended actions
  estimated_impact VARCHAR(20), -- 'low', 'medium', 'high'
  implementation_complexity VARCHAR(20), -- 'easy', 'moderate', 'complex'
  implemented BOOLEAN DEFAULT FALSE,
  implemented_at TIMESTAMP,
  implementation_notes TEXT,
  effectiveness_rating INTEGER, -- 1-5 rating after implementation
  
  -- Constraints
  CONSTRAINT valid_optimization_priority CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT valid_estimated_impact CHECK (estimated_impact IN ('low', 'medium', 'high')),
  CONSTRAINT valid_implementation_complexity CHECK (implementation_complexity IN ('easy', 'moderate', 'complex')),
  CONSTRAINT valid_effectiveness_rating CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5)
);

-- System performance baselines for trend analysis
CREATE TABLE IF NOT EXISTS performance_baselines (
  id SERIAL PRIMARY KEY,
  metric_type VARCHAR(50) NOT NULL,
  baseline_value DECIMAL(10,4) NOT NULL,
  measurement_unit VARCHAR(20),
  calculated_at TIMESTAMP DEFAULT NOW(),
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  confidence_level DECIMAL(5,2) DEFAULT 95.00, -- Statistical confidence
  sample_size INTEGER DEFAULT 0,
  notes TEXT,
  
  -- Constraints
  CONSTRAINT valid_confidence_level CHECK (confidence_level >= 50.00 AND confidence_level <= 99.99)
);

-- Performance analysis sessions for comprehensive reports
CREATE TABLE IF NOT EXISTS performance_analysis_sessions (
  id SERIAL PRIMARY KEY,
  session_start TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP,
  analysis_type VARCHAR(50) DEFAULT 'automatic', -- 'automatic', 'manual', 'triggered'
  trigger_reason VARCHAR(100), -- What caused this analysis
  overall_health_score INTEGER, -- 0-100
  critical_issues_count INTEGER DEFAULT 0,
  warning_issues_count INTEGER DEFAULT 0,
  optimizations_generated INTEGER DEFAULT 0,
  session_summary JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT valid_analysis_type CHECK (analysis_type IN ('automatic', 'manual', 'triggered', 'scheduled')),
  CONSTRAINT valid_health_score CHECK (overall_health_score >= 0 AND overall_health_score <= 100)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_category ON performance_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_category_timestamp ON performance_metrics(metric_category, timestamp);

CREATE INDEX IF NOT EXISTS idx_bottlenecks_detected_at ON performance_bottlenecks(detected_at);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_type_severity ON performance_bottlenecks(bottleneck_type, severity);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_resolved ON performance_bottlenecks(resolved);

CREATE INDEX IF NOT EXISTS idx_optimizations_priority ON performance_optimizations(priority);
CREATE INDEX IF NOT EXISTS idx_optimizations_category ON performance_optimizations(category);
CREATE INDEX IF NOT EXISTS idx_optimizations_implemented ON performance_optimizations(implemented);

CREATE INDEX IF NOT EXISTS idx_baselines_metric_type ON performance_baselines(metric_type);
CREATE INDEX IF NOT EXISTS idx_baselines_valid_period ON performance_baselines(valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_analysis_sessions_start ON performance_analysis_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_type ON performance_analysis_sessions(analysis_type);

-- Add table comments
COMMENT ON TABLE performance_metrics IS 'Detailed system performance metrics collected over time';
COMMENT ON TABLE performance_bottlenecks IS 'Detected performance bottlenecks with severity and recommendations';
COMMENT ON TABLE performance_optimizations IS 'Performance optimization recommendations and implementation tracking';
COMMENT ON TABLE performance_baselines IS 'Statistical baselines for performance metrics trend analysis';
COMMENT ON TABLE performance_analysis_sessions IS 'Performance analysis session records and summaries';

-- Insert initial performance tracking configuration
INSERT INTO monitoring_metrics (metric_name, metric_value, metric_type, tags) VALUES
('performance_analysis_enabled', 1, 'gauge', '{"component": "performance_analyzer", "version": "3.0"}'),
('performance_metrics_interval_minutes', 5, 'gauge', '{"component": "performance_analyzer"}'),
('performance_analysis_interval_minutes', 15, 'gauge', '{"component": "performance_analyzer"}'),
('bottleneck_detection_enabled', 1, 'gauge', '{"component": "bottleneck_detector"}'),
('optimization_recommendations_enabled', 1, 'gauge', '{"component": "performance_optimizer"}'),
('performance_baseline_tracking_enabled', 1, 'gauge', '{"component": "baseline_tracker"}')
ON CONFLICT DO NOTHING;

-- Function to calculate performance health score
CREATE OR REPLACE FUNCTION calculate_performance_health_score(
  p_cpu_usage DECIMAL,
  p_memory_usage DECIMAL,
  p_db_response_time INTEGER,
  p_critical_bottlenecks INTEGER,
  p_warning_bottlenecks INTEGER
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 100;
BEGIN
  -- CPU impact (25% weight)
  IF p_cpu_usage > 90 THEN score := score - 25;
  ELSIF p_cpu_usage > 75 THEN score := score - 15;
  ELSIF p_cpu_usage > 60 THEN score := score - 8;
  END IF;
  
  -- Memory impact (25% weight)
  IF p_memory_usage > 95 THEN score := score - 25;
  ELSIF p_memory_usage > 80 THEN score := score - 15;
  ELSIF p_memory_usage > 65 THEN score := score - 8;
  END IF;
  
  -- Database response time impact (20% weight)
  IF p_db_response_time > 2000 THEN score := score - 20;
  ELSIF p_db_response_time > 1000 THEN score := score - 12;
  ELSIF p_db_response_time > 500 THEN score := score - 6;
  END IF;
  
  -- Critical bottlenecks impact (20% weight)
  score := score - (p_critical_bottlenecks * 10);
  
  -- Warning bottlenecks impact (10% weight)  
  score := score - (p_warning_bottlenecks * 5);
  
  -- Ensure score stays within bounds
  RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old performance data
CREATE OR REPLACE FUNCTION cleanup_performance_data() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Clean up old performance metrics (keep 3 days)
  DELETE FROM performance_metrics 
  WHERE timestamp < NOW() - INTERVAL '3 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up resolved bottlenecks older than 30 days
  DELETE FROM performance_bottlenecks 
  WHERE resolved = TRUE AND resolved_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up implemented optimizations older than 90 days
  DELETE FROM performance_optimizations 
  WHERE implemented = TRUE AND implemented_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old baselines (keep only latest for each metric type)
  DELETE FROM performance_baselines pb1
  WHERE EXISTS (
    SELECT 1 FROM performance_baselines pb2 
    WHERE pb2.metric_type = pb1.metric_type 
    AND pb2.calculated_at > pb1.calculated_at
  ) AND pb1.calculated_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old analysis sessions (keep 60 days)
  DELETE FROM performance_analysis_sessions 
  WHERE session_start < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;