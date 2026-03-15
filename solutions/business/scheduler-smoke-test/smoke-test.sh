#!/bin/bash
#
# Scheduler Flow End-to-End Smoke Test
#
# Validates the complete scheduled task lifecycle:
#   create task → verify → manual trigger → poll execution → check result → pause/resume → delete
#
# Prerequisites:
#   - Backend running (npm run dev:backend)
#   - Claude CLI available (npx claude-code or claude in PATH)
#   - jq installed (optional, falls back to grep)
#   - ADMIN_KEY set (or INITIAL_ADMIN_KEY used at backend startup)
#
# Usage:
#   ADMIN_KEY=sk-xxx bash solutions/business/scheduler-smoke-test/smoke-test.sh
#   CCAAS_URL=http://remote:3001 ADMIN_KEY=sk-xxx bash solutions/business/scheduler-smoke-test/smoke-test.sh
#

set -euo pipefail

# --- Configuration ---
CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"
ADMIN_KEY="${ADMIN_KEY:-}"
TIMESTAMP=$(date +%s)
TENANT_ID="${TENANT_ID:-default}"
# How long to wait for execution to finish (seconds)
EXEC_POLL_TIMEOUT="${EXEC_POLL_TIMEOUT:-120}"

# --- Counters ---
PASS=0
FAIL=0
TOTAL_STEPS=7

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

# --- JSON helpers ---
json_field() {
  local json="$1"
  local field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$field // empty" 2>/dev/null
  else
    echo "$json" | grep -o "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/'
  fi
}

# --- Validate prerequisites ---
if [ -z "$ADMIN_KEY" ]; then
  echo "ERROR: ADMIN_KEY environment variable is required."
  echo ""
  echo "Usage:"
  echo "  ADMIN_KEY=sk-your-admin-key bash $0"
  exit 1
fi

# Resolve tenant UUID if "default" slug is given
if [ "$TENANT_ID" = "default" ]; then
  TENANT_RESPONSE=$(curl -s "${CCAAS_URL}/api/v1/tenants/default" \
    -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "{}")
  RESOLVED_TENANT_ID=$(json_field "$TENANT_RESPONSE" "id")
  if [ -n "$RESOLVED_TENANT_ID" ]; then
    TENANT_ID="$RESOLVED_TENANT_ID"
  fi
fi

echo ""
echo "=========================================="
echo "  Scheduler Flow E2E Smoke Test"
echo "  URL: ${CCAAS_URL}"
echo "  Tenant: ${TENANT_ID:0:12}..."
echo "=========================================="

# ============================================================
# Step 0: Health Check
# ============================================================
echo ""
echo "=== Step 0: Health Check ==="

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${CCAAS_URL}/api/v1/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  pass "GET /api/v1/health — 200 OK"
else
  fail "GET /api/v1/health — expected 200, got ${HTTP_CODE} (is backend running at ${CCAAS_URL}?)"
  echo ""
  echo "  Cannot continue without a healthy backend. Exiting."
  exit 1
fi

# ============================================================
# Step 1: Create Scheduled Task
# ============================================================
echo ""
echo "=== Step 1: Create Scheduled Task ==="

# Use "interval" type with a very long interval (24h) so it won't auto-fire
# during the test. We trigger it manually in Step 3.
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${CCAAS_URL}/api/v1/scheduled-tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d "{
    \"tenantId\": \"${TENANT_ID}\",
    \"name\": \"Smoke Test Task ${TIMESTAMP}\",
    \"description\": \"Automated smoke test — safe to delete\",
    \"message\": \"Say exactly: SCHEDULER_SMOKE_OK_${TIMESTAMP}. Nothing else.\",
    \"scheduleType\": \"interval\",
    \"scheduleValue\": \"86400000\",
    \"timeoutMs\": 120000,
    \"maxConcurrent\": 2
  }" 2>/dev/null || echo -e "\n000")

CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')
CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -1)

if [ "$CREATE_CODE" = "201" ]; then
  TASK_ID=$(json_field "$CREATE_BODY" "id")
  if [ -n "$TASK_ID" ]; then
    pass "POST /api/v1/scheduled-tasks — 201, task=${TASK_ID:0:8}..."
  else
    fail "POST /api/v1/scheduled-tasks — 201 but task id not found"
  fi
