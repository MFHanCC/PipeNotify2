# 🔑 OAuth Scopes and Permissions

**PipeNotify's Pipedrive API Access Requirements**

---

## 🎯 **Overview**

PipeNotify uses OAuth 2.0 to securely connect with your Pipedrive account. This document explains exactly which permissions we request and why each one is necessary for the service to function.

**Security First**: We follow the principle of least privilege - requesting only the minimum permissions required to deliver the notification service you expect.

---

## 📋 **Required Pipedrive Scopes**

### 👤 **`users:read`**
**Purpose**: Account identification and authentication

**What it allows**:
- Read your basic profile information (name, company)
- Identify your Pipedrive company ID for multi-tenant isolation
- Verify your account permissions during OAuth flow

**Why we need it**:
- **Multi-tenant Security**: Each company's data must be completely isolated
- **User Authentication**: Verify you have access to the Pipedrive account
- **Company Identification**: Link notifications to the correct organization

**Data accessed**:
- User ID and name
- Company ID and name
- API domain (for multi-region Pipedrive accounts)

---

### 🔗 **`webhooks:write`**
**Purpose**: Create and manage notification webhooks

**What it allows**:
- Create new webhooks when you install PipeNotify
- Update webhook configurations when you change settings
- Delete webhooks when you uninstall or disconnect

**Why we need it**:
- **Automatic Setup**: Create webhooks without manual configuration
- **Real-time Notifications**: Enable instant delivery when deals change
- **Clean Uninstall**: Remove webhooks when disconnecting service

**Actions performed**:
- Register webhook URLs pointing to PipeNotify servers
- Configure which events trigger notifications (deals, contacts, activities)
- Manage webhook lifecycle (create, update, delete)

---

### 👀 **`webhooks:read`**
**Purpose**: Monitor and manage existing webhooks

**What it allows**:
- List existing webhooks in your Pipedrive account
- Check webhook status and configuration
- Avoid creating duplicate webhooks

**Why we need it**:
- **Prevent Conflicts**: Detect existing PipeNotify webhooks before creating new ones
- **Health Monitoring**: Verify webhooks are active and properly configured
- **Troubleshooting**: Diagnose notification delivery issues

**Information accessed**:
- List of active webhooks
- Webhook URLs and event configurations
- Webhook creation dates and status

---

### 💼 **`deals:read`**
**Purpose**: Process deal change notifications

**What it allows**:
- Read deal information when webhook events are received
- Access deal details like value, stage, owner, probability
- Include relevant deal data in Google Chat notifications

**Why we need it**:
- **Rich Notifications**: Include deal value, stage, and owner in messages
- **Smart Filtering**: Apply your configured filters (value thresholds, stages, etc.)
- **Contextual Information**: Provide enough detail for actionable notifications

**Data processed** (only when notifications are triggered):
- Deal title and value
- Current stage and probability
- Deal owner and creation date
- Custom fields (if used in notification rules)

**❌ What we DON'T do**:
- Store deal data permanently
- Access deals not involved in triggered notifications
- Read historical deal information beyond the triggering event

---

### 👥 **`persons:read`**
**Purpose**: Include contact information in notifications

**What it allows**:
- Read contact details when person-related notifications are triggered
- Access contact information linked to deals and activities
- Include contact names and company information in notifications

**Why we need it**:
- **Complete Context**: Show which contact is associated with deal changes
- **Person Notifications**: Send notifications when new contacts are created
- **Relationship Clarity**: Display contact-to-deal relationships in messages

**Data processed** (only during notification events):
- Contact name and title
- Company name
- Email and phone (if configured in notification templates)

**❌ What we DON'T do**:
- Access contacts unrelated to your notification rules
- Store contact information beyond message delivery
- Use contact data for marketing or other purposes

---

### 📅 **`activities:read`**
**Purpose**: Send activity and meeting notifications

**What it allows**:
- Read activity details when activity notifications are triggered
- Access meeting, call, and task information
- Include activity schedules and participants in notifications

