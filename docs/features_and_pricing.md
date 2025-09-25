# Pipenotify Features & Pricing Reference

*Comprehensive guide to Pipenotify's features across all pricing tiers*

---

## 📋 Feature Overview

Pipenotify transforms your Pipedrive CRM into a real-time notification system for Google Chat, ensuring your sales team never misses critical deal updates.

### Core Value Proposition
- **30-50% of sales go to sellers who respond first** - Stay ahead with instant notifications
- **Reduce context switching** between tools
- **Automated deal monitoring** with intelligent alerts
- **Team coordination** through smart channel routing

---

## 💰 Pricing Tiers

### 🆓 Free Plan - $0/month
**Perfect for**: Solo entrepreneurs and small teams getting started

**Limits:**
- 100 notifications per month
- 1 Google Chat webhook
- 3 basic notification rules
- 7-day log retention

**Features:**
- ✅ Basic deal notifications (won, lost, created)
- ✅ Simple webhook integration
- ✅ Community support
- ✅ OAuth 2.0 security

### 🚀 Starter Plan - $9/month
**Perfect for**: Small sales teams (2-5 people)

**Limits:**
- 1,000 notifications per month
- 3 Google Chat webhooks
- 10 custom rules
- 30-day log retention

**Features:**
- ✅ Everything in Free, plus:
- ✅ **Value-based filtering** ($1K+ deals get priority)
- ✅ **Enhanced message formatting** with deal details
- ✅ **Stage-based notifications** (specific pipeline stages)
- ✅ **Email support**
- ✅ **Usage analytics dashboard**

### 🎯 Professional Plan - $29/month ⭐ *Most Popular*
**Perfect for**: Growing sales teams (5-20 people)

**Limits:**
- 10,000 notifications per month
- Unlimited webhooks
- Unlimited rules
- 90-day log retention

**Features:**
- ✅ Everything in Starter, plus:
- ✅ **Smart channel routing** (high-value deals → exec channels)
- ✅ **Stalled deal alerts** (3, 7, 14+ days inactive)
- ✅ **Custom message templates** with variables
- ✅ **Rich Google Chat cards** with action buttons
- ✅ **Quiet hours scheduling** (respect work hours)
- ✅ **Priority support**
- ✅ **Advanced filtering** (probability, owner, pipeline)

### 🏆 Team Plan - $79/month
**Perfect for**: Large sales organizations (20+ people)

**Limits:**
- Unlimited notifications
- Unlimited webhooks and rules
- 1-year log retention

**Features:**
- ✅ Everything in Professional, plus:
- ✅ **Multi-channel orchestration** (different channels for different priorities)
- ✅ **Daily/weekly pipeline summaries**
- ✅ **Team performance metrics**
- ✅ **Advanced filters** (tags, custom fields, complex conditions)
- ✅ **API access** for custom integrations
- ✅ **Dedicated support**
- ✅ **White-label options** (coming soon)

---

## 🔒 Plan-Based Feature Restrictions

### **UI Experience for Restricted Features**

Pipenotify implements intelligent plan-based feature gating to provide clear upgrade paths while maintaining excellent user experience.

#### **How Restrictions Are Displayed:**

**🔒 Locked Tabs/Sections:**
- **Smart Routing** tab: Greyed out for Free/Starter users
- **Quiet Hours** tab: Greyed out for Free/Starter users  
- **Advanced Filters** section: Disabled in rule creation/editing

**📝 Interactive Upgrade Prompts:**
- **Hover tooltips** show required plan and feature benefits
- **Clear upgrade messaging**: "Available in Pro plan and above"
- **Direct upgrade button** linking to pricing page
- **Feature descriptions** explain business value

**🎨 Visual Design:**
- Disabled features use 50% opacity and grayscale filter
- Hover overlays with upgrade prompts appear on interaction
- Clear lock icons (🔒) indicate restricted features
- Consistent styling maintains professional appearance

#### **Feature Restriction Mapping:**

```javascript
// Frontend Feature Gating
FREE_PLAN_RESTRICTIONS = {
  advanced_filtering: false,    // Advanced rule filters UI
  value_filtering: false,       // Deal value-based filtering  
  channel_routing: false,       // Smart routing to different channels
  quiet_hours: false,          // Scheduled notification delays
  custom_templates: false,      // Rich message formatting
  stalled_alerts: false        // Inactive deal monitoring
}

STARTER_PLAN_FEATURES = {
  advanced_filtering: true,     // ✅ Now available
  value_filtering: true,        // ✅ Filter by deal amount
  enhanced_formatting: true,    // ✅ Better message templates
  stage_filtering: true,        // ✅ Pipeline stage filters
  activity_notifications: true, // ✅ Activity-based alerts
  usage_analytics: true         // ✅ Dashboard analytics
}

PRO_PLAN_FEATURES = {
  channel_routing: true,        // ✅ Smart channel routing
  quiet_hours: true,           // ✅ Scheduled quiet hours
  custom_templates: true,       // ✅ Custom message templates
  rich_formatting: true,       // ✅ Rich Google Chat cards
  probability_filtering: true,  // ✅ Deal probability filters
  owner_filtering: true,       // ✅ Deal owner filters
  time_filtering: true         // ✅ Time-based filters
}
```

