-- Migration: Add custom template support to notification rules
-- Allows users to create personalized notification templates with variables

-- Add template columns to rules table
ALTER TABLE rules 
ADD COLUMN IF NOT EXISTS template_mode VARCHAR(20) DEFAULT 'simple',
ADD COLUMN IF NOT EXISTS custom_template TEXT,
ADD COLUMN IF NOT EXISTS template_format VARCHAR(10) DEFAULT 'text';

-- Add constraint for template_mode (drop if exists to avoid conflicts)
ALTER TABLE rules DROP CONSTRAINT IF EXISTS valid_template_mode;
ALTER TABLE rules 
ADD CONSTRAINT valid_template_mode 
CHECK (template_mode IN ('simple', 'card', 'custom'));

-- Add constraint for template_format (drop if exists to avoid conflicts)
ALTER TABLE rules DROP CONSTRAINT IF EXISTS valid_template_format;
ALTER TABLE rules
ADD CONSTRAINT valid_template_format
CHECK (template_format IN ('text', 'markdown', 'html'));

-- Create template_presets table for storing reusable templates
CREATE TABLE IF NOT EXISTS template_presets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  event_types TEXT[] NOT NULL, -- Array of event types this template supports
  template_content TEXT NOT NULL,
  template_format VARCHAR(10) DEFAULT 'text',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_tenant_template_name UNIQUE (tenant_id, name),
  CONSTRAINT valid_preset_format CHECK (template_format IN ('text', 'markdown', 'html')),
  CONSTRAINT non_empty_template CHECK (LENGTH(TRIM(template_content)) > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_template_presets_tenant_id ON template_presets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_template_presets_event_types ON template_presets USING GIN(event_types);
CREATE INDEX IF NOT EXISTS idx_template_presets_active ON template_presets(tenant_id, is_active) WHERE is_active = true;

-- Add updated_at trigger for template_presets
CREATE OR REPLACE FUNCTION update_template_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_template_presets_updated_at ON template_presets;
CREATE TRIGGER update_template_presets_updated_at
  BEFORE UPDATE ON template_presets
  FOR EACH ROW
  EXECUTE PROCEDURE update_template_presets_updated_at();

-- Insert default template presets for common use cases
INSERT INTO template_presets (tenant_id, name, description, event_types, template_content, template_format) VALUES 
(1, 'Deal Won Celebration', 'Celebratory template for won deals', ARRAY['deal.won'], 
'🎉 **Deal Won!** 🏆

📋 Deal: **{deal.title}**
💰 Value: **{deal.value}**
👤 Owner: {deal.owner_name}
📅 Closed: {event.timestamp}

Time to celebrate! 🥳

[View Deal]({deal.url})', 'markdown'),

(1, 'New High-Value Deal Alert', 'Alert template for high-value new deals', ARRAY['deal.added'], 
'🚨 **HIGH-VALUE DEAL ALERT** 🚨

📋 **{deal.title}**
💰 **{deal.value}** 
👤 Owner: {deal.owner_name}
🎯 Stage: {deal.stage}
📊 Probability: {deal.probability}%

This deal requires immediate attention!

[View Deal]({deal.url})', 'markdown'),

(1, 'Activity Reminder', 'Simple reminder for upcoming activities', ARRAY['activity.added'], 
'📅 **Activity Scheduled**

🔄 {activity.subject}
📋 Type: {activity.type}
📅 Due: {activity.due_date} at {activity.due_time}
👤 Owner: {activity.owner_name}

[View Activity]({activity.url})', 'markdown'),

(1, 'New Contact Welcome', 'Welcome template for new contacts', ARRAY['person.added'], 
'👋 **Welcome New Contact!**

👤 {person.name}
🏢 {person.company}
💼 {person.title}
📧 {person.email}

Let''s make a great first impression!

[View Contact]({person.url})', 'markdown'),

(1, 'Deal Stage Change', 'Template for deal stage updates', ARRAY['deal.updated'], 
'📈 **Deal Progress Update**

📋 {deal.title}
🎯 New Stage: **{deal.stage}**
💰 Value: {deal.value}
📊 Probability: {deal.probability}%
👤 Owner: {deal.owner_name}
📅 Days in stage: {deal.days_in_stage}

[View Deal]({deal.url})', 'markdown');

-- Add comments for documentation
COMMENT ON TABLE template_presets IS 'Stores reusable notification templates for different event types';
COMMENT ON COLUMN template_presets.tenant_id IS 'Foreign key to tenants table';
COMMENT ON COLUMN template_presets.name IS 'Human-readable template name';
COMMENT ON COLUMN template_presets.description IS 'Template description and use case';
COMMENT ON COLUMN template_presets.event_types IS 'Array of Pipedrive event types this template supports';
COMMENT ON COLUMN template_presets.template_content IS 'Template content with variable placeholders';
COMMENT ON COLUMN template_presets.template_format IS 'Output format: text, markdown, or html';

COMMENT ON COLUMN rules.template_mode IS 'Template mode: simple (auto-generated), card (rich format), or custom (user-defined)';
COMMENT ON COLUMN rules.custom_template IS 'Custom template content with variable substitution';
COMMENT ON COLUMN rules.template_format IS 'Template output format for rendering';

-- Template variable examples for documentation:
/*
Available template variables:

DEAL VARIABLES:
- {deal.title} - Deal name
- {deal.value} - Deal value with currency  
- {deal.currency} - Currency code
- {deal.stage} - Current pipeline stage
- {deal.status} - Deal status (open/won/lost)
- {deal.probability} - Win probability percentage
- {deal.expected_close_date} - Expected close date
- {deal.owner_name} - Deal owner name
- {deal.created_date} - Deal creation date
- {deal.days_in_stage} - Days in current stage
- {deal.url} - Direct link to deal

PERSON VARIABLES:
- {person.name} - Full name
- {person.first_name} - First name  
- {person.last_name} - Last name
- {person.email} - Primary email
- {person.phone} - Primary phone
- {person.company} - Company name
- {person.title} - Job title
- {person.url} - Direct link to person

ORGANIZATION VARIABLES:
- {org.name} - Organization name
- {org.owner_name} - Organization owner
- {org.address} - Organization address
- {org.people_count} - Number of people
- {org.deals_count} - Number of deals
- {org.url} - Direct link to organization

ACTIVITY VARIABLES:
- {activity.subject} - Activity subject
- {activity.type} - Activity type
- {activity.due_date} - Due date
- {activity.due_time} - Due time
- {activity.duration} - Duration
- {activity.note} - Activity note
- {activity.owner_name} - Activity owner
- {activity.url} - Direct link to activity

SYSTEM VARIABLES:
- {event.type} - Webhook event type
- {event.timestamp} - Event timestamp
- {user.name} - User who triggered event
- {user.email} - User email address
- {company.name} - Pipedrive company name

EXAMPLE TEMPLATES:

Deal Won Template:
🎉 Deal Won! 
📋 **{deal.title}**
💰 **{deal.value}** 🏆
👤 Owner: {deal.owner_name}
[View Deal]({deal.url})

New Contact Template:
👤 New Contact: {person.name}
🏢 Company: {person.company}
💼 Title: {person.title}
📧 Email: {person.email}
[View Contact]({person.url})
*/