**Why we need it**:
- **Activity Reminders**: Notify about upcoming calls and meetings
- **Task Notifications**: Alert about completed or overdue activities
- **Schedule Coordination**: Keep team informed about important activities

**Data processed** (only for configured activity notifications):
- Activity subject and type
- Due date and time
- Activity participants and notes
- Related deals or contacts

---

## 🔒 **Data Security & Privacy**

### **What We Store**
- ✅ OAuth refresh tokens (encrypted)
- ✅ Webhook configurations you create
- ✅ Notification rules and preferences
- ✅ Delivery logs for 90 days (troubleshooting)

### **What We DON'T Store**
- ❌ Your Pipedrive deals, contacts, or activities
- ❌ Sensitive business data beyond operational needs
- ❌ Personal information not required for notifications
- ❌ Historical data beyond log retention period

### **Data Processing**
- **Real-time Only**: We process webhook events as they arrive
- **Ephemeral Processing**: Data is processed and immediately formatted into notifications
- **No Data Mining**: We never analyze your data for insights or trends
- **Secure Transmission**: All API calls use HTTPS/TLS encryption

---

## 🛡️ **Security Measures**

### **OAuth 2.0 Implementation**
- **No Password Storage**: Only secure tokens are used
- **Automatic Token Refresh**: Tokens are refreshed before expiration
- **Token Encryption**: All tokens encrypted at rest
- **Scope Validation**: Only requested permissions are used

### **API Security**
- **Rate Limiting**: Prevents abuse and ensures API stability
- **Request Validation**: All requests validated and sanitized
- **Error Handling**: Secure error responses that don't leak information
- **Audit Logging**: Security events logged for monitoring

### **Infrastructure Security**
- **Encrypted Databases**: All data encrypted at rest
- **Network Security**: VPN and firewall protection
- **Access Controls**: Role-based access to systems
- **Regular Security Audits**: Ongoing security assessments

---

## ❓ **Frequently Asked Questions**

### **Q: Can PipeNotify access all my Pipedrive data?**
**A**: No. We only access data related to the specific webhook events you've configured for notifications. We cannot browse your entire Pipedrive database.

### **Q: Do you store my deals and contacts?**
**A**: No. We process webhook events in real-time to create notifications and then discard the data. We only keep delivery logs for troubleshooting.

### **Q: What happens to my data if I uninstall?**
**A**: All your data is deleted within 30 days of uninstallation, including configurations, tokens, and logs. Webhooks are immediately removed from Pipedrive.

### **Q: Can I revoke permissions later?**
**A**: Yes. You can revoke PipeNotify's access anytime through your Pipedrive account settings. This will immediately stop all notifications and data processing.

### **Q: Why do you need webhook write permissions?**
**A**: To automatically register webhooks that enable real-time notifications. Without this, you would need to manually configure webhooks in Pipedrive, which is complex and error-prone.

### **Q: Can other Pipedrive users in my company see PipeNotify?**
**A**: PipeNotify is installed per-company, but each user controls their own notification preferences. Webhooks are registered at the company level for all authorized events.

---

## 📞 **Questions or Concerns?**

If you have questions about our data usage or security practices:

- 📧 **Security Questions**: security@primedevlabs.com
- 📧 **Privacy Questions**: privacy@primedevlabs.com  
- 📧 **General Support**: support@primedevlabs.com

We're committed to transparency and happy to explain any aspect of our data handling in detail.

---

## 📄 **Related Documentation**

- [Privacy Policy](../frontend/public/privacy.html) - Complete privacy policy
- [Terms of Service](../frontend/public/terms.html) - Terms and conditions
- [Security Guidelines](security_guideline_document.md) - Technical security documentation
- [API Reference](API_REFERENCE.md) - Technical API documentation

---

*Last updated: January 23, 2025*

*This document will be updated whenever our scope requirements change. We will notify existing users of any changes that require additional permissions.*