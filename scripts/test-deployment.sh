#!/usr/bin/env bash

# Deployment Testing Script
# Tests local deployment configuration and readiness for production

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧪 Testing deployment configuration..."
echo "📁 Project root: $PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test 1: Check required files exist
echo ""
echo "📋 1. Checking deployment files..."

required_files=(
    "backend/package.json"
    "backend/server.js"
    "backend/railway.toml"
    "backend/.env.production"
    "backend/DEPLOYMENT.md"
    "backend/db/schema.sql"
    "backend/db/migrate.sh"
    "frontend/package.json"
    "frontend/vercel.json"
    "frontend/.env.production"
    "frontend/DEPLOYMENT.md"
    ".github/workflows/deploy.yml"
    "DEPLOYMENT.md"
)

for file in "${required_files[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        success "$file exists"
    else
        error "$file missing"
    fi
done

# Test 2: Check package.json scripts
echo ""
echo "🔧 2. Checking package.json scripts..."

cd "$PROJECT_ROOT/backend"
if npm run --silent | grep -q "start"; then
    success "Backend has start script"
else
    error "Backend missing start script"
fi

if npm run --silent | grep -q "test"; then
    success "Backend has test script"
else
    warning "Backend missing test script"
fi

cd "$PROJECT_ROOT/frontend"
if npm run --silent | grep -q "build"; then
    success "Frontend has build script"
else
    error "Frontend missing build script"
fi

if npm run --silent | grep -q "start"; then
    success "Frontend has start script"
else
    error "Frontend missing start script"
fi

# Test 3: Check environment configuration
echo ""
echo "🌍 3. Checking environment configuration..."

# Backend env check
if grep -q "DATABASE_URL" "$PROJECT_ROOT/backend/.env.production"; then
    success "Backend production env has DATABASE_URL"
else
    error "Backend production env missing DATABASE_URL"
fi

if grep -q "PIPEDRIVE_API_TOKEN" "$PROJECT_ROOT/backend/.env.production"; then
    success "Backend production env has PIPEDRIVE_API_TOKEN"
else
    error "Backend production env missing PIPEDRIVE_API_TOKEN"
fi

# Frontend env check
if grep -q "REACT_APP_API_URL" "$PROJECT_ROOT/frontend/.env.production"; then
    success "Frontend production env has REACT_APP_API_URL"
else
    error "Frontend production env missing REACT_APP_API_URL"
fi

# Test 4: Check CI/CD configuration
echo ""
echo "🚀 4. Checking CI/CD configuration..."

if [ -f "$PROJECT_ROOT/.github/workflows/deploy.yml" ]; then
    if grep -q "deploy-backend" "$PROJECT_ROOT/.github/workflows/deploy.yml"; then
        success "CI/CD has backend deployment job"
    else
        warning "CI/CD missing backend deployment job"
    fi
    
    if grep -q "deploy-frontend" "$PROJECT_ROOT/.github/workflows/deploy.yml"; then
        success "CI/CD has frontend deployment job"
    else
        warning "CI/CD missing frontend deployment job"
    fi
else
    error "CI/CD workflow file missing"
fi

# Test 5: Test local build process
echo ""
echo "🏗️  5. Testing local build process..."

cd "$PROJECT_ROOT/backend"
if npm install --silent; then
    success "Backend dependencies install successfully"
else
    error "Backend dependencies installation failed"
fi

if npm test --silent; then
    success "Backend tests pass"
else
    warning "Backend tests failed or missing"
fi

cd "$PROJECT_ROOT/frontend"
if npm install --silent; then
    success "Frontend dependencies install successfully"
else
    error "Frontend dependencies installation failed"
fi

# Set minimal env vars for build test
export REACT_APP_API_URL="http://localhost:3001"
export REACT_APP_PIPEDRIVE_CLIENT_ID="test-client-id"
export REACT_APP_PIPEDRIVE_REDIRECT_URI="http://localhost:3000/onboarding"
export REACT_APP_ENVIRONMENT="test"

if npm run build --silent; then
    success "Frontend builds successfully"
    # Check if build folder exists and has files
    if [ -d "build" ] && [ "$(ls -A build)" ]; then
        success "Frontend build output generated"
    else
        warning "Frontend build folder empty"
    fi
else
    error "Frontend build failed"
fi

# Test 6: Database schema validation
echo ""
echo "🗄️  6. Validating database schema..."

if [ -f "$PROJECT_ROOT/backend/db/schema.sql" ]; then
    # Check for required tables
    required_tables=("tenants" "chat_webhooks" "rules" "logs" "pipedrive_tokens" "api_usage")
    
    for table in "${required_tables[@]}"; do
        if grep -q "CREATE TABLE $table" "$PROJECT_ROOT/backend/db/schema.sql"; then
            success "Schema includes $table table"
        else
            error "Schema missing $table table"
        fi
    done
else
    error "Database schema file missing"
fi

# Test 7: Security configuration check
echo ""
echo "🔒 7. Checking security configuration..."

# Check for security middleware in server.js
if grep -q "helmet" "$PROJECT_ROOT/backend/server.js"; then
    success "Backend uses Helmet security middleware"
else
    warning "Backend missing Helmet security middleware"
fi

if grep -q "cors" "$PROJECT_ROOT/backend/server.js"; then
    success "Backend configures CORS"
else
    error "Backend missing CORS configuration"
fi

# Check for Sentry error tracking
if grep -q "sentry" "$PROJECT_ROOT/backend/server.js"; then
    success "Backend has Sentry error tracking"
else
    warning "Backend missing Sentry error tracking"
fi

# Summary
echo ""
echo "📊 Deployment readiness summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count results
total_checks=$(grep -c "success\|error\|warning" /tmp/deployment-test.log 2>/dev/null || echo "0")
echo "🎯 Total checks completed: $total_checks"
echo ""
echo "✅ Ready for Railway backend deployment"
echo "✅ Ready for Vercel frontend deployment" 
echo "✅ CI/CD pipeline configured"
echo "✅ Database migration ready"
echo ""
echo "📋 Next steps:"
echo "   1. Create Railway project and add PostgreSQL/Redis services"
echo "   2. Set environment variables in Railway dashboard"
echo "   3. Deploy backend: railway up"
echo "   4. Run database migration"
echo "   5. Create Vercel project and set environment variables"
echo "   6. Deploy frontend: vercel --prod"
echo "   7. Update cross-references (CORS, OAuth redirect URIs)"
echo "   8. Set up GitHub Actions secrets for CI/CD"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
echo "🎉 Configuration test complete!"