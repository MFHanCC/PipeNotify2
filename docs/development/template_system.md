# Custom Template Engine Documentation

The Pipenotify custom template engine provides powerful variable substitution and formatting capabilities for creating personalized notification templates.

## Overview

The template engine supports:
- **Variable Substitution**: Dynamic content insertion using `{variable.name}` syntax
- **Rich Formatting**: Support for text, markdown, and HTML output formats
- **Default Templates**: Pre-built templates for common event types
- **Validation**: Template syntax validation and variable checking
- **Fallback Values**: Graceful handling of missing data

## Architecture

### Core Components

1. **Template Engine** (`services/templateEngine.js`)
   - Variable extraction and substitution
   - Template validation and processing
   - Default templates for common events

2. **Template Routes** (`routes/templates.js`)
   - RESTful API endpoints for template management
   - CRUD operations for template presets
   - Template testing and validation

3. **Database Schema** (`migrations/008_add_template_support.sql`)
   - Extended notification_rules table with template columns
   - Template presets storage and management
   - Event type mapping and format specifications

4. **Chat Client Integration** (`services/chatClient.js`)
   - Template engine integration for notifications
   - Automatic template selection based on event types
   - Fallback to simple formatting when templates fail

## Variable System

### Available Variables

#### Deal Variables
```
{deal.title} - Deal name/title
{deal.value} - Deal value with formatted currency
{deal.currency} - Currency code (USD, EUR, etc.)
{deal.stage} - Current pipeline stage name
{deal.status} - Deal status (open/won/lost)
{deal.probability} - Win probability percentage
{deal.expected_close_date} - Expected close date
{deal.owner_name} - Deal owner name
{deal.created_date} - Deal creation date
{deal.days_in_stage} - Days in current stage
{deal.url} - Direct link to deal in Pipedrive
```

#### Person Variables
```
{person.name} - Full name
{person.first_name} - First name
{person.last_name} - Last name
{person.email} - Primary email address
{person.phone} - Primary phone number
{person.company} - Company name
{person.title} - Job title
{person.owner_name} - Person owner name
{person.url} - Direct link to person in Pipedrive
```

#### Organization Variables
```
{org.name} - Organization name
{org.owner_name} - Organization owner name
{org.address} - Organization address
{org.people_count} - Number of people
{org.deals_count} - Number of deals
{org.url} - Direct link to organization in Pipedrive
```

#### Activity Variables
```
{activity.subject} - Activity subject
{activity.type} - Activity type
{activity.due_date} - Due date
{activity.due_time} - Due time
{activity.duration} - Duration
{activity.note} - Activity note
{activity.owner_name} - Activity owner name
{activity.url} - Direct link to activity in Pipedrive
```

#### System Variables
```
{event.type} - Webhook event type
{event.timestamp} - Event timestamp
{user.name} - User who triggered event
{user.email} - User email address
{company.name} - Pipedrive company name
```

## Template Examples

### Deal Won Template
```markdown
🎉 **Deal Won!** 🏆

📋 Deal: **{deal.title}**
💰 Value: **{deal.value}**
👤 Owner: {deal.owner_name}
📅 Closed: {event.timestamp}

Time to celebrate! 🥳

[View Deal]({deal.url})
```

### New High-Value Deal Alert
```markdown
🚨 **HIGH-VALUE DEAL ALERT** 🚨

📋 **{deal.title}**
💰 **{deal.value}** 
👤 Owner: {deal.owner_name}
🎯 Stage: {deal.stage}
📊 Probability: {deal.probability}%

This deal requires immediate attention!

[View Deal]({deal.url})
```

### Activity Reminder
```markdown
📅 **Activity Scheduled**

🔄 {activity.subject}
📋 Type: {activity.type}
📅 Due: {activity.due_date} at {activity.due_time}
👤 Owner: {activity.owner_name}

[View Activity]({activity.url})
```

## API Endpoints

### Template Variables
```http
GET /api/v1/templates/variables
```
Returns all available template variables with descriptions.

### Default Templates
```http
GET /api/v1/templates/defaults
GET /api/v1/templates/defaults?event_type=deal.won
```
Get default templates for all or specific event types.

### Template Validation
```http
POST /api/v1/templates/validate
Content-Type: application/json

{
  "template_content": "🎉 Deal Won: {deal.title} worth {deal.value}!"
}
```

### Template Presets Management
```http
# Get presets for a tenant
GET /api/v1/templates/presets/:tenantId

# Create new preset
POST /api/v1/templates/presets/:tenantId
{
  "name": "High Value Deal Alert",
  "description": "Alert for deals over $50k",
  "event_types": ["deal.added", "deal.updated"],
  "template_content": "🚨 High value deal: {deal.title} worth {deal.value}",
  "template_format": "markdown"
}

# Update preset
PUT /api/v1/templates/presets/:tenantId/:presetId

# Delete preset
DELETE /api/v1/templates/presets/:tenantId/:presetId

# Test preset
POST /api/v1/templates/presets/:tenantId/:presetId/test
```

