#!/bin/bash

# Test CCAAS File Registration Endpoint
# This script tests the new /api/v1/files/register endpoint

set -e

echo "🧪 Testing CCAAS File Registration"
echo "=================================="
echo ""

# Create a test file
TEST_FILE="/tmp/ccaas-test-$(date +%s).txt"
echo "Hello from CCAAS file service integration test!" > "$TEST_FILE"
echo "✅ Created test file: $TEST_FILE"
echo ""

# Register the file with CCAAS
echo "📤 Registering file with CCAAS..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/files/register \
  -H "Content-Type: application/json" \
  -d "{
    \"originalPath\": \"$TEST_FILE\",
    \"sessionId\": \"test-session-$(date +%s)\",
    \"tenantId\": \"default\"
  }")

echo "Response: $RESPONSE"
echo ""

# Extract fileId from response
FILE_ID=$(echo "$RESPONSE" | grep -o '"fileId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$FILE_ID" ]; then
  echo "❌ Failed to register file - no fileId in response"
  exit 1
fi

echo "✅ File registered successfully!"
echo "   File ID: $FILE_ID"
echo ""

# Test download
echo "📥 Testing file download..."
DOWNLOAD_URL="http://localhost:3001/api/v1/files/$FILE_ID/download"
DOWNLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" "$DOWNLOAD_URL")
HTTP_CODE=$(echo "$DOWNLOAD_RESPONSE" | tail -n1)
CONTENT=$(echo "$DOWNLOAD_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ File downloaded successfully!"
  echo "   Content: $CONTENT"
else
  echo "❌ File download failed with HTTP $HTTP_CODE"
  exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "Next steps:"
echo "1. Test with NotebookLM skill in frontend"
echo "2. Verify attachments appear in lesson plan"
echo "3. Click download and check Network tab (should be localhost:3001)"
