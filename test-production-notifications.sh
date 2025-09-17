#!/bin/bash

# Test notification flow in production
# Make sure to replace WEBHOOK_URL with your actual Google Chat webhook URL

BACKEND_URL="https://pipenotify.up.railway.app"
WEBHOOK_URL="YOUR_GOOGLE_CHAT_WEBHOOK_URL_HERE"

echo "🧪 Testing Production Notification Flow"
echo "======================================="

if [ "$WEBHOOK_URL" = "YOUR_GOOGLE_CHAT_WEBHOOK_URL_HERE" ]; then
    echo "❌ Error: Please replace WEBHOOK_URL with your actual Google Chat webhook URL"
    echo "   Edit this script and set WEBHOOK_URL to your webhook"
    exit 1
fi

echo "📡 Backend URL: $BACKEND_URL"
echo "🎯 Webhook URL: ${WEBHOOK_URL:0:50}..."
echo ""

# Test 1: System status
echo "📊 TEST 1: System Status"
echo "------------------------"
curl -s "$BACKEND_URL/api/v1/debug/system-status" | jq .
echo ""

# Test 2: Direct chat test
echo "📬 TEST 2: Direct Chat Test"
echo "---------------------------"
curl -s -X POST "$BACKEND_URL/api/v1/test/direct-chat" \
  -H "Content-Type: application/json" \
  -d "{\"webhookUrl\": \"$WEBHOOK_URL\", \"message\": \"🧪 Production test: Direct notification working!\"}" | jq .
echo ""

# Test 3: Full notification flow diagnostic
echo "🔍 TEST 3: Complete Notification Flow Diagnostic"
echo "-----------------------------------------------"
curl -s -X POST "$BACKEND_URL/api/v1/test/notification-flow" \
  -H "Content-Type: application/json" \
  -d "{\"webhookUrl\": \"$WEBHOOK_URL\"}" | jq .
echo ""

# Test 4: Webhook pipeline test
echo "🚀 TEST 4: Full Webhook Pipeline Test"
echo "------------------------------------"
curl -s -X POST "$BACKEND_URL/api/v1/test/webhook" \
  -H "Content-Type: application/json" \
  -d "{\"webhookUrl\": \"$WEBHOOK_URL\"}" | jq .
echo ""

echo "✅ Testing complete!"
echo ""
echo "💡 Instructions:"
echo "1. Replace WEBHOOK_URL in this script with your Google Chat webhook"
echo "2. Run: chmod +x test-production-notifications.sh"
echo "3. Run: ./test-production-notifications.sh"
echo "4. Check your Google Chat for test messages"
echo "5. Review the JSON output for any failures"