-- Pipenotify Database Schema
-- Multi-tenant architecture for Pipedrive → Google Chat integration

-- Enable UUID extension for better IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table - represents each company using the service
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    pipedrive_company_id INTEGER, -- Pipedrive's company ID (nullable for OAuth flow)
    pipedrive_user_id INTEGER, -- Pipedrive user ID from OAuth
    pipedrive_user_name TEXT, -- Pipedrive user name from OAuth
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'trial')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pipedrive_user_id) -- One tenant per Pipedrive user
);

-- Pipedrive connections - OAuth tokens and connection details
CREATE TABLE pipedrive_connections (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, -- OAuth access token
    refresh_token TEXT NOT NULL, -- OAuth refresh token
    api_domain TEXT NOT NULL, -- Pipedrive API domain (e.g., 'company.pipedrive.com')
    expires_at TIMESTAMPTZ NOT NULL, -- Token expiration time
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    UNIQUE(tenant_id) -- One connection per tenant
);

-- Google Chat webhooks - where notifications are sent
CREATE TABLE chat_webhooks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- User-friendly name like "Sales Team"
    webhook_url TEXT NOT NULL, -- Google Chat webhook URL
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification rules - define when and how to send notifications
CREATE TABLE rules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- User-friendly rule name
    event_type TEXT NOT NULL, -- e.g., 'deal.updated', 'person.added'
    filters JSONB NOT NULL DEFAULT '{}', -- Event filtering criteria
    target_webhook_id INTEGER NOT NULL REFERENCES chat_webhooks(id) ON DELETE CASCADE,
    template_mode TEXT DEFAULT 'simple' CHECK (template_mode IN ('simple', 'detailed', 'custom')),
    custom_template TEXT, -- For custom template mode
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1, -- For rule ordering
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification logs - track all notification attempts
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES rules(id) ON DELETE SET NULL,
    webhook_id INTEGER REFERENCES chat_webhooks(id) ON DELETE SET NULL,
    payload JSONB NOT NULL, -- Original webhook payload from Pipedrive
    formatted_message JSONB, -- The message sent to Google Chat
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'retry', 'skipped')),
    error_message TEXT,
    response_code INTEGER,
    response_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery attempts - for retry logic
CREATE TABLE delivery_attempts (
    id SERIAL PRIMARY KEY,
    log_id INTEGER NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    response_code INTEGER,
    response_time_ms INTEGER,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tenants_pipedrive_user_id ON tenants(pipedrive_user_id);
CREATE INDEX idx_pipedrive_connections_tenant_id ON pipedrive_connections(tenant_id);
CREATE INDEX idx_chat_webhooks_tenant_id ON chat_webhooks(tenant_id);
CREATE INDEX idx_rules_tenant_id ON rules(tenant_id);
CREATE INDEX idx_rules_event_type ON rules(event_type);
CREATE INDEX idx_rules_enabled ON rules(enabled);
CREATE INDEX idx_logs_tenant_id ON logs(tenant_id);
CREATE INDEX idx_logs_rule_id ON logs(rule_id);
CREATE INDEX idx_logs_status ON logs(status);
CREATE INDEX idx_logs_created_at ON logs(created_at);
CREATE INDEX idx_delivery_attempts_log_id ON delivery_attempts(log_id);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_webhooks_updated_at BEFORE UPDATE ON chat_webhooks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipedrive_connections_updated_at BEFORE UPDATE ON pipedrive_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for development
INSERT INTO tenants (company_name, pipedrive_company_id) VALUES 
('Acme Corp', 12345),
('Tech Startup', 67890);

INSERT INTO chat_webhooks (tenant_id, name, webhook_url, description) VALUES 
(1, 'Sales Team', 'https://chat.googleapis.com/v1/spaces/SAMPLE/messages?key=SAMPLE', 'Main sales team notifications'),
(1, 'Management', 'https://chat.googleapis.com/v1/spaces/SAMPLE2/messages?key=SAMPLE2', 'Executive notifications'),
(2, 'All Hands', 'https://chat.googleapis.com/v1/spaces/SAMPLE3/messages?key=SAMPLE3', 'Company-wide updates');

INSERT INTO rules (tenant_id, name, event_type, filters, target_webhook_id, template_mode, enabled) VALUES 
(1, 'Deal Won Notification', 'deal.updated', '{"status": ["won"]}', 1, 'detailed', true),
(1, 'Large Deal Alert', 'deal.updated', '{"value": {"min": 10000}}', 2, 'detailed', true),
(1, 'New Person Added', 'person.added', '{}', 1, 'simple', true),
(2, 'All Deal Updates', 'deal.updated', '{}', 3, 'simple', true);

-- Comments for documentation
COMMENT ON TABLE tenants IS 'Companies using the Pipenotify service';
COMMENT ON TABLE pipedrive_connections IS 'OAuth connections to Pipedrive API';
COMMENT ON TABLE chat_webhooks IS 'Google Chat webhook endpoints for notifications';
COMMENT ON TABLE rules IS 'Notification rules defining when and how to send messages';
COMMENT ON TABLE logs IS 'Audit log of all notification attempts';
COMMENT ON TABLE delivery_attempts IS 'Detailed retry attempts for failed notifications';

-- Grant permissions (adjust as needed for your environment)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pipenotify_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pipenotify_app;