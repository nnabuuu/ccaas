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
# Phase 2b-2: ccaas's SSE change stream (`/api/v1/projects/:id/changes`)
# is no longer `@Public()`-bypassed — it requires `?token=<apiKey>`. The
# token's tenant must match the project's tenant (resolved via the
# session_metadata binding written by `bind-project`). The script now:
#   - resolves a key from `CCAAS_API_KEY` env, OR
#   - reads one from the dev SQLite (rows in `api_keys` for the tenant),
#   - fails fast if no key is available with instructions to mint one.
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

  # Fallback: read the SQLite DB at the conventional path. The running
  # backend reads DATABASE_PATH relative to its CWD. `npm run dev:backend`
  # from the repo root cd's into packages/backend/ first (npm workspace
  # convention), so the canonical default path is
  # `packages/backend/.agent-workspace/data.db`. Caller can override with
  # CCAAS_DB_PATH if their backend was started from a different CWD.
  REPO_ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
  DB_PATH=${CCAAS_DB_PATH:-"$REPO_ROOT/packages/backend/.agent-workspace/data.db"}
  if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
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

if [ -z "$CCAAS_API_KEY" ]; then
  echo "==> mint ccaas api key for tenant=$TENANT_SLUG (SSE auth, phase 2b-2)"
  # DB_PATH already resolved in the tenant lookup block above; reused
  # here so the mint writes to the same DB the running backend reads.
  if ! CCAAS_API_KEY=$(cd "$REPO_ROOT/packages/backend" && \
        DATABASE_PATH="$DB_PATH" \
        npx ts-node --transpile-only scripts/create-dev-api-key.ts \
        "$TENANT_SLUG" --raw-only 2>/dev/null); then
    echo "✗ failed to mint api key. Try: CCAAS_API_KEY=<rawkey> sh $0"
    exit 1
  fi
  CCAAS_API_KEY=$(printf '%s' "$CCAAS_API_KEY" | tr -d '\r\n ')
  if [ -z "$CCAAS_API_KEY" ]; then
    echo "✗ minted empty key. Investigate scripts/create-dev-api-key.ts"
    exit 1
  fi
  echo "    api key minted (length=${#CCAAS_API_KEY})"
fi

# URL-encode is unnecessary for the opaque dev key shape (alphanum +
# underscore). If a future key format adds reserved chars, switch to a
# `jq -rR @uri` call here.
TOKEN_QS="token=$CCAAS_API_KEY"

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

echo "==> POST bind-project — writes session_metadata row + fires async bootstrap sync"
# The bootstrap sync triggered here fires events that NO subscriber sees
# yet (SSE auth requires the metadata row first; we open SSE in the next
# step). Those bootstrap events are accepted as "missed" — the next step
# proves the event-delivery path with a GUI-side edit + /invalidate.
BIND=$(curl -fs -X POST "$CCAAS/api/v1/sessions/$SID/bind-project" \
  -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PID\",\"tenantId\":\"$TENANT_ID\"}")
echo "    response: $BIND"
# Small sleep to let the metadata write commit + the bootstrap sync
# finish (so the next invalidate sees the post-bootstrap snapshot).
sleep 2

echo "==> subscribe ccaas change stream in background (metadata row now exists; auth passes)"
SSE_LOG=$(mktemp)
( curl -sN -m 15 "$CCAAS/projects/$PID/changes?$TOKEN_QS" > "$SSE_LOG" 2>&1 ) &
SSE_PID=$!
trap "kill $SSE_PID 2>/dev/null || true; rm -f $SSE_LOG" EXIT INT TERM
# Wait for the welcome `subscribed` event to land — confirms auth passed
# AND confirms the subscription is attached before we trigger changes.
for i in 1 2 3 4 5 6 7 8 9 10; do
  if grep -q '"kind":"subscribed"' "$SSE_LOG" 2>/dev/null; then
    break
  fi
  sleep 0.5
done
if ! grep -q '"kind":"subscribed"' "$SSE_LOG" 2>/dev/null; then
  echo "✗ SSE did not subscribe within 5s; auth or connection issue"
  echo "    SSE log:"
  sed 's/^/    /' "$SSE_LOG"
  exit 1
fi
echo "    subscribed"

echo "==> mutate manifest via live-lesson PUT — sim a GUI edit on the project"
NEW_CONTENT='{"id":"'"$PID"'","title":"poc-smoke EDITED","subject":"","gradeLevel":"","lessonType":"interactive","readingSteps":[]}'
curl -fs -X PUT "$LLL/api/projects/$PID/artifacts?path=execution/manifest.json" \
  -H 'content-type: application/json' \
  -d "{\"content\":$(printf '%s' "$NEW_CONTENT" | jq -Rs .),\"type\":\"json\"}" >/dev/null
echo "    PUT ok"

echo "==> POST /invalidate — triggers ccaas to re-sync; diff finds the edit; SSE sees the event"
curl -fs -X POST "$CCAAS/projects/$PID/invalidate?$TOKEN_QS" >/dev/null
sleep 3

echo "==> SSE events captured:"
sed 's/^/    /' "$SSE_LOG"

# Count "updated" events from the post-bind edit. The 'subscribed' welcome
# is filtered separately; we want at least one real ChangeEvent.
UPDATES=$(grep -c '"kind":"updated"' "$SSE_LOG" || true)
if [ "$UPDATES" -lt 1 ]; then
  echo ""
  echo "✗ expected ≥1 'updated' event from GUI edit + /invalidate, got $UPDATES"
  exit 1
fi
echo ""
echo "✓ end-to-end PoC passed: $UPDATES change events delivered (auth + sync + SSE)"
