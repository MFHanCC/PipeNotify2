#!/usr/bin/env bash

# Database Migration Script for Railway PostgreSQL
# Usage: ./migrate.sh [environment]
# Default environment: production

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"

echo "🚀 Starting database migration for $ENVIRONMENT environment..."

# Load environment variables
if [ -f "$SCRIPT_DIR/../.env" ]; then
    source "$SCRIPT_DIR/../.env"
fi

if [ -f "$SCRIPT_DIR/../.env.production" ] && [ "$ENVIRONMENT" = "production" ]; then
    source "$SCRIPT_DIR/../.env.production"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "For Railway: Set in Railway dashboard → Environment Variables"
    echo "For local: Set in .env file or export DATABASE_URL='your-database-url'"
    exit 1
fi

DB_URL="$DATABASE_URL"

echo "📊 Database URL: ${DB_URL%/*}/[hidden]"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql command not found. Please install PostgreSQL client."
    echo "Railway: Use 'railway shell' to access psql"
    exit 1
fi

# Verify PostgreSQL connection
echo "🔍 Testing database connection..."
if ! psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ ERROR: Cannot connect to database"
    echo "Check your DATABASE_URL and network connection"
    exit 1
fi

echo "✅ Database connection successful"

# Run migration
echo "📋 Running schema migration..."
if psql "$DB_URL" -f "$SCHEMA_FILE"; then
    echo "✅ Migration completed successfully"
    
    # Verify tables were created
    echo "🔍 Verifying table creation..."
    TABLE_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    echo "📊 Created $TABLE_COUNT tables"
    
    # Show table list
    echo "📋 Tables created:"
    psql "$DB_URL" -c "\dt"
    
    # Show sample data count if tables exist
    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo "📝 Initial data counts:"
        echo "   - Tenants: $(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM tenants;" 2>/dev/null | tr -d ' ' || echo '0')"
        echo "   - Webhooks: $(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM chat_webhooks;" 2>/dev/null | tr -d ' ' || echo '0')"
        echo "   - Rules: $(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM rules;" 2>/dev/null | tr -d ' ' || echo '0')"
    fi
    
else
    echo "❌ Migration failed"
    exit 1
fi

echo "🎉 Database migration completed successfully!"
echo "🚀 Ready for Railway deployment!"