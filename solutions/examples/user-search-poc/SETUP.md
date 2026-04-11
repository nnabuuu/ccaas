# User Search POC — 接入指南

本示例演示如何将业务系统 HTTP 接口接入 Agent，支持两种 MCP 接入方案，均可端到端运行。

## 概述

| | stdio MCP | REST Adapter |
|------|-----------|--------------|
| **原理** | 编写 MCP server 进程，通过 stdio 通信 | 配置 HTTP endpoint，平台自动生成 MCP 工具 |
| **适用场景** | 本地开发/测试、需要自定义逻辑 | 已有 REST API、生产部署、零代码接入 |
| **依赖** | `@modelcontextprotocol/sdk` + Node.js | 零依赖（只需配置 JSON） |
| **工具名** | 自定义（如 `business_http_request`） | 来自 endpoint.name（如 `search_users`） |
| **注册方式** | solution.json `mcpServers` + 文件部署 | `POST /api/v1/admin/mcp-servers` API |
| **测试脚本** | `test.sh` | `test-rest.sh` |

## 架构图

### stdio 方案

```
用户发消息
  → Agent 读取 .context/page-context.json 获取 authBindingId
  → 调用 business_http_request（stdio MCP server 内部 mock 数据）
  → 调用 write_output 推送结果到前端 syncField
  → 前端面板实时展示 search_result
```

### REST Adapter 方案

```
用户发消息
  → Agent 读取 .context/page-context.json 获取 authBindingId
  → 调用 search_users（REST Adapter Bridge → HTTP GET /xcf-modular/users）
  → 调用 write_output（REST Adapter Bridge → HTTP POST /xcf-modular/write-output）
  → 前端面板实时展示 search_result

内部流程：
  Claude CLI ──(stdio MCP protocol)──▶ rest-adapter-bridge ──(HTTP)──▶ Mock REST API (:4567)
```

---

## 方案一：stdio MCP（开发/测试推荐）

### 前置条件

- 后端运行中：`npm run dev:backend`（默认 :3001）
- Node.js 18+

### 快速开始（一键测试）

```bash
# 安装 MCP server 依赖
cd solutions/examples/user-search-poc/mcp-server && npm install

# 运行 E2E 测试
cd solutions/examples/user-search-poc && bash test.sh
```

### 手动步骤

```bash
ADMIN_KEY="sk-default-testd84f5b7a1dbdbc4c424417be6c009f01"
BASE_URL="http://localhost:3001"

# 1. 导入 solution（创建 tenant + 注册 MCP server 定义）
curl -X POST "${BASE_URL}/api/v1/admin/solutions/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d @solution.json
# → 返回 { tenantId: "..." }

# 2. 部署 MCP server 文件到 workspace
TENANT_ID="<从上一步获取>"
MCP_DIR=".agent-workspace/tenants/${TENANT_ID}/mcp-servers/user-search-tools"
mkdir -p "${MCP_DIR}"
cp mcp-server/index.mjs mcp-server/package.json "${MCP_DIR}/"
cd "${MCP_DIR}" && npm install --production && cd -

# 3. 注册 + 发布 skill
SKILL_RESP=$(curl -X POST "${BASE_URL}/api/v1/skills" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d '{ "name": "User Search Assistant", "slug": "user-search-assistant", ... }')

SKILL_ID=$(echo "$SKILL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -X POST "${BASE_URL}/api/v1/skills/${SKILL_ID}/publish" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}"

# 4. 发送消息
curl -N -X POST "${BASE_URL}/api/v1/sessions/test-$(date +%s)/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d '{
    "sessionTemplate": "user-search",
    "message": "查询用户名张三的用户信息",
    "context": { "authBindingId": "mock-binding-id-12345" }
  }'
```

### 工作原理

1. `solution.json` 中的 `mcpServers.user-search-tools` 定义了 stdio MCP server
2. 后端将 MCP server 文件从 workspace 部署目录启动为子进程
3. Agent 通过 stdio 协议调用 `business_http_request` 和 `write_output` 工具
4. MCP server 进程内包含 mock 数据，直接返回查询结果

---

