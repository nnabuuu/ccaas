#!/bin/bash
#
# CCAAS Production Smoke Test
#
# Validates the core CCAAS platform is healthy after deployment.
# Solution-agnostic — tests infrastructure only, no domain logic.
#
# Usage:
#   ./tools/smoke-test.sh
#   CCAAS_URL=http://remote:3001 DB_PATH=/path/to/data.db ./tools/smoke-test.sh
#

set -euo pipefail

# --- Configuration ---
CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"
DB_PATH="${DB_PATH:-packages/backend/.agent-workspace/data.db}"
CCAAS_PORT="${CCAAS_PORT:-$(echo "$CCAAS_URL" | grep -oE '[0-9]+$')}"

# --- Counters ---
PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  ⚠️  $1"; WARN=$((WARN + 1)); }

# ============================================================
# 1. Backend Health
# ============================================================
echo ""
echo "=== 1. Backend Health ==="

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" "${CCAAS_URL}/api/v1/health" 2>/dev/null || echo -e "\n000")
HTTP_BODY=$(echo "$HTTP_RESPONSE" | head -1)
HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  if echo "$HTTP_BODY" | grep -q '"status":"ok"'; then
    pass "GET /api/v1/health — 200, status ok"
  else
    warn "GET /api/v1/health — 200 but status not 'ok': $HTTP_BODY"
  fi
else
  fail "GET /api/v1/health — expected 200, got $HTTP_CODE (is backend running?)"
fi

# ============================================================
# 2. Database Connectivity
# ============================================================
echo ""
echo "=== 2. Database Connectivity ==="

if [ -f "$DB_PATH" ]; then
  pass "Database file exists: $DB_PATH"
else
  fail "Database file not found: $DB_PATH"
fi

if [ -r "$DB_PATH" ]; then
  pass "Database file is readable"
else
  fail "Database file is not readable: $DB_PATH"
fi

# Check core tables
CORE_TABLES="skills tenants api_keys messages message_queue jobs scheduled_tasks"
if command -v sqlite3 &>/dev/null && [ -f "$DB_PATH" ]; then
  EXISTING_TABLES=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null || echo "")
  for TABLE in $CORE_TABLES; do
    if echo "$EXISTING_TABLES" | grep -qw "$TABLE"; then
      pass "Table exists: $TABLE"
    else
      fail "Table missing: $TABLE"
    fi
  done
else
  if ! command -v sqlite3 &>/dev/null; then
    warn "sqlite3 not installed — skipping table checks"
  fi
fi

# ============================================================
# 3. Database Schema Validation
# ============================================================
echo ""
echo "=== 3. Schema Validation ==="

if command -v sqlite3 &>/dev/null && [ -f "$DB_PATH" ]; then
  # Verify enabledSkills column exists (post-migration)
  for TABLE in jobs scheduled_tasks; do
    if sqlite3 "$DB_PATH" "PRAGMA table_info($TABLE);" 2>/dev/null | grep -q "enabledSkills"; then
      pass "$TABLE has 'enabledSkills' column"
    else
      fail "$TABLE missing 'enabledSkills' column"
    fi
  done

  # Verify legacy columns are gone
  for TABLE in jobs scheduled_tasks; do
    if sqlite3 "$DB_PATH" "PRAGMA table_info($TABLE);" 2>/dev/null | grep -q "enabledSkillSlugs"; then
      fail "$TABLE still has legacy 'enabledSkillSlugs' column"
    else
      pass "$TABLE has no legacy 'enabledSkillSlugs' column"
    fi
  done
else
  warn "Skipping schema validation (sqlite3 unavailable or DB missing)"
fi

# ============================================================
# 4. API Endpoint Smoke
# ============================================================
echo ""
echo "=== 4. API Endpoints ==="

# Health (already tested above, but include in endpoint section)
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${CCAAS_URL}/api/v1/health" 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
  pass "GET /api/v1/health — $HEALTH_CODE"
else
  fail "GET /api/v1/health — $HEALTH_CODE"
fi

# Sessions controller mounted
SESSIONS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "${CCAAS_URL}/api/v1/sessions/smoke-test/messages" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping"}' 2>/dev/null || echo "000")
if [ "$SESSIONS_CODE" != "404" ] && [ "$SESSIONS_CODE" != "000" ]; then
  pass "POST /api/v1/sessions/.../messages — $SESSIONS_CODE (controller mounted)"
else
  fail "POST /api/v1/sessions/.../messages — $SESSIONS_CODE (controller not mounted?)"
fi

# Skills controller mounted
SKILLS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${CCAAS_URL}/api/v1/skills" 2>/dev/null || echo "000")
if [ "$SKILLS_CODE" != "404" ] && [ "$SKILLS_CODE" != "000" ]; then
  pass "GET /api/v1/skills — $SKILLS_CODE (controller mounted)"
else
  fail "GET /api/v1/skills — $SKILLS_CODE (controller not mounted?)"
fi

# ============================================================
# 5. Process Health
# ============================================================
echo ""
echo "=== 5. Process Health ==="

if [ -n "$CCAAS_PORT" ]; then
  LISTENERS=$(lsof -iTCP:"$CCAAS_PORT" -sTCP:LISTEN -t 2>/dev/null | wc -l | xargs)
  if [ "$LISTENERS" -ge 1 ]; then
    pass "Process listening on port $CCAAS_PORT"
    if [ "$LISTENERS" -gt 1 ]; then
      warn "Multiple processes ($LISTENERS) listening on port $CCAAS_PORT"
    fi
  else
    fail "No process listening on port $CCAAS_PORT"
  fi
else
  warn "Could not determine port from CCAAS_URL — skipping process check"
fi

# ============================================================
# 6. Summary
# ============================================================
echo ""
echo "==========================================="
TOTAL=$((PASS + FAIL + WARN))
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings ($TOTAL total)"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  ❌ SMOKE TEST FAILED"
  exit 1
else
  echo ""
  echo "  ✅ SMOKE TEST PASSED"
  exit 0
fi
