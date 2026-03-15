#!/bin/bash
#
# Builder Flow End-to-End Smoke Test
#
# Validates the complete builder API key flow:
#   admin key → builder key → tenant → skill → chat key → conversation
#
# Prerequisites:
#   - Backend running (npm run dev:backend)
#   - jq installed (optional, falls back to grep)
#   - ADMIN_KEY set (or INITIAL_ADMIN_KEY used at backend startup)
#
# Usage:
#   ADMIN_KEY=sk-xxx bash solutions/business/builder-smoke-test/smoke-test.sh
#   CCAAS_URL=http://remote:3001 ADMIN_KEY=sk-xxx bash solutions/business/builder-smoke-test/smoke-test.sh
#

set -euo pipefail

# --- Configuration ---
CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"
ADMIN_KEY="${ADMIN_KEY:-}"
TIMESTAMP=$(date +%s)
SLUG_SUFFIX="smoke-${TIMESTAMP}"

# --- Counters ---
PASS=0
FAIL=0
TOTAL_STEPS=7

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

# --- JSON helpers ---
# Extract a JSON field value. Uses jq if available, falls back to grep.
json_field() {
  local json="$1"
  local field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$field // empty" 2>/dev/null
  else
    # Fallback: naive extraction for simple string/number values
    echo "$json" | grep -o "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/'
  fi
}

# --- Validate prerequisites ---
if [ -z "$ADMIN_KEY" ]; then
  echo "ERROR: ADMIN_KEY environment variable is required."
  echo ""
  echo "Usage:"
  echo "  ADMIN_KEY=sk-your-admin-key bash $0"
  echo ""
  echo "The admin key is created on first backend startup."
  echo "Set INITIAL_ADMIN_KEY env var before starting the backend to use a fixed key."
  exit 1
fi

echo ""
echo "=========================================="
echo "  Builder Flow E2E Smoke Test"
echo "  URL: ${CCAAS_URL}"
echo "  Slug suffix: ${SLUG_SUFFIX}"
echo "=========================================="

# ============================================================
# Step 0: Health Check
# ============================================================
echo ""
echo "=== Step 0: Health Check ==="

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" "${CCAAS_URL}/api/v1/health" 2>/dev/null || echo -e "\n000")
HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  pass "GET /api/v1/health — 200 OK"
else
  fail "GET /api/v1/health — expected 200, got ${HTTP_CODE} (is backend running at ${CCAAS_URL}?)"
  echo ""
  echo "  Cannot continue without a healthy backend. Exiting."
  exit 1
fi

# ============================================================
# Step 1: Create Builder User + link to default tenant
# ============================================================
echo ""
echo "=== Step 1: Create Builder User ==="

# 1a. Resolve default tenant UUID
DEFAULT_TENANT_RESPONSE=$(curl -s "${CCAAS_URL}/api/v1/tenants/default" \
  -H "Authorization: Bearer ${ADMIN_KEY}" 2>/dev/null || echo "{}")
DEFAULT_TENANT_UUID=$(json_field "$DEFAULT_TENANT_RESPONSE" "id")

if [ -z "$DEFAULT_TENANT_UUID" ]; then
  fail "Could not resolve default tenant UUID"
else
  # 1b. Create user
  USER_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${CCAAS_URL}/users" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_KEY}" \
    -d "{
      \"email\": \"builder-${SLUG_SUFFIX}@smoke-test.local\",
      \"name\": \"Builder Smoke User ${TIMESTAMP}\"
    }" 2>/dev/null || echo -e "\n000")

  USER_BODY=$(echo "$USER_RESPONSE" | sed '$d')
  USER_CODE=$(echo "$USER_RESPONSE" | tail -1)

  if [ "$USER_CODE" = "201" ]; then
    BUILDER_USER_ID=$(json_field "$USER_BODY" "id")
    if [ -n "$BUILDER_USER_ID" ]; then
      # 1c. Link user to default tenant
      LINK_RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST "${CCAAS_URL}/users/tenants" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ADMIN_KEY}" \
        -d "{
          \"userId\": \"${BUILDER_USER_ID}\",
          \"tenantId\": \"${DEFAULT_TENANT_UUID}\",
          \"role\": \"admin\"
        }" 2>/dev/null || echo -e "\n000")
      LINK_CODE=$(echo "$LINK_RESPONSE" | tail -1)

      if [ "$LINK_CODE" = "201" ]; then
        pass "POST /users + /users/tenants — user=${BUILDER_USER_ID:0:8}... linked to default tenant"
      else
        fail "POST /users/tenants — expected 201, got ${LINK_CODE}"
        echo "  Response: $(echo "$LINK_RESPONSE" | sed '$d')"
      fi
    else
      fail "POST /users — 201 but user id not found in response"
    fi
  else
    fail "POST /users — expected 201, got ${USER_CODE}"
    echo "  Response: ${USER_BODY}"
  fi
