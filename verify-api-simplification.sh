#!/bin/bash
set -e

echo "=== API Simplification Verification ==="
echo ""

BASE_URL="http://localhost:3001"

# Test 1: Health endpoint (should work)
echo "✓ Testing GET /api/v1/chat/health..."
HEALTH=$(curl -s "${BASE_URL}/api/v1/chat/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "  ✅ Health endpoint works"
else
  echo "  ❌ Health endpoint failed: $HEALTH"
  exit 1
fi

# Test 2: Status endpoint (should work)
echo "✓ Testing GET /api/v1/chat/status..."
STATUS=$(curl -s "${BASE_URL}/api/v1/chat/status")
if echo "$STATUS" | grep -q '"status":"ready"'; then
  echo "  ✅ Status endpoint works"
else
  echo "  ❌ Status endpoint failed: $STATUS"
  exit 1
fi

# Test 3: Deleted endpoint - /api/v1/chat/send (should return 404)
echo "✓ Testing POST /api/v1/chat/send (should be deleted)..."
SEND_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/api/v1/chat/send" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"test","message":"test"}')
HTTP_CODE=$(echo "$SEND_RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "404" ]; then
  echo "  ✅ Endpoint correctly deleted (404)"
else
  echo "  ❌ Endpoint should be deleted but returned: $HTTP_CODE"
  exit 1
fi

# Test 4: Standard endpoint - /api/v1/sessions/:id/completion (should exist)
echo "✓ Testing POST /api/v1/sessions/test/completion (standard API)..."
COMPLETION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/api/v1/sessions/test/completion" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"test","message":"test"}')
HTTP_CODE=$(echo "$COMPLETION_RESPONSE" | tail -1)
if [ "$HTTP_CODE" != "404" ]; then
  echo "  ✅ Standard endpoint exists (not 404)"
else
  echo "  ❌ Standard endpoint should exist: $HTTP_CODE"
  exit 1
fi

echo ""
echo "=== ✅ All Verification Tests Passed ==="
