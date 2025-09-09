# Production Deployment Commands

## Phase 6: Production Deployment - Step by Step

### Step 1: Railway Backend Deployment

**1.1 Create Railway Project**
```bash
cd backend
railway init
# Select: "Adam Greywolf's Projects" workspace
# Select: "Create empty project"
# Enter project name: "pipenotify-backend"
```

**1.2 Add Services in Railway Dashboard**
Open Railway dashboard and add these services:
1. **Add PostgreSQL**:
   - Go to your project dashboard
   - Click "Add Service" → "Database" → "PostgreSQL"
   - Wait for deployment (DATABASE_URL will be auto-generated)

2. **Add Redis**:
   - Click "Add Service" → "Database" → "Redis" 
   - Wait for deployment (REDIS_URL will be auto-generated)

**1.3 Set Environment Variables**
In Railway Dashboard → Environment Variables, add:
```bash
# Auto-generated (will appear automatically)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Add these manually
NODE_ENV=production
PIPEDRIVE_API_TOKEN=your-pipedrive-api-token
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
JWT_SECRET=your-secure-32-char-random-string
WEBHOOK_SECRET=your-secure-random-string
FRONTEND_URL=https://your-app.vercel.app  # Set after Vercel deployment
```

**1.4 Deploy Backend**
```bash
cd backend
railway up
```

**1.5 Run Database Migration**
```bash
railway shell
cd db && ./migrate.sh production
exit
```

### Step 2: Vercel Frontend Deployment

**2.1 Install Vercel CLI (if needed)**
```bash
npm install -g vercel
```

**2.2 Deploy Frontend**
```bash
cd frontend
vercel login
vercel --prod
# Follow prompts:
# - Link to existing project: No
# - Project name: pipenotify-frontend
# - Directory: ./
# - Override settings: No
```

**2.3 Set Vercel Environment Variables**
In Vercel Dashboard → Settings → Environment Variables:
```bash
REACT_APP_API_URL=https://your-backend.railway.app
REACT_APP_PIPEDRIVE_CLIENT_ID=your-pipedrive-oauth-client-id
REACT_APP_PIPEDRIVE_REDIRECT_URI=https://your-app.vercel.app/onboarding
REACT_APP_ENVIRONMENT=production
```

### Step 3: Update Cross-References

**3.1 Update Railway CORS**
In Railway Dashboard → Environment Variables, update:
```bash
FRONTEND_URL=https://your-app.vercel.app
```

**3.2 Update Pipedrive OAuth Settings**
In your Pipedrive Developer App:
- Set Redirect URI: `https://your-app.vercel.app/onboarding`
- Set Webhook URL: `https://your-backend.railway.app/api/v1/webhook/pipedrive`

### Step 4: Validation

**4.1 Test Endpoints**
```bash
# Backend health
curl https://your-backend.railway.app/health

# Frontend
curl https://your-app.vercel.app

# API status
curl https://your-backend.railway.app/status
```

**4.2 Test Application**
1. Visit your Vercel URL
2. Click "Get Started" 
3. Verify OAuth redirect works
4. Test creating a notification rule

## Get Your Deployment URLs

After deployment, you'll get:
- **Railway Backend**: `https://pipenotify-backend-production-XXXX.up.railway.app`
- **Vercel Frontend**: `https://pipenotify-frontend-XXXX.vercel.app`

## Secrets Needed

**For Railway (get these ready):**
- PIPEDRIVE_API_TOKEN (from your Pipedrive app settings)
- SENTRY_DSN (from your Sentry.io project)
- JWT_SECRET (generate: `openssl rand -base64 32`)
- WEBHOOK_SECRET (generate: `openssl rand -base64 32`)

**For Vercel:**
- REACT_APP_PIPEDRIVE_CLIENT_ID (from your Pipedrive app settings)

## Troubleshooting

**Railway Issues:**
```bash
railway logs --tail
railway status
```

**Vercel Issues:**
```bash
vercel logs
vercel env ls
```

**Database Issues:**
```bash
railway shell
echo $DATABASE_URL
psql $DATABASE_URL -c "SELECT 1;"
```

---

**Ready to deploy! Run these commands in your terminal. 🚀**