#!/bin/bash
# Production Cleanup Script for Pipenotify2
# This script removes all development/testing files to prepare for production deployment

set -e  # Exit on any error

echo "🧹 Preparing Pipenotify2 for production deployment..."
echo "⚠️  This will remove all development/testing files!"

# Confirm before proceeding (unless CI environment)
if [ "$CI" != "true" ]; then
    read -p "Are you sure you want to clean for production? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Production cleanup cancelled"
        exit 1
    fi
fi

echo "🗑️  Removing test and debug files..."

# Remove HTML test interfaces
echo "  - Removing HTML test files"
rm -f test-dashboard.html
rm -f test-endpoints.html  
rm -f clear-auth.html

# Remove backend test files
echo "  - Removing backend test files"
rm -f backend/test-notification-flow.js
rm -rf backend/tests/
rm -f backend/backend.log

# Remove frontend test files  
echo "  - Removing frontend test files"
rm -rf frontend/src/tests/
rm -f frontend/frontend.log

# Remove backup files
echo "  - Removing backup files"
rm -f backend/services/*.bak
rm -f backend/services/*.bak2

# Remove dangerous scripts directory
echo "  - Removing scripts directory (contains dangerous production manipulation tools)"
rm -rf backend/scripts/

# Remove shell scripts from root
echo "  - Removing shell scripts"
rm -f *.sh
rm -f monitor-testing.sh
rm -f test-production-notifications.sh
rm -f upgrade-tenant-1.sh

# Remove development documentation from root
echo "  - Removing development documentation from root"
rm -f MIGRATION_FIX.md
rm -f TESTING_GUIDE.md
rm -f SCREENSHOT_GUIDE.md  
rm -f README_DEPLOYMENT.md
rm -f CLAUDE.md

# Remove submission assets
echo "  - Removing submission assets"
rm -rf submitInfo/

# Remove empty backup directory
echo "  - Removing empty directories"
rm -rf backups/

# Remove development environment files (keep .env.example)
echo "  - Removing development environment files"  
rm -f .env.development

# Keep these files/directories in production:
# - docs/ (user documentation)
# - frontend/public/*.html (legal pages) 
# - .env.example (template)
# - .env.production (production template)

echo "✅ Production cleanup completed successfully!"
echo "📋 Removed:"
echo "   - Test interfaces and scripts"  
echo "   - Debug and development files"
echo "   - Backup files and empty directories"
echo "   - Development documentation"
echo "   - Database manipulation scripts"
echo ""
echo "📋 Kept:"
echo "   - User documentation (/docs/)"
echo "   - Legal pages (frontend/public/)"
echo "   - Environment templates"
echo "   - All production code"
echo ""
echo "🚀 Code is now ready for production deployment!"
echo "💡 Next steps:"
echo "   1. Test that the app still builds and runs"
echo "   2. Commit these changes to main branch"  
echo "   3. Deploy to production"