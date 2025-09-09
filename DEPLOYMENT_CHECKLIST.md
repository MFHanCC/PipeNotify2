# 🚀 Production Deployment Checklist

## Pre-Deployment Setup ✅

- [x] Railway CLI installed and authenticated (`railway whoami`)
- [x] Vercel CLI installed and authenticated  
- [x] All deployment configuration files created
- [x] Production secrets generated
- [x] Database migration script ready
- [x] Validation scripts completed (30/30 checks passed)

## Phase 6: Production Deployment Steps

### Step 1: Railway Backend Deployment

#### 1.1 Create Railway Project
```bash
cd backend
railway init
```
- [ ] Select workspace: "Adam Greywolf's Projects"
- [ ] Choose: "Create empty project"
- [ ] Name: "pipenotify-backend"

#### 1.2 Add Services (Railway Dashboard)
- [ ] Add PostgreSQL service (wait for deployment)
- [ ] Add Redis service (wait for deployment)
- [ ] Verify DATABASE_URL and REDIS_URL auto-generated

#### 1.3 Set Environment Variables (Railway Dashboard)
Copy from generated secrets:
```
NODE_ENV=production
JWT_SECRET=0+DhzOdZi5K0615WAPHbojgHkLD78auxLETs0oqIZKg=
WEBHOOK_SECRET=dDI+AI1gO1zE5Ebl94zkZzHDlsK77oh03DW8UlKnfIM=
```
Replace with actual values:
- [ ] `PIPEDRIVE_API_TOKEN=your-pipedrive-api-token`
- [ ] `SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id`
- [ ] `FRONTEND_URL=https://your-app.vercel.app` (set after Vercel)

#### 1.4 Deploy Backend
```bash
railway up
```
- [ ] Deployment successful
- [ ] Note Railway URL: `https://pipenotify-backend-production-XXXX.up.railway.app`

#### 1.5 Run Database Migration
```bash
railway shell
cd db && ./migrate.sh production
exit
```
- [ ] Migration completed successfully
- [ ] All tables created (6 tables expected)

### Step 2: Vercel Frontend Deployment

#### 2.1 Deploy Frontend
```bash
cd frontend
vercel login
vercel --prod
```
- [ ] Project created: "pipenotify-frontend"
- [ ] Note Vercel URL: `https://pipenotify-frontend-XXXX.vercel.app`

#### 2.2 Set Environment Variables (Vercel Dashboard)
```
REACT_APP_ENVIRONMENT=production
```
Replace with actual values:
- [ ] `REACT_APP_API_URL=https://your-backend.railway.app`
- [ ] `REACT_APP_PIPEDRIVE_CLIENT_ID=your-pipedrive-oauth-client-id`  
- [ ] `REACT_APP_PIPEDRIVE_REDIRECT_URI=https://your-app.vercel.app/onboarding`

### Step 3: Update Cross-References

#### 3.1 Update Railway CORS
- [ ] Set `FRONTEND_URL=https://your-app.vercel.app` in Railway dashboard

#### 3.2 Update Pipedrive OAuth Settings
In your Pipedrive Developer App:
- [ ] Redirect URI: `https://your-app.vercel.app/onboarding`
- [ ] Webhook URL: `https://your-backend.railway.app/api/v1/webhook/pipedrive`

### Step 4: Validation & Testing

#### 4.1 Health Checks
- [ ] Backend: `curl https://your-backend.railway.app/health` returns 200
- [ ] Frontend: `curl https://your-app.vercel.app` loads successfully
- [ ] API: `curl https://your-backend.railway.app/status` shows environment

#### 4.2 Application Testing
- [ ] Visit Vercel URL, app loads without errors
- [ ] Click "Get Started" button works
- [ ] OAuth redirect to Pipedrive works
- [ ] Can complete onboarding flow
- [ ] Dashboard loads and shows empty state
- [ ] API communication working (no CORS errors)

#### 4.3 Webhook Testing
- [ ] Test endpoint: `POST https://your-backend.railway.app/api/v1/webhook/pipedrive`
- [ ] Webhook processing queued (check Railway logs)
- [ ] Database queries working (no connection errors)

## Production URLs

After deployment, update these in your notes:

**Railway Backend URL:**
`https://pipenotify-backend-production-XXXX.up.railway.app`

**Vercel Frontend URL:**  
`https://pipenotify-frontend-XXXX.vercel.app`

## Required Secrets

**Get these ready before deployment:**

1. **Pipedrive API Token**: From Pipedrive App settings
2. **Pipedrive Client ID**: From Pipedrive App OAuth settings  
3. **Sentry DSN**: From Sentry.io project settings

## Troubleshooting Commands

**Railway Issues:**
```bash
railway logs --tail
railway status  
railway shell
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
psql $DATABASE_URL -c "\dt"
```

## Success Criteria

- [ ] Backend responds to health checks
- [ ] Frontend loads without console errors
- [ ] OAuth flow completes successfully  
- [ ] Database migration completed
- [ ] Webhook endpoint accessible
- [ ] CORS configured correctly
- [ ] Error tracking active

## Next Steps After Deployment

1. **Pipedrive Marketplace Submission**
   - Submit app for review with production URLs
   - Include screenshots and documentation

2. **Monitoring Setup**
   - Configure Sentry alerts
   - Set up uptime monitoring
   - Monitor error rates and performance

3. **Documentation Updates**
   - Update README with production URLs
   - Create user guide with actual screenshots
   - Document admin/support procedures

---

🎯 **Ready for production deployment!** 

All preparation complete. Execute the steps above to deploy Pipenotify to production.