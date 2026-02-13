#!/bin/bash

# Test Files API Endpoints
# Usage: ./test-files-api.sh

set -e

BASE_URL="http://localhost:3002"
SESSION_ID="test-session-$(date +%s)"

echo "🧪 Testing Files API"
echo "===================="
echo ""

# Test 1: Get empty file tree
echo "✅ Test 1: Get empty file tree"
RESPONSE=$(curl -s "$BASE_URL/api/v1/files/session/$SESSION_ID/tree")
echo "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"tree":\[\]'; then
  echo "✅ PASS: Empty tree returned"
else
  echo "❌ FAIL: Expected {tree:[]}"
  exit 1
fi
echo ""

# Test 2: Upload a file
echo "✅ Test 2: Upload a file"
echo "Hello, World!" > /tmp/test-file.txt
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/files/upload" \
  -F "file=@/tmp/test-file.txt" \
  -F "sessionId=$SESSION_ID")
echo "Upload Response: $UPLOAD_RESPONSE"

FILE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$FILE_ID" ]; then
  echo "❌ FAIL: No file ID returned"
  exit 1
fi
echo "✅ PASS: File uploaded with ID: $FILE_ID"
echo ""

# Test 3: Get file tree with uploaded file
echo "✅ Test 3: Get file tree with uploaded file"
TREE_RESPONSE=$(curl -s "$BASE_URL/api/v1/files/session/$SESSION_ID/tree")
echo "Tree Response: $TREE_RESPONSE"
if echo "$TREE_RESPONSE" | grep -q 'test-file.txt'; then
  echo "✅ PASS: File appears in tree"
else
  echo "❌ FAIL: File not found in tree"
  exit 1
fi
echo ""

# Test 4: Download file
echo "✅ Test 4: Download file"
curl -s "$BASE_URL/api/v1/files/$FILE_ID/download" -o /tmp/downloaded-file.txt
if diff /tmp/test-file.txt /tmp/downloaded-file.txt > /dev/null; then
  echo "✅ PASS: Downloaded file matches original"
else
  echo "❌ FAIL: Downloaded file differs from original"
  exit 1
fi
echo ""

# Test 5: Mark file as synced
echo "✅ Test 5: Mark file as synced"
SYNC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/files/$FILE_ID/sync")
echo "Sync Response: $SYNC_RESPONSE"
if echo "$SYNC_RESPONSE" | grep -q '"status":"synced"'; then
  echo "✅ PASS: File marked as synced"
else
  echo "❌ FAIL: Failed to mark as synced"
  exit 1
fi
echo ""

# Test 6: Get new files count
echo "✅ Test 6: Get new files count"
COUNT_RESPONSE=$(curl -s "$BASE_URL/api/v1/files/session/$SESSION_ID/new-count")
echo "Count Response: $COUNT_RESPONSE"
if echo "$COUNT_RESPONSE" | grep -q '"count":0'; then
  echo "✅ PASS: No new files after marking as synced"
else
  echo "❌ FAIL: Expected count to be 0"
  exit 1
fi
echo ""

# Cleanup
rm -f /tmp/test-file.txt /tmp/downloaded-file.txt

echo "===================="
echo "✅ All tests passed!"
echo "===================="