## 方案二：REST Adapter（生产推荐）

### 前置条件

- 后端运行中：`npm run dev:backend`（默认 :3001）
- Node.js 18+（用于启动 mock REST API server）

### 快速开始（一键测试）

```bash
cd solutions/examples/user-search-poc && bash test-rest.sh
```

测试脚本会自动：
1. 后台启动 mock REST API server（:4567）
2. 导入 `solution-rest.json`（创建独立 tenant，无 MCP server）
3. 通过 admin API 注册 REST adapter MCP server
4. 注册并发布 skill
5. 发送带 context 的消息
6. 退出时自动清理 mock server 进程

### 手动步骤

```bash
ADMIN_KEY="sk-default-testd84f5b7a1dbdbc4c424417be6c009f01"
BASE_URL="http://localhost:3001"

# 1. 启动 mock REST API server
node rest-server/server.mjs &
# → Mock REST API listening on http://localhost:4567

# 2. 导入 solution（不含 mcpServers）
curl -X POST "${BASE_URL}/api/v1/admin/solutions/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d @solution-rest.json
# → 返回 { tenantId: "..." }

# 3. 通过 admin API 注册 REST adapter MCP server
TENANT_ID="<从上一步获取>"
curl -X POST "${BASE_URL}/api/v1/admin/mcp-servers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -d '{
    "tenantId": "'${TENANT_ID}'",
    "name": "User Search REST API",
    "slug": "user-search-rest",
    "type": "rest-adapter",
    "config": {
      "restAdapter": {
        "baseUrl": "http://localhost:4567",
        "auth": { "type": "none" },
        "endpoints": [
          {
            "name": "search_users",
            "description": "按关键字搜索用户",
            "method": "GET",
            "path": "/xcf-modular/users",
            "queryParams": {
              "keyword": { "type": "string", "required": true, "description": "搜索关键字" }
            }
          },
          {
            "name": "write_output",
            "description": "将结果同步到前端面板",
            "method": "POST",
            "path": "/xcf-modular/write-output",
            "body": {
              "type": "json",
              "schema": {
                "field": { "type": "string", "required": true, "description": "字段名" },
                "value": { "type": "string", "required": true, "description": "字段值" }
              }
            }
          }
        ]
      }
    }
  }'

# 4. 注册 + 发布 skill（同方案一，但使用 REST 版本的 skill）
# ...

# 5. 发送消息（同方案一）
curl -N -X POST "${BASE_URL}/api/v1/sessions/test-$(date +%s)/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -d '{
    "sessionTemplate": "user-search",
    "message": "查询用户名张三的用户信息",
    "context": { "authBindingId": "mock-binding-id-12345" }
  }'
```

### 工作原理

1. `solution-rest.json` 只创建 tenant + session template，**不包含 mcpServers**
2. REST adapter MCP server 通过 `POST /api/v1/admin/mcp-servers` API 单独注册
3. 后端检测到 `type: "rest-adapter"`，自动启动 `rest-adapter-bridge` 子进程
4. bridge 进程读取 `restAdapter` 配置，将每个 endpoint 转为 MCP tool
5. Agent 调用 `search_users` → bridge 发送 `GET /xcf-modular/users?keyword=张三` → 返回结果
6. Agent 调用 `write_output` → bridge 发送 `POST /xcf-modular/write-output` → 返回确认

### REST Adapter 配置详解

#### Endpoint 配置

每个 endpoint 定义一个 MCP tool：

```json
{
  "name": "tool_name",           // 生成的 MCP tool 名称
  "description": "工具描述",      // Agent 看到的工具说明
  "method": "GET",               // HTTP 方法：GET/POST/PUT/DELETE/PATCH
  "path": "/api/resource/{id}",  // URL 路径（支持 {param} 路径参数）
  "pathParams": {                // 路径参数定义
    "id": { "type": "string", "required": true }
  },
  "queryParams": {               // 查询参数定义
    "keyword": { "type": "string", "required": false }
  },
  "body": {                      // 请求体定义
    "type": "json",
    "schema": {
      "field": { "type": "string", "required": true }
    }
  }
}
```

#### 认证方式

