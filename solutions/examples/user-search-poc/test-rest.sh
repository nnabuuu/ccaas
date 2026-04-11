#!/usr/bin/env bash
#
# User Search POC — REST Adapter 端到端测试
#
# 前提：后端已运行 (npm run dev:backend → :3001)
#
# 用法：cd solutions/user-search-poc && bash test-rest.sh
#

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
ADMIN_KEY="${ADMIN_KEY:-sk-default-testd84f5b7a1dbdbc4c424417be6c009f01}"
SESSION_ID="test-rest-user-search-$(date +%s)"
MOCK_SERVER_PID=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# Check dependencies
for cmd in curl jq node; do
  command -v "$cmd" &> /dev/null || fail "Missing required tool: $cmd"
done

# ── Cleanup on exit ──────────────────────────────────────────────────────────
cleanup() {
  if [ -n "$MOCK_SERVER_PID" ] && kill -0 "$MOCK_SERVER_PID" 2>/dev/null; then
    info "停止 Mock REST API server (PID: $MOCK_SERVER_PID)..."
    kill "$MOCK_SERVER_PID" 2>/dev/null || true
    wait "$MOCK_SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Step 0: Verify backend is up ─────────────────────────────────────────────
info "检查后端是否运行..."
if ! curl -sf "${BASE_URL}/api/v1/health" > /dev/null 2>&1; then
  fail "后端不可达 (${BASE_URL}/api/v1/health)。请先运行: npm run dev:backend"
fi
info "后端运行中 ✓"

# ── Step 1: Start mock REST API server ───────────────────────────────────────
info "启动 Mock REST API server..."
node rest-server/server.mjs &
MOCK_SERVER_PID=$!
sleep 1

# Verify mock server is up
if ! curl -sf "http://localhost:4567/xcf-modular/users?keyword=" > /dev/null 2>&1; then
  fail "Mock REST API server 启动失败"
fi
info "Mock REST API server 运行中 (PID: $MOCK_SERVER_PID) ✓"

# ── Step 2: Import solution (no mcpServers) ──────────────────────────────────
info "导入 solution-rest.json..."
IMPORT_RESP=$(curl -sf -X POST "${BASE_URL}/api/v1/admin/solutions/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d @solution-rest.json)

TENANT_ID=$(echo "$IMPORT_RESP" | jq -r '.tenantId // empty')

if [ -z "$TENANT_ID" ]; then
  echo "$IMPORT_RESP"
  fail "导入失败：无法获取 tenantId"
fi
info "Tenant 已创建/更新: ${TENANT_ID}"

# ── Step 3: Register REST adapter MCP server via admin API ───────────────────
info "注册 REST Adapter MCP server..."
MCP_RESP=$(curl -s -X POST "${BASE_URL}/api/v1/admin/mcp-servers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d "{
    \"tenantId\": \"${TENANT_ID}\",
    \"name\": \"User Search REST API\",
    \"slug\": \"user-search-rest\",
    \"type\": \"rest-adapter\",
    \"config\": {
      \"restAdapter\": {
        \"baseUrl\": \"http://localhost:4567\",
        \"auth\": { \"type\": \"none\" },
        \"endpoints\": [
          {
            \"name\": \"search_users\",
            \"description\": \"按关键字搜索用户\",
            \"method\": \"GET\",
            \"path\": \"/xcf-modular/users\",
            \"queryParams\": {
              \"keyword\": {
                \"type\": \"string\",
                \"required\": true,
                \"description\": \"搜索关键字\"
              }
            }
          },
          {
            \"name\": \"write_output\",
            \"description\": \"将结果同步到前端面板\",
            \"method\": \"POST\",
            \"path\": \"/xcf-modular/write-output\",
            \"body\": {
              \"type\": \"json\",
              \"schema\": {
                \"field\": { \"type\": \"string\", \"required\": true, \"description\": \"字段名\" },
                \"value\": { \"type\": \"string\", \"required\": true, \"description\": \"字段值\" }
              }
            }
          }
        ]
      }
    }
  }" 2>&1) || true

MCP_ID=$(echo "$MCP_RESP" | jq -r '.id // empty' 2>/dev/null || true)
if [ -n "$MCP_ID" ]; then
  info "REST Adapter MCP server 已注册: ${MCP_ID}"
else
  warn "注册返回: $(echo "$MCP_RESP" | head -c 200)"
  info "MCP server 可能已存在，继续..."
fi

# ── Step 4: Register skill ───────────────────────────────────────────────────
info "注册 skill (REST 版本)..."

SKILL_FILE="skills/user-search-assistant-rest/SKILL.md"
SKILL_CONTENT=$(cat "$SKILL_FILE" | jq -Rs .)
SKILL_NAME=$(awk '/^---$/,/^---$/' "$SKILL_FILE" | grep "^name:" | sed 's/^name:[[:space:]]*//')
SKILL_DESC=$(awk '/^---$/,/^---$/' "$SKILL_FILE" | grep "^description:" | sed 's/^description:[[:space:]]*//')

# Check if skill exists
EXISTING_ID=$(curl -s "${BASE_URL}/api/v1/skills/user-search-assistant-rest" \
  -H "X-Tenant-Id: user-search-poc-rest" \
  -H "X-Api-Key: ${ADMIN_KEY}" | jq -r '.id // empty')

if [ -n "$EXISTING_ID" ]; then
  SKILL_RESP=$(curl -s -X PUT "${BASE_URL}/api/v1/skills/${EXISTING_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_KEY}" \
    -H "X-Tenant-Id: ${TENANT_ID}" \
    -d "{
      \"name\": \"${SKILL_NAME}\",
      \"description\": \"${SKILL_DESC}\",
      \"content\": ${SKILL_CONTENT}
    }")
  info "Skill 已更新: user-search-assistant-rest"
else
  SKILL_RESP=$(curl -s -X POST "${BASE_URL}/api/v1/skills" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_KEY}" \
    -H "X-Tenant-Id: ${TENANT_ID}" \
    -d "{
      \"name\": \"${SKILL_NAME}\",
      \"slug\": \"user-search-assistant-rest\",
      \"description\": \"${SKILL_DESC}\",
      \"content\": ${SKILL_CONTENT},
      \"type\": \"skill\"
    }")

  SKILL_ID=$(echo "$SKILL_RESP" | jq -r '.id // empty')
  if [ -n "$SKILL_ID" ]; then
    # Publish skill
    curl -s -X POST "${BASE_URL}/api/v1/skills/${SKILL_ID}/publish" \
      -H "Authorization: Bearer ${ADMIN_KEY}" \
      -H "X-Tenant-Id: ${TENANT_ID}" > /dev/null 2>&1
    info "Skill 已创建并发布: user-search-assistant-rest (${SKILL_ID})"
  else
    warn "Skill 注册返回: $(echo "$SKILL_RESP" | jq -r '.message // "unknown"')"
  fi
fi

# ── Step 5: Send message with context ────────────────────────────────────────
info "发送消息 (session: ${SESSION_ID})..."
echo ""
echo "─── SSE 响应流 ───"

curl -N -X POST "${BASE_URL}/api/v1/sessions/${SESSION_ID}/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d "{
    \"sessionTemplate\": \"user-search\",
    \"message\": \"查询用户名包含张三的用户信息\",
    \"context\": {
      \"authBindingId\": \"mock-binding-id-12345\"
    }
  }" 2>/dev/null

echo ""
echo "─── 测试完成 ───"
info "检查上方 SSE 输出中是否包含 search_users 工具调用和用户查询结果。"
info "（REST Adapter 方案的工具名是 search_users，而非 stdio 方案的 business_http_request）"
