#!/bin/bash

# Pipenotify Testing Monitor Script
# Run this in a separate terminal while testing

echo "🚀 Pipenotify Testing Monitor Started"
echo "📊 Monitoring system health during testing..."
echo "⏰ Started at $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check frontend status
check_frontend() {
    echo -e "${BLUE}🌐 Checking frontend status...${NC}"
    if curl -s -I https://pipenotify-frontend.vercel.app | grep -q "200"; then
        echo -e "${GREEN}✅ Frontend is accessible${NC}"
    else
        echo -e "${RED}❌ Frontend unreachable${NC}"
    fi
}

# Function to check GitHub Actions
check_github_actions() {
    echo -e "${BLUE}🔄 GitHub Actions status available at:${NC}"
    echo "https://github.com/MFHanCC/PipeNotify2/actions"
}

# Function to show testing URLs
show_urls() {
    echo -e "${YELLOW}📍 Key Testing URLs:${NC}"
    echo "Frontend: https://pipenotify-frontend.vercel.app"
    echo "GitHub: https://github.com/MFHanCC/PipeNotify2"
    echo "Actions: https://github.com/MFHanCC/PipeNotify2/actions"
    echo ""
}

# Main monitoring loop
monitor_loop() {
    while true; do
        echo "🔍 Testing Monitor - $(date)"
        check_frontend
        echo ""
        echo "💡 To check Railway logs manually, run:"
        echo "   railway logs --tail"
        echo ""
        echo "🔧 To check backend deployment:"
        echo "   railway status"
        echo ""
        echo "⏳ Next check in 30 seconds... (Ctrl+C to stop)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        sleep 30
    done
}

# Show initial status
show_urls
check_frontend
check_github_actions

echo ""
echo -e "${YELLOW}🎯 Testing Phase 1: Free Plan${NC}"
echo "👉 Follow the TESTING_GUIDE.md for step-by-step instructions"
echo "🚨 Report any issues immediately - I'll provide fixes in real-time"
echo ""

# Start monitoring
echo "🔄 Starting continuous monitoring..."
monitor_loop