REST Adapter 支持 4 种认证方式：

**无认证**
```json
{ "type": "none" }
```

**Bearer Token**
```json
{
  "type": "bearer",
  "token": "your-token-here",
  "headerName": "Authorization",   // 可选，默认 Authorization
  "headerPrefix": "Bearer"         // 可选，默认 Bearer
}
```

**Basic Auth**
```json
{
  "type": "basic",
  "username": "user",
  "password": "pass"
}
```

**API Key**
```json
{
  "type": "api_key",
  "apiKeyName": "X-API-Key",       // header 名称
  "apiKeyValue": "your-key",
  "apiKeyLocation": "header"       // "header" 或 "query"
}
```

#### 超时配置

```json
{
  "restAdapter": {
    "baseUrl": "...",
    "timeout": 30000,
    "headers": { "X-Custom": "value" },
    ...
  }
}
```

- `timeout`：请求超时毫秒数，默认 30000（30 秒）
- `headers`：全局自定义 headers，会合并到每个请求中

---

## 共通部分

### Context 工作原理

前端通过 `SendMessageDto.context` 传入的数据，会被写入 session workspace 的 `.context/page-context.json` 文件：

```json
{
  "authBindingId": "<业务token>",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Agent 通过 `Read(".context/page-context.json")` 读取这个文件来获取 context 数据。

### Mock 数据

两种方案使用相同的测试用户数据：

| 姓名 | 部门 | 职位 |
|------|------|------|
| 张三 | 技术部 | 高级工程师 |
| 张三丰 | 产品部 | 产品经理 |
| 李四 | 市场部 | 市场总监 |
| 王五 | 技术部 | 前端工程师 |
| 赵六 | 人事部 | HR经理 |

搜索"张三"会匹配张三和张三丰。

### 常见问题

#### MCP 工具未被调用

**stdio 方案：**
1. 确认 MCP server 文件已部署到 workspace：`<WORKSPACE_DIR>/tenants/{tenantId}/mcp-servers/user-search-tools/`
2. 确认部署目录下已运行 `npm install`（test.sh 会自动执行）
3. 检查后端日志是否有 `Skipping MCP server` 警告

**REST adapter 方案：**
1. 确认 mock REST API server 正在运行（`curl http://localhost:4567/xcf-modular/users`）
2. 确认 MCP server 已通过 admin API 注册（`GET /api/v1/admin/mcp-servers?tenantId=...`）
3. 检查 `restAdapter.baseUrl` 是否可达

#### Agent 不读取 context

确认发送消息时包含 `context` 字段，且 skill 的 SKILL.md 中有读取 `.context/page-context.json` 的指令。

#### Skill 未生效

Skill 必须处于 `published` 状态。注册后需调用 `POST /api/v1/skills/{id}/publish` 发布。

### 已知限制

- **生产服务器 CLAUDE.md 干扰**：生产服务器上可能存在运维用的 CLAUDE.md，会被 Agent Engine 自动读取。症状：Agent 回复"这是一台 GCP 生产服务器"。解决：重命名干扰的 CLAUDE.md。
- **REST adapter 不支持 solution.json 导入**：`McpServerDefinitionSchema` 的 `command` 字段必填，REST adapter 需通过 admin API 单独注册。
- **OAuth2 认证**：REST adapter 目前支持 none/bearer/basic/api_key，OAuth2 将在后续迭代中支持。

## 文件清单

```
user-search-poc/
├── SETUP.md                                    ← 本文档
├── solution.json                               ← stdio 方案配置
├── solution-rest.json                          ← REST adapter 方案配置
├── test.sh                                     ← stdio E2E 测试
├── test-rest.sh                                ← REST adapter E2E 测试
├── mcp-server/                                 ← stdio MCP server
│   ├── index.mjs
│   └── package.json
├── rest-server/                                ← Mock REST API（REST adapter 方案用）
│   └── server.mjs
└── skills/
    ├── user-search-assistant/                  ← stdio 方案 skill
    │   └── SKILL.md
    └── user-search-assistant-rest/             ← REST adapter 方案 skill
        └── SKILL.md
```
