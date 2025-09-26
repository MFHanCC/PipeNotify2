-- Advanced analytics migration
-- Creates tables for Team plan advanced analytics features

-- Executive reports table
CREATE TABLE IF NOT EXISTS executive_reports (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    report_type VARCHAR(50) NOT NULL, -- 'weekly', 'monthly', 'quarterly'
    report_period TIMESTAMPTZ NOT NULL, -- Start of the period being reported
    metrics JSONB NOT NULL, -- Store computed metrics
    summary TEXT, -- Natural language summary
    recommendations TEXT[], -- Array of recommendations
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Team performance metrics table
CREATE TABLE IF NOT EXISTS team_performance (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    metrics JSONB NOT NULL, -- Performance data by user/team
    benchmarks JSONB, -- Industry benchmarks if available
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Predictive analytics table
CREATE TABLE IF NOT EXISTS predictive_analytics (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    prediction_type VARCHAR(50) NOT NULL, -- 'deal_probability', 'pipeline_forecast', etc.
    model_version VARCHAR(20) NOT NULL,
    input_data JSONB NOT NULL,
    predictions JSONB NOT NULL,
    confidence_score DECIMAL(5,4), -- 0-1 confidence level
    expires_at TIMESTAMPTZ, -- When prediction becomes stale
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Analytics exports tracking table
CREATE TABLE IF NOT EXISTS analytics_exports (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    export_type VARCHAR(50) NOT NULL, -- 'csv', 'pdf', 'excel'
    data_range VARCHAR(50) NOT NULL, -- '7d', '30d', '90d', 'custom'
    filter_criteria JSONB, -- What filters were applied
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    file_path TEXT, -- Where the export file is stored
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ, -- When download link expires
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_executive_reports_tenant_period 
    ON executive_reports(tenant_id, report_period DESC);

CREATE INDEX IF NOT EXISTS idx_team_performance_tenant_period 
    ON team_performance(tenant_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_predictive_analytics_tenant_type 
    ON predictive_analytics(tenant_id, prediction_type, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_exports_tenant_status 
    ON analytics_exports(tenant_id, status, created_at DESC);

-- Add updated_at trigger for executive_reports
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_executive_reports_updated_at ON executive_reports;
CREATE TRIGGER update_executive_reports_updated_at 
    BEFORE UPDATE ON executive_reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE executive_reports IS 'Stores pre-computed executive summary reports for Team plan users';
COMMENT ON TABLE team_performance IS 'Team performance metrics and benchmarks for advanced analytics';
COMMENT ON TABLE predictive_analytics IS 'ML-powered predictions and forecasts for Team plan';
COMMENT ON TABLE analytics_exports IS 'Tracks user-requested data exports in various formats';