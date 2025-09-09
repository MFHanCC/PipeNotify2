# Railway Migration Fix

## The Issue
The migration script can't access Railway's DATABASE_URL environment variable properly.

## Solution: Manual Migration Steps

### Step 1: Get Your DATABASE_URL
From the Railway variables output, your DATABASE_URL is:
```
postgresql://postgres:yXQDROasUgDFGpEhQLFGKtKBMbpsqxIa@postgres.railway.internal:5432/railway
```

### Step 2: Run Migration Manually

#### Option A: Use Railway Run with Full Command
```bash
railway run sh -c 'psql "$DATABASE_URL" -f db/schema.sql'
```

#### Option B: Export URL Locally and Connect
```bash
export DATABASE_URL="postgresql://postgres:yXQDROasUgDFGpEhQLFGKtKBMbpsqxIa@postgres.railway.internal:5432/railway"
psql "$DATABASE_URL" -f backend/db/schema.sql
```

#### Option C: Railway Dashboard Console Method
1. Go to https://railway.app/dashboard
2. Open your PipeNotify project  
3. Click on your main service (gallant-success)
4. Click "Console" tab
5. Run these commands:
   ```bash
   cd /app
   psql "$DATABASE_URL" -f db/schema.sql
   ```

### Step 3: Verify Migration Worked

After running any method above, verify:

```bash
railway run sh -c 'psql "$DATABASE_URL" -c "\dt"'
```

Should show 6 tables:
- tenants
- pipedrive_connections  
- chat_webhooks
- rules
- logs
- api_usage

## If All Methods Fail: Manual SQL Execution

Copy the SQL from `backend/db/schema.sql` and run it directly in Railway's console.

---

**Try Option A first - it should work! 🚀**