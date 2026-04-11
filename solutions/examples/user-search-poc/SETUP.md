# User Search POC — 接入指南

本示例演示如何将业务系统 HTTP 接口接入 CCAAS Agent，支持两种方式：

| 方式 | 状态 | 适用场景 |
|------|------|----------|
| **stdio MCP server** | 可用 | 本地开发/测试 |
| **REST Adapter** | 可用 | HTTP API 转发，无需编写 MCP server |

## 架构

```
用户发消息 → Agent 读取 .context/page-context.json 获取 authBindingId
           → 调用 business_http_request（MCP server 查询业务系统）
           → 调用 write_output 将结果推送到前端 syncField
           → 前端面板实时展示 search_result
```

## 快速开始（stdio 方案）

### 前置条件

- CCAAS 后端运行中 (`npm run dev:backend`)
- Node.js 18+

### 1. 安装 MCP server 依赖

```bash
cd solutions/examples/user-search-poc/mcp-server
npm install
```

### 2. 运行端到端测试

```bash
cd solutions/examples/user-search-poc
bash test.sh
```

测试脚本会自动：
1. 导入 solution（创建 tenant + 注册 MCP server）
2. 部署 MCP server 文件到 workspace（`tenants/{tenantId}/mcp-servers/user-search-tools/`）
3. 注册并发布 skill
4. 发送带 context 的消息
5. 输出 SSE 响应流

### 3. 手动测试

```bash
ADMIN_KEY="sk-default-testd84f5b7a1dbdbc4c424417be6c009f01"
BASE_URL="http://localhost:3001"

# Step 1: 导入 solution
curl -X POST "${BASE_URL}/api/v1/admin/solutions/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d @solution.json

# Step 2: 注册 skill（需要 tenantId）
TENANT_ID="<从上一步获取>"

SKILL_RESP=$(curl -X POST "${BASE_URL}/api/v1/skills" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d '{
    "name": "User Search Assistant",
    "slug": "user-search-assistant",
    "description": "根据前端绑定的业务身份，按用户名查询业务系统用户信息",
    "content": "<SKILL.md 内容>"
  }')

# Step 2b: 发布 skill（必须！draft 状态的 skill 不会被 Agent 加载）
SKILL_ID=$(echo "$SKILL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -X POST "${BASE_URL}/api/v1/skills/${SKILL_ID}/publish" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}"

# Step 3: 发送消息
SESSION_ID="test-$(date +%s)"
curl -N -X POST "${BASE_URL}/api/v1/sessions/${SESSION_ID}/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d '{
    "sessionTemplate": "user-search",
    "message": "查询用户名张三的用户信息",
    "context": { "authBindingId": "mock-binding-id-12345" }
  }'
```

## Context 工作原理

前端通过 `SendMessageDto.context` 传入的数据，会被写入 session workspace 的 `.context/page-context.json` 文件：

```json
{
  "authBindingId": "<业务token>",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Agent 通过 `Read(".context/page-context.json")` 读取这个文件来获取 context 数据。

## Mock 数据

MCP server 内置以下测试用户：

| 姓名 | 部门 | 职位 |
|------|------|------|
| 张三 | 技术部 | 高级工程师 |
| 张三丰 | 产品部 | 产品经理 |
| 李四 | 市场部 | 市场总监 |
| 王五 | 技术部 | 前端工程师 |
| 赵六 | 人事部 | HR经理 |

搜索"张三"会匹配张三和张三丰。

## REST Adapter 方案

REST Adapter 类型的 MCP server 现在可以在 Agent 管道中工作。`completion-orchestration.service.ts` 会自动将 REST adapter 配置包装为 `rest-adapter-bridge` stdio 进程：

```
Claude CLI ──(stdio MCP protocol)──▶ rest-adapter-bridge ──(HTTP)──▶ 外部 API
```

注册一个 REST adapter MCP server 时，只需配置 `restAdapter` 字段（无需 `command`）：

```json
{
  "name": "My API",
  "slug": "my-api",
  "type": "rest-adapter",
  "config": {
    "restAdapter": {
      "baseUrl": "https://api.example.com",
      "auth": { "type": "bearer", "token": "..." },
      "endpoints": [
        {
          "name": "search_users",
          "description": "按名称搜索用户",
          "method": "GET",
          "path": "/users",
          "queryParams": { "q": { "type": "string", "required": true } }
        }
      ]
    }
  }
}
```

支持的认证方式：`none`、`api_key`、`bearer`、`basic`。OAuth2 将在后续迭代中支持。

## 已知限制

### 生产服务器 CLAUDE.md 干扰

生产服务器上可能存在运维用的 CLAUDE.md，会被 Agent Engine 自动读取，覆盖 skill prompt。症状：Agent 回复"这是一台 GCP 生产服务器"。

**解决**：重命名干扰的 CLAUDE.md。

## 常见问题

### MCP 工具未被调用

1. 确认 MCP server 文件已部署到 workspace：`<WORKSPACE_DIR>/tenants/{tenantId}/mcp-servers/user-search-tools/`
2. 确认部署目录下已运行 `npm install`（test.sh 会自动执行）
3. 检查后端日志是否有 `Skipping MCP server` 警告
4. 确认 solution.json 中 `mcpServers` 的 `command` 字段非空
5. solution.json 中的 `args` 应为相对于部署目录的路径（如 `["index.mjs"]`），系统会自动补全为 `tenants/{tid}/mcp-servers/{slug}/index.mjs`

### Agent 不读取 context

确认发送消息时包含 `context` 字段，且 skill 的 SKILL.md 中有读取 `.context/page-context.json` 的指令。
