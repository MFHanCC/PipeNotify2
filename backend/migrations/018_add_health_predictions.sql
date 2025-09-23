-- Migration: Add health prediction and forecasting tables
-- Supports predictive health forecasting, risk assessment, and ML-based predictions

-- Health predictions storage for forecast results
CREATE TABLE IF NOT EXISTS health_predictions (
  id SERIAL PRIMARY KEY,
  prediction_data JSONB NOT NULL, -- Complete prediction results
  overall_status VARCHAR(20) NOT NULL, -- 'healthy', 'warning', 'critical'
  critical_risks INTEGER DEFAULT 0,
  warning_risks INTEGER DEFAULT 0,
  average_confidence DECIMAL(5,4), -- 0.0000 to 1.0000
  prediction_horizon_hours INTEGER DEFAULT 24,
  data_points_used INTEGER,
  model_version VARCHAR(20) DEFAULT 'v1.0',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_prediction_status CHECK (overall_status IN ('healthy', 'warning', 'critical', 'unknown')),
  CONSTRAINT valid_confidence CHECK (average_confidence >= 0.0 AND average_confidence <= 1.0)
);

-- Risk assessments from predictions
CREATE TABLE IF NOT EXISTS prediction_risks (
  id SERIAL PRIMARY KEY,
  prediction_id INTEGER REFERENCES health_predictions(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL,
  risk_severity VARCHAR(20) NOT NULL,
  risk_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
  confidence DECIMAL(5,4) NOT NULL,
  current_value DECIMAL(10,4),
  predicted_value DECIMAL(10,4),
  threshold_value DECIMAL(10,4),
  time_to_impact_hours DECIMAL(8,2), -- Hours until the risk materializes
  description TEXT,
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_risk_severity CHECK (risk_severity IN ('info', 'warning', 'critical')),
  CONSTRAINT valid_risk_score CHECK (risk_score >= 0.0 AND risk_score <= 1.0),
  CONSTRAINT valid_prediction_confidence CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

-- Model performance tracking for prediction accuracy
CREATE TABLE IF NOT EXISTS prediction_model_performance (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(50) NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  prediction_horizon_hours INTEGER NOT NULL,
  total_predictions INTEGER DEFAULT 0,
  accurate_predictions INTEGER DEFAULT 0, -- Within acceptable error range
  average_error DECIMAL(10,4),
  error_variance DECIMAL(10,4),
  accuracy_percentage DECIMAL(5,2), -- 0.00 to 100.00
  last_evaluation TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint per model-metric-horizon combination
  UNIQUE(model_name, metric_name, prediction_horizon_hours)
);

-- Prediction alerts for automated notification of high-risk predictions
CREATE TABLE IF NOT EXISTS prediction_alerts (
  id SERIAL PRIMARY KEY,
  prediction_id INTEGER REFERENCES health_predictions(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'risk_detected', 'threshold_exceeded', 'model_degradation'
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  affected_metrics JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMP,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_alert_severity CHECK (severity IN ('info', 'warning', 'critical', 'emergency'))
);

-- Time series patterns for seasonality and trend detection
CREATE TABLE IF NOT EXISTS time_series_patterns (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(50) NOT NULL,
  pattern_type VARCHAR(30) NOT NULL, -- 'trend', 'seasonal', 'anomaly', 'cycle'
  pattern_data JSONB NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  pattern_strength DECIMAL(5,4), -- How strong the pattern is (0-1)
  
  -- Constraints
  CONSTRAINT valid_pattern_type CHECK (pattern_type IN ('trend', 'seasonal', 'anomaly', 'cycle', 'baseline')),
  CONSTRAINT valid_pattern_confidence CHECK (confidence >= 0.0 AND confidence <= 1.0),
  CONSTRAINT valid_pattern_strength CHECK (pattern_strength >= 0.0 AND pattern_strength <= 1.0)
);

-- Prediction model configurations and parameters
CREATE TABLE IF NOT EXISTS prediction_model_configs (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(50) NOT NULL UNIQUE,
  model_type VARCHAR(30) NOT NULL, -- 'linear', 'exponential', 'seasonal', 'ensemble'
  parameters JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  min_data_points INTEGER DEFAULT 20,
  max_prediction_horizon_hours INTEGER DEFAULT 72,
  accuracy_threshold DECIMAL(5,4) DEFAULT 0.7,
  last_trained TIMESTAMP,
  training_data_points INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_model_type CHECK (model_type IN ('linear', 'exponential', 'seasonal', 'ensemble', 'moving_average')),
  CONSTRAINT valid_accuracy_threshold CHECK (accuracy_threshold >= 0.0 AND accuracy_threshold <= 1.0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON health_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON health_predictions(overall_status);
CREATE INDEX IF NOT EXISTS idx_predictions_confidence ON health_predictions(average_confidence);

CREATE INDEX IF NOT EXISTS idx_prediction_risks_prediction_id ON prediction_risks(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_risks_severity ON prediction_risks(risk_severity);
CREATE INDEX IF NOT EXISTS idx_prediction_risks_metric ON prediction_risks(metric_name);
CREATE INDEX IF NOT EXISTS idx_prediction_risks_time_to_impact ON prediction_risks(time_to_impact_hours);

CREATE INDEX IF NOT EXISTS idx_model_performance_model_metric ON prediction_model_performance(model_name, metric_name);
CREATE INDEX IF NOT EXISTS idx_model_performance_accuracy ON prediction_model_performance(accuracy_percentage);

CREATE INDEX IF NOT EXISTS idx_prediction_alerts_severity ON prediction_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_prediction_alerts_acknowledged ON prediction_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_prediction_alerts_created_at ON prediction_alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_time_series_patterns_metric ON time_series_patterns(metric_name);
CREATE INDEX IF NOT EXISTS idx_time_series_patterns_type ON time_series_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_time_series_patterns_validity ON time_series_patterns(valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_model_configs_enabled ON prediction_model_configs(enabled);

-- Add table comments
COMMENT ON TABLE health_predictions IS 'Stored health prediction results and forecasts';
COMMENT ON TABLE prediction_risks IS 'Risk assessments derived from health predictions';
COMMENT ON TABLE prediction_model_performance IS 'Tracking accuracy and performance of prediction models';
COMMENT ON TABLE prediction_alerts IS 'Automated alerts generated from high-risk predictions';
COMMENT ON TABLE time_series_patterns IS 'Detected patterns in time series data for better predictions';
COMMENT ON TABLE prediction_model_configs IS 'Configuration and parameters for prediction models';

-- Insert default model configurations
INSERT INTO prediction_model_configs (model_name, model_type, parameters, enabled) VALUES
('linear_regression', 'linear', '{"window_size": 24, "min_confidence": 0.7}', true),
('moving_average', 'moving_average', '{"window_size": 24, "alpha": 0.3}', true),
('exponential_smoothing', 'exponential', '{"alpha": 0.3, "beta": 0.1, "gamma": 0.1}', true),
('seasonal_decomposition', 'seasonal', '{"seasonality_period": 24, "trend_window": 168}', true),
('ensemble_model', 'ensemble', '{"models": ["linear", "exponential", "seasonal"], "weighting": "confidence"}', true)
ON CONFLICT DO NOTHING;

-- Function to evaluate prediction accuracy
CREATE OR REPLACE FUNCTION evaluate_prediction_accuracy(
  p_prediction_id INTEGER,
  p_actual_values JSONB
) RETURNS VOID AS $$
DECLARE
  prediction_record RECORD;
  prediction_data JSONB;
  metric_name TEXT;
  predicted_value DECIMAL;
  actual_value DECIMAL;
  error_rate DECIMAL;
  is_accurate BOOLEAN;
BEGIN
  -- Get the prediction record
  SELECT * INTO prediction_record FROM health_predictions WHERE id = p_prediction_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  prediction_data := prediction_record.prediction_data;
  
  -- Evaluate each metric prediction
  FOR metric_name IN SELECT jsonb_object_keys(prediction_data->'predictions')
  LOOP
    -- Get predicted value (using short-term prediction)
    predicted_value := (prediction_data->'predictions'->metric_name->'shortTerm'->>'prediction')::DECIMAL;
    actual_value := (p_actual_values->>metric_name)::DECIMAL;
    
    IF predicted_value IS NOT NULL AND actual_value IS NOT NULL THEN
      -- Calculate error rate
      error_rate := ABS(predicted_value - actual_value) / GREATEST(actual_value, 1);
      is_accurate := error_rate <= 0.2; -- 20% error threshold
      
      -- Update model performance
      UPDATE prediction_model_performance 
      SET 
        total_predictions = total_predictions + 1,
        accurate_predictions = accurate_predictions + CASE WHEN is_accurate THEN 1 ELSE 0 END,
        average_error = (average_error * total_predictions + error_rate) / (total_predictions + 1),
        accuracy_percentage = (accurate_predictions + CASE WHEN is_accurate THEN 1 ELSE 0 END) * 100.0 / (total_predictions + 1),
        last_evaluation = NOW()
      WHERE model_name = 'ensemble_model' AND metric_name = evaluate_prediction_accuracy.metric_name;
      
      -- Insert if not exists
      INSERT INTO prediction_model_performance (
        model_name, metric_name, prediction_horizon_hours,
        total_predictions, accurate_predictions, average_error, accuracy_percentage
      ) VALUES (
        'ensemble_model', evaluate_prediction_accuracy.metric_name, 6,
        1, CASE WHEN is_accurate THEN 1 ELSE 0 END, error_rate,
        CASE WHEN is_accurate THEN 100.0 ELSE 0.0 END
      ) ON CONFLICT (model_name, metric_name, prediction_horizon_hours) DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate prediction alerts
CREATE OR REPLACE FUNCTION generate_prediction_alerts(
  p_prediction_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
  prediction_record RECORD;
  risk_record RECORD;
  alert_count INTEGER := 0;
BEGIN
  -- Get the prediction
  SELECT * INTO prediction_record FROM health_predictions WHERE id = p_prediction_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Create alerts for critical risks
  FOR risk_record IN 
    SELECT * FROM prediction_risks 
    WHERE prediction_id = p_prediction_id AND risk_severity = 'critical'
  LOOP
    INSERT INTO prediction_alerts (
      prediction_id, alert_type, severity, title, message,
      affected_metrics, recommended_actions
    ) VALUES (
      p_prediction_id,
      'risk_detected',
      'critical',
      'Critical Risk Predicted: ' || risk_record.metric_name,
      risk_record.description,
      jsonb_build_array(risk_record.metric_name),
      risk_record.recommendations
    );
    
    alert_count := alert_count + 1;
  END LOOP;
  
  -- Create alert for overall system degradation
  IF prediction_record.overall_status = 'critical' THEN
    INSERT INTO prediction_alerts (
      prediction_id, alert_type, severity, title, message,
      recommended_actions
    ) VALUES (
      p_prediction_id,
      'threshold_exceeded',
      'critical',
      'System Degradation Predicted',
      'Multiple critical risks detected in health forecast',
      jsonb_build_array('Review system capacity', 'Check resource utilization', 'Prepare incident response')
    );
    
    alert_count := alert_count + 1;
  END IF;
  
  RETURN alert_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old prediction data
CREATE OR REPLACE FUNCTION cleanup_prediction_data() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Clean up old predictions (keep 30 days)
  DELETE FROM health_predictions 
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up acknowledged alerts older than 7 days
  DELETE FROM prediction_alerts 
  WHERE acknowledged = TRUE AND acknowledged_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up expired patterns
  DELETE FROM time_series_patterns 
  WHERE valid_until IS NOT NULL AND valid_until < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old model performance data (keep 90 days of history)
  DELETE FROM prediction_model_performance 
  WHERE last_evaluation < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;