fi

# ============================================================
# Step 2: Create Builder API Key (using admin key)
# ============================================================
echo ""
echo "=== Step 2: Create Builder API Key ==="

if [ -z "${BUILDER_USER_ID:-}" ]; then
  fail "Skipping — no user from Step 1"
else
  BUILDER_KEY_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${CCAAS_URL}/api/v1/admin/api-keys" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_KEY}" \
    -d "{
      \"tenantId\": \"default\",
      \"name\": \"builder-${SLUG_SUFFIX}\",
      \"scopes\": [\"builder\"],
      \"userId\": \"${BUILDER_USER_ID}\"
    }" 2>/dev/null || echo -e "\n000")

  BUILDER_KEY_BODY=$(echo "$BUILDER_KEY_RESPONSE" | sed '$d')
  BUILDER_KEY_CODE=$(echo "$BUILDER_KEY_RESPONSE" | tail -1)

  if [ "$BUILDER_KEY_CODE" = "201" ]; then
    BUILDER_KEY=$(json_field "$BUILDER_KEY_BODY" "rawKey")
    if [ -n "$BUILDER_KEY" ]; then
      pass "POST /api/v1/admin/api-keys — 201, builder key created (${BUILDER_KEY:0:16}...)"
    else
      fail "POST /api/v1/admin/api-keys — 201 but rawKey not found in response"
    fi
  else
    fail "POST /api/v1/admin/api-keys — expected 201, got ${BUILDER_KEY_CODE}"
    echo "  Response: ${BUILDER_KEY_BODY}"
  fi
fi

# ============================================================
# Step 3: Create Tenant (using builder key)
# ============================================================
echo ""
echo "=== Step 3: Create Tenant ==="

if [ -z "${BUILDER_KEY:-}" ]; then
  fail "Skipping — no builder key from Step 2"
else
  TENANT_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${CCAAS_URL}/api/v1/builder/tenants" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BUILDER_KEY}" \
    -d "{
      \"name\": \"Smoke Test Tenant ${TIMESTAMP}\",
      \"slug\": \"${SLUG_SUFFIX}\"
    }" 2>/dev/null || echo -e "\n000")

  TENANT_BODY=$(echo "$TENANT_RESPONSE" | sed '$d')
  TENANT_CODE=$(echo "$TENANT_RESPONSE" | tail -1)

  if [ "$TENANT_CODE" = "201" ]; then
    TENANT_ID=$(json_field "$TENANT_BODY" "id")
    if [ -z "$TENANT_ID" ]; then
      # Try nested tenant.id
      if command -v jq &>/dev/null; then
        TENANT_ID=$(echo "$TENANT_BODY" | jq -r ".tenant.id // .id // empty" 2>/dev/null)
      fi
    fi
    if [ -n "$TENANT_ID" ]; then
      pass "POST /api/v1/builder/tenants — 201, tenant=${TENANT_ID:0:8}..."
    else
      fail "POST /api/v1/builder/tenants — 201 but tenantId not found in response"
    fi
  else
    fail "POST /api/v1/builder/tenants — expected 201, got ${TENANT_CODE}"
    echo "  Response: ${TENANT_BODY}"
  fi
fi

# ============================================================
# Step 4: Register Skill (using builder key + X-Tenant-Id)
# ============================================================
echo ""
echo "=== Step 4: Register Skill ==="

if [ -z "${BUILDER_KEY:-}" ] || [ -z "${TENANT_ID:-}" ]; then
  fail "Skipping — missing builder key or tenant ID from previous steps"
else
  SKILL_CONTENT="You are a simple echo assistant for smoke testing. When a user sends a message, acknowledge it and repeat back the key points. Keep responses short."

  SKILL_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${CCAAS_URL}/api/v1/skills" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BUILDER_KEY}" \
    -H "X-Tenant-Id: ${TENANT_ID}" \
    -d "{
      \"name\": \"Echo Chat ${TIMESTAMP}\",
      \"slug\": \"echo-chat-${SLUG_SUFFIX}\",
      \"content\": \"${SKILL_CONTENT}\",
      \"type\": \"skill\"
    }" 2>/dev/null || echo -e "\n000")

  SKILL_BODY=$(echo "$SKILL_RESPONSE" | sed '$d')
  SKILL_CODE=$(echo "$SKILL_RESPONSE" | tail -1)

  if [ "$SKILL_CODE" = "201" ]; then
    SKILL_SLUG=$(json_field "$SKILL_BODY" "slug")
    pass "POST /api/v1/skills — 201, slug=${SKILL_SLUG:-echo-chat-${SLUG_SUFFIX}}"
  else
    fail "POST /api/v1/skills — expected 201, got ${SKILL_CODE}"
    echo "  Response: ${SKILL_BODY}"
  fi
