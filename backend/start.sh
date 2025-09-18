#!/bin/bash

# Railway Network Initialization Delay Script
# This script adds a delay to allow Railway's private networking to initialize
# before starting the Node.js application

echo "🚀 Starting Pipenotify Backend with Railway networking delay..."

# Get startup delay from environment variable or default to 3 seconds
STARTUP_DELAY=${STARTUP_DELAY:-3}

echo "⏳ Waiting ${STARTUP_DELAY} seconds for Railway network initialization..."
sleep $STARTUP_DELAY

echo "🔗 Network initialization complete, starting Node.js server..."

# Start the Node.js application
exec node server.js