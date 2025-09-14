# Deployment Guide - Marketplace Ready

## 🚀 Production Deployment (Railway + Vercel)

### Backend (Railway)
1. **Railway automatically provides these environment variables:**
   ```bash
   DATABASE_URL=postgresql://...  # Railway PostgreSQL
   REDIS_URL=redis://...          # Railway Redis
   PORT=8080                      # Railway assigns port
   ```

2. **You must set these in Railway dashboard:**
   ```bash
   PIPEDRIVE_CLIENT_ID=your_actual_client_id
   PIPEDRIVE_CLIENT_SECRET=your_actual_client_secret
   PIPEDRIVE_REDIRECT_URI=https://your-app.railway.app/auth/callback
   JWT_SECRET=your_secure_jwt_secret
   WEBHOOK_SECRET=your_pipedrive_webhook_secret
   SENTRY_DSN=https://your-sentry-dsn
   FRONTEND_URL=https://your-app.vercel.app
   NODE_ENV=production
   ```

### Frontend (Vercel)
1. **Set in Vercel dashboard:**
   ```bash
   REACT_APP_API_URL=https://your-app.railway.app
   NODE_ENV=production
   ```

## 🔧 Development Setup

### Option 1: Railway Database Proxy (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Connect to your Railway project
railway login
railway link

# Run with Railway proxy (automatically provides DATABASE_URL, REDIS_URL)
railway run npm start
```

### Option 2: Staging Environment
```bash
# Set staging URLs in .env.development
DATABASE_URL=postgresql://staging-db-url
REDIS_URL=redis://staging-redis-url
FRONTEND_URL=https://staging-frontend.vercel.app
REACT_APP_API_URL=https://staging-backend.railway.app
```

## ⚠️ NEVER Hardcode localhost

❌ **Wrong:**
```bash
DATABASE_URL=postgresql://localhost:5432/db
FRONTEND_URL=http://localhost:3000
```

✅ **Right:**
```bash
# Use Railway proxy or staging URLs
DATABASE_URL=postgresql://staging.railway.app:5432/db
FRONTEND_URL=https://preview.vercel.app
```

## 🏢 Multi-Tenant Architecture

Each customer gets:
- ✅ Isolated tenant data (tenant_id in all tables)
- ✅ Dynamic Pipedrive URLs (company_domain based)
- ✅ Separate webhook configurations
- ✅ Individual subscription management
- ✅ No hardcoded company-specific values