#!/usr/bin/env bash

# Deployment Validation Script
# Validates deployment configuration without requiring external services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

echo "🚀 Validating deployment readiness..."
echo "📁 Project: $PROJECT_ROOT"

ERRORS=0

# Check 1: Required deployment files
echo ""
echo "📋 1. Deployment Files"
files=(
    "backend/railway.toml:Railway deployment config"
    "backend/.env.production:Backend production env"
    "backend/DEPLOYMENT.md:Backend deployment guide"
    "frontend/vercel.json:Vercel deployment config"
    "frontend/.env.production:Frontend production env"
    "frontend/DEPLOYMENT.md:Frontend deployment guide"
    ".github/workflows/deploy.yml:CI/CD workflow"
    "DEPLOYMENT.md:Main deployment guide"
)

for file_desc in "${files[@]}"; do
    file="${file_desc%:*}"
    desc="${file_desc#*:}"
    if [ -f "$PROJECT_ROOT/$file" ]; then
        success "$desc"
    else
        error "$desc missing ($file)"
        ((ERRORS++))
    fi
done

# Check 2: Package.json configurations
echo ""
echo "🔧 2. Package Configuration"

# Backend package.json
if [ -f "$PROJECT_ROOT/backend/package.json" ]; then
    if grep -q '"start".*"node server.js"' "$PROJECT_ROOT/backend/package.json"; then
        success "Backend start script configured"
    else
        error "Backend start script incorrect"
        ((ERRORS++))
    fi
    
    if grep -q '"engines"' "$PROJECT_ROOT/backend/package.json"; then
        success "Backend Node.js version specified"
    else
        warning "Backend Node.js version not specified"
    fi
else
    error "Backend package.json missing"
    ((ERRORS++))
fi

# Frontend package.json
if [ -f "$PROJECT_ROOT/frontend/package.json" ]; then
    if grep -q '"build".*"react-scripts build"' "$PROJECT_ROOT/frontend/package.json"; then
        success "Frontend build script configured"
    else
        error "Frontend build script incorrect"
        ((ERRORS++))
    fi
else
    error "Frontend package.json missing"
    ((ERRORS++))
fi

# Check 3: Environment variables
echo ""
echo "🌍 3. Environment Configuration"

# Backend environment
if [ -f "$PROJECT_ROOT/backend/.env.production" ]; then
    required_backend_vars=("DATABASE_URL" "REDIS_URL" "PIPEDRIVE_API_TOKEN" "SENTRY_DSN" "NODE_ENV")
    for var in "${required_backend_vars[@]}"; do
        if grep -q "^$var=" "$PROJECT_ROOT/backend/.env.production"; then
            success "Backend has $var"
        else
            error "Backend missing $var"
            ((ERRORS++))
        fi
    done
else
    error "Backend .env.production missing"
    ((ERRORS++))
fi

# Frontend environment
if [ -f "$PROJECT_ROOT/frontend/.env.production" ]; then
    required_frontend_vars=("REACT_APP_API_URL" "REACT_APP_PIPEDRIVE_CLIENT_ID" "REACT_APP_ENVIRONMENT")
    for var in "${required_frontend_vars[@]}"; do
        if grep -q "^$var=" "$PROJECT_ROOT/frontend/.env.production"; then
            success "Frontend has $var"
        else
            error "Frontend missing $var"
            ((ERRORS++))
        fi
    done
else
    error "Frontend .env.production missing"
    ((ERRORS++))
fi

# Check 4: Railway configuration
echo ""
echo "🚄 4. Railway Configuration"

if [ -f "$PROJECT_ROOT/backend/railway.toml" ]; then
    if grep -q 'startCommand = "npm start"' "$PROJECT_ROOT/backend/railway.toml"; then
        success "Railway start command configured"
    else
        error "Railway start command incorrect"
        ((ERRORS++))
    fi
    
    if grep -q 'buildCommand = "npm install"' "$PROJECT_ROOT/backend/railway.toml"; then
        success "Railway build command configured"
    else
        warning "Railway build command not standard"
    fi
else
    error "Railway configuration missing"
    ((ERRORS++))
