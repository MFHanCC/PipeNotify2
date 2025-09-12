# 🧪 Pipenotify Comprehensive Testing Guide

## 🚀 **PHASE 1: FREE PLAN TESTING**

### **Step 1.1: Initial Setup**

**🌐 Frontend Access**
1. Open: `https://pipenotify-frontend.vercel.app`
2. **Expected**: React app should load with login/onboarding interface
3. **Open Browser DevTools (F12)** - Monitor Console and Network tabs
4. **Report any console errors immediately**

**🔑 OAuth Flow Testing**
1. Click "Connect to Pipedrive" or similar button
2. **Expected**: Redirect to Pipedrive OAuth
3. Complete OAuth authorization
4. **Expected**: Redirect back to Pipenotify with JWT token
5. **Verify**: Check localStorage/sessionStorage for token
6. **Verify**: Should land on main dashboard

### **Step 1.2: Dashboard Access**

**📊 Dashboard Loading**
1. Should see main navigation with tabs
2. **Expected tabs**: Overview, Rules, Logs, Webhooks, Analytics, etc.
3. **Verify**: No 403 errors in Network tab
4. **Check**: Tenant ID is being used correctly

### **Step 1.3: Webhook Management (Free: 1 webhook max)**

**➕ Add First Webhook**
1. Go to "Webhooks" tab
2. Click "Add Webhook" or similar
3. Enter:
   - Name: "Test Sales Channel" 
   - Webhook URL: [Your Google Chat webhook]
   - Description: "Testing webhook"
4. **Expected**: Webhook saves successfully
5. **Test Button**: Should send test message to Google Chat

**🚫 Test Webhook Limit (Should Fail)**
1. Try to add a second webhook
2. **Expected**: Should show error "Free plan allows 1 webhook only"
3. **Expected**: Upgrade prompt should appear
4. **Verify**: No webhook created in database

### **Step 1.4: Rule Management (Free: 3 rules max)**

**📋 Create Basic Rules**
1. Go to "Rules" tab
2. Create Rule 1:
   - Name: "Deal Won Celebrations"
   - Event: "deal.updated"
   - Filter: `{"status": ["won"]}`
   - Target Webhook: Your test webhook
   - Template: Simple

3. Create Rule 2:
   - Name: "Deal Lost Tracking"
   - Event: "deal.updated" 
   - Filter: `{"status": ["lost"]}`
   - Target Webhook: Your test webhook

4. Create Rule 3:
   - Name: "New Deal Alerts"
   - Event: "deal.added"
   - Filter: `{}`
   - Target Webhook: Your test webhook

**🚫 Test Rule Limit (Should Fail)**
1. Try to create 4th rule
2. **Expected**: Error "Free plan allows 3 rules maximum"
3. **Expected**: Upgrade prompt

### **Step 1.5: Feature Access Testing (Should Be Blocked)**

**Value Filtering (Starter+ Feature)**
1. Try to add value filter to a rule
2. **Expected**: Feature should be grayed out or show upgrade prompt
3. **Expected**: "Available in Starter plan and higher"

**Stalled Deal Monitoring (Professional+ Feature)**
1. Try to access "Stalled Deals" tab
2. **Expected**: Should show upgrade prompt
3. **Expected**: "Available in Professional plan and higher"

**Custom Templates (Professional+ Feature)**
1. Try to select "Custom" template mode
2. **Expected**: Should be disabled with upgrade prompt

### **Step 1.6: Notification Testing**

**🔔 Test Real Notifications**
1. Go to your Pipedrive account
2. Create a test deal
3. **Expected**: Should receive notification in Google Chat
4. **Check**: Dashboard logs should show successful delivery
5. **Verify**: Notification counter increases

**📊 Usage Tracking**
1. Check analytics/usage dashboard
2. **Expected**: Should show 1/100 notifications used
3. Send 5-10 more notifications
4. **Expected**: Counter should update accurately

### **Step 1.7: Quota Enforcement**
*This is harder to test without sending 100 notifications*
1. Note current usage count
2. **Theoretical**: At 100 notifications, new ones should fail
3. **Expected**: Error message about quota exceeded

---

## 🚀 **PHASE 2: STARTER PLAN TESTING**

### **Step 2.1: Plan Upgrade**

**💳 Upgrade Flow**
1. Click "Upgrade" button anywhere in interface
2. **Expected**: Stripe payment modal or redirect
3. Complete payment flow (use test card if available)
4. **Expected**: Immediate feature unlock
5. **Verify**: Dashboard shows "Starter Plan" status

### **Step 2.2: Expanded Limits**

**🌐 Webhook Expansion**
1. Add 2 more webhooks (should now allow 3 total)
2. **Expected**: No errors, webhooks save successfully
3. **Test**: Try to add 4th webhook
4. **Expected**: Should fail with "Starter plan allows 3 webhooks"

**📋 Rule Expansion** 
1. Add 7 more rules (should now allow 10 total)
2. **Expected**: All rules save successfully
3. **Test**: Try to add 11th rule
4. **Expected**: Should fail with limit message

### **Step 2.3: Starter Features**

**💰 Value-Based Filtering**
1. Edit an existing rule
2. Add value filter: `{"value": {"min": 1000}}`
3. **Expected**: Filter saves and works
4. **Test**: Create deals above/below $1,000
5. **Expected**: Only high-value deals trigger notifications

