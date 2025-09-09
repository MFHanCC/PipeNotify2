#!/bin/bash

echo "🚀 Starting Claude Code Full-Visibility Environment"

# Create log directories
mkdir -p logs/{browser,railway,vercel,github,aggregated,claude-alerts}

# Setup environment
if [ -f .env ]; then
    source .env
fi

# Check for required tools
echo "🔍 Checking required tools..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js >= 20.0.0"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm"
    exit 1
fi

# Install monitoring dependencies if needed
echo "📦 Installing monitoring dependencies..."
cd monitoring
if [ ! -f package.json ]; then
    npm init -y
    npm install playwright ws
fi
cd ..

# Start monitoring dashboard (placeholder)
echo "📊 Starting monitoring dashboard..."
# node monitoring/dashboard-server.js &

# Start error aggregation
echo "🔍 Starting error aggregation..."
node monitoring/error-aggregator.js &

# Start browser monitoring
echo "🌐 Starting browser monitoring..."
node monitoring/browser-tests.js &

# Start deployment monitoring  
echo "🚢 Starting deployment monitoring..."
node monitoring/deployment-monitor.js &

# Start development servers
echo "🔧 Starting development servers..."

# Backend
if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    cd backend
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run dev &
    cd ..
fi

# Frontend
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    cd frontend
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm start &
    cd ..
fi

# Wait for services to be ready
sleep 10

echo "✅ Full-visibility monitoring active!"
echo ""
echo "📋 Monitoring Status:"
echo "  ✅ Browser testing: Playwright monitoring active"
echo "  ✅ Railway logs: Monitoring for railway CLI output" 
echo "  ✅ Vercel logs: Monitoring for vercel CLI output"
echo "  ✅ GitHub Actions: Monitoring via gh CLI"
echo "  ✅ Error aggregation: Active and logging to logs/"
echo ""
echo "🤖 Claude Code is now monitoring everything!"
echo "   All errors will be automatically detected and logged."
echo "   Check logs/claude-alerts/ for autonomous action triggers."
echo ""
echo "Press Ctrl+C to stop monitoring"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping monitoring services..."
    jobs -p | xargs -r kill
    echo "✅ Monitoring stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Keep script running
wait