fi

# Check 5: Vercel configuration
echo ""
echo "🔺 5. Vercel Configuration"

if [ -f "$PROJECT_ROOT/frontend/vercel.json" ]; then
    if grep -q '"@vercel/static-build"' "$PROJECT_ROOT/frontend/vercel.json"; then
        success "Vercel build configuration correct"
    else
        error "Vercel build configuration incorrect"
        ((ERRORS++))
    fi
    
    if grep -q '"distDir": "build"' "$PROJECT_ROOT/frontend/vercel.json"; then
        success "Vercel output directory configured"
    else
        error "Vercel output directory not configured"
        ((ERRORS++))
    fi
else
    error "Vercel configuration missing"
    ((ERRORS++))
fi

# Check 6: Database configuration
echo ""
echo "🗄️  6. Database Configuration"

if [ -f "$PROJECT_ROOT/backend/db/schema.sql" ]; then
    success "Database schema exists"
    
    # Check for required tables
    required_tables=("tenants" "chat_webhooks" "rules" "logs")
    for table in "${required_tables[@]}"; do
        if grep -q "CREATE TABLE $table" "$PROJECT_ROOT/backend/db/schema.sql"; then
            success "Schema includes $table table"
        else
            error "Schema missing $table table"
            ((ERRORS++))
        fi
    done
else
    error "Database schema missing"
    ((ERRORS++))
fi

if [ -f "$PROJECT_ROOT/backend/db/migrate.sh" ] && [ -x "$PROJECT_ROOT/backend/db/migrate.sh" ]; then
    success "Migration script exists and is executable"
else
    error "Migration script missing or not executable"
    ((ERRORS++))
fi

# Check 7: CI/CD configuration
echo ""
echo "🔄 7. CI/CD Configuration"

if [ -f "$PROJECT_ROOT/.github/workflows/deploy.yml" ]; then
    if grep -q "deploy-backend" "$PROJECT_ROOT/.github/workflows/deploy.yml"; then
        success "CI/CD has backend deployment"
    else
        error "CI/CD missing backend deployment"
        ((ERRORS++))
    fi
    
    if grep -q "deploy-frontend" "$PROJECT_ROOT/.github/workflows/deploy.yml"; then
        success "CI/CD has frontend deployment"
    else
        error "CI/CD missing frontend deployment"
        ((ERRORS++))
    fi
    
    if grep -q "RAILWAY_TOKEN" "$PROJECT_ROOT/.github/workflows/deploy.yml"; then
        success "CI/CD configured for Railway"
    else
        error "CI/CD missing Railway configuration"
        ((ERRORS++))
    fi
    
    if grep -q "VERCEL_TOKEN" "$PROJECT_ROOT/.github/workflows/deploy.yml"; then
        success "CI/CD configured for Vercel"
    else
        error "CI/CD missing Vercel configuration"
        ((ERRORS++))
    fi
else
    error "CI/CD workflow missing"
    ((ERRORS++))
fi

# Summary
echo ""
echo "📊 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Ready for deployment.${NC}"
    echo ""
    echo "✅ Railway backend deployment ready"
    echo "✅ Vercel frontend deployment ready"
    echo "✅ CI/CD pipeline configured"
    echo "✅ Database migration prepared"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Create Railway project and services"
    echo "   2. Set environment variables in Railway dashboard"
    echo "   3. Deploy backend: railway up"
    echo "   4. Run database migration"
    echo "   5. Create Vercel project and deploy frontend"
    echo "   6. Update cross-references (CORS, OAuth)"
    echo "   7. Set up GitHub Actions secrets"
    echo ""
    echo "📖 See DEPLOYMENT.md for detailed instructions"
    exit 0
else
    echo -e "${RED}❌ $ERRORS errors found. Fix before deploying.${NC}"
    echo ""
    echo "🔧 Review the errors above and:"
    echo "   - Check missing files"
    echo "   - Verify environment variables"
    echo "   - Validate configuration files"
    echo ""
    echo "📖 See DEPLOYMENT.md for setup instructions"
    exit 1
fi