# OAuth Redirect URI Configuration Fix

## Problem Solved
Fixed "Redirect URI match failed" error during onboarding process.

## Root Cause
The OAuth redirect URI was incorrectly pointing to the backend instead of the frontend:
- ❌ **Wrong**: `https://backend.railway.app/api/v1/oauth/callback`
- ✅ **Correct**: `https://frontend.vercel.app/onboarding`

## Correct OAuth Flow
1. **User clicks "Connect Pipedrive"** → Pipedrive OAuth page
2. **Pipedrive redirects** → Frontend `/onboarding?code=xxx`
3. **Frontend receives code** → Calls backend `/api/v1/oauth/callback` 
4. **Backend processes code** → Returns JWT token

## Environment Configuration

### Development
```bash
PIPEDRIVE_REDIRECT_URI=http://localhost:3000/onboarding
FRONTEND_URL=http://localhost:3000
```

### Production
```bash
PIPEDRIVE_REDIRECT_URI=https://pipenotify-frontend.vercel.app/onboarding
FRONTEND_URL=https://pipenotify-frontend.vercel.app
```

## Pipedrive App Configuration
Update your Pipedrive app registration to match these redirect URIs:
- **Development**: `http://localhost:3000/onboarding`
- **Production**: `https://pipenotify-frontend.vercel.app/onboarding`

## Files Updated
- `backend/.env` (local development)
- `.env.production` (production template)
- `.env.example` (documentation)

## Testing
After updating Pipedrive app registration, test the onboarding flow:
1. Start development servers
2. Navigate to `/onboarding`
3. Click "Connect Pipedrive"
4. Complete OAuth flow without redirect errors