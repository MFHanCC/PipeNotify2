-- Migration: Add system reporting and comprehensive analysis tables
-- Supports automated report generation, executive summaries, and technical analysis

-- System reports storage for automated and manual reports
CREATE TABLE IF NOT EXISTS system_reports (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL, -- 'executive_summary', 'technical_deep_dive', 'performance_analysis'
  report_data JSONB NOT NULL, -- Complete report content
  overall_score INTEGER, -- 0-100 overall system health score
  system_status VARCHAR(20), -- 'healthy', 'warning', 'critical'
  period_hours INTEGER DEFAULT 24, -- Time period covered by the report
  confidence_score DECIMAL(5,4), -- Confidence in the report data (0-1)
  data_completeness DECIMAL(5,4), -- Completeness of underlying data (0-1)
  generated_by VARCHAR(20) DEFAULT 'automated', -- 'automated', 'manual', 'scheduled'
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_report_type CHECK (report_type IN ('executive_summary', 'technical_deep_dive', 'performance_analysis', 'security_assessment', 'capacity_planning')),
  CONSTRAINT valid_system_status CHECK (system_status IN ('healthy', 'warning', 'critical', 'unknown')),
  CONSTRAINT valid_overall_score CHECK (overall_score >= 0 AND overall_score <= 100),
  CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  CONSTRAINT valid_data_completeness CHECK (data_completeness >= 0.0 AND data_completeness <= 1.0)
);

-- Report subscriptions for automated delivery
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id SERIAL PRIMARY KEY,
  subscriber_email VARCHAR(255) NOT NULL,
  subscriber_name VARCHAR(100),
  report_type VARCHAR(50) NOT NULL,
  frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  delivery_method VARCHAR(20) DEFAULT 'email', -- 'email', 'webhook', 'dashboard'
  delivery_config JSONB DEFAULT '{}', -- Configuration for delivery method
  active BOOLEAN DEFAULT TRUE,
  last_delivered TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_report_subscription_type CHECK (report_type IN ('executive_summary', 'technical_deep_dive', 'performance_analysis', 'security_assessment', 'capacity_planning')),
  CONSTRAINT valid_subscription_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly', 'on_demand')),
  CONSTRAINT valid_delivery_method CHECK (delivery_method IN ('email', 'webhook', 'dashboard', 'slack'))
);

-- Report templates for customizable report generation
CREATE TABLE IF NOT EXISTS report_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL UNIQUE,
  report_type VARCHAR(50) NOT NULL,
  template_config JSONB NOT NULL, -- Template configuration and customization
  sections_included JSONB DEFAULT '[]', -- Which sections to include
  custom_thresholds JSONB DEFAULT '{}', -- Custom thresholds for this template
  target_audience VARCHAR(50), -- 'executive', 'technical', 'operations'
  created_by VARCHAR(100),
  is_default BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_template_report_type CHECK (report_type IN ('executive_summary', 'technical_deep_dive', 'performance_analysis', 'security_assessment', 'capacity_planning')),
  CONSTRAINT valid_target_audience CHECK (target_audience IN ('executive', 'technical', 'operations', 'security', 'all'))
);

