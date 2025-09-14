# Pipenotify Troubleshooting Guide

**Quick solutions for common issues and comprehensive debugging procedures**

---

## Table of Contents

1. [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Error Code Reference](#error-code-reference)
4. [Debugging Procedures](#debugging-procedures)
5. [Performance Issues](#performance-issues)
6. [Integration Problems](#integration-problems)
7. [Support Resources](#support-resources)

---

## Quick Diagnostic Checklist

### Before You Start

**Essential Information to Gather:**
- Error messages (exact text and screenshots)
- When the issue started occurring
- What actions trigger the problem
- Which browser/device you're using
- Recent changes to your setup

### 5-Minute Health Check

✅ **Step 1: System Status**
- Go to Dashboard → Overview tab
- Check system health indicators (should be green 🟢)
- Verify "Last Updated" timestamp is recent

✅ **Step 2: Pipedrive Connection**
- Go to Onboarding tab or Dashboard
- Look for green ✅ next to "Pipedrive Connected"
- If red ❌, click "Reconnect to Pipedrive"

✅ **Step 3: Webhook Status**
- Go to Webhooks tab
- Click "🧪 Test" on each webhook
- Verify test messages appear in Google Chat

✅ **Step 4: Active Rules**
- Go to Rules tab
- Confirm rules are enabled (green toggle switch)
- Check "Last Triggered" column for recent activity

✅ **Step 5: Recent Logs**
- Go to Logs tab
- Look for recent entries with "✅ Success" status
- Check for any "❌ Failed" entries

---

## Common Issues & Solutions

### 🚫 Notifications Not Appearing in Google Chat

**Symptoms:**
- Rules are enabled but no messages in chat
- Analytics show notifications as "delivered"
- No obvious error messages

**Quick Fixes:**
1. **Test Webhook Connection**
   ```
   → Go to Webhooks tab
   → Click "🧪 Test" button
   → Check Google Chat for test message
   ```

2. **Verify Webhook URL**
   ```
   → Must contain "chat.googleapis.com"
   → Must start with "https://"
   → Should be from the correct Google Chat space
   ```

3. **Check Google Chat Space Settings**
   ```
   → Ensure you have permission to receive webhooks
   → Verify the space still exists
   → Check if webhook was disabled in Google Chat
   ```

**Advanced Solutions:**
- Regenerate webhook in Google Chat and update URL
- Check if Google Chat space was archived or deleted
- Verify webhook hasn't exceeded Google's rate limits

---

### ⚠️ High Failure Rate (>5%)

**Symptoms:**
- Analytics dashboard shows red ⚠️ failure indicators
- Many notifications marked as "Failed" in logs
- Poor success rate metrics

**Diagnostic Steps:**
1. **Check Error Details**
   ```
   → Go to Logs tab
   → Filter by "Failed" status
   → Read error messages in "Details" column
   ```

2. **Test Individual Webhooks**
   ```
   → Go to Webhooks tab
   → Test each webhook separately
   → Identify which ones are failing
   ```

3. **Common Error Messages:**
   - `"webhook_url_invalid"` → Webhook URL format issue
   - `"space_not_found"` → Google Chat space was deleted
   - `"rate_limit_exceeded"` → Too many messages sent
   - `"network_timeout"` → Google Chat temporary unavailability

**Solutions by Error Type:**

| Error | Solution |
|-------|----------|
| Invalid webhook URL | Regenerate webhook in Google Chat |
| Space not found | Create new webhook in active space |
| Rate limit exceeded | Enable quiet hours or reduce rule frequency |
| Network timeout | Check Google Chat status, usually resolves automatically |

---

### 🔄 Rules Not Triggering

**Symptoms:**
- Expected Pipedrive events don't generate notifications
- "Last Triggered" shows old dates or "Never"
- Analytics show low notification volume

**Step-by-Step Diagnosis:**

1. **Verify Pipedrive Connection**
   ```
   → Check for green ✅ "Pipedrive Connected" status
   → If red ❌, click "Reconnect to Pipedrive"
   → Complete OAuth flow if prompted
   ```

2. **Review Rule Configuration**
   ```
   → Go to Rules tab
   → Click "Edit" on non-triggering rule
   → Verify event type matches your actions in Pipedrive
   → Check if filters are too restrictive
   ```

3. **Test with Simple Rule**
   ```
   → Create new rule with these settings:
     - Event Type: "Deal Updated"
     - No filters
     - Any active webhook
   → Make a test change to any deal in Pipedrive
   → Check if notification appears
   ```

4. **Check Rule Filters**
   ```
   Common filter issues:
   → Pipeline filter set to wrong pipeline
   → Owner filter set to inactive user
   → Deal value filter set too high
   → Stage filter set to unused stage
   ```

**Quick Test Procedure:**
```
1. Go to Pipedrive
2. Open any deal
3. Change the deal stage
4. Wait 1-2 minutes
5. Check Google Chat for notification
6. If no notification, check Logs tab for errors
```

---

### 🐌 Slow Notification Delivery

**Symptoms:**
- Long delays between Pipedrive action and chat notification
- Analytics show high average response time (>5 seconds)
- Users report "late" notifications

**Performance Diagnosis:**

1. **Check Response Time Metrics**
   ```
   → Go to Analytics tab
   → Look at "Avg Response Time" metric
   → Good: <2 seconds | Warning: 2-5 seconds | Critical: >5 seconds
   ```

2. **Identify Bottlenecks**
   ```
   → Go to Analytics → Channel Performance tab
   → Compare response times across different webhooks
   → Identify consistently slow channels
   ```

3. **Test Individual Components**
   ```
   → Use webhook test function (should be instant)
   → Create simple rule without complex filters
   → Check if specific event types are slower
   ```

**Common Causes & Solutions:**

| Cause | Symptoms | Solution |
|-------|----------|----------|
| Google Chat API slowness | All webhooks slow | Wait for Google to resolve, check status.google.com |
| Complex rule filters | Specific rules slow | Simplify filters, reduce JSON complexity |
| Database performance | All operations slow | Contact support, may need scaling |
| High volume processing | Slow during peak hours | Enable quiet hours during busy periods |

---

### 🔐 Authentication & Access Issues

**Symptoms:**
- "Session expired" messages
- "Permission denied" errors
- Unable to access certain features

**Authentication Troubleshooting:**

1. **Clear Session & Re-login**
   ```
   → Log out completely
   → Clear browser cache and cookies
   → Log back in with fresh session
   ```

2. **Check Pipedrive Permissions**
   ```
   → Go to Pipedrive → Settings → Personal preferences → Authorized apps
   → Find "Pipenotify" in the list
   → Verify permissions include "Read deals", "Read activities", etc.
   → If missing, revoke and re-authorize
   ```

3. **Browser-Specific Issues**
   ```
   → Try incognito/private browsing mode
   → Disable browser extensions temporarily
   → Clear localStorage and sessionStorage
   → Try different browser
   ```

**Permission Levels:**
- **Admin**: Full access to all features
- **User**: Can view and create rules, limited webhook management
- **Viewer**: Read-only access to dashboard and logs

---

### 📱 Mobile & Browser Compatibility

**Symptoms:**
- Layout appears broken on mobile
- Buttons not working properly
- Features missing on certain browsers

**Browser Support:**
- ✅ **Fully Supported**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- ⚠️ **Limited Support**: Internet Explorer (not recommended)
- 📱 **Mobile**: Responsive design works on all modern mobile browsers

**Mobile-Specific Issues:**
1. **Layout Problems**
   ```
   → Try rotating device (portrait/landscape)
   → Zoom out to see full interface
   → Refresh page to reload responsive styles
   ```

2. **Touch Interface Issues**
   ```
   → Ensure you're tapping, not long-pressing
   → Try double-tap on unresponsive elements
   → Use latest mobile browser version
   ```

---

## Error Code Reference

### HTTP Status Codes

| Code | Meaning | Common Causes | Solution |
|------|---------|---------------|----------|
| 401 | Unauthorized | Token expired, invalid login | Re-authenticate |
| 403 | Forbidden | Insufficient permissions | Check user role |
| 404 | Not Found | Resource doesn't exist | Verify URL/ID |
| 429 | Rate Limited | Too many requests | Wait and retry |
| 500 | Server Error | Backend problem | Contact support |
| 503 | Service Unavailable | Maintenance mode | Check status page |

### Application Error Codes

#### WEBHOOK_ERRORS
- `WEBHOOK_URL_INVALID`: Malformed Google Chat webhook URL
- `WEBHOOK_UNREACHABLE`: Cannot connect to Google Chat
- `WEBHOOK_RATE_LIMITED`: Google Chat rate limit exceeded
- `WEBHOOK_SPACE_NOT_FOUND`: Google Chat space deleted/archived

#### RULE_ERRORS
- `RULE_FILTER_INVALID`: Rule filter syntax error
- `RULE_EVENT_TYPE_INVALID`: Unsupported event type
- `RULE_TEMPLATE_ERROR`: Template rendering failed
- `RULE_DISABLED`: Rule is disabled but triggered

#### AUTH_ERRORS
- `TOKEN_EXPIRED`: JWT token has expired
- `TOKEN_INVALID`: JWT token malformed or tampered
- `PIPEDRIVE_AUTH_FAILED`: Pipedrive OAuth failed
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions

---

## Debugging Procedures

### Comprehensive Diagnostic Process

#### Phase 1: Initial Assessment
1. **Reproduce the Issue**
   ```
   → Document exact steps to trigger problem
   → Note any error messages or unusual behavior
   → Test in incognito mode to rule out browser issues
   ```

2. **Check System Health**
   ```
   → Dashboard → Overview → System health indicators
   → Analytics → Check recent performance metrics
   → Logs → Look for patterns in recent failures
   ```

3. **Gather Environmental Information**
   ```
   → Browser version and operating system
   → Network connection quality
   → Time zone and current time
   → Recent changes to setup
   ```

#### Phase 2: Component Isolation
1. **Test Individual Components**
   ```
   → Webhook connectivity (test buttons)
   → Pipedrive connection (try reconnecting)
   → Rule logic (create simple test rule)
   → Template rendering (test with basic template)
   ```

2. **Identify Scope of Issue**
   ```
   → Single rule vs. all rules
   → Specific webhook vs. all webhooks
   → Particular event types vs. all events
   → One user vs. multiple users
   ```

#### Phase 3: Advanced Diagnostics
1. **Deep Log Analysis**
   ```
   → Go to Logs tab
   → Apply filters to narrow down timeframe
   → Look for error patterns or correlations
   → Check response times for performance issues
   ```

2. **Rule Testing Matrix**
   ```
   Create test rules with these combinations:
   → Simple event + no filters + working webhook
   → Complex event + no filters + working webhook
   → Simple event + basic filters + working webhook
   → Simple event + no filters + new webhook
   ```

3. **Network Diagnostics**
   ```
   → Check browser developer tools (F12) → Network tab
   → Look for failed requests (red entries)
   → Check request/response details
   → Verify API endpoints are reachable
   ```

### Data Collection for Support

When contacting support, provide this information:

**Issue Details:**
- Exact error message or description
- Steps to reproduce the problem
- When the issue started
- Frequency (always, sometimes, once)

**Technical Information:**
```
Browser: Chrome 96.0.4664.110
OS: Windows 10
Tenant ID: [from JWT token or URL]
Affected Rules: [list rule names/IDs]
Error Logs: [copy relevant log entries]
```

**Screenshots:**
- Error messages or unexpected behavior
- Rule configuration screens
- Log entries showing failures
- Analytics dashboard showing issues

---

## Performance Issues

### Dashboard Loading Slowly

**Symptoms:**
- Long load times on initial page access
- Slow navigation between tabs
- Unresponsive interface

**Optimization Steps:**
1. **Browser Optimization**
   ```
   → Clear browser cache and cookies
   → Disable unnecessary browser extensions
   → Close other browser tabs
   → Ensure browser is up to date
   ```

2. **Network Optimization**
   ```
   → Test internet speed (should be >10 Mbps)
   → Try wired connection instead of WiFi
   → Check if company firewall is blocking requests
   → Use incognito mode to test without cache
   ```

3. **Data Volume Optimization**
   ```
   → Use shorter date ranges in analytics
   → Filter logs by recent timeframes
   → Limit rules display to active rules only
   ```

### High Memory Usage

**Symptoms:**
- Browser becomes sluggish
- Tab crashes or becomes unresponsive
- System runs out of memory

**Memory Management:**
1. **Reduce Data Load**
   ```
   → Limit analytics date range to 7 days
   → Filter logs to show fewer entries
   → Avoid keeping multiple Pipenotify tabs open
   ```

2. **Browser Maintenance**
   ```
   → Restart browser periodically
   → Clear browser data regularly
   → Update to latest browser version
   ```

### API Rate Limiting

**Symptoms:**
- "Rate limit exceeded" errors
- Delayed responses from API
- Some requests failing intermittently

**Rate Limit Information:**
- General API: 100 requests per minute
- Webhook processing: 1000 requests per minute
- Analytics: 50 requests per minute

**Mitigation Strategies:**
1. **Reduce Request Frequency**
   ```
   → Don't refresh dashboard excessively
   → Use longer analytics date ranges
   → Avoid bulk operations during peak hours
   ```

2. **Optimize Workflows**
   ```
   → Plan bulk changes for off-peak hours
   → Use bulk operations instead of individual requests
   → Enable quiet hours to reduce automatic notifications
   ```

---

## Integration Problems

### Pipedrive Integration Issues

#### Connection Problems
**Symptoms:**
- Red ❌ "Pipedrive Disconnected" status
- OAuth flow fails or loops
- "Invalid credentials" errors

**Solutions:**
1. **Re-authorize Connection**
   ```
   → Click "Reconnect to Pipedrive"
   → Complete OAuth flow in popup window
   → Grant all requested permissions
   → Verify green ✅ status appears
   ```

2. **Check Pipedrive App Status**
   ```
   → Go to Pipedrive → Settings → Apps & integrations
   → Find "Pipenotify" in list
   → Ensure it's enabled and has proper permissions
   → If not listed, re-install the app
   ```

3. **Firewall/Network Issues**
   ```
   → Ensure Pipedrive APIs are not blocked
   → Allow popups from Pipedrive domain
   → Check corporate firewall settings
   ```

#### Data Sync Issues
**Symptoms:**
- Old or missing data in rule filters
- Incorrect pipeline/stage options
- User lists out of date

**Refresh Data:**
1. **Manual Refresh**
   ```
   → Disconnect and reconnect Pipedrive
   → This refreshes all cached data
   → May take 2-3 minutes to complete
   ```

2. **Clear Cached Data**
   ```
   → Log out and log back in
   → This forces fresh data load
   → Verify updated information appears
   ```

### Google Chat Integration Issues

#### Webhook Problems
**Symptoms:**
- Webhooks fail to deliver messages
- Test messages don't appear
- "Webhook unreachable" errors

**Troubleshooting Steps:**
1. **Verify Webhook URL**
   ```
   → Copy webhook URL from Google Chat
   → Ensure it contains "chat.googleapis.com"
   → Check for any extra characters or spaces
   → Test URL format in webhook validation
   ```

2. **Google Chat Space Status**
   ```
   → Ensure you're still a member of the space
   → Check if space was archived or deleted
   → Verify webhook is still active in space settings
   → Try creating new webhook as test
   ```

3. **Permission Issues**
   ```
   → Ensure you have permission to add webhooks
   → Check if organization policy blocks webhooks
   → Verify Google Workspace settings allow external integrations
   ```

#### Message Formatting Issues
**Symptoms:**
- Messages appear garbled or incorrectly formatted
- Variables not replaced properly
- Links don't work

**Template Debugging:**
1. **Test with Simple Template**
   ```
   → Switch to "Simple" template mode
   → If this works, issue is with custom template
   → Gradually add complexity to identify problem
   ```

2. **Variable Validation**
   ```
   → Check variable spelling: {deal.title} not {deal.name}
   → Ensure proper bracket syntax: {} not []
   → Test with sample data in template editor
   ```

3. **Link Issues**
   ```
   → Verify Pipedrive domain in link URLs
   → Check if organization blocks external links
   → Test links by clicking them in received messages
   ```

---

## Support Resources

### Self-Service Resources

#### Documentation
- 📖 **User Guide**: Complete feature documentation
- 🔧 **Technical Documentation**: Developer and admin resources
- 🆘 **This Troubleshooting Guide**: Common issues and solutions
- 📋 **FAQ**: Frequently asked questions

#### Diagnostic Tools
- 🧪 **Webhook Test**: Built-in connectivity testing
- 📊 **Analytics Dashboard**: Performance monitoring
- 📝 **Logs Viewer**: Detailed error information
- ⚡ **Health Check**: System status overview

### Getting Help

#### Before Contacting Support
1. **Try Quick Diagnostic Checklist** (above)
2. **Search Documentation** for your specific issue
3. **Check Recent Logs** for error details
4. **Test in Incognito Mode** to rule out browser issues

#### Information to Include
**Required Information:**
- Exact error message or problem description
- Steps to reproduce the issue
- When the problem started
- Browser and operating system
- Screenshots of error or unexpected behavior

**Helpful Additional Information:**
- Tenant ID (from URL or account settings)
- Affected rule names or webhook names
- Recent changes to configuration
- Network environment (corporate, home, etc.)

#### Response Time Expectations
- 🟢 **General Questions**: 24-48 hours
- 🟡 **Technical Issues**: 12-24 hours
- 🔴 **Critical/Production Issues**: 2-4 hours
- 🚨 **System Outages**: 1 hour

### Status & Updates

#### System Status
- Check service status and planned maintenance
- Subscribe to status updates
- View historical uptime data

#### Known Issues
- Current known issues and workarounds
- Planned fixes and estimated timelines
- Temporary solutions while fixes are developed

---

## Emergency Procedures

### Service Outage
1. **Check Status Page** first
2. **Verify Network Connectivity** to rule out local issues
3. **Try Alternative Browser** to confirm it's not browser-specific
4. **Wait for Resolution** if confirmed outage
5. **Monitor Status Page** for updates

### Data Loss Concerns
1. **Don't Panic** - system has automatic backups
2. **Document What's Missing** with specific details
3. **Avoid Making Changes** that might complicate recovery
4. **Contact Support Immediately** with details
5. **Preserve Evidence** through screenshots

### Security Incident
1. **Change Passwords Immediately** for Pipedrive and Google accounts
2. **Revoke API Access** in Pipedrive app settings
3. **Review Recent Activity** in logs for suspicious patterns
4. **Contact Support** to report potential security issue
5. **Monitor for Unauthorized Activity**

---

*This troubleshooting guide covers the most common issues and their solutions. For additional help or complex issues not covered here, please contact our support team with detailed information about your problem.*

*Last updated: December 2024*