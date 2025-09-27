#!/bin/bash

# Railway Network Initialization Delay Script
# This script adds a delay to allow Railway's private networking to initialize
# before starting the Node.js application

echo "🚀 Starting Pipenotify Backend with Railway networking delay..."

# Get startup delay from environment variable or default to 3 seconds
STARTUP_DELAY=${STARTUP_DELAY:-3}

echo "⏳ Waiting ${STARTUP_DELAY} seconds for Railway network initialization..."
sleep $STARTUP_DELAY

echo "🔗 Network initialization complete, running migrations and starting Node.js server..."

# Skip migrations during Railway startup due to network timing issues
if [ "$SKIP_MIGRATIONS" = "true" ] || [ "$RAILWAY_ENVIRONMENT" = "production" ]; then
    echo "⚠️ Skipping database migrations (Railway startup optimization)"
    echo "💡 Run migrations manually: railway run node backend/scripts/migrate.js"
else
    # Run database migrations
    echo "🔄 Running database migrations..."
    if timeout 30 node scripts/migrate.js; then
        echo "✅ Database migrations completed successfully"
    else
        echo "⚠️ Database migrations timed out or failed, continuing with server start"
    fi
fi

# Start the Node.js application
exec node server.js
