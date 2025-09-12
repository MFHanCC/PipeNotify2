# Google Chat Webhook Troubleshooting Guide

## 🚨 Current Issue: 403 Permission Denied

Your Pipenotify system is **100% functional** but Google Chat webhooks are returning permission errors.

### ✅ What's Working
- **Pipedrive Integration**: Webhooks received successfully ✅
- **Job Processing**: All jobs completed (rules_matched: 1) ✅  
- **Database & Queue**: Operational ✅
- **Notification Rules**: 15 active rules matching events ✅
- **Railway Backend**: No critical errors ✅

### ❌ What's Not Working
- **Google Chat Delivery**: 403 Permission Denied errors ❌

## 🔧 Quick Fix Steps

### Step 1: Test Current Webhook
```bash
curl -X POST "YOUR_CURRENT_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "🧪 Test message"}'
```

**Expected Result**: 403 Permission Denied (confirms the issue)

### Step 2: Create New Google Chat Webhook

1. **Open Google Chat** in your browser
2. **Navigate to your space** where you want notifications
3. **Click the space name** at the top
4. **Select "Manage webhooks"**
5. **Delete existing webhook** (if any)
6. **Click "Add webhook"**
7. **Give it a name** (e.g., "Pipenotify Notifications")
8. **Copy the new webhook URL**

### Step 3: Update Webhook in Pipenotify

**Option A: Via Frontend Dashboard**
1. Log into your Pipenotify dashboard
2. Go to Webhooks/Integration settings
3. Replace the old webhook URL with the new one
4. Save changes

**Option B: Via API (if dashboard not available)**
```bash
curl -X POST https://pipenotify.up.railway.app/api/v1/admin/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Updated Demo Webhook",
    "webhook_url": "YOUR_NEW_GOOGLE_CHAT_WEBHOOK_URL",
    "description": "Updated webhook with valid permissions"
  }'
```

### Step 4: Test the Fix
```bash
curl -X POST "YOUR_NEW_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "✅ Webhook is now working!"}'
```

**Expected Result**: Message appears in your Google Chat space

## 🧪 Verification Steps

### Test End-to-End Flow
1. **Create a test deal** in Pipedrive
2. **Change the deal stage** 
3. **Mark deal as won**
4. **Check Google Chat** for notifications

### Check Railway Logs
```bash
railway logs --service gallant-success
```

**Look for**:
- `✅ Job completed: { rules_matched: 1, notifications_sent: 1 }`
- No more `Chat webhook error: 403` messages

## 📊 System Verification Commands

### Check System Status
```bash
curl -s https://pipenotify.up.railway.app/api/v1/debug/system-status | jq '.'
```

### Check Active Rules
```bash
curl -s https://pipenotify.up.railway.app/api/v1/admin/debug/rules | jq '.tenant2_rules | length'
```

### Check Webhooks  
```bash
curl -s https://pipenotify.up.railway.app/api/v1/admin/debug/rules | jq '.tenant2_webhooks[0].webhook_url'
```

## ❗ Important Notes

1. **Google Chat webhooks expire** - This is likely why yours stopped working
2. **The Pipenotify system is fully operational** - The issue is only the webhook URL
3. **All rules are configured correctly** - You have 15 active notification rules
4. **Jobs are processing successfully** - Check the Railway logs to confirm

## 🏁 Success Criteria

After updating the webhook URL, you should see:
- ✅ Messages in Google Chat when you change deals in Pipedrive
- ✅ Railway logs showing `notifications_sent: 1` (instead of 0)
- ✅ No more 403 errors in the logs

## 🆘 Need Help?

If you continue having issues after updating the webhook URL:

1. **Check webhook format**: Must be `https://chat.googleapis.com/v1/spaces/...`
2. **Verify bot permissions**: Ensure the webhook bot has write access to the space
3. **Test webhook directly**: Use the curl command above to test outside of Pipenotify
4. **Check Railway logs**: Look for any other error messages

The system is ready to deliver notifications as soon as you have a valid Google Chat webhook URL! 🚀