# 🎬 PipeNotify Demo Video Script

**Professional installation and feature demonstration for Pipedrive Marketplace**

**Duration**: 8-10 minutes  
**Format**: Screen recording with voiceover  
**Resolution**: 1920x1080 minimum  
**Platform**: YouTube (unlisted) + backup on Google Drive

---

## 🎯 **Video Objectives**

### **Primary Goals**
1. **Demonstrate OAuth flow** with clear permission explanations
2. **Show Pro/Team features** to encourage upgrades
3. **Prove real functionality** with live Google Chat notifications
4. **Establish credibility** through professional presentation
5. **Address security concerns** with transparent data handling

### **Key Messaging**
- "5-minute setup, immediate value"
- "Transform delayed communication into instant team coordination"
- "See exactly what permissions we need and why"
- "From deal alerts to team celebrations - never miss what matters"

---

## 🎬 **Pre-Recording Preparation**

### **Technical Setup**
- **Recording Software**: OBS Studio or Loom (professional quality)
- **Browser**: Chrome in incognito mode (1920x1080 window)
- **Audio**: External microphone with clear, professional sound
- **Screen**: Clean desktop, close unnecessary applications
- **Internet**: Stable connection for seamless demonstration

### **Account Preparation**
- **Pipedrive Account**: Demo account with sample deals, contacts, activities
- **Pro/Team PipeNotify**: Account with all premium features enabled
- **Google Chat**: Workspace with multiple channels ready for notifications
- **Test Data**: Realistic but non-sensitive demo data

### **Demo Data Requirements**
```javascript
// Sample deals to create/modify during demo
{
  "High-Value Deal": { value: "$25,000", stage: "Proposal", probability: 75 },
  "New Opportunity": { value: "$5,500", stage: "Qualified", probability: 60 },
  "Closing Soon": { value: "$12,000", stage: "Negotiation", probability: 90 },
  "Stalled Deal": { value: "$8,000", stage: "Demo", days_inactive: 14 }
}
```

---

## 📝 **Detailed Script**

### **🎬 Introduction (45 seconds)**

**[Screen: Clean browser tab, Pipedrive Marketplace visible]**

> "Hi! I'm going to show you how PipeNotify transforms your sales team's communication by connecting Pipedrive directly to Google Chat. 
>
> Whether you're missing critical deal updates or spending too much time checking Pipedrive manually, PipeNotify delivers instant, contextual notifications right where your team collaborates.
>
> The entire setup takes under 5 minutes, and you'll see real notifications by the end of this demo. Let's get started."

**[Visual cue: Cursor hovers over "Install" button]**

---

### **🔐 Installation & OAuth Flow (2.5 minutes)**

**[Screen: Navigate to Pipedrive Marketplace, search "PipeNotify"]**

> "First, I'll install PipeNotify from the Pipedrive Marketplace. Here we can see PipeNotify with excellent reviews and clear feature descriptions."

**[Click Install button]**

> "Now we're taken to the OAuth authorization screen. This is important - let me explain exactly what permissions PipeNotify needs and why."

**[Screen: OAuth authorization page with permissions list]**

> "PipeNotify requests six specific permissions, and I'll explain each one:
>
> **Users Read** - This identifies my Pipedrive account and company. PipeNotify uses this for secure multi-tenant isolation, ensuring our company's data stays completely separate from other companies.
>
> **Webhooks Write and Read** - These permissions let PipeNotify automatically set up the webhooks that enable real-time notifications. Without these, you'd have to manually configure complex webhook settings.
>
> **Deals Read, Persons Read, Activities Read** - These allow PipeNotify to process the specific events you want notifications for. Importantly, we only access data related to the notifications you configure - never your entire Pipedrive database.
>
> What's crucial to understand is that PipeNotify never stores your Pipedrive data permanently. We process webhook events in real-time to create notifications, then discard the data. Only delivery logs are kept for troubleshooting."

**[Click Authorize]**

**[Screen: Automatic redirect to PipeNotify dashboard]**

> "Great! PipeNotify automatically registers the necessary webhooks and redirects us to the dashboard. Notice we're now logged in with our Pro plan, which gives us advanced features we'll explore."

---

