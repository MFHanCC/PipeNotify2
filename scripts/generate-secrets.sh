#!/usr/bin/env bash

# Generate Production Secrets
# Creates secure random strings for JWT and webhook secrets

set -e

echo "🔐 Generating production secrets..."
echo ""

# Generate JWT Secret (32 bytes, base64 encoded)
JWT_SECRET=$(openssl rand -base64 32)
echo "🔑 JWT_SECRET (copy to Railway):"
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Generate Webhook Secret (32 bytes, base64 encoded)  
WEBHOOK_SECRET=$(openssl rand -base64 32)
echo "🔗 WEBHOOK_SECRET (copy to Railway):"
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET"
echo ""

echo "📋 Environment Variables for Railway:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "NODE_ENV=production"
echo "JWT_SECRET=$JWT_SECRET"
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET"
echo "PIPEDRIVE_API_TOKEN=your-pipedrive-api-token"
echo "SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id"
echo "FRONTEND_URL=https://your-app.vercel.app"
echo ""

echo "📋 Environment Variables for Vercel:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "REACT_APP_API_URL=https://your-backend.railway.app"
echo "REACT_APP_PIPEDRIVE_CLIENT_ID=your-pipedrive-oauth-client-id"
echo "REACT_APP_PIPEDRIVE_REDIRECT_URI=https://your-app.vercel.app/onboarding"
echo "REACT_APP_ENVIRONMENT=production"
echo ""

echo "💡 Next steps:"
echo "1. Copy these secrets to Railway and Vercel dashboards"
echo "2. Replace 'your-*' placeholders with actual values"
echo "3. Update URLs after deployment"
echo ""
echo "🔒 Keep these secrets secure and don't commit them to git!"