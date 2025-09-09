# Railway Migration - Alternative Methods

## Issue: `railway shell` not working

Since `railway shell` isn't working, here are 3 alternative methods:

## Method 1: Direct Railway Run (Recommended)

### Run Migration via Railway Run Command
```bash
cd backend
railway run bash db/migrate.sh production
```

This runs the migration script directly in Railway's environment without needing an interactive shell.

## Method 2: Manual psql Connection

### Connect directly to PostgreSQL
```bash
cd backend
# Get the DATABASE_URL
railway variables
# Look for DATABASE_URL in the output, then:
psql "YOUR_DATABASE_URL_HERE" -f db/schema.sql
```

**Replace YOUR_DATABASE_URL_HERE with the actual DATABASE_URL from railway variables**

## Method 3: Railway Dashboard Console (Web Interface)

### Use Railway's Web Console
1. Go to https://railway.app/dashboard
2. Open your **PipeNotify** project
3. Click on your **main service** (not the databases)
4. Click **"Console"** tab
5. In the console, run:
   ```bash
   cd db
   ./migrate.sh production
   ```

## Method 4: Copy Schema and Run Manually

### If all else fails, run the SQL directly:

1. **Get your DATABASE_URL:**
```bash
railway variables | grep DATABASE_URL
```

2. **Copy the schema file content and run it:**
```bash
psql "postgresql://user:pass@host:port/dbname" -f backend/db/schema.sql
```

## Verify Migration Worked

After any method, verify it worked:

```bash
# Check if tables were created
railway run psql $DATABASE_URL -c "\dt"
```

**You should see 6 tables:**
- tenants
- chat_webhooks
- rules  
- logs
- pipedrive_tokens
- api_usage

## What to Do Next

Once migration is complete (any method):

1. **Test backend health:**
```bash
curl https://your-railway-url.railway.app/health
```

2. **Move to Vercel deployment:**
- The backend is ready
- Database is set up
- Ready for frontend deployment

## Quick Status Check

Let's verify your current status:

```bash
cd backend
railway status
railway logs --tail
```

This will show if your deployment is running and any errors.

---

**Try Method 1 first - it's most likely to work! 🚀**