### **🏠 Dashboard Overview (1 minute)**

**[Screen: Main dashboard with Pro plan features visible]**

> "Here's the main dashboard. Notice we're on the Professional plan, which provides unlimited rules, advanced filtering, and 90-day log retention.
>
> You can see our system health is excellent, with 99.5% delivery success rate and average response times under 200 milliseconds. The self-healing system automatically monitors and fixes common issues."

**[Point to various dashboard elements]**

> "The interface gives us real-time visibility into notification delivery, active rules, and system performance. Everything you need to ensure your team stays informed."

---

### **💬 Google Chat Setup (2 minutes)**

**[Screen: Open Google Chat in new tab]**

> "Now let's connect Google Chat. I'll open Google Chat in a new tab and create a webhook for our sales team channel."

**[Navigate to Google Chat space settings]**

> "In Google Chat, I'll go to the space settings, select 'Manage webhooks,' and create a new incoming webhook. I'll name it 'Pipedrive Notifications' so it's clear where messages are coming from."

**[Copy webhook URL]**

> "Perfect! Now I'll copy this webhook URL and return to PipeNotify to configure it."

**[Switch back to PipeNotify, navigate to Webhooks section]**

> "In PipeNotify, I'll add this webhook URL and give it a descriptive name. I can also set up different webhooks for different priorities - for example, high-value deals might go to an executive channel while general updates go to the main sales channel."

**[Add webhook and test connection]**

> "Let me test this connection... Excellent! You can see the test message appeared immediately in Google Chat with rich formatting and professional presentation."

---

### **⚙️ Pro/Team Features Demo (2.5 minutes)**

**[Screen: Navigate to Rules section]**

> "Now let's explore the powerful features available with our Pro plan. I'll create an advanced notification rule that showcases the intelligent filtering capabilities."

**[Click Create New Rule]**

> "I'm creating a 'High-Value Deal Alert' rule. With the Pro plan, I can set sophisticated filters - deals over $10,000, specific pipeline stages, particular deal owners, and even custom field conditions."

**[Configure advanced filters]**

> "Notice the rich template options. The Pro plan includes custom message templates with variables, rich Google Chat cards with action buttons, and the ability to customize the entire notification format."

**[Save rule and navigate to Stalled Deals Monitor]**

> "Here's another Pro feature - the Stalled Deals Monitor. This automatically identifies deals that have been inactive for 7, 14, or 30+ days and sends targeted alerts to help recover potential lost opportunities."

**[Show stalled deals list]**

> "You can see deals that need attention, when they went quiet, and suggested recovery actions. This proactive approach helps prevent deals from slipping through the cracks."

**[Navigate to Quiet Hours settings]**

> "The Pro plan also includes Quiet Hours scheduling. I can configure when notifications should be paused - respecting work-life balance while ensuring urgent deals still get through during business hours."

**[Show bulk rule management]**

> "For larger teams, the bulk rule management lets you enable, disable, or modify multiple notification rules at once - essential when managing complex notification strategies for different team members."

---

### **🔔 Live Notification Demo (1.5 minutes)**

**[Screen: Switch to Pipedrive, open a high-value deal]**

> "Now for the exciting part - let's see real-time notifications in action. I'll modify this $25,000 deal to trigger our high-value deal alert."

**[Change deal stage from 'Qualified' to 'Proposal']**

> "I'm moving this deal to the Proposal stage, which should trigger our notification rule immediately..."

**[Switch to Google Chat tab]**

> "And there it is! The notification appeared instantly in Google Chat with rich formatting, including the deal value, new stage, deal owner, and direct links back to Pipedrive."

**[Click the Pipedrive link in the notification]**

> "Notice how clicking the notification takes me directly to the deal in Pipedrive - no searching, no context switching delays. This immediate access helps teams respond faster to opportunities."

**[Create another test - new contact]**

> "Let me trigger one more notification by creating a new contact... and again, immediate notification with all the relevant details formatted beautifully for quick team visibility."

---

### **📊 Analytics & Monitoring (1 minute)**

**[Screen: Navigate to Analytics dashboard]**

> "The Pro plan includes comprehensive analytics to track notification performance. You can see delivery success rates, response times, most active rules, and usage patterns over the past 90 days."