**🔄 Stage-Based Filtering**
1. Create rule with stage filter
2. **Expected**: Only deals in specified stages trigger notifications

**🎨 Enhanced Message Formatting**
1. **Expected**: Notifications now show more deal details
2. **Expected**: Better formatting than Free plan messages

### **Step 2.4: Analytics Access**
1. Go to Analytics tab
2. **Expected**: Should see detailed usage statistics
3. **Expected**: 30-day log retention
4. **Expected**: Success rate tracking

---

## 🚀 **PHASE 3: PROFESSIONAL PLAN TESTING**

### **Step 3.1: Plan Upgrade**
1. Upgrade to Professional ($29/month)
2. **Expected**: All Professional features unlock immediately

### **Step 3.2: Unlimited Resources**
1. **Test**: Add 10+ webhooks
2. **Expected**: Should work without limits
3. **Test**: Add 20+ rules  
4. **Expected**: Should work without limits

### **Step 3.3: Smart Channel Routing**
1. Create routing rule:
   - High value deals (>$5,000) → Executive webhook
   - Standard deals → Sales team webhook
   - Lost deals → Manager webhook
2. **Test**: Create deals of different values
3. **Expected**: Messages go to correct channels

### **Step 3.4: Stalled Deal Monitoring**
1. Go to "Stalled Deals" tab
2. Configure:
   - Warning: 3 days
   - Stale: 7 days
   - Critical: 14 days
   - Alert Channel: Your test webhook
3. **Test**: Manual trigger
4. **Expected**: Receive stalled deal report

### **Step 3.5: Custom Templates**
1. Create custom template with variables
2. Use variables like `{{deal.title}}`, `{{deal.value}}`, `{{person.name}}`
3. **Test**: Send notification
4. **Expected**: Variables are replaced with actual values

### **Step 3.6: Rich Google Chat Cards**
1. Enable rich card formatting
2. **Expected**: Notifications show as cards with buttons
3. **Test**: Action buttons should work

### **Step 3.7: Quiet Hours**
1. Configure quiet hours: 6 PM - 9 AM
2. **Test**: Send notification during quiet hours
3. **Expected**: Notification should be queued
4. **Test**: Should deliver at 9 AM

---

## 🚀 **PHASE 4: TEAM PLAN TESTING**

### **Step 4.1: Plan Upgrade**
1. Upgrade to Team plan ($79/month)
2. **Expected**: All features unlock, unlimited notifications

### **Step 4.2: Advanced Features**

**🎛️ Multi-Channel Orchestration**
1. Create complex routing with multiple conditions
2. **Test**: Round-robin distribution
3. **Test**: Priority-based routing

**📊 Daily Summaries**
1. Configure daily pipeline summary
2. **Expected**: Receive summary email/notification

**👥 Team Performance Metrics**
1. **Expected**: Individual rep performance
2. **Expected**: Team comparison charts
3. **Expected**: Response time analytics

**🔧 API Access**
1. Generate API keys
2. **Test**: Make API calls programmatically
3. **Expected**: Full API functionality

---

## 🐛 **ISSUE REPORTING PROTOCOL**

For any issue found:

**📷 1. Document**
- Screenshot the error
- Copy full error message
- Note which browser/device

**🔍 2. Browser DevTools**
- Console errors (copy full stack trace)
- Network tab failures (status codes, response)
- Application tab (check localStorage/sessionStorage)

**📊 3. Backend Logs**
- If you can access Railway logs, include relevant errors
- Note timestamp of issue

**📝 4. Report Format**
```
Issue: [Brief description]
Step: [Exact step in testing guide]
Browser: [Chrome/Safari/Firefox + version]
Error: [Full error message]
Console: [Any console errors]
Expected: [What should have happened]
Actual: [What actually happened]
```

**⏸️ 5. Stop and Wait**
- Don't continue testing until issue is fixed
- I'll provide immediate fix and re-deployment if needed

---

## 🎯 **SUCCESS CRITERIA**

### Free Plan ✅
- [ ] OAuth flow works
- [ ] 1 webhook, 3 rules limits enforced
- [ ] Basic notifications work
- [ ] Feature blocking works properly
- [ ] 100 notification quota tracking

### Starter Plan ✅ 
- [ ] Upgrade flow works
- [ ] 3 webhooks, 10 rules limits
- [ ] Value/stage filtering works
- [ ] Enhanced formatting visible
- [ ] Analytics dashboard accessible

### Professional Plan ✅
- [ ] Unlimited webhooks/rules
- [ ] Channel routing works
- [ ] Stalled deal monitoring functional
- [ ] Custom templates work
- [ ] Quiet hours implemented
- [ ] Rich cards in Google Chat

### Team Plan ✅
- [ ] All features unlocked
- [ ] Multi-channel orchestration
- [ ] Daily summaries work
- [ ] Team metrics displayed
- [ ] API access functional

### Downgrade Testing ✅
- [ ] Features disable gracefully
- [ ] Data retention follows plan limits
- [ ] No data loss during downgrades

---

**🚀 Ready to start testing!** 

Open the frontend URL and begin with Step 1.1. I'll be monitoring and ready to fix any issues immediately.