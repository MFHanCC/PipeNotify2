# Vercel Frontend Deployment Guide

## Prerequisites
1. Vercel account: https://vercel.com
2. GitHub repository connected to Vercel
3. Vercel CLI installed: `npm install -g vercel`

## Vercel Project Setup

### 1. Create Vercel Project
```bash
vercel login
cd frontend
vercel
# Follow prompts to create new project
# Select "Deploy" when prompted
```

### 2. Environment Variables
Set in Vercel Dashboard → Settings → Environment Variables:

**Required for production:**
- `REACT_APP_API_URL` - Railway backend URL (e.g., https://your-backend.railway.app)
- `REACT_APP_PIPEDRIVE_CLIENT_ID` - Pipedrive OAuth client ID
- `REACT_APP_PIPEDRIVE_REDIRECT_URI` - Production redirect URI (e.g., https://your-app.vercel.app/onboarding)
- `REACT_APP_ENVIRONMENT=production`

**Optional configuration:**
- `REACT_APP_SENTRY_DSN` - Frontend error tracking
- `REACT_APP_ENABLE_DEBUG=false`
- `REACT_APP_ENABLE_ANALYTICS=true`

### 3. Build Configuration
Vercel automatically detects React apps and uses:
- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

### 4. Custom Domain (Optional)
Configure custom domain in Vercel Dashboard → Settings → Domains

## Deployment Commands

### Manual Deployment
```bash
cd frontend
vercel --prod
```

### Environment Check
```bash
vercel env ls
vercel logs
```

### Preview Deployment
```bash
vercel
# Creates preview deployment for testing
```

## Post-Deployment Updates

### Update Railway CORS
After Vercel deployment, update Railway backend environment:
```
FRONTEND_URL=https://your-app.vercel.app
```

### Update Pipedrive OAuth
Update Pipedrive app settings with new redirect URI:
```
https://your-app.vercel.app/onboarding
```

## Health Check
After deployment, verify:
- `https://your-app.vercel.app` loads successfully
- OAuth flow redirects correctly to `/onboarding`
- API communication with Railway backend works
- No console errors in browser

## Troubleshooting
- Check Vercel logs: `vercel logs --tail`
- Verify environment variables: `vercel env ls`
- Test build locally: `npm run build && npm run start`
- Check Functions tab in Vercel dashboard for errors