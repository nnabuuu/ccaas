#!/usr/bin/env bash
#
# User Search POC — 端到端本地测试（stdio MCP 方案）
#
# 前提：后端已运行 (npm run dev:backend → :3001)
#       MCP server 依赖已安装 (cd mcp-server && npm install)
#
# 用法：cd solutions/user-search-poc && bash test.sh
#

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
ADMIN_KEY="${ADMIN_KEY:-sk-default-testd84f5b7a1dbdbc4c424417be6c009f01}"
SESSION_ID="test-user-search-$(date +%s)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# Check dependencies
for cmd in curl jq; do
  command -v "$cmd" &> /dev/null || fail "Missing required tool: $cmd"
done

# ── Step 0: Verify backend is up ──────────────────────────────────────────────
info "检查后端是否运行..."
if ! curl -sf "${BASE_URL}/api/v1/health" > /dev/null 2>&1; then
  fail "后端不可达 (${BASE_URL}/api/v1/health)。请先运行: npm run dev:backend"
fi
info "后端运行中 ✓"

# ── Step 1: Import solution ───────────────────────────────────────────────────
info "导入 solution..."
IMPORT_RESP=$(curl -sf -X POST "${BASE_URL}/api/v1/admin/solutions/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d @solution.json)

TENANT_ID=$(echo "$IMPORT_RESP" | jq -r '.tenantId // empty')

if [ -z "$TENANT_ID" ]; then
  echo "$IMPORT_RESP"
  fail "导入失败：无法获取 tenantId"
fi
info "Tenant 已创建/更新: ${TENANT_ID}"

# ── Step 1b: Deploy MCP server files ──────────────────────────────────────
info "部署 MCP server 文件到 workspace..."
WORKSPACE_DIR="${WORKSPACE_DIR:-$(cd ../../.. && pwd)/.agent-workspace}"
MCP_DEPLOY_DIR="${WORKSPACE_DIR}/tenants/${TENANT_ID}/mcp-servers/user-search-tools"
mkdir -p "${MCP_DEPLOY_DIR}"
cp mcp-server/index.mjs mcp-server/package.json "${MCP_DEPLOY_DIR}/"
(cd "${MCP_DEPLOY_DIR}" && npm install --production --no-audit --no-fund 2>&1) || fail "npm install 失败"
info "MCP server 已部署到 ${MCP_DEPLOY_DIR}"

# ── Step 2: Register skill ────────────────────────────────────────────────────
info "注册 skill..."

SKILL_FILE="skills/user-search-assistant/SKILL.md"
SKILL_CONTENT=$(cat "$SKILL_FILE" | jq -Rs .)
SKILL_NAME=$(awk '/^---$/,/^---$/' "$SKILL_FILE" | grep "^name:" | sed 's/^name:[[:space:]]*//')
SKILL_DESC=$(awk '/^---$/,/^---$/' "$SKILL_FILE" | grep "^description:" | sed 's/^description:[[:space:]]*//')

# Check if skill exists
EXISTING_ID=$(curl -s "${BASE_URL}/api/v1/skills/user-search-assistant" \
  -H "X-Tenant-Id: user-search-poc" \
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
  info "Skill 已更新: user-search-assistant"
else
  SKILL_RESP=$(curl -s -X POST "${BASE_URL}/api/v1/skills" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_KEY}" \
    -H "X-Tenant-Id: ${TENANT_ID}" \
    -d "{
      \"name\": \"${SKILL_NAME}\",
      \"slug\": \"user-search-assistant\",
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
    info "Skill 已创建并发布: user-search-assistant (${SKILL_ID})"
  else
    warn "Skill 注册返回: $(echo "$SKILL_RESP" | jq -r '.message // "unknown"')"
  fi
fi

# ── Step 3: Send message with context ─────────────────────────────────────────
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
info "检查上方 SSE 输出中是否包含 business_http_request 工具调用和用户查询结果。"
