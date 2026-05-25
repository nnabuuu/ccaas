#!/bin/sh
# End-to-end smoke for the agent-runtime <-> live-lesson wiring.
#
# What it does:
#   1. Hits live-lesson (:3007) to create a CourseProject (auto-scaffolded
#      with plan/lesson-plan.md + execution/manifest.json).
#   2. Subscribes to ccaas's project change SSE stream in the background.
#   3. Sends a first message to ccaas (:3001) to instantiate a session
#      under the live-lesson-creator tenant + edit-lesson template
#      (auto-creates the session record).
#   4. Calls POST /sessions/:id/bind-project to wire the session to the
#      project — this fires session.bound which bootstraps the workspace
#      by loading artifacts from live-lesson.
#   5. Tails the SSE stream — expect two "updated" events for
#      plan/lesson-plan.md and execution/manifest.json (the bootstrap
#      load).
#
# Requirements:
#   - both backends running:
#       cd packages/backend && SOLUTIONS_DIR=$(realpath ../../solutions/business) \
#         WORKSPACE_PROVIDER=local AUTH_ALLOW_ANONYMOUS=true \
#         node dist/src/main.js
#       cd solutions/business/live-lesson/backend && node dist/main.js
#   - the live-lesson-creator solution has been imported (it is, on
#     startup, when SOLUTIONS_DIR is set)
#   - jq + curl
#
# Auth note: with AUTH_ALLOW_ANONYMOUS=true (default in dev), the @Auth
# scope guards on bind-project / messages let anonymous through. For a
# production deploy you'd need an API key — see
# packages/backend/scripts/create-dev-api-key.ts.
#
# Exit code 0 = the bootstrap SSE events were received; non-zero = fail.

set -e
CCAAS=${CCAAS:-http://127.0.0.1:3001}
LLL=${LLL:-http://127.0.0.1:3007}
TENANT_SLUG=${TENANT_SLUG:-live-lesson-creator}
TPL=${TPL:-edit-lesson}
# TENANT_ID can be passed explicitly. Otherwise resolved from the
# tenants list by slug (works against any deployment, not just the dev
# DB the original PoC was authored against).
TENANT_ID=${TENANT_ID:-}

NO_PROXY=127.0.0.1,localhost
export NO_PROXY no_proxy=$NO_PROXY

if [ -z "$TENANT_ID" ]; then
  echo "==> resolve tenant id for slug=$TENANT_SLUG"
  # Try the REST tenants list first (works in production with an admin
  # API key). The endpoint is auth-gated even under
  # AUTH_ALLOW_ANONYMOUS=true, so the curl will likely 403 in pure-dev
  # mode — fall through to the sqlite path below.
  TENANT_ID=$(curl -fs "$CCAAS/api/v1/tenants" 2>/dev/null \
    | jq -r --arg slug "$TENANT_SLUG" '(.items // .) | map(select(.slug == $slug))[0].id // empty' 2>/dev/null)

  # Fallback: read the SQLite DB at the conventional path used by ccaas
  # in dev. Cheap and 100% reliable when both backends share a host.
  if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
    REPO_ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
    DB_PATH=${CCAAS_DB_PATH:-"$REPO_ROOT/packages/backend/.agent-workspace/data.db"}
    if [ -r "$DB_PATH" ] && command -v sqlite3 >/dev/null 2>&1; then
      TENANT_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM tenants WHERE slug='$TENANT_SLUG';" 2>/dev/null)
    fi
  fi

  if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
    echo "✗ could not resolve tenant id for $TENANT_SLUG"
    echo "  options:"
    echo "    1. TENANT_ID=<uuid> sh $0"
    echo "    2. install sqlite3 + ensure $DB_PATH exists (dev fallback)"
    echo "    3. set CCAAS_API_KEY=... and add 'Authorization: Bearer ...' to the curl (production)"
    exit 1
  fi
  echo "    tenant = $TENANT_ID"
fi

echo "==> create project on live-lesson"
PID=$(curl -fs -X POST "$LLL/api/projects" \
  -H 'content-type: application/json' \
  -d '{"title":"poc-smoke","description":"agent-runtime end-to-end check"}' \
  | jq -r .id)
[ -n "$PID" ] && [ "$PID" != "null" ] || { echo "✗ project create failed"; exit 1; }
echo "    project = $PID"

echo "==> verify live-lesson scaffolded files"
ARTS=$(curl -fs "$LLL/api/projects/$PID/artifacts" | jq '. | length')
[ "$ARTS" -ge 2 ] || { echo "✗ expected ≥2 artifacts, got $ARTS"; exit 1; }
echo "    artifacts = $ARTS (expected plan/ + execution/)"

echo "==> subscribe ccaas change stream in background"
SSE_LOG=$(mktemp)
( curl -sN -m 15 "$CCAAS/projects/$PID/changes" > "$SSE_LOG" 2>&1 ) &
SSE_PID=$!
trap "kill $SSE_PID 2>/dev/null || true; rm -f $SSE_LOG" EXIT INT TERM
sleep 1

echo "==> POST first message — auto-creates session"
SID=$(uuidgen 2>/dev/null | tr 'A-Z' 'a-z' || python3 -c 'import uuid;print(uuid.uuid4())')
# The messages endpoint streams SSE until the first agent turn completes
# (~5-15s depending on LLM latency); the connection stays open for the
# whole turn. We only need the session to exist for bind-project, so
# discard the stream body and just record the status code. -m 30 keeps
# the whole script bounded even if the LLM stalls.
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CCAAS/api/v1/sessions/$SID/messages" \
  -H 'content-type: application/json' \
  -d "{\"message\":\"hi\",\"tenantId\":\"$TENANT_ID\",\"templateName\":\"$TPL\"}" -m 30)
[ "$HTTP" = "201" ] || { echo "✗ message POST failed: $HTTP"; exit 1; }
echo "    session = $SID"

echo "==> POST bind-project — should trigger bootstrap sync"
BIND=$(curl -fs -X POST "$CCAAS/api/v1/sessions/$SID/bind-project" \
  -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PID\",\"tenantId\":\"$TENANT_ID\"}")
echo "    response: $BIND"
sleep 3

echo "==> SSE events captured:"
sed 's/^/    /' "$SSE_LOG"

# Count "updated" events — bootstrap should produce one per artifact
UPDATES=$(grep -c '"kind":"updated"' "$SSE_LOG" || true)
if [ "$UPDATES" -lt 2 ]; then
  echo ""
  echo "✗ expected ≥2 'updated' events from bootstrap sync, got $UPDATES"
  exit 1
fi
echo ""
echo "✓ end-to-end PoC passed: $UPDATES change events delivered"