-- Report insights for tracking key findings and trends
CREATE TABLE IF NOT EXISTS report_insights (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES system_reports(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL, -- 'achievement', 'concern', 'recommendation', 'trend'
  category VARCHAR(50) NOT NULL, -- 'performance', 'reliability', 'security', 'capacity'
  title VARCHAR(200) NOT NULL,
  description TEXT,
  severity VARCHAR(20), -- 'info', 'warning', 'critical'
  confidence DECIMAL(5,4), -- Confidence in this insight (0-1)
  supporting_data JSONB DEFAULT '{}',
  action_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_insight_type CHECK (insight_type IN ('achievement', 'concern', 'recommendation', 'trend', 'anomaly')),
  CONSTRAINT valid_insight_category CHECK (category IN ('performance', 'reliability', 'security', 'capacity', 'automation', 'general')),
  CONSTRAINT valid_insight_severity CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT valid_insight_confidence CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

-- Report metrics for tracking report quality and effectiveness
CREATE TABLE IF NOT EXISTS report_metrics (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES system_reports(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metric_unit VARCHAR(20),
  baseline_value DECIMAL(10,4),
  threshold_warning DECIMAL(10,4),
  threshold_critical DECIMAL(10,4),
  status VARCHAR(20), -- 'normal', 'warning', 'critical'
  trend VARCHAR(20), -- 'improving', 'stable', 'degrading'
  
  -- Constraints
  CONSTRAINT valid_metric_status CHECK (status IN ('normal', 'warning', 'critical', 'unknown')),
  CONSTRAINT valid_metric_trend CHECK (trend IN ('improving', 'stable', 'degrading', 'unknown'))
);

-- Report delivery log for tracking report distribution
CREATE TABLE IF NOT EXISTS report_delivery_log (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES system_reports(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES report_subscriptions(id) ON DELETE CASCADE,
  delivery_method VARCHAR(20) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL, -- 'pending', 'sent', 'delivered', 'failed'
  recipient VARCHAR(255) NOT NULL,
  delivery_attempts INTEGER DEFAULT 1,
  last_attempt TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  error_message TEXT,
  
  -- Constraints
  CONSTRAINT valid_delivery_status CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_reports_type_created ON system_reports(report_type, created_at);
CREATE INDEX IF NOT EXISTS idx_system_reports_status ON system_reports(system_status);
CREATE INDEX IF NOT EXISTS idx_system_reports_score ON system_reports(overall_score);
CREATE INDEX IF NOT EXISTS idx_system_reports_created_at ON system_reports(created_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON report_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_type_frequency ON report_subscriptions(report_type, frequency);
CREATE INDEX IF NOT EXISTS idx_subscriptions_last_delivered ON report_subscriptions(last_delivered);

CREATE INDEX IF NOT EXISTS idx_templates_report_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON report_templates(active);
CREATE INDEX IF NOT EXISTS idx_templates_default ON report_templates(is_default);

CREATE INDEX IF NOT EXISTS idx_insights_report_id ON report_insights(report_id);
CREATE INDEX IF NOT EXISTS idx_insights_type_category ON report_insights(insight_type, category);
CREATE INDEX IF NOT EXISTS idx_insights_severity ON report_insights(severity);
CREATE INDEX IF NOT EXISTS idx_insights_action_required ON report_insights(action_required);

CREATE INDEX IF NOT EXISTS idx_report_metrics_report_id ON report_metrics(report_id);
CREATE INDEX IF NOT EXISTS idx_report_metrics_name_status ON report_metrics(metric_name, status);

CREATE INDEX IF NOT EXISTS idx_delivery_log_report_id ON report_delivery_log(report_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON report_delivery_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_delivery_log_delivered_at ON report_delivery_log(delivered_at);

-- Add table comments
COMMENT ON TABLE system_reports IS 'Comprehensive system reports including executive summaries and technical analysis';
COMMENT ON TABLE report_subscriptions IS 'Automated report delivery subscriptions';
COMMENT ON TABLE report_templates IS 'Customizable templates for different report types and audiences';
COMMENT ON TABLE report_insights IS 'Key insights, findings, and recommendations extracted from reports';
COMMENT ON TABLE report_metrics IS 'Quantitative metrics and KPIs tracked in reports';
COMMENT ON TABLE report_delivery_log IS 'Log of report delivery attempts and status';

-- Insert default report templates
INSERT INTO report_templates (template_name, report_type, template_config, sections_included, target_audience, is_default) VALUES
('executive_standard', 'executive_summary', 
 '{"focus": "business_impact", "detail_level": "high_level", "include_predictions": true}',
 '["summary", "highlights", "risk_assessment", "recommendations"]',
 'executive', true),
 
('technical_standard', 'technical_deep_dive',
 '{"focus": "technical_details", "detail_level": "comprehensive", "include_raw_data": true}',
 '["performance_analysis", "reliability_analysis", "predictive_insights", "appendix"]',
 'technical', true),
 
('operations_daily', 'performance_analysis',
 '{"focus": "operational_metrics", "detail_level": "detailed", "period_hours": 24}',
 '["performance_overview", "bottlenecks", "remediation_summary"]',
 'operations', true)
ON CONFLICT DO NOTHING;

-- Function to calculate report quality score
CREATE OR REPLACE FUNCTION calculate_report_quality_score(
  p_report_id INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  report_record RECORD;
  quality_score DECIMAL := 0;
  data_quality_weight DECIMAL := 0.4;
  insight_quality_weight DECIMAL := 0.3;
  timeliness_weight DECIMAL := 0.3;
BEGIN
  -- Get report details
  SELECT * INTO report_record FROM system_reports WHERE id = p_report_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Data quality component (0-40 points)
  quality_score := quality_score + (
    COALESCE(report_record.confidence_score, 0) * 
    COALESCE(report_record.data_completeness, 0) * 
    data_quality_weight * 100
  );
  
  -- Insight quality component (0-30 points)
  -- Based on number and confidence of insights
  SELECT 
    COALESCE(AVG(confidence), 0) * 
    LEAST(COUNT(*) / 5.0, 1.0) * -- Normalize to max 5 insights
    insight_quality_weight * 100
  INTO quality_score
  FROM report_insights 
  WHERE report_id = p_report_id;
  
  quality_score := quality_score + COALESCE(quality_score, 0);
  
  -- Timeliness component (0-30 points)
  -- Reports are more valuable when fresh
  quality_score := quality_score + (
    CASE 
      WHEN report_record.created_at >= NOW() - INTERVAL '1 hour' THEN timeliness_weight * 100
      WHEN report_record.created_at >= NOW() - INTERVAL '6 hours' THEN timeliness_weight * 80
      WHEN report_record.created_at >= NOW() - INTERVAL '24 hours' THEN timeliness_weight * 60
      ELSE timeliness_weight * 40
    END
  );
  
  RETURN LEAST(100.0, quality_score);
END;
$$ LANGUAGE plpgsql;

-- Function to extract insights from report data
CREATE OR REPLACE FUNCTION extract_report_insights(
  p_report_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
  report_record RECORD;
  report_data JSONB;
  insight_count INTEGER := 0;
BEGIN
  -- Get report data
  SELECT * INTO report_record FROM system_reports WHERE id = p_report_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  report_data := report_record.report_data;
  
  -- Extract achievements
  IF report_data->'highlights'->'achievements' IS NOT NULL THEN
    INSERT INTO report_insights (
      report_id, insight_type, category, title, description, 
      severity, confidence, action_required
    )
    SELECT 
      p_report_id,
      'achievement',
      'general',
      achievement::TEXT,
      'System achievement identified in automated analysis',
      'info',
      COALESCE(report_record.confidence_score, 0.8),
      false
    FROM jsonb_array_elements_text(report_data->'highlights'->'achievements') AS achievement;
    
    -- Get row count instead of using GET DIAGNOSTICS
    SELECT COUNT(*) INTO insight_count FROM report_insights WHERE report_id = p_report_id;
  END IF;
  
  -- Extract concerns
  IF report_data->'highlights'->'concerns' IS NOT NULL THEN
    INSERT INTO report_insights (
      report_id, insight_type, category, title, description,
      severity, confidence, action_required
    )
    SELECT 
      p_report_id,
      'concern',
      'performance',
      concern::TEXT,
      'System concern identified in automated analysis',
      'warning',
      COALESCE(report_record.confidence_score, 0.8),
      true
    FROM jsonb_array_elements_text(report_data->'highlights'->'concerns') AS concern;
    
    -- Update row count
    SELECT COUNT(*) INTO insight_count FROM report_insights WHERE report_id = p_report_id;
  END IF;
  
  -- Extract recommendations
  IF report_data->'recommendations' IS NOT NULL THEN
    INSERT INTO report_insights (
      report_id, insight_type, category, title, description,
      severity, confidence, action_required
    )
    SELECT 
      p_report_id,
      'recommendation',
      COALESCE(rec->>'category', 'general'),
      COALESCE(rec->>'action', 'Review system configuration'),
      COALESCE(rec->>'rationale', 'Automated recommendation'),
      CASE COALESCE(rec->>'priority', 'medium')
        WHEN 'immediate' THEN 'critical'
        WHEN 'high' THEN 'warning'
        ELSE 'info'
      END,
      COALESCE(report_record.confidence_score, 0.8),
      COALESCE(rec->>'priority', 'medium') IN ('immediate', 'high')
    FROM jsonb_array_elements(report_data->'recommendations') AS rec;
    
    -- Update row count
    SELECT COUNT(*) INTO insight_count FROM report_insights WHERE report_id = p_report_id;
  END IF;
  
  RETURN insight_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old report data
CREATE OR REPLACE FUNCTION cleanup_report_data() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Clean up old reports (keep 90 days for executive, 30 days for technical)
  DELETE FROM system_reports 
  WHERE (report_type = 'executive_summary' AND created_at < NOW() - INTERVAL '90 days')
     OR (report_type != 'executive_summary' AND created_at < NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old delivery logs (keep 30 days)
  DELETE FROM report_delivery_log 
  WHERE last_attempt < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up inactive subscriptions (no delivery in 60 days)
  UPDATE report_subscriptions 
  SET active = FALSE 
  WHERE active = TRUE 
    AND (last_delivered IS NULL OR last_delivered < NOW() - INTERVAL '60 days');
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;