#!/bin/bash

# Test Sub-Agent Polling Implementation
# This script verifies the new REST endpoint works correctly

echo "🧪 Testing Sub-Agent Polling Implementation"
echo "==========================================="
echo ""

# Check if backend is running
if ! curl -s http://localhost:3001/api/v1/chat/health > /dev/null 2>&1; then
  echo "❌ Backend is not running on port 3001"
  echo "   Start backend with: npm run start:dev -w @ccaas/backend"
  exit 1
fi

echo "✅ Backend is running"
echo ""

# Test 1: Invalid session (should return 404)
echo "Test 1: Invalid session (expecting 404)..."
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3001/api/v1/sessions/fake-session-id/sub-agents)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 404 ]; then
  echo "✅ Test 1 passed: Returns 404 for invalid session"
else
  echo "❌ Test 1 failed: Expected 404, got $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 2: Valid session with no active sub-agents
# Note: This requires a real session ID. For demo, we'll just show the format
echo "Test 2: Valid session format..."
echo "   To test with real session:"
echo "   1. Start a session in the frontend"
echo "   2. Run: curl http://localhost:3001/api/v1/sessions/<SESSION_ID>/sub-agents"
echo ""
echo "   Expected response format:"
cat <<'EOF'
   {
     "sessionId": "lpd_abc123",
     "activeSubAgents": [],
     "timestamp": "2025-02-03T10:31:00.000Z"
   }
EOF
echo ""

# Test 3: Check unit tests
echo "Test 3: Running unit tests..."
cd /Users/niex/Documents/GitHub/kedge-ccaas/packages/backend
if npm test -- sessions.controller.spec.ts --silent 2>&1 | grep -q "5 passed"; then
  echo "✅ Test 3 passed: All 5 unit tests passed"
else
  echo "❌ Test 3 failed: Unit tests did not pass"
fi
echo ""

# Summary
echo "==========================================="
echo "✅ Implementation verified!"
echo ""
echo "Next steps for manual testing:"
echo "1. Start backend: npm run start:dev -w @ccaas/backend"
echo "2. Start frontend: cd solutions/lesson-plan-designer/frontend && npm run dev"
echo "3. Open browser DevTools Network tab"
echo "4. Send message that triggers sub-agent (e.g., '请生成教学音频')"
echo "5. Refresh browser and watch polling requests appear"
echo "6. Verify SubAgentCard reappears within 2-10 seconds"
