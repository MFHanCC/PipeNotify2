# Release Process for Pipenotify2

This document outlines the complete process for releasing Pipenotify2 from development to production.

## Branch Structure Overview

- **`main`** - Production-ready code, clean and marketplace-ready
- **`development`** - Active development with all debug tools and test files
- **`release/vX.X.X`** - Temporary branches for preparing releases

## Daily Development Workflow

### Working on Features
```bash
# Always start from development
git checkout development
git pull origin development

# Make your changes, test with debug endpoints
# All test tools are available: test-dashboard.html, debug endpoints, etc.

# Commit and push
git add .
git commit -m "Add new feature or fix"
git push origin development
```

### Creating Feature Branches (Optional)
```bash
# For larger features, create a branch
git checkout development
git checkout -b feature/new-notification-type

# Work on feature
# ... make changes ...

# Merge back to development
git checkout development
git merge feature/new-notification-type
git push origin development
```

## Production Release Process

### Step 1: Prepare Release Branch
```bash
# Create release branch from development
git checkout development
git checkout -b release/v1.0.0

# Run production cleanup
./scripts/prepare-production.sh

# Verify cleanup worked
ls -la  # Should not see test files
node backend/server.js  # Should see "Production mode - debug endpoints disabled"
```

### Step 2: Test Production Build
```bash
# Test backend production build
cd backend
npm install --production
NODE_ENV=production npm start

# Test frontend production build  
cd ../frontend
npm run build
# Check that build succeeds
```

### Step 3: Update Version Numbers
```bash
# Update package.json versions
cd backend
npm version 1.0.0

cd ../frontend  
npm version 1.0.0

# Commit version updates
git add .
git commit -m "Version bump to 1.0.0"
```

### Step 4: Final Code Review
- Review all changes that will go to production
- Ensure no console.log statements in critical paths
- Verify all environment variables are properly configured
- Test that app works without debug endpoints

### Step 5: Merge to Main
```bash
# Switch to main and merge
git checkout main
git merge release/v1.0.0

# Tag the release
git tag -a v1.0.0 -m "Release v1.0.0 - Initial marketplace launch"

# Push to production
git push origin main
git push origin v1.0.0
```

### Step 6: Deploy to Production
The deployment will happen automatically:
- **Backend**: Railway will deploy from main branch
- **Frontend**: Vercel will deploy from main branch

### Step 7: Verify Production Deployment
1. Check Railway logs for successful deployment
2. Check Vercel deployment status
3. Test production URLs
4. Verify no debug endpoints are accessible

### Step 8: Clean Up
```bash
# Delete release branch
git branch -d release/v1.0.0

# Switch back to development for future work
git checkout development
```

## Environment-Specific Features

### Development Environment
**Available in development branch:**
- ✅ `/api/v1/dev/create-tenant` - Create test tenants
- ✅ `/api/v1/test/*` - All test endpoints
- ✅ `/api/v1/debug/*` - Debug endpoints
- ✅ `test-dashboard.html` - HTML testing interface
- ✅ `test-endpoints.html` - API testing dashboard
- ✅ Backend scripts for fixing issues
- ✅ Console.log debugging output
- ✅ Test files and utilities

### Production Environment  
**Clean production main branch:**
- ❌ No debug endpoints
- ❌ No test files
- ❌ No console.log output
- ❌ No backend manipulation scripts
- ✅ Only production-ready code
- ✅ User documentation
- ✅ Legal pages (privacy, terms)

## Emergency Hotfixes

If production has a critical issue:

```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-bug-fix

# Make minimal fix
# ... fix the bug ...

# Test the fix
npm test

# Merge to main
git checkout main
git merge hotfix/critical-bug-fix
git push origin main

# Also merge back to development
git checkout development  
git merge hotfix/critical-bug-fix
git push origin development

# Clean up
git branch -d hotfix/critical-bug-fix
```

## Rollback Process

If production deployment fails:

```bash
# Find last working tag
git tag --sort=-version:refname

# Rollback to previous version
git checkout main
git reset --hard v0.9.0  # Previous working version
git push --force-with-lease origin main

# Or create a rollback tag
git tag -a v1.0.1-rollback -m "Rollback to v0.9.0"
git push origin v1.0.1-rollback
```

## Checklist Before Release

### Pre-Release Checklist
- [ ] All features tested in development environment
- [ ] Backend scripts removed or protected
- [ ] Console.log statements cleaned from production code
- [ ] Environment variables documented and configured
- [ ] Database migrations tested
- [ ] Frontend builds successfully
- [ ] Backend starts without errors in production mode

### Post-Release Checklist
- [ ] Production deployment successful
- [ ] Health endpoints responding
- [ ] No debug endpoints accessible
- [ ] Error monitoring active (Sentry)
- [ ] Database connections working
- [ ] Redis/BullMQ working
- [ ] OAuth flow working
- [ ] Webhook processing working

## Useful Commands

```bash
# Check current branch
git branch

# See what's different between development and main  
git diff development main

# Check deployment status
# Railway: railway status  
# Vercel: vercel ls

# View production logs
# Railway: railway logs
# Vercel: vercel logs

# Test production environment locally
NODE_ENV=production npm start
```

## Branch Protection Rules

**For `main` branch:**
- Require pull request before merging
- Require status checks to pass
- No direct pushes allowed
- No force pushes allowed

**For `development` branch:**
- Allow direct pushes (for quick fixes)
- Require status checks for PRs (optional)

This process ensures clean separation between development and production while maintaining the ability to debug and iterate quickly.