#### **Backend Integration:**

The frontend restrictions are backed by robust server-side enforcement:

- **API endpoints** check feature permissions before processing
- **Database queries** respect plan limits (rules, webhooks, notifications)
- **Real-time validation** prevents unauthorized feature access
- **Graceful degradation** when plans are downgraded

---

## 🎯 Feature Breakdown by Category

### 📡 Notification Types

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Deal Won/Lost | ✅ | ✅ | ✅ | ✅ |
| New Deals | ✅ | ✅ | ✅ | ✅ |
| Deal Updates | ✅ | ✅ | ✅ | ✅ |
| Stage Changes | ✅ | ✅ | ✅ | ✅ |
| Activity Notifications | ❌ | ✅ | ✅ | ✅ |
| Contact Updates | ❌ | ❌ | ✅ | ✅ |
| Product/Note Changes | ❌ | ❌ | ✅ | ✅ |
| Custom Event Triggers | ❌ | ❌ | ❌ | ✅ |

### 🔧 Filtering & Routing

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Basic Event Filtering | ✅ | ✅ | ✅ | ✅ |
| **Advanced Filtering UI** | 🔒 | ✅ | ✅ | ✅ |
| Value-Based Filtering | 🔒 | ✅ | ✅ | ✅ |
| Stage/Pipeline Filtering | 🔒 | ✅ | ✅ | ✅ |
| Enhanced Message Formatting | 🔒 | ✅ | ✅ | ✅ |
| Activity Notifications | 🔒 | ✅ | ✅ | ✅ |
| Usage Analytics Dashboard | 🔒 | ✅ | ✅ | ✅ |
| **Smart Channel Routing** | 🔒 | 🔒 | ✅ | ✅ |
| **Stalled Deal Alerts** | 🔒 | 🔒 | ✅ | ✅ |
| **Custom Message Templates** | 🔒 | 🔒 | ✅ | ✅ |
| **Rich Google Chat Cards** | 🔒 | 🔒 | ✅ | ✅ |
| **Quiet Hours Scheduling** | 🔒 | 🔒 | ✅ | ✅ |
| **Probability Filtering** | 🔒 | 🔒 | ✅ | ✅ |
| **Owner/User Filtering** | 🔒 | 🔒 | ✅ | ✅ |
| **Time-Based Filtering** | 🔒 | 🔒 | ✅ | ✅ |
| **Multi-Channel Orchestration** | 🔒 | 🔒 | 🔒 | ✅ |
| **Daily/Weekly Summaries** | 🔒 | 🔒 | 🔒 | ✅ |
| **Team Performance Metrics** | 🔒 | 🔒 | 🔒 | ✅ |
| **Rule Templates Library** | 🔒 | 🔒 | ✅ | ✅ |
| **Bulk Rule Management** | 🔒 | 🔒 | 🔒 | ✅ |
| **Custom Field Filtering** | 🔒 | 🔒 | 🔒 | ✅ |
| **Tag-Based Filtering** | 🔒 | 🔒 | 🔒 | ✅ |

> **🔒 Locked Features**: Shown as disabled in UI with upgrade prompts and hover tooltips explaining benefits

### 🎨 Message Formatting

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Basic Text Messages | ✅ | ✅ | ✅ | ✅ |
| Enhanced Formatting | ❌ | ✅ | ✅ | ✅ |
| Deal Value Display | ❌ | ✅ | ✅ | ✅ |
| Rich Google Chat Cards | ❌ | ❌ | ✅ | ✅ |
| Action Buttons | ❌ | ❌ | ✅ | ✅ |
| Custom Templates | ❌ | ❌ | ✅ | ✅ |
| Variable Substitution | ❌ | ❌ | ✅ | ✅ |
| Multi-language Support | ❌ | ❌ | ❌ | ✅ |

### 🔍 Monitoring & Analytics

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Basic Usage Stats | ✅ | ✅ | ✅ | ✅ |
| Notification History | 7 days | 30 days | 90 days | 1 year |
| Success Rate Tracking | ❌ | ✅ | ✅ | ✅ |
| Stalled Deal Alerts | ❌ | ❌ | ✅ | ✅ |
| Pipeline Summaries | ❌ | ❌ | ❌ | ✅ |
| Team Performance | ❌ | ❌ | ❌ | ✅ |
| Custom Reports | ❌ | ❌ | ❌ | ✅ |
| API Analytics | ❌ | ❌ | ❌ | ✅ |

### ⏰ Automation & Scheduling

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Real-time Notifications | ✅ | ✅ | ✅ | ✅ |
| Basic Deduplication | ✅ | ✅ | ✅ | ✅ |
| Quiet Hours | ❌ | ❌ | ✅ | ✅ |
| Weekend Scheduling | ❌ | ❌ | ✅ | ✅ |
| Holiday Calendar | ❌ | ❌ | ❌ | ✅ |
| Auto-escalation | ❌ | ❌ | ❌ | ✅ |
| Workflow Automation | ❌ | ❌ | ❌ | ✅ |

