# Pipenotify User Guide

**Complete guide to using Pipenotify for Pipedrive → Google Chat notifications**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Setting Up Webhooks](#setting-up-webhooks)
4. [Creating Notification Rules](#creating-notification-rules)
5. [Analytics & Performance](#analytics--performance)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Getting Started

### Initial Setup

1. **Connect to Pipedrive**
   - Click "Connect Pipedrive" on the onboarding wizard
   - Authorize Pipenotify to access your Pipedrive data
   - ✅ Green checkmark indicates successful connection

2. **Add Google Chat Webhooks**
   - Navigate to the "Webhooks" section
   - Click "+ Add Webhook"
   - Enter a descriptive name (e.g., "Sales Team Alerts")
   - Paste your Google Chat webhook URL
   - Click "Test" to verify the connection

3. **Create Your First Rule**
   - Go to "Rules" section
   - Click "Create New Rule"
   - Choose an event type (e.g., "Deal Won")
   - Select your webhook destination
   - Set any filters if needed
   - Save and enable the rule

---

## Dashboard Overview

### Main Navigation Tabs

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| **Overview** | System status and quick stats | Active rules, recent notifications, health indicators |
| **Rules** | Manage notification rules | Create, edit, disable/enable rules |
| **Logs** | View delivery history | Success/failure status, timestamps, error details |
| **Webhooks** | Manage Google Chat webhooks | Add, test, manage webhook destinations |
| **Analytics** | Performance insights | Success rates, trends, rule effectiveness |
| **Routing** | Channel-specific routing | Route different events to different channels |
| **Quiet Hours** | Schedule notification breaks | Set times when notifications are paused |
| **Stalled Deals** | Monitor inactive deals | Automated alerts for deals needing attention |

### Status Indicators

- 🟢 **Green**: System healthy, notifications working
- 🟡 **Yellow**: Warnings, reduced performance
- 🔴 **Red**: Critical issues, notifications failing
- ⚫ **Gray**: Disabled or inactive

---

## Setting Up Webhooks

### Creating Google Chat Webhooks

1. **In Google Chat:**
   - Open the space where you want notifications
   - Click the space name → "Manage webhooks"
   - Click "Add webhook"
   - Name it (e.g., "Pipedrive Notifications")
   - Copy the webhook URL

2. **In Pipenotify:**
   - Go to "Webhooks" tab
   - Click "+ Add Webhook"
   - Fill in the form:
     - **Name**: Descriptive name for your team
     - **Webhook URL**: Paste the Google Chat webhook URL
     - **Description**: Optional details about the channel

3. **Test the Connection:**
   - Click "🧪 Test" button
   - Check Google Chat for the test message
   - ✅ Success means your webhook is ready

### Webhook Management

- **View All Webhooks**: See all configured webhooks with their status
- **Test Webhooks**: Send test messages to verify connectivity
- **Edit/Delete**: Manage existing webhook configurations

### Webhook URL Requirements

- Must be a valid Google Chat webhook URL
- Must start with `https://`
- Must contain `chat.googleapis.com`
- Example: `https://chat.googleapis.com/v1/spaces/AAAAXXXXxxx/messages?key=...`

---

## Creating Notification Rules

### Rule Components

Every notification rule has these components:

1. **Name**: Descriptive identifier for the rule
2. **Event Type**: What Pipedrive event triggers the notification
3. **Target Webhook**: Which Google Chat space receives the notification
4. **Template**: How the message appears in chat
5. **Filters**: Conditions that must be met to send the notification
6. **Status**: Enabled/disabled state

### Available Event Types

| Event | Description | When It Triggers |
|-------|-------------|------------------|
| `deal.added` | New deal created | When someone creates a new deal |
| `deal.updated` | Deal information changed | When deal details are modified |
| `deal.stage_changed` | Deal moved to new stage | When deal progresses through pipeline |
| `deal.won` | Deal marked as won | When a deal is successfully closed |
| `deal.lost` | Deal marked as lost | When a deal is lost or cancelled |
| `person.added` | New contact created | When someone adds a new person |
| `activity.added` | New activity scheduled | When activities are created |
| `activity.updated` | Activity modified | When activity details change |

### Message Templates

Choose how your notifications appear:

- **Simple**: Basic information only
- **Compact**: Key details in condensed format
- **Detailed**: Comprehensive information
- **Custom**: Create your own template using variables

### Template Variables

Use these variables in custom templates:

#### Deal Variables
- `{deal.title}` - Deal name
- `{deal.value}` - Deal value with currency
- `{deal.stage}` - Current pipeline stage
- `{deal.owner_name}` - Deal owner name
- `{deal.url}` - Direct link to deal

#### Person Variables
- `{person.name}` - Contact full name
- `{person.email}` - Contact email
- `{person.company}` - Company name
- `{person.url}` - Direct link to person

#### System Variables
- `{event.timestamp}` - When the event occurred
- `{user.name}` - User who triggered the event

### Rule Filters

Apply conditions to control when notifications are sent:

#### Available Filters
- **Pipeline**: Only deals in specific pipelines
- **Stage**: Only deals in certain stages
- **Owner**: Only deals owned by specific users
- **Deal Value**: Minimum or maximum deal values
- **Company**: Only deals from specific organizations

#### Filter Examples

**High-Value Deal Alerts:**
```
Event: deal.updated
Filter: Deal Value ≥ $10,000
Template: Detailed
```

**Won Deal Celebrations:**
```
Event: deal.won
Filter: All deals
Template: Custom: "🎉 {deal.title} won! ${deal.value} by {deal.owner_name}"
```

**Sales Manager Notifications:**
```
Event: deal.stage_changed
Filter: Stage = "Proposal Made"
Template: Compact
```

---

## Analytics & Performance

### Overview Metrics

The Analytics dashboard provides comprehensive insights:

#### Key Performance Indicators
- **Total Notifications**: Number of notifications sent
- **Success Rate**: Percentage of successful deliveries (target: 95%+)
- **Average Response Time**: How quickly notifications are delivered
- **Failure Rate**: Percentage of failed notifications (target: <5%)

#### Performance Trends
- **Time Series Charts**: Visual representation of notification volume and success rates
- **Trend Analysis**: Identify patterns and performance changes over time
- **Health Indicators**: Color-coded status showing system health

### Rule Performance Analysis

#### Top Performing Rules
- See which rules trigger most frequently
- Compare success rates across different rules
- Identify rules that need optimization

#### Rule Effectiveness Metrics
- **Triggers Today**: How often each rule activated
- **Success Rate**: Delivery success for each rule
- **Response Time**: Average delivery speed per rule
- **Trend Indicators**: 📈 Improving, 📉 Declining, ➡️ Stable

### Channel Performance

#### Per-Channel Analytics
- Success rates for each Google Chat webhook
- Response times by channel
- Total delivery counts
- Health status indicators

#### Performance Optimization
- Identify slow or failing channels
- Monitor delivery consistency
- Plan capacity and scaling

### Date Range Filtering

Analyze performance across different timeframes:
- **Last 24 Hours**: Real-time monitoring
- **Last 7 Days**: Weekly trends
- **Last 30 Days**: Monthly patterns
- **Last 90 Days**: Quarterly analysis

---

## Advanced Features

### Channel Routing

Route different types of notifications to specific channels:

1. **Setup Multiple Webhooks**: Create webhooks for different teams/purposes
2. **Create Routing Rules**: 
   - High-value deals → Management channel
   - Won deals → Sales celebration channel
   - Lost deals → Sales review channel
3. **Test Routing**: Verify messages go to correct channels

### Quiet Hours

Prevent notifications during specific hours:

1. **Enable Quiet Hours**: Toggle the feature on
2. **Set Schedule**:
   - Start time (e.g., 6:00 PM)
   - End time (e.g., 9:00 AM)
   - Time zone
3. **Configure Days**: Select which days quiet hours apply
4. **Override Options**: Allow urgent notifications if needed

### Stalled Deal Monitoring

Automatically detect and alert on inactive deals:

#### Configuration
- **Warning Threshold**: Days before first alert (default: 3 days)
- **Stale Threshold**: Days before marked as stale (default: 7 days)
- **Critical Threshold**: Days before critical status (default: 14 days)
- **Minimum Deal Value**: Only monitor deals above this value

#### Alerts
- **Daily Summaries**: Morning reports of stalled deals
- **Individual Alerts**: Immediate notifications when deals stall
- **Channel Selection**: Choose which chat receives alerts

### Bulk Rule Management

Efficiently manage multiple rules:

1. **Select Multiple Rules**: Use checkboxes to select rules
2. **Bulk Actions**:
   - Enable/disable multiple rules
   - Delete multiple rules
   - Change webhook destinations
3. **Import/Export**: Transfer rule configurations
4. **Search & Filter**: Find specific rules quickly

### Template Customization

Create personalized notification messages:

1. **Choose Custom Template**: Select "Custom" template mode
2. **Use Variables**: Insert dynamic content using `{variable.name}` syntax
3. **Preview**: See how your message will look
4. **Test**: Send test notifications to verify formatting

---

## Troubleshooting

### Common Issues

#### "Webhooks Not Receiving Messages"

**Symptoms**: Rules are enabled but no messages appear in Google Chat

**Solutions**:
1. **Test Webhook**: Use the "🧪 Test" button in Webhooks section
2. **Check Webhook URL**: Verify it contains `chat.googleapis.com`
3. **Google Chat Permissions**: Ensure the webhook is still valid
4. **Rule Status**: Confirm rules are enabled (green toggle)

#### "High Failure Rate"

**Symptoms**: Analytics show >5% failure rate

**Solutions**:
1. **Check Individual Webhooks**: Test each webhook separately
2. **Review Error Logs**: Look at specific error messages in Logs section
3. **Regenerate Webhooks**: Create new webhooks in Google Chat if old ones expired
4. **Contact Support**: If issues persist

#### "Rules Not Triggering"

**Symptoms**: Expected events don't generate notifications

**Solutions**:
1. **Verify Pipedrive Connection**: Check OAuth status
2. **Review Rule Filters**: Ensure filters aren't too restrictive
3. **Check Event Types**: Confirm you're monitoring the right events
4. **Test with Simple Rules**: Create a rule without filters to test

#### "Slow Notification Delivery"

**Symptoms**: Long delays between Pipedrive events and chat notifications

**Solutions**:
1. **Check Analytics**: Review response time metrics
2. **Google Chat Status**: Verify Google's services are operational
3. **Webhook Performance**: Test individual webhooks for speed
4. **Contact Support**: For persistent performance issues

### Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Session expired" | Authentication token expired | Log out and log back in |
| "Permission denied" | Insufficient access rights | Check Pipedrive app permissions |
| "Invalid webhook URL" | Webhook URL format incorrect | Verify Google Chat webhook URL |
| "Rate limit exceeded" | Too many API calls | Wait a few minutes, then retry |
| "Network error" | Connection issues | Check internet connection |

### Getting Help

1. **Error Logs**: Check the "Logs" section for detailed error information
2. **Test Functions**: Use built-in test features to isolate issues
3. **Documentation**: Review this guide and API documentation
4. **Support Contact**: Reach out with specific error messages and steps to reproduce

---

## Best Practices

### Rule Organization

#### Naming Conventions
- Use descriptive names: "High Value Deals - Management Alert"
- Include purpose: "Daily Won Deals Summary"
- Add team identifier: "Sales Team - New Leads"

#### Rule Structure
- **Start Simple**: Begin with basic rules, add complexity gradually
- **Test Frequently**: Verify each rule works before creating more
- **Monitor Performance**: Regular check analytics for rule effectiveness
- **Clean Up**: Disable or delete unused rules

### Webhook Management

#### Organization Strategy
- **One Webhook Per Channel**: Don't share webhooks across different purposes
- **Descriptive Names**: "Sales Team General", "Management Alerts", "Deal Celebrations"
- **Regular Testing**: Monthly webhook health checks
- **Backup Webhooks**: Keep spare webhooks for critical channels

#### Security
- **Limit Access**: Only share webhook URLs with authorized team members
- **Regular Rotation**: Regenerate webhooks periodically for security
- **Monitor Usage**: Watch for unexpected notification volumes

### Performance Optimization

#### Rule Efficiency
- **Use Filters Wisely**: More specific filters reduce unnecessary notifications
- **Avoid Overlapping Rules**: Prevent duplicate notifications for same events
- **Template Selection**: Simple templates process faster than complex custom ones

#### Monitoring
- **Weekly Analytics Review**: Check performance trends weekly
- **Error Rate Monitoring**: Address issues when failure rate >2%
- **Response Time Tracking**: Investigate if delivery times >5 seconds

### Team Management

#### Onboarding New Users
1. **Start with Observation**: Let new users observe before creating rules
2. **Training Rules**: Create test rules in development webhooks
3. **Gradual Permissions**: Start with limited access, expand as needed
4. **Documentation**: Maintain team-specific rule documentation

#### Change Management
- **Announce Changes**: Notify team before modifying shared rules
- **Backup Configurations**: Export rule settings before major changes
- **Test in Development**: Use test webhooks before modifying production rules
- **Rollback Plan**: Know how to quickly revert changes if needed

### Compliance & Governance

#### Data Handling
- **Sensitive Information**: Be careful with deal values and customer data in notifications
- **Access Control**: Limit notification access to appropriate team members
- **Retention**: Understand that notification logs are retained for 90 days

#### Audit Trail
- **Rule Changes**: All rule modifications are logged with timestamps and user information
- **Performance History**: Analytics data helps with compliance reporting
- **Error Documentation**: Maintain records of issues and resolutions

---

## Quick Reference

### Essential Actions

| Task | Location | Steps |
|------|----------|-------|
| Add webhook | Webhooks tab | → + Add Webhook → Fill form → Test |
| Create rule | Rules tab | → Create New Rule → Configure → Save |
| Test notification | Rules tab | → Click rule → Test button |
| View delivery status | Logs tab | → Filter by date/status |
| Check performance | Analytics tab | → Select date range |
| Pause notifications | Quiet Hours tab | → Enable → Set schedule |

### Keyboard Shortcuts

- `Ctrl/Cmd + R`: Refresh current view
- `Escape`: Close modal dialogs
- `Tab`: Navigate between form fields
- `Enter`: Submit forms/confirm actions

### Status Codes

- **✅ Success**: Notification delivered successfully
- **❌ Failed**: Delivery failed (check error details)
- **⏳ Pending**: Notification queued for delivery
- **🔄 Retrying**: Attempting redelivery after failure

---

*This guide covers the essential features of Pipenotify. For technical documentation, API details, or advanced configuration, see the Technical Documentation.*

*Last updated: December 2024*