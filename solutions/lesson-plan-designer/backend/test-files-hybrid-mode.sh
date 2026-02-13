#!/bin/bash
#
# Test script for Files Tab Hybrid Mode
#

set -e

BASE_URL="http://localhost:3002"
SESSION_ID="${1:-lpd_test}"

echo "=== Testing Files API Hybrid Mode ==="
echo "Session ID: $SESSION_ID"
echo ""

echo "1. Testing /tree endpoint (default options)"
curl -s "${BASE_URL}/api/v1/files/session/${SESSION_ID}/tree" | jq '.'
echo ""

echo "2. Testing /tree endpoint (with scanFilesystem=true)"
curl -s "${BASE_URL}/api/v1/files/session/${SESSION_ID}/tree?scanFilesystem=true" | jq '.stats'
echo ""

echo "3. Testing /tree endpoint (with autoImport=true)"
curl -s "${BASE_URL}/api/v1/files/session/${SESSION_ID}/tree?autoImport=true" | jq '.stats'
echo ""

echo "4. Checking database records"
sqlite3 data/lesson-plans.db "SELECT id, filename, message_id, status, uploaded_by FROM agent_files WHERE session_id = '${SESSION_ID}' LIMIT 5"
echo ""

echo "=== Test Complete ==="
