# How to Get Sentry DSN - Step by Step

## What is Sentry DSN?
Sentry DSN (Data Source Name) is a URL that tells your application where to send error reports. You need both **backend DSN** and **frontend DSN**.

## Step 1: Create Sentry Account

### 1.1 Sign Up for Sentry
1. Go to https://sentry.io
2. Click **"Get Started"** 
3. Choose **"Sign up with GitHub"** (recommended) or email
4. Complete registration

### 1.2 Create Organization (if prompted)
- Organization name: **"Pipenotify"** or your company name
- You'll be the owner

## Step 2: Create Backend Project

### 2.1 Create New Project
1. Click **"Create Project"** button
2. **Select Platform:** Choose **"Node.js"**
3. **Set Alert Frequency:** Choose **"Alert me on every new issue"**
4. **Project Name:** Enter **"pipenotify-backend"**
5. **Team:** Leave as default
6. Click **"Create Project"**

### 2.2 Get Backend DSN
After project creation, you'll see:

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://1234567890abcdef1234567890abcdef@o123456.ingest.sentry.io/123456",
});
```

**Copy the DSN URL** (the part in quotes after `dsn:`):
```
https://1234567890abcdef1234567890abcdef@o123456.ingest.sentry.io/123456
```

This is your **BACKEND SENTRY_DSN**!

### 2.3 Alternative Way to Find DSN
If you missed it:
1. Go to **Settings** → **Projects** → **pipenotify-backend**
2. Click **"Client Keys (DSN)"** in left sidebar
3. Copy the **DSN** value

## Step 3: Create Frontend Project

### 3.1 Create Second Project
1. Click **"Projects"** in top navigation
2. Click **"Create Project"** 
3. **Select Platform:** Choose **"React"**
4. **Project Name:** Enter **"pipenotify-frontend"**
5. Click **"Create Project"**

### 3.2 Get Frontend DSN
You'll see React setup code:

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://abcdef1234567890abcdef1234567890@o123456.ingest.sentry.io/654321",
});
```

**Copy this DSN URL** - this is your **FRONTEND SENTRY_DSN**!

## Step 4: Your DSN Values

You now have **two different DSNs**:

### Backend DSN (for Railway)
```
SENTRY_DSN=https://1234567890abcdef1234567890abcdef@o123456.ingest.sentry.io/123456
```

### Frontend DSN (for Vercel)  
```
REACT_APP_SENTRY_DSN=https://abcdef1234567890abcdef1234567890@o123456.ingest.sentry.io/654321
```

## Step 5: Where to Use These DSNs

### Railway Environment Variables
In Railway Dashboard → Variables:
```bash
SENTRY_DSN=https://your-backend-dsn@sentry.io/project-id
```

### Vercel Environment Variables
In Vercel Dashboard → Settings → Environment Variables:
```bash
REACT_APP_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
```

## How to Find DSNs Later

### Method 1: Project Settings
1. Go to https://sentry.io
2. Select your organization
3. Go to **Settings** → **Projects**
4. Click on **pipenotify-backend** or **pipenotify-frontend**
5. Click **"Client Keys (DSN)"** in sidebar
6. Copy the **DSN** value

### Method 2: Quick Access
1. Go to https://sentry.io
2. Click on project name
3. Go to **Settings** → **Client Keys**
4. Copy the **DSN**

## Testing Sentry Integration

### Test Backend (after Railway deployment)
```bash
curl https://your-railway-url.railway.app/api/v1/test-error
```

### Test Frontend (after Vercel deployment)
1. Visit your Vercel URL
2. Open browser console
3. You should see Sentry initialization message

## Sentry Dashboard Features

After setup, you can:
- **View Errors:** Real-time error tracking
- **Set Alerts:** Email/Slack notifications  
- **Performance:** Monitor response times
- **Releases:** Track deployments (configured in CI/CD)

## Free Tier Limits
- **5,000 errors/month** (plenty for development)
- **1 team member**
- **90 days data retention**

Perfect for Pipenotify development and production!

## Quick Reference

**Sentry.io:** https://sentry.io  
**Docs:** https://docs.sentry.io/platforms/node/  
**React Setup:** https://docs.sentry.io/platforms/javascript/guides/react/

---

**You now have both Sentry DSNs ready for Railway and Vercel! 🎯**