### 🛠️ Integration & Support

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Google Chat Integration | ✅ | ✅ | ✅ | ✅ |
| Pipedrive OAuth 2.0 | ✅ | ✅ | ✅ | ✅ |
| Community Support | ✅ | ✅ | ✅ | ✅ |
| Email Support | ❌ | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ | ✅ |
| Dedicated Support | ❌ | ❌ | ❌ | ✅ |
| Rule Templates Library | ❌ | ❌ | ✅ | ✅ |
| Bulk Rule Management | ❌ | ❌ | ❌ | ✅ |

---

## 🎮 Use Cases by Plan

### 🆓 Free Plan Use Cases
**"Getting Started"**
- Solo entrepreneur testing the integration
- Small team wanting basic deal notifications
- Proof of concept for larger implementation
- Basic won/lost deal celebrations

**Example Setup:**
- 1 webhook to #sales channel
- 3 rules: deal.won, deal.lost, deal.added
- ~50-80 notifications/month for small pipeline

### 🚀 Starter Plan Use Cases
**"Small Team Growth"**
- 2-5 person sales team
- Multiple products/pipelines
- Need to filter by deal size
- Want separate channels for different purposes

**Example Setup:**
- 3 webhooks: #sales-wins, #sales-pipeline, #sales-alerts
- 10 rules with value filtering ($1K+ to #sales-alerts)
- ~500-800 notifications/month

### 🎯 Professional Plan Use Cases
**"Scaling Sales Operations"**
- 5-20 person sales team
- Multiple managers needing different views
- Deal velocity is critical
- Need stalled deal monitoring

**Example Setup:**
- Unlimited webhooks: #executive, #managers, #reps, #wins
- Smart routing: >$10K deals → #executive
- Stalled deal alerts every morning
- Custom templates for different event types
- ~3,000-8,000 notifications/month

### 🏆 Team Plan Use Cases
**"Enterprise Sales Machine"**
- 20+ person sales organization
- Complex sales processes
- Multiple regions/teams
- Need comprehensive analytics

**Example Setup:**
- 10+ channels for different teams/regions
- Daily pipeline summaries to leadership
- Team performance tracking
- API integration with other tools
- 15,000+ notifications/month

---

## 🚀 Getting Started

### 1. **Install from Pipedrive Marketplace**
   - Search "Pipenotify" in Pipedrive Marketplace
   - Click "Install" and authorize OAuth permissions

### 2. **Connect Google Chat**
   - Create webhook URL in Google Chat
   - Paste webhook URL in Pipenotify setup
   - Test connection with sample notification

### 3. **Configure Notification Rules**
   - Choose which events to track
   - Set up filtering based on your needs
   - Test with actual deal data

### 4. **Optimize & Scale**
   - Monitor usage dashboard
   - Add more channels for routing
   - Upgrade plan as team grows

---

## 🔧 Technical Specifications

### **System Requirements**
- Active Pipedrive account (Essential plan or higher)
- Google Chat workspace
- Admin permissions for webhook creation

### **Security Features**
- OAuth 2.0 authentication
- Webhook signature verification
- Data encryption in transit
- GDPR compliant data handling

### **Performance & Reliability**
- 99.9% uptime SLA
- < 30 second notification delivery
- Automatic retry on failures
- Redundant infrastructure

### **Data Retention**
- Free: 7 days
- Starter: 30 days  
- Pro: 90 days
- Team: 1 year

---

## 📞 Support & Resources

### **Documentation**
- Setup guides and tutorials
- API documentation (Team plan)
- Best practices guide
- Troubleshooting FAQ

### **Support Channels**
- **Community**: Discord server (all plans)
- **Email**: business hours response (Starter+)
- **Priority**: 4-hour response (Pro+)
- **Dedicated**: Slack channel (Team)

### **Training & Onboarding**
- Self-service video tutorials (all plans)
- Live onboarding call (Pro+)
- Team training sessions (Team)
- Custom implementation support (Team)

---

## 🔄 Migration & Upgrade Path

### **Free to Starter**
- Instant activation
- Keep existing rules and history
- Access to value filtering immediately

### **Starter to Professional**
- Advanced features activate instantly
- Historical data retained
- Channel routing suggestions provided

### **Professional to Team**
- API keys generated
- Advanced analytics enabled
- Dedicated support channel created

### **Downgrade Policy**
- Features disabled gracefully
- Data retained based on new plan limits
- 30-day grace period for accidental downgrades

---

## 📊 ROI Calculator

### **Time Savings**
- Average 2 hours/day saved per rep
- Faster deal response time = higher close rates
- Reduced missed opportunities

### **Revenue Impact**
- 15-25% increase in deal velocity
- 10-20% improvement in close rates
- Earlier deal risk identification

### **Cost Comparison**
- Replaces need for custom development
- No maintenance or infrastructure costs
- Scales with team growth

---

*Last updated: January 2025*
*Version: 1.0.0*