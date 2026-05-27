#!/bin/sh
# End-to-end smoke for the rich-chat-cards MCP layer.
#
# What it does (no LLM needed):
#   1. Builds creator-mcp-server (if not already built).
#   2. For each of the 3 emit_*_card tools, spawns the server,
#      sends a tools/call MCP request via stdio with sample input,
#      and asserts the response is a valid JSON-stringified card
#      payload with the expected `kind` discriminator.
#   3. Negative test: sends invalid input (missing required field)
#      and asserts the server returns isError=true.
#
# What it does NOT do:
#   - Drive a real ccaas chat session (would need an LLM API key +
#     burn tokens). For that, run live-lesson normally + chat with
#     a message that asks the agent to use one of the emit_*_card
#     tools, then watch DevTools Network for output_update SSE
#     events.
#
# Exit 0 = MCP layer end-to-end works.

set -eu

MCP_DIR="$(cd "$(dirname "$0")/.." && pwd)/creator-mcp-server"
DIST="$MCP_DIR/dist/index.js"

echo "==> creator-mcp-server smoke test"
echo "    server: $DIST"

# Build if needed
if [ ! -f "$DIST" ]; then
  echo "==> dist/ missing, building..."
  ( cd "$MCP_DIR" && npm install --silent && npx tsc )
fi

# ── Helper: invoke one MCP tool, return its response JSON ──────────
#
# Sends the MCP protocol handshake (initialize), then tools/call
# with the provided name + args. Returns the tools/call result.
call_tool() {
  TOOL_NAME=$1
  ARGS_JSON=$2
  REQ=$(printf '%s\n%s\n%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cards-smoke","version":"1.0.0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL_NAME\",\"arguments\":$ARGS_JSON}}")
  # The MCP server emits one JSON line per response. We want the
  # tools/call response (id=2), so grep for it.
  printf '%s\n' "$REQ" | node "$DIST" 2>/dev/null | grep '"id":2' | tail -1
}

# ── Helper: assert a property in a JSON string ─────────────────────
assert_json() {
  JSON=$1
  JQ_FILTER=$2
  EXPECTED=$3
  ACTUAL=$(printf '%s' "$JSON" | jq -r "$JQ_FILTER" 2>/dev/null || echo "")
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    return 0
  fi
  echo "    ✗ expected $JQ_FILTER = '$EXPECTED', got '$ACTUAL'"
  echo "      response: $JSON"
  return 1
}

# Requirement check
if ! command -v jq >/dev/null 2>&1; then
  echo "✗ jq is required (brew install jq)"
  exit 1
fi

PASS=0
FAIL=0

# ── Test 1: emit_todo_card ─────────────────────────────────────────
echo "==> [1/4] emit_todo_card (happy path)"
ARGS='{"title":"Test plan","items":[{"id":"t1","label":"Step one","status":"done"},{"id":"t2","label":"Step two","status":"active"}]}'
RESP=$(call_tool "emit_todo_card" "$ARGS")
TEXT=$(printf '%s' "$RESP" | jq -r '.result.content[0].text' 2>/dev/null)
if [ -z "$TEXT" ] || [ "$TEXT" = "null" ]; then
  echo "    ✗ no result.content[0].text"
  echo "      response: $RESP"
  FAIL=$((FAIL + 1))
else
  if assert_json "$TEXT" '.kind' 'todo' \
     && assert_json "$TEXT" '.title' 'Test plan' \
     && assert_json "$TEXT" '.items[0].status' 'done'; then
    echo "    ✓ todo card payload shape correct"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
fi

# ── Test 2: emit_questions_card ────────────────────────────────────
echo "==> [2/4] emit_questions_card (happy path)"
ARGS='{"title":"Pick","items":[{"id":"q1","label":"Choose","type":"radio","options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]}]}'
RESP=$(call_tool "emit_questions_card" "$ARGS")
TEXT=$(printf '%s' "$RESP" | jq -r '.result.content[0].text' 2>/dev/null)
if [ -z "$TEXT" ] || [ "$TEXT" = "null" ]; then
  echo "    ✗ no result.content[0].text"
  FAIL=$((FAIL + 1))
else
  if assert_json "$TEXT" '.kind' 'questions' \
     && assert_json "$TEXT" '.items[0].type' 'radio'; then
    echo "    ✓ questions card payload shape correct"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
fi

# ── Test 3: emit_verify_card ───────────────────────────────────────
echo "==> [3/4] emit_verify_card (happy path)"
ARGS='{"title":"V","target":"manifest.json","schema":"v1","status":"done","startedAt":"10:00","completedAt":"10:01","checks":[{"id":"c1","label":"Schema","desc":"OK","status":"pass"}]}'
RESP=$(call_tool "emit_verify_card" "$ARGS")
TEXT=$(printf '%s' "$RESP" | jq -r '.result.content[0].text' 2>/dev/null)
if [ -z "$TEXT" ] || [ "$TEXT" = "null" ]; then
  echo "    ✗ no result.content[0].text"
  FAIL=$((FAIL + 1))
else
  if assert_json "$TEXT" '.kind' 'verify' \
     && assert_json "$TEXT" '.status' 'done' \
     && assert_json "$TEXT" '.checks[0].status' 'pass'; then
    echo "    ✓ verify card payload shape correct"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
fi

# ── Test 4: negative — invalid input rejected ──────────────────────
echo "==> [4/4] emit_todo_card with invalid input (should fail)"
ARGS='{"title":"X"}' # missing required 'items'
RESP=$(call_tool "emit_todo_card" "$ARGS")
IS_ERROR=$(printf '%s' "$RESP" | jq -r '.result.isError' 2>/dev/null)
if [ "$IS_ERROR" = "true" ]; then
  echo "    ✓ invalid input properly rejected (isError=true)"
  PASS=$((PASS + 1))
else
  echo "    ✗ expected isError=true, got '$IS_ERROR'"
  echo "      response: $RESP"
  FAIL=$((FAIL + 1))
fi

# ── Summary ────────────────────────────────────────────────────────
echo ""
echo "==> ${PASS}/4 passed, ${FAIL} failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo ""
echo "✓ MCP layer end-to-end works."
echo ""
echo "Next steps (manual, needs LLM):"
echo "  1. Start ccaas + live-lesson backend + creator dev server"
echo "  2. Open creator, send a chat message like:"
echo "     '请用 emit_todo_card 工具展示一个 3 步的执行设计生成计划'"
echo "  3. Verify a TodoCard renders in the chat panel"
echo "  4. Repeat with: '请用 emit_questions_card 问我两个澄清问题'"
echo "  5. Repeat with: '请用 emit_verify_card 模拟一次 manifest 校验'"
