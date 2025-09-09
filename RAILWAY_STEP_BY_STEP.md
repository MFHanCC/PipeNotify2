# Railway Backend Deployment - Detailed Steps

## Step 1: Create Railway Project

### 1.1 Initialize Railway Project
```bash
cd backend
railway init
```

**What you'll see:**
```
? Select a workspace › 
❯ Adam Greywolf's Projects
  Create a new workspace
```
- Select: **"Adam Greywolf's Projects"**

**Next prompt:**
```
? Select a project ›
❯ Create empty project
  [Existing projects if any]
```
- Select: **"Create empty project"**

**Project name prompt:**
```
? Enter project name › pipenotify-backend
```
- Enter: **`pipenotify-backend`**

**Success message:**
```
🚝 Created project pipenotify-backend
🎉 Project linked to pipenotify-backend (12345678-1234-1234-1234-123456789abc)
```

### 1.2 Add Database Services (Railway Dashboard)

**Open Railway Dashboard:**
1. Go to https://railway.app/dashboard
2. Find your **"pipenotify-backend"** project
3. Click on the project to open it

**Add PostgreSQL Service:**
1. Click **"+ New"** button in the dashboard
2. Select **"Database"**
3. Choose **"PostgreSQL"**
4. Wait for deployment (takes 1-2 minutes)
5. You'll see `DATABASE_URL` automatically appear in variables

**Add Redis Service:**
1. Click **"+ New"** button again
2. Select **"Database"**  
3. Choose **"Redis"**
4. Wait for deployment (takes 1-2 minutes)
5. You'll see `REDIS_URL` automatically appear in variables

### 1.3 Set Environment Variables (Railway Dashboard)

**In your project dashboard:**
1. Click on your **main service** (not the databases)
2. Go to **"Variables"** tab
3. Click **"+ New Variable"**

**Add these variables one by one:**

```bash
NODE_ENV=production
```

```bash
JWT_SECRET=0+DhzOdZi5K0615WAPHbojgHkLD78auxLETs0oqIZKg=
```

```bash
WEBHOOK_SECRET=dDI+AI1gO1zE5Ebl94zkZzHDlsK77oh03DW8UlKnfIM=
```

**Variables you need to replace with actual values:**

```bash
PIPEDRIVE_API_TOKEN=your-actual-pipedrive-token
```
*Get this from: Pipedrive → Settings → Apps & Integrations → Your App → API Token*

```bash
SENTRY_DSN=https://your-actual-sentry-dsn@sentry.io/project-id
```
*Get this from: Sentry.io → Your Project → Settings → Client Keys (DSN)*

```bash
FRONTEND_URL=https://your-vercel-url.vercel.app
```
*Set this AFTER you deploy to Vercel (Step 2)*

### 1.4 Deploy Backend to Railway

**In your terminal:**
```bash
cd backend
railway up
```

**What you'll see:**
```
🚀 Deploying...
✅ Build successful
✅ Deployment successful
🚝 Available at: https://pipenotify-backend-production-1234.up.railway.app
```

**Copy your Railway URL** - you'll need it for Vercel setup!

### 1.5 Run Database Migration

**Connect to Railway shell:**
```bash
railway shell
```

**You'll be in the Railway environment. Run:**
```bash
cd db
./migrate.sh production
```

**What you should see:**
```
🚀 Starting database migration for production environment...
📊 Database URL: postgresql://postgres:[hidden]/railway
🔍 Testing database connection...
✅ Database connection successful
📋 Running schema migration...
✅ Migration completed successfully
🔍 Verifying table creation...
📊 Created 6 tables
📋 Tables created:
          List of relations
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | tenants         | table | postgres
 public | chat_webhooks   | table | postgres
 public | rules           | table | postgres
 public | logs            | table | postgres
 public | pipedrive_tokens| table | postgres
 public | api_usage       | table | postgres
🎉 Database migration completed successfully!
```

**Exit Railway shell:**
```bash
exit
```

## Verification

**Test your Railway deployment:**
```bash
curl https://your-railway-url.railway.app/health
```

**Should return:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

## Common Issues & Solutions

### Issue: "Failed to prompt for options - not a TTY"
**Solution:** Run the commands directly in your terminal, not through Claude Code

### Issue: Database connection failed
**Solution:** 
1. Check Railway dashboard shows PostgreSQL as "Active"
2. Verify DATABASE_URL exists in variables
3. Try: `railway shell` then `echo $DATABASE_URL`

### Issue: Build failed
**Solution:**
1. Check `railway logs` for errors
2. Verify package.json has correct start script
3. Ensure all dependencies are in package.json

### Issue: Can't find migration script
**Solution:**
```bash
railway shell
ls -la db/
chmod +x db/migrate.sh
./db/migrate.sh production
```

## Next Step

After Railway deployment succeeds:
1. **Copy your Railway URL** (e.g., `https://pipenotify-backend-production-1234.up.railway.app`)
2. **Proceed to Step 2: Vercel Frontend Deployment**
3. **Update FRONTEND_URL** in Railway after Vercel deployment

---

**Your Railway backend will be live and ready! 🚀**