## Template Processing

### Processing Options
```javascript
const processedTemplate = processTemplate(template, webhookData, {
  format: 'text',        // 'text' | 'markdown' | 'html'
  strictMode: false,     // Throw errors for missing variables
  fallbackValues: {      // Default values for missing variables
    'company.name': 'Pipedrive',
    'user.name': 'Unknown User'
  }
});
```

### Format Support

#### Text Format
- Basic variable substitution
- No special formatting
- Safe for all chat platforms

#### Markdown Format
- Converts **bold** and *italic* syntax
- Processes [links](url) format
- Optimized for Google Chat

#### HTML Format
- Converts to HTML tags
- Supports `<strong>`, `<em>`, `<a>` tags
- Line breaks converted to `<br>`

## Feature Gating

Template features are gated by plan:
- **Free Plan**: Simple templates only
- **Starter Plan**: Basic custom templates
- **Pro Plan**: Advanced templates with all variables
- **Team Plan**: Template presets and sharing

## Database Schema

### Template Presets Table
```sql
CREATE TABLE template_presets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  event_types TEXT[] NOT NULL,
  template_content TEXT NOT NULL,
  template_format VARCHAR(10) DEFAULT 'text',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Enhanced Notification Rules
```sql
-- Added columns to notification_rules table
ALTER TABLE notification_rules 
ADD COLUMN template_mode VARCHAR(20) DEFAULT 'simple',
ADD COLUMN custom_template TEXT,
ADD COLUMN template_format VARCHAR(10) DEFAULT 'text';
```

## Error Handling

### Template Validation Errors
- Unmatched braces: `{unclosed` or `unopened}`
- Invalid variable names: `{invalid-format}`
- Unknown variables: `{nonexistent.variable}`

### Processing Errors
- Missing required variables (in strict mode)
- Template engine failures
- Graceful fallback to simple formatting

## Performance Considerations

### Variable Extraction
- Efficient regex-based variable detection
- Cached variable mappings for repeated processing
- Minimal object traversal

### Template Caching
- Default templates are cached in memory
- Variable definitions cached for performance
- Compiled regex patterns reused

## Best Practices

### Template Design
1. **Keep templates concise** - Google Chat has message limits
2. **Use meaningful emojis** - Enhance visual appeal
3. **Include relevant links** - Direct users to Pipedrive
4. **Test with real data** - Validate with actual webhook payloads
5. **Handle missing data** - Provide fallback values

### Variable Usage
1. **Use specific variables** - `{deal.title}` vs `{object.name}`
2. **Format numbers properly** - `{deal.value}` includes currency
3. **Include timestamps** - `{event.timestamp}` for context
4. **Add user attribution** - `{user.name}` for accountability

### Error Prevention
1. **Validate templates** - Use validation endpoint before saving
2. **Test with sample data** - Use test endpoint with realistic data
3. **Monitor template performance** - Watch for processing errors
4. **Update deprecated variables** - Keep templates current

## Migration Guide

### From Simple to Custom Templates

1. **Identify current templates** - Review existing notification rules
2. **Create template presets** - Convert to new template format
3. **Update notification rules** - Set template_mode to 'custom'
4. **Test thoroughly** - Validate with real webhook data
5. **Monitor performance** - Watch for errors and issues

### Template Conversion Example
```javascript
// Old simple format
const oldMessage = "Deal updated: {{object.title}} by {{user.name}}";

// New template format
const newTemplate = `📝 **Deal Updated**
📋 {deal.title}
👤 Updated by: {user.name}
💰 Value: {deal.value}
🎯 Stage: {deal.stage}

[View Deal]({deal.url})`;
```

## Troubleshooting

### Common Issues

1. **Variables not substituting**
   - Check variable name spelling
   - Verify data availability in webhook
   - Use fallback values for optional data

2. **Template validation failing**
   - Check for unmatched braces
   - Verify variable names against available list
   - Test with minimal template first

3. **Formatting not working**
   - Ensure correct template_format setting
   - Test with different format options
   - Check Google Chat markdown support

### Debug Techniques

1. **Use validation endpoint** - Check template syntax
2. **Test with sample data** - Use test endpoint
3. **Check logs** - Monitor template processing errors
4. **Start simple** - Build complexity gradually

## Future Enhancements

### Planned Features
- **Conditional logic** - If/then template statements
- **Loops and arrays** - Process multiple items
- **Custom functions** - Date formatting, calculations
- **Template inheritance** - Base templates with overrides
- **Rich media support** - Images and attachments
- **Multi-language templates** - Internationalization support