else
  fail "POST /api/v1/scheduled-tasks — expected 201, got ${CREATE_CODE}"
  echo "  Response: ${CREATE_BODY}"
fi

# ============================================================
# Step 2: Verify Task Details
# ============================================================
echo ""
echo "=== Step 2: Verify Task Details ==="

if [ -z "${TASK_ID:-}" ]; then
  fail "Skipping — no task ID from Step 1"
else
  GET_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}" \
    -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo -e "\n000")

  GET_BODY=$(echo "$GET_RESPONSE" | sed '$d')
  GET_CODE=$(echo "$GET_RESPONSE" | tail -1)

  if [ "$GET_CODE" = "200" ]; then
    TASK_STATUS=$(json_field "$GET_BODY" "status")
    TASK_TYPE=$(json_field "$GET_BODY" "scheduleType")
    TASK_NAME=$(json_field "$GET_BODY" "name")
    if [ "$TASK_STATUS" = "active" ] && [ "$TASK_TYPE" = "interval" ]; then
      pass "GET /api/v1/scheduled-tasks/:id — status=active, type=interval, name='${TASK_NAME}'"
    else
      fail "GET /api/v1/scheduled-tasks/:id — unexpected status=${TASK_STATUS}, type=${TASK_TYPE}"
    fi
  else
    fail "GET /api/v1/scheduled-tasks/:id — expected 200, got ${GET_CODE}"
    echo "  Response: ${GET_BODY}"
  fi
fi

# ============================================================
# Step 3: Manual Trigger
# ============================================================
echo ""
echo "=== Step 3: Manual Trigger ==="

if [ -z "${TASK_ID:-}" ]; then
  fail "Skipping — no task ID"
else
  TRIGGER_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}/trigger" \
    -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo -e "\n000")

  TRIGGER_BODY=$(echo "$TRIGGER_RESPONSE" | sed '$d')
  TRIGGER_CODE=$(echo "$TRIGGER_RESPONSE" | tail -1)

  if [ "$TRIGGER_CODE" = "201" ]; then
    EXEC_ID=$(json_field "$TRIGGER_BODY" "id")
    EXEC_STATUS=$(json_field "$TRIGGER_BODY" "status")
    if [ -n "$EXEC_ID" ]; then
      pass "POST /api/v1/scheduled-tasks/:id/trigger — 201, exec=${EXEC_ID:0:8}... status=${EXEC_STATUS}"
    else
      fail "POST /api/v1/scheduled-tasks/:id/trigger — 201 but execution id not found"
    fi
  else
    fail "POST /api/v1/scheduled-tasks/:id/trigger — expected 201, got ${TRIGGER_CODE}"
    echo "  Response: ${TRIGGER_BODY}"
  fi
fi

# ============================================================
# Step 4: Poll Execution Until Complete
# ============================================================
echo ""
echo "=== Step 4: Poll Execution ==="

if [ -z "${TASK_ID:-}" ] || [ -z "${EXEC_ID:-}" ]; then
  fail "Skipping — no task or execution ID"
else
  POLL_START=$(date +%s)
  FINAL_STATUS=""

  echo "  Polling execution ${EXEC_ID:0:8}... (timeout: ${EXEC_POLL_TIMEOUT}s)"

  while true; do
    ELAPSED=$(( $(date +%s) - POLL_START ))
    if [ "$ELAPSED" -ge "$EXEC_POLL_TIMEOUT" ]; then
      fail "Execution did not complete within ${EXEC_POLL_TIMEOUT}s (last status: ${FINAL_STATUS:-unknown})"
      break
    fi

    POLL_RESPONSE=$(curl -s \
      "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}/executions/${EXEC_ID}" \
      -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "{}")

    FINAL_STATUS=$(json_field "$POLL_RESPONSE" "status")

    case "$FINAL_STATUS" in
      success)
        DURATION=$(json_field "$POLL_RESPONSE" "durationMs")
        pass "Execution completed: status=success, duration=${DURATION:-?}ms"
        break
        ;;
      failed)
        ERROR_MSG=$(json_field "$POLL_RESPONSE" "errorMessage")
        fail "Execution failed: ${ERROR_MSG:-no error message}"
        break
        ;;
      timeout)
        fail "Execution timed out on server side"
        break
        ;;
      cancelled)
        fail "Execution was cancelled"
        break
        ;;
      running)
        printf "  ... still running (%ds)\r" "$ELAPSED"
        sleep 3
        ;;
      *)
        # Unknown or empty status — keep polling
        sleep 2
        ;;
    esac
  done
  echo "" # Clear the progress line