**[Point to various metrics]**

> "This visibility helps optimize your notification strategy - you can see which rules are most valuable, identify any delivery issues, and understand team engagement with notifications."

**[Show health monitoring]**

> "The system continuously monitors itself and provides detailed health reports. If issues arise, the self-healing capabilities automatically resolve common problems, ensuring reliable notification delivery."

---

### **🔧 Uninstallation Process (45 seconds)**

**[Screen: Navigate to Settings]**

> "Finally, let me show the clean uninstallation process. In Settings, there's a clear 'Disconnect' option that handles everything automatically."

**[Click Disconnect, show confirmation dialog]**

> "PipeNotify removes all webhooks from Pipedrive, deletes your notification configurations, and schedules all data for permanent deletion within 30 days. The process is completely transparent and secure."

**[Cancel disconnection]**

> "Of course, I won't actually disconnect since we want to keep using these great features!"

---

### **🎯 Conclusion (30 seconds)**

**[Screen: Return to main dashboard]**

> "In just a few minutes, we've seen how PipeNotify transforms delayed communication into instant team coordination. From the secure OAuth setup to rich notifications and powerful Pro features like stalled deal monitoring and advanced analytics.
>
> Your sales team will never miss another critical deal update, and with features like quiet hours and smart filtering, you get the right notifications at the right time.
>
> Install PipeNotify from the Pipedrive Marketplace today and experience the difference real-time communication makes for your sales results."

**[Screen: Fade to PipeNotify logo]**

> "Visit our documentation for advanced configuration options, or contact support for any questions. Thanks for watching!"

---

## 🎯 **Key Talking Points**

### **Security & Permissions** (Critical for Approval)
- Explain each OAuth permission in detail
- Emphasize data minimization and real-time processing
- Highlight secure token handling and encryption
- Address privacy concerns proactively

### **Pro/Team Feature Highlights**
- **Advanced Filtering**: Value thresholds, custom fields, complex conditions
- **Stalled Deal Monitor**: Proactive opportunity recovery
- **Rich Notifications**: Custom templates, action buttons, formatting
- **Bulk Management**: Team-scale rule configuration
- **Analytics**: 90-day retention, performance insights
- **Quiet Hours**: Work-life balance integration

### **Business Value**
- **Speed**: "Sales go to those who respond first"
- **Context**: "Right information, right time, right people"
- **Efficiency**: "Stop checking Pipedrive manually"
- **Coordination**: "Keep entire team synchronized"

---

## 🎥 **Recording Best Practices**

### **Audio Quality**
- Use external microphone (not laptop built-in)
- Record in quiet environment
- Speak clearly and at moderate pace
- Pause between sections for editing

### **Visual Presentation**
- Keep cursor movements smooth and purposeful
- Allow time for viewers to read interface elements
- Use consistent timing for clicks and navigation
- Maintain professional presentation throughout

### **Technical Execution**
- Test all demo scenarios before recording
- Have backup data ready in case of failures
- Record in segments if needed for quality
- Keep raw footage for potential re-editing

### **Post-Production**
- Add subtle background music if appropriate
- Include PipeNotify branding/logo
- Create engaging thumbnail for YouTube
- Add closed captions for accessibility

---

## 📤 **Video Delivery**

### **Upload Specifications**
- **Resolution**: 1920x1080 minimum (4K preferred)
- **Format**: MP4 with H.264 encoding
- **Frame Rate**: 30fps or 60fps
- **Audio**: 48kHz, stereo, clear quality

### **Platform Setup**
- **YouTube**: Upload as unlisted video for marketplace submission
- **Backup**: Store on Google Drive with sharing permissions
- **Thumbnail**: Professional custom thumbnail with PipeNotify branding
- **Description**: Detailed description with timestamps and links

### **Marketplace Integration**
- Add YouTube URL to Pipedrive Developer Hub
- Test video playback in marketplace preview
- Ensure video is accessible to Pipedrive reviewers
- Include video link in all submission materials

---

**This professional demo video will significantly strengthen your marketplace application by showing real functionality, addressing security concerns, and highlighting the value of premium features that encourage upgrades.**