fi

# ============================================================
# Step 5: Create Chat API Key (using builder key)
# ============================================================
echo ""
echo "=== Step 5: Create Chat API Key ==="

if [ -z "${BUILDER_KEY:-}" ] || [ -z "${TENANT_ID:-}" ]; then
  fail "Skipping — missing builder key or tenant ID from previous steps"
else
  CHAT_KEY_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${CCAAS_URL}/api/v1/builder/tenants/${TENANT_ID}/api-keys" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BUILDER_KEY}" \
    -d "{
      \"name\": \"chat-key-${SLUG_SUFFIX}\",
      \"scopes\": [\"chat\", \"skills:read\", \"skills:execute\"]
    }" 2>/dev/null || echo -e "\n000")

  CHAT_KEY_BODY=$(echo "$CHAT_KEY_RESPONSE" | sed '$d')
  CHAT_KEY_CODE=$(echo "$CHAT_KEY_RESPONSE" | tail -1)

  if [ "$CHAT_KEY_CODE" = "201" ]; then
    CHAT_KEY=$(json_field "$CHAT_KEY_BODY" "rawKey")
    if [ -n "$CHAT_KEY" ]; then
      pass "POST /api/v1/builder/tenants/:id/api-keys — 201, chat key created (${CHAT_KEY:0:16}...)"
    else
      fail "POST /api/v1/builder/tenants/:id/api-keys — 201 but rawKey not found in response"
    fi
  else
    fail "POST /api/v1/builder/tenants/:id/api-keys — expected 201, got ${CHAT_KEY_CODE}"
    echo "  Response: ${CHAT_KEY_BODY}"
  fi
fi

# ============================================================
# Step 6: Send Message via SSE (using chat key)
# ============================================================
echo ""
echo "=== Step 6: Send Message (SSE) ==="

if [ -z "${CHAT_KEY:-}" ] || [ -z "${TENANT_ID:-}" ]; then
  fail "Skipping — missing chat key or tenant ID from previous steps"
else
  SESSION_ID="smoke-session-${TIMESTAMP}"
  SKILL_SLUG_TO_USE="${SKILL_SLUG:-echo-chat-${SLUG_SUFFIX}}"

  # Use timeout to read the first few seconds of SSE stream
  # timeout returns 124 on timeout (expected), which is fine
  SSE_OUTPUT=$(timeout 15 curl -s -N \
    -X POST "${CCAAS_URL}/api/v1/sessions/${SESSION_ID}/messages" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${CHAT_KEY}" \
    -H "X-Tenant-Id: ${TENANT_ID}" \
    -d "{
      \"message\": \"Hello, this is a smoke test. Please echo back: builder flow works.\",
      \"tenantId\": \"${TENANT_ID}\",
      \"enabledSkills\": [\"${SKILL_SLUG_TO_USE}\"]
    }" 2>/dev/null || true)

  if [ -z "$SSE_OUTPUT" ]; then
    fail "POST /api/v1/sessions/:id/messages — no SSE output received"
  else
    # Check for SSE event indicators
    HAS_EVENTS=false

    if echo "$SSE_OUTPUT" | grep -q "text_delta\|agent_status\|tool_activity"; then
      HAS_EVENTS=true
    fi

    # Also check for data: prefix (SSE format)
    if echo "$SSE_OUTPUT" | grep -q "^data:"; then
      HAS_EVENTS=true
    fi

    if [ "$HAS_EVENTS" = "true" ]; then
      # Count event lines for detail
      EVENT_COUNT=$(echo "$SSE_OUTPUT" | grep -c "^data:" || echo "0")
      pass "POST /api/v1/sessions/:id/messages — SSE stream received (${EVENT_COUNT} events)"
    else
      # Check for error in response
      if echo "$SSE_OUTPUT" | grep -qi "error\|unauthorized\|forbidden"; then
        fail "POST /api/v1/sessions/:id/messages — received error response"
        echo "  Response (first 500 chars): ${SSE_OUTPUT:0:500}"
      else
        fail "POST /api/v1/sessions/:id/messages — SSE stream received but no expected events found"
        echo "  Response (first 500 chars): ${SSE_OUTPUT:0:500}"
      fi
    fi
  fi
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
  echo "  ❌ BUILDER FLOW SMOKE TEST FAILED"
  exit 1
else
  echo ""
  echo "  ✅ BUILDER FLOW SMOKE TEST PASSED"
  exit 0
fi
