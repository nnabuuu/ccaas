#!/bin/bash
# Test script for tenant creation with auto-create API key feature

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "🧪 Testing Tenant Creation with Auto-Create API Key Feature"
echo "============================================================"
echo ""

# Get admin API key from environment or prompt
if [ -z "$ADMIN_API_KEY" ]; then
  echo "⚠️  ADMIN_API_KEY not set"
  echo "Please provide an admin API key:"
  read -r ADMIN_API_KEY
fi

echo "✅ Using backend: $BACKEND_URL"
echo ""

# Test 1: Create tenant without API key (backward compatibility)
echo "Test 1: Create tenant without API key (backward compatibility)"
echo "---------------------------------------------------------------"
RESPONSE_1=$(curl -s -X POST "$BACKEND_URL/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{
    "name": "Test Tenant Legacy",
    "slug": "test-tenant-legacy"
  }')

echo "$RESPONSE_1" | jq '.'
echo ""

TENANT_1_ID=$(echo "$RESPONSE_1" | jq -r '.tenant.id')
HAS_API_KEY_1=$(echo "$RESPONSE_1" | jq -r '.apiKey')

if [ "$HAS_API_KEY_1" == "null" ]; then
  echo "✅ Test 1 PASSED: No API key created (backward compatible)"
else
  echo "❌ Test 1 FAILED: API key was created unexpectedly"
  exit 1
fi
echo ""

# Test 2: Create tenant with API key
echo "Test 2: Create tenant with auto-create API key"
echo "-----------------------------------------------"
RESPONSE_2=$(curl -s -X POST "$BACKEND_URL/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{
    "name": "Test Tenant Auto Key",
    "slug": "test-tenant-auto-key",
    "autoCreateApiKey": true
  }')

echo "$RESPONSE_2" | jq '.'
echo ""

TENANT_2_ID=$(echo "$RESPONSE_2" | jq -r '.tenant.id')
API_KEY_2=$(echo "$RESPONSE_2" | jq -r '.apiKey')
RAW_KEY_2=$(echo "$RESPONSE_2" | jq -r '.rawKey')
WARNING_2=$(echo "$RESPONSE_2" | jq -r '.warning')

if [ "$API_KEY_2" != "null" ] && [ "$RAW_KEY_2" != "null" ]; then
  echo "✅ Test 2 PASSED: API key created successfully"
  echo "   API Key ID: $(echo "$RESPONSE_2" | jq -r '.apiKey.id')"
  echo "   Key Prefix: $(echo "$RESPONSE_2" | jq -r '.apiKey.keyPrefix')"
  echo "   Scopes: $(echo "$RESPONSE_2" | jq -r '.apiKey.scopes | join(", ")')"
  echo "   Raw Key: ${RAW_KEY_2:0:20}..."
else
  echo "❌ Test 2 FAILED: API key was not created"
  exit 1
fi
echo ""

# Test 3: Verify API key works
echo "Test 3: Verify created API key works"
echo "-------------------------------------"
SKILLS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/v1/skills" \
  -H "X-API-Key: $RAW_KEY_2")

echo "$SKILLS_RESPONSE" | jq '.'
echo ""

if echo "$SKILLS_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
  echo "✅ Test 3 PASSED: API key works for authentication"
else
  echo "❌ Test 3 FAILED: API key authentication failed"
  exit 1
fi
echo ""

# Test 4: Test authentication (should fail without key)
echo "Test 4: Test authentication protection"
echo "---------------------------------------"
UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Unauthorized Tenant",
    "slug": "unauthorized"
  }')

HTTP_CODE=$(echo "$UNAUTH_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
  echo "✅ Test 4 PASSED: Unauthenticated requests are rejected (401)"
else
  echo "❌ Test 4 FAILED: Expected 401, got $HTTP_CODE"
  exit 1
fi
echo ""

# Test 5: Test with autoCreateApiKey: false
echo "Test 5: Create tenant with autoCreateApiKey: false"
echo "----------------------------------------------------"
RESPONSE_5=$(curl -s -X POST "$BACKEND_URL/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{
    "name": "Test Tenant No Key Explicit",
    "slug": "test-tenant-no-key-explicit",
    "autoCreateApiKey": false
  }')

echo "$RESPONSE_5" | jq '.'
echo ""

HAS_API_KEY_5=$(echo "$RESPONSE_5" | jq -r '.apiKey')

if [ "$HAS_API_KEY_5" == "null" ]; then
  echo "✅ Test 5 PASSED: No API key created when autoCreateApiKey: false"
else
  echo "❌ Test 5 FAILED: API key was created unexpectedly"
  exit 1
fi
echo ""

echo "🎉 All tests passed!"
echo ""
echo "Summary:"
echo "- ✅ Backward compatibility: Tenants created without API key by default"
echo "- ✅ Auto-create feature: API key created when autoCreateApiKey: true"
echo "- ✅ API key authentication: Created key works for requests"
echo "- ✅ Security: Unauthenticated requests are rejected"
echo "- ✅ Explicit false: autoCreateApiKey: false works correctly"
echo ""
echo "Cleanup:"
echo "  Tenant 1 ID: $TENANT_1_ID"
echo "  Tenant 2 ID: $TENANT_2_ID"
echo "  Tenant 2 API Key: ${RAW_KEY_2:0:20}..."
