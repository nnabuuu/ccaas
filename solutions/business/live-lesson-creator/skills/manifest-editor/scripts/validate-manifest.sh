#!/bin/bash
# Validate the workspace's manifest against the live-lesson backend's
# production ManifestSchema (same Zod the publish flow uses).
#
# Low-cost: no LLM, no DB writes — just one HTTP POST that runs Zod
# in-memory and returns the result. Designed to be called by the agent
# after EVERY edit to execution/manifest.json (see SKILL.md "Self-check"
# section).
#
# Usage:
#   bash scripts/validate-manifest.sh                          # default path
#   bash scripts/validate-manifest.sh path/to/other.json
#
# Override the backend URL with LIVE_LESSON_URL (defaults to
# http://localhost:3007, which is the runtime dev convention).
#
# Output (stdout, single line of JSON — feed to jq):
#   { "valid": true,  "stepCount": N }
#   { "valid": false, "issues": [{ "path": "...", "message": "..." }, ...] }
#
# Exit code:
#   0 = valid (or transport OK but invalid — both 200 from backend)
#   non-zero = transport error (backend unreachable, jq missing, etc.)
#
# The exit code is intentionally NOT tied to valid/invalid — the agent
# should read the JSON and act on `.valid`, not on `$?`. This matches
# how `jq` and friends are usually composed.

set -e
MANIFEST=${1:-artifacts/execution/manifest.json}
BACKEND=${LIVE_LESSON_URL:-http://localhost:3007}

if [ ! -r "$MANIFEST" ]; then
  printf '{"valid":false,"issues":[{"path":"$","message":"manifest file not readable: %s"}]}\n' "$MANIFEST"
  exit 0  # the response is well-formed; transport itself didn't fail
fi

# `jq -Rs '{content: .}'` reads the whole file as one string and wraps
# it in the request body { content: "<raw JSON text>" }. This way the
# backend receives the manifest as a string (preserving exact bytes)
# and decides JSON parse + Zod validation in one place.
PAYLOAD=$(jq -Rs '{content: .}' < "$MANIFEST")

# -f makes curl exit non-zero on HTTP errors (5xx, network failure).
# 200 + {valid:false,...} is the SUCCESS path here (validation answered).
if ! RES=$(curl -fsS -X POST "$BACKEND/api/projects/validate-manifest" \
              -H 'content-type: application/json' \
              -d "$PAYLOAD" 2>&1); then
  printf '{"valid":false,"issues":[{"path":"$","message":"backend unreachable at %s: %s"}]}\n' "$BACKEND" "$RES" | tr -d '\n'
  echo
  exit 1
fi
echo "$RES"
