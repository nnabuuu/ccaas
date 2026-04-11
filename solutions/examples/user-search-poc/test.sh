#!/usr/bin/env bash
#
# User Search POC — 端到端本地测试
#
# 前提：后端已运行 (npm run dev:backend → :3001)
#       MCP server 依赖已安装 (cd mcp-server && npm install)
#
# 用法：cd solutions/examples/user-search-poc && bash test.sh
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

# ── Step 0: Verify backend is up ──────────────────────────────────────────────
info "检查后端是否运行..."
if ! curl -sf "${BASE_URL}/api/health" > /dev/null 2>&1; then
  fail "后端不可达 (${BASE_URL}/api/health)。请先运行: npm run dev:backend"
fi
info "后端运行中 ✓"

# ── Step 1: Import solution ───────────────────────────────────────────────────
info "导入 solution..."
IMPORT_RESP=$(curl -sf -X POST "${BASE_URL}/api/v1/admin/solutions/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d @solution.json)

TENANT_ID=$(echo "$IMPORT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['tenantId'])" 2>/dev/null || true)

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
SKILL_CONTENT=$(cat skills/user-search-assistant/SKILL.md)

SKILL_RESP=$(curl -sf -X POST "${BASE_URL}/api/v1/skills" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d "$(python3 -c "
import json, sys
content = open('skills/user-search-assistant/SKILL.md').read()
# Strip frontmatter
lines = content.split('\n')
in_fm = False
body_lines = []
for line in lines:
    if line.strip() == '---':
        in_fm = not in_fm
        continue
    if not in_fm:
        body_lines.append(line)
body = '\n'.join(body_lines).strip()
print(json.dumps({
    'name': 'User Search Assistant',
    'slug': 'user-search-assistant',
    'description': '根据前端绑定的业务身份，按用户名查询业务系统用户信息',
    'content': body,
}))
")" 2>&1) || true

info "Skill 注册结果: $(echo "$SKILL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug', d.get('message','unknown')))" 2>/dev/null || echo "$SKILL_RESP")"

# ── Step 2b: Publish skill ───────────────────────────────────────────────────
info "发布 skill..."
SKILL_ID=$(echo "$SKILL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || true)

if [ -n "$SKILL_ID" ]; then
  PUBLISH_RESP=$(curl -sf -X POST "${BASE_URL}/api/v1/skills/${SKILL_ID}/publish" \
    -H "Authorization: Bearer ${ADMIN_KEY}" \
    -H "X-Tenant-Id: ${TENANT_ID}" 2>&1) || true
  info "Skill 发布结果: $(echo "$PUBLISH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status', d.get('message','unknown')))" 2>/dev/null || echo "$PUBLISH_RESP")"
else
  warn "跳过发布：无法获取 skill ID（可能 skill 已存在）"
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