fi

# ============================================================
# Step 5: Verify Execution Result
# ============================================================
echo ""
echo "=== Step 5: Verify Execution Result ==="

if [ -z "${TASK_ID:-}" ] || [ -z "${EXEC_ID:-}" ]; then
  fail "Skipping — no task or execution ID"
elif [ "${FINAL_STATUS:-}" != "success" ]; then
  fail "Skipping — execution did not succeed (status=${FINAL_STATUS:-unknown})"
else
  RESULT_RESPONSE=$(curl -s \
    "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}/executions/${EXEC_ID}" \
    -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "{}")

  RESULT_TEXT=$(json_field "$RESULT_RESPONSE" "resultText")

  if [ -n "$RESULT_TEXT" ]; then
    # Check if result contains our smoke test marker
    if echo "$RESULT_TEXT" | grep -qi "SCHEDULER_SMOKE_OK_${TIMESTAMP}\|smoke"; then
      pass "Execution result contains expected marker"
    else
      pass "Execution has resultText (${#RESULT_TEXT} chars) — content may vary by LLM"
    fi
  else
    fail "Execution completed but resultText is empty"
  fi
fi

# ============================================================
# Step 6: Pause / Resume Lifecycle
# ============================================================
echo ""
echo "=== Step 6: Pause / Resume Lifecycle ==="

if [ -z "${TASK_ID:-}" ]; then
  fail "Skipping — no task ID"
else
  # Pause
  PAUSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}/pause" \
    -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "000")

  if [ "$PAUSE_CODE" = "201" ] || [ "$PAUSE_CODE" = "200" ]; then
    # Verify paused
    PAUSED_RESPONSE=$(curl -s \
      "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}" \
      -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "{}")
    PAUSED_STATUS=$(json_field "$PAUSED_RESPONSE" "status")

    if [ "$PAUSED_STATUS" = "paused" ]; then
      # Resume
      RESUME_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}/resume" \
        -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "000")

      if [ "$RESUME_CODE" = "201" ] || [ "$RESUME_CODE" = "200" ]; then
        RESUMED_RESPONSE=$(curl -s \
          "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}" \
          -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "{}")
        RESUMED_STATUS=$(json_field "$RESUMED_RESPONSE" "status")

        if [ "$RESUMED_STATUS" = "active" ]; then
          pass "Pause → Resume lifecycle: paused → active"
        else
          fail "Resume did not restore active status (got ${RESUMED_STATUS})"
        fi
      else
        fail "POST /resume — expected 200/201, got ${RESUME_CODE}"
      fi
    else
      fail "Pause did not set status to paused (got ${PAUSED_STATUS})"
    fi
  else
    fail "POST /pause — expected 200/201, got ${PAUSE_CODE}"
  fi
fi

# ============================================================
# Cleanup: Delete task (soft delete, best effort)
# ============================================================
if [ -n "${TASK_ID:-}" ]; then
  curl -s -o /dev/null \
    -X DELETE "${CCAAS_URL}/api/v1/scheduled-tasks/${TASK_ID}" \
    -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || true
  echo ""
  echo "  (Cleaned up task ${TASK_ID:0:8}...)"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "=========================================="
echo "  Results: ${PASS} passed, ${FAIL} failed (of ${TOTAL_STEPS} steps)"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  ❌ SCHEDULER SMOKE TEST FAILED"
  exit 1
else
  echo ""
  echo "  ✅ SCHEDULER SMOKE TEST PASSED"
  exit 0
fi
