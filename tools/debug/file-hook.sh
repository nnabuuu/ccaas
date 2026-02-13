#!/bin/bash
#
# Verify WriteFileTrackerHook Execution
#
# This script tests whether the WriteFileTrackerHook is working correctly
# by creating a session, writing a file, and checking database records.
#
# Usage:
#   ./verify-file-hook.sh
#
# Expected Output:
#   - CCAAS backend logs showing "[DEBUG] WriteFileTracker triggered"
#   - Database record in agent_files table
#   - WebSocket file_created event (if frontend connected)
#

set -e

CCAAS_URL="http://localhost:3001"
TENANT_ID="test-tenant"

echo "=== Verify WriteFileTrackerHook Execution ==="
echo ""

# Step 1: Check if CCAAS backend is running
echo "Step 1: Checking CCAAS backend status..."
if ! curl -s "${CCAAS_URL}/api/v1/chat/health" > /dev/null; then
  echo "❌ CCAAS backend is not running at ${CCAAS_URL}"
  echo "   Start it with: cd packages/backend && npm run start:dev"
  exit 1
fi
echo "✅ CCAAS backend is running"
echo ""

# Step 2: Create a session via REST API
echo "Step 2: Creating test session..."
SESSION_RESPONSE=$(curl -s -X POST "${CCAAS_URL}/api/v1/sessions" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"${TENANT_ID}\",
    \"message\": \"Create a file called test-$(date +%s).txt with content: Hello from verification script!\"
  }")

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" == "null" ]; then
  echo "❌ Failed to create session"
  echo "   Response: $SESSION_RESPONSE"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"
echo ""

# Step 3: Wait for file to be written
echo "Step 3: Waiting for file to be written (30 seconds)..."
sleep 30
echo ""

# Step 4: Check database for agent_files record
echo "Step 4: Checking database for file records..."
DB_PATH="packages/backend/.agent-workspace/data.db"

if [ ! -f "$DB_PATH" ]; then
  echo "❌ Database not found at $DB_PATH"
  exit 1
fi

FILES_QUERY="SELECT id, filename, original_path, size, status, uploaded_by, message_id, session_id, created_at
FROM agent_files
WHERE session_id = '$SESSION_ID'
ORDER BY created_at DESC LIMIT 5"

echo "Running query:"
echo "$FILES_QUERY"
echo ""

FILES_RESULT=$(sqlite3 "$DB_PATH" "$FILES_QUERY" 2>&1 || echo "QUERY_FAILED")

if [ "$FILES_RESULT" == "QUERY_FAILED" ]; then
  echo "❌ Database query failed"
  exit 1
fi

if [ -z "$FILES_RESULT" ]; then
  echo "❌ No files found in database for session $SESSION_ID"
  echo ""
  echo "This means WriteFileTrackerHook did NOT create a database record."
  echo ""
  echo "Possible reasons:"
  echo "  1. Hook skipped due to missing message context (currentAssistantMessageId)"
  echo "  2. Hook failed with error (check backend logs)"
  echo "  3. File not written by CLI yet (wait longer)"
  echo ""
  echo "Check backend logs for:"
  echo "  grep -i 'writefiletracker' packages/backend/logs/*"
  echo "  grep -i 'no assistant message context' packages/backend/logs/*"
  echo ""
  exit 1
fi

echo "✅ Files found in database:"
echo "$FILES_RESULT"
echo ""

# Step 5: Check if message_id is set
MESSAGE_ID=$(echo "$FILES_RESULT" | head -1 | cut -d'|' -f7)

if [ -z "$MESSAGE_ID" ] || [ "$MESSAGE_ID" == "null" ]; then
  echo "⚠️  File record exists but message_id is NULL"
  echo "   This confirms the message context timing issue."
  echo ""
  echo "Fix: Set session.currentAssistantMessageId BEFORE CLI execution"
else
  echo "✅ File is associated with message: $MESSAGE_ID"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Next Steps:"
echo "  1. Check CCAAS backend logs for detailed hook execution:"
echo "     tail -f packages/backend/logs/*.log | grep -i 'writefiletracker'"
echo ""
echo "  2. Check session workspace directory:"
echo "     ls -la packages/backend/.agent-workspace/sessions/${SESSION_ID}/"
echo ""
echo "  3. If files exist in workspace but NOT in database:"
echo "     → Hook is being skipped (check logs for reason)"
echo ""
echo "  4. If message_id is NULL:"
echo "     → Fix message context timing in session.service.ts"
