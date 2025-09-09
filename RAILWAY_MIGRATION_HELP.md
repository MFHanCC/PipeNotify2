# Railway Database Migration - Detailed Help

## Step 1.5: Run Database Migration - Complete Guide

### What Railway Shell Does
`railway shell` connects you to your Railway project's environment with all your environment variables (DATABASE_URL, etc.) already loaded.

### Method 1: Railway Shell (Recommended)

#### 1.1 Connect to Railway Shell
```bash
railway shell
```

**What you'll see:**
```
🚝 Connecting to Railway environment...
✅ Connected to pipenotify-backend (production)
$
```

You're now in a shell with Railway's environment variables loaded.

#### 1.2 Navigate to Database Directory
```bash
cd db
```

#### 1.3 Check Files Exist
```bash
ls -la
```

**You should see:**
```
-rwxr-xr-x  1 user  staff  2.1K  migrate.sh
-rw-r--r--  1 user  staff  4.2K  schema.sql
```

#### 1.4 Run Migration
```bash
./migrate.sh production
```

**Expected Output:**
```
🚀 Starting database migration for production environment...
📊 Database URL: postgresql://postgres:[hidden]/railway
🔍 Testing database connection...
✅ Database connection successful
📋 Running schema migration...

CREATE EXTENSION
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
INSERT 0 1

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

📝 Initial data counts:
   - Tenants: 1
   - Webhooks: 0
   - Rules: 0
🎉 Database migration completed successfully!
🚀 Ready for Railway deployment!
```

#### 1.5 Exit Railway Shell
```bash
exit
```

### Method 2: Alternative Approach (If Method 1 Fails)

#### 2.1 Run Migration Through Railway Run
```bash
cd backend
railway run bash db/migrate.sh production
```

### Method 3: Manual Database Setup (If Migration Script Fails)

#### 3.1 Connect to PostgreSQL Directly
```bash
railway shell
psql $DATABASE_URL
```

#### 3.2 Run Schema Manually
```sql
-- Copy and paste the contents of db/schema.sql
-- Or run: \i db/schema.sql
```

#### 3.3 Verify Tables Created
```sql
\dt
```

#### 3.4 Exit PostgreSQL and Railway Shell
```sql
\q
```
```bash
exit
```

## Troubleshooting Common Issues

### Issue 1: "migrate.sh: Permission denied"
**Solution:**
```bash
railway shell
chmod +x db/migrate.sh
./db/migrate.sh production
```

### Issue 2: "No such file or directory"
**Solution:**
```bash
railway shell
pwd
ls -la
cd db
ls -la
```
Make sure you're in the right directory.

### Issue 3: "DATABASE_URL not set"
**Solution:**
```bash
railway shell
echo $DATABASE_URL
```
If empty, check Railway dashboard environment variables.

### Issue 4: "Connection refused"
**Solution:**
1. Check Railway dashboard - PostgreSQL service should be "Active"
2. Wait 2-3 minutes after creating PostgreSQL service
3. Try: `railway shell` then `psql $DATABASE_URL -c "SELECT 1;"`

### Issue 5: "psql command not found"
**Solution:**
Railway shell includes psql, but if missing:
```bash
railway shell
apt-get update && apt-get install -y postgresql-client
psql $DATABASE_URL -f db/schema.sql
```

## Verification After Migration

### Check Database Connection
```bash
railway shell
psql $DATABASE_URL -c "\dt"
```

**Should show 6 tables:**
- tenants
- chat_webhooks  
- rules
- logs
- pipedrive_tokens
- api_usage

### Test Sample Query
```bash
railway shell
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"
```

Should return `1` (the default tenant created by migration).

## What the Migration Does

1. **Creates Extension:** UUID extension for generating IDs
2. **Creates 6 Tables:** All required database tables with proper relationships
3. **Adds Sample Data:** Creates a default tenant for development
4. **Sets Up Indexes:** Optimizes queries with proper database indexes
5. **Configures Timestamps:** Auto-updating created_at and updated_at fields

## Next Steps After Success

After migration completes successfully:
1. **Exit Railway shell:** `exit`
2. **Test your Railway deployment:** 
   ```bash
   curl https://your-railway-url.railway.app/health
   ```
3. **Proceed to Vercel frontend deployment**

---

**Your database will be ready for production! 🎯**