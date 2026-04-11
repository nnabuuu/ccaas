# Builder Flow 教程

本教程面向**外部 Solution 开发者**，从零开始讲解如何通过 Builder API 完成完整的接入流程。

## 1. 概述

### 什么是 Builder Flow

Builder 是拥有 `builder` scope API key 的外部开发者。通过 Builder API，开发者可以自助完成租户创建、技能注册、API key 管理，无需平台管理员介入日常操作。

**核心流程：**

```
获取 Builder Key → 创建 Tenant → 注册 Skill → 创建 API Key → 发起对话
     (管理员)        (Builder)     (Builder)     (Builder)     (终端用户)
```

### Builder vs Admin

| 能力 | Builder | Admin |
|------|---------|-------|
| 创建 Tenant | 只能创建自己的 | 管理所有 |
| 管理 API Key | 只能管理自己 tenant 下的 | 管理所有 |
| 创建 admin/builder scope 的 key | 禁止 | 允许 |
| 注册 Skill | 需要 `skills:write` scope | 所有 scope |

Builder key 自动拥有除 `admin` 和 `builder` 外的所有 scope（`skills:read`, `skills:write`, `skills:execute`, `skills:delete`, `mcp:read`, `mcp:write`, `chat`, `analytics:read`）。

## 2. 前置条件

- CCAAS 后端运行中：`npm run dev:backend`（默认 port 3001）
- 拥有一个 `builder` scope 的 API key（由平台管理员创建）
- **Builder key 必须绑定 `userId`**，否则所有 Builder 端点返回 403

**推荐方式**：使用一站式 onboarding 接口（一次创建 user + tenant + key）：

```bash
curl -X POST http://localhost:3001/api/v1/admin/builder-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-admin_xxx" \
  -d '{
    "email": "builder@example.com",
    "name": "Acme Corp",
    "tenantName": "Acme Corp"
  }'
```

**手动方式**：先创建 user，再手动创建 builder key：

```bash
curl -X POST http://localhost:3001/api/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-admin_xxx" \
  -d '{
    "tenantId": "<platform-tenant-id>",
    "name": "Builder: Acme Corp",
    "scopes": ["builder"],
    "userId": "<builder-user-id>"
  }'
```

> 保存返回的 `rawKey`，后续所有步骤都需要它。创建 builder key 时不带 `userId` 会直接返回 400 Bad Request。

## 3. Step 1: 创建 Tenant

```
POST /api/v1/builder/tenants
```

每个 Builder 可以创建多个 tenant，每个 tenant 代表一个独立的业务空间。

**请求：**

```bash
BUILDER_KEY="sk-builder_xxx"

curl -X POST http://localhost:3001/api/v1/builder/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{
    "name": "My Solution",
    "slug": "my-solution",
    "description": "A demo solution for testing"
  }'
```

**响应（示例）：**

```json
{
  "id": "a1b2c3d4-...",
  "tenant": {
    "id": "a1b2c3d4-...",
    "name": "My Solution",
    "slug": "my-solution",
    "status": "active",
    "plan": "free",
    "createdAt": "2026-03-13T10:00:00.000Z"
  }
}
```

**Auto-link 机制**：创建 tenant 后，Builder 用户自动成为该 tenant 的 admin（通过 UserTenant 关联），后续可以管理该 tenant 的所有资源。

**其他 Tenant 端点：**

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/builder/tenants` | 列出自己的所有 tenant |
| GET | `/api/v1/builder/tenants/:id` | 获取 tenant 详情 |
| PUT | `/api/v1/builder/tenants/:id` | 更新 tenant |

## 4. Step 2: 注册 Skill

Skill 是 CCAAS 的核心概念，定义了 AI 助手的行为和能力。注册 skill 后，对话时可以指定启用哪些 skill。

### 方式 A：通过 API 注册

```
POST /api/v1/skills
```

需要在请求中携带 `X-Tenant-Id` header，指定 skill 注册到哪个 tenant。

```bash
TENANT_ID="a1b2c3d4-..."

curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{
    "name": "echo-chat",
    "slug": "echo-chat",
    "content": "You are a simple echo assistant. When a user sends a message, acknowledge it and repeat back the key points. Keep responses short.",
    "description": "Simple echo skill for testing"
  }'
```

**CreateSkillDto 字段说明：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | Skill 名称 |
| `content` | 是 | Skill prompt 内容（SKILL.md 的文本） |
| `slug` | 否 | URL 友好的唯一标识，不传则自动生成 |
| `description` | 否 | Skill 描述 |
| `type` | 否 | `skill`（默认）或 `sub-agent` |
| `triggers` | 否 | 触发条件数组（keyword/intent/pattern/context） |
| `config` | 否 | 自定义配置 |
| `allowedTools` | 否 | 允许使用的 MCP 工具列表 |

### 方式 B：通过 CLI 导入

如果你的 skill 定义在 `solutions/` 目录中，可以使用 CLI 批量导入：

```bash
cd packages/backend
npm run skill:import -- my-solution
```

CLI 会读取 `solutions/business/my-solution/solution.json` 中的 skill 配置并注册到数据库。

### Skill 内容格式

Skill 的 `content` 字段就是 SKILL.md 文件的纯文本内容。最简示例：

```markdown
# Echo Chat Skill

You are a simple echo assistant used for smoke testing the builder API key flow.

When a user sends a message, acknowledge it and repeat back the key points.
Keep responses short.
```

## 5. Step 3: 创建 API Key

为 tenant 创建供终端用户或前端应用使用的 API key。

```
POST /api/v1/builder/tenants/:tenantId/api-keys
```

```bash
curl -X POST http://localhost:3001/api/v1/builder/tenants/$TENANT_ID/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{
    "name": "Frontend Key",
    "scopes": ["chat", "skills:read", "skills:execute"]
  }'
```

**响应（示例）：**

```json
{
  "apiKey": {
    "id": "key-uuid-...",
    "name": "Frontend Key",
    "keyPrefix": "sk-xxxx",
    "scopes": ["chat", "skills:read", "skills:execute"],
    "rateLimitRpm": 60,
    "rateLimitRpd": 1000,
    "status": "active",
    "createdAt": "2026-03-13T10:05:00.000Z"
  },
  "rawKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
  "warning": "This is the only time the raw API key will be displayed. Please save it securely."
}
```

> **重要**：`rawKey` 只在创建时返回一次，请立即保存。丢失后只能重新创建。

**可用 scope 列表：**

| Scope | 说明 |
|-------|------|
| `chat` | 发送消息、对话 |
| `skills:read` | 读取 skill 列表 |
| `skills:write` | 创建/更新 skill |
| `skills:execute` | 执行 skill |
| `skills:delete` | 删除 skill |
| `mcp:read` | 读取 MCP server 配置 |
| `mcp:write` | 管理 MCP server |
| `analytics:read` | 读取分析数据 |

> Builder **禁止**创建 `admin` 或 `builder` scope 的 key，尝试会返回 403。

**其他 API Key 端点：**

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/builder/tenants/:tenantId/api-keys` | 列出 tenant 下所有 key |
| PUT | `/api/v1/builder/api-keys/:id` | 更新 key |
| POST | `/api/v1/builder/api-keys/:id/revoke` | 吊销 key |
| DELETE | `/api/v1/builder/api-keys/:id` | 删除 key |

## 6. Step 4: 发起对话

使用上一步创建的 API key 发起对话。

```
POST /api/v1/sessions/:sessionId/messages
```

响应为 `text/event-stream`（SSE），无需 WebSocket 连接。

```bash
CHAT_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
SESSION_ID="test-session-$(date +%s)"

curl -N -X POST "http://localhost:3001/api/v1/sessions/$SESSION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CHAT_KEY" \
  -d "{
    \"message\": \"Hello, this is a test message!\",
    \"tenantId\": \"$TENANT_ID\",
    \"enabledSkills\": [\"echo-chat\"]
  }"
```

> `-N` 参数禁用 curl 缓冲，确保 SSE 事件实时输出。

**SendMessageDto 字段说明：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `message` | 是 | 用户消息内容 |
| `tenantId` | 是* | 租户 ID（不传会收到 MISSING_TENANT_ID 错误） |
| `enabledSkills` | 否 | 启用的 skill slug 列表（不传则自动加载 tenant 下所有已发布 skill） |
| `context` | 否 | 页面上下文（key-value 对象） |
| `appendSystemPrompt` | 否 | 追加的系统提示词 |
| `templateName` | 否 | 会话模板名称 |
| `autoClose` | 否 | 处理完成后自动关闭 session |
| `afterSeq` | 否 | 断线重连：从此序号之后重放事件 |

### SSE 事件流

响应为标准 SSE 格式，每个事件包含一个 JSON 对象：

```
id: 1
data: {"seq":1,"sessionId":"test-session-123","timestamp":"...","event":{"type":"agent_status","status":"processing"}}

id: 2
data: {"seq":2,"sessionId":"test-session-123","timestamp":"...","event":{"type":"text_delta","text":"Hello"}}

id: 3
data: {"seq":3,"sessionId":"test-session-123","timestamp":"...","event":{"type":"text_delta","text":"! I received"}}

...

id: 10
data: {"seq":10,"sessionId":"test-session-123","timestamp":"...","event":{"type":"token_usage","inputTokens":150,"outputTokens":42}}

id: 11
data: {"seq":11,"sessionId":"test-session-123","timestamp":"...","event":{"type":"agent_status","status":"complete"}}
```

**常见事件类型：**

| 事件 | 说明 |
|------|------|
| `agent_status` | 状态变更（`processing`, `complete`, `error`, `cancelled`） |
| `text_delta` | 文本增量（流式输出） |
| `token_usage` | Token 消耗统计 |
| `tool_activity` | 工具调用活动 |
| `error` | 错误事件 |
| `done` | Turn 结束标记 |

## 7. 完整示例：builder-smoke-test

项目中的 `solutions/business/builder-smoke-test/` 是一个最小参考实现。

### solution.json

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "Builder Smoke Test",
    "slug": "builder-smoke-test",
    "description": "Minimal solution for verifying builder API key flow end-to-end."
  },
  "skills": [
    { "slug": "echo-chat", "name": "echo-chat" }
  ]
}
```

### 5 步走完的 curl 命令集

```bash
#!/bin/bash
# Builder Flow 完整示例
# 前提：BUILDER_KEY 已设置

BASE_URL="http://localhost:3001"
BUILDER_KEY="sk-builder_xxx"  # 替换为你的 builder key

# Step 1: 创建 Tenant
echo "=== Step 1: Create Tenant ==="
TENANT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/builder/tenants" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{"name": "Builder Smoke Test", "slug": "builder-smoke-test"}')

TENANT_ID=$(echo "$TENANT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Tenant ID: $TENANT_ID"

# Step 2: 注册 Skill
echo ""
echo "=== Step 2: Register Skill ==="
curl -s -X POST "$BASE_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{
    "name": "echo-chat",
    "slug": "echo-chat",
    "content": "You are a simple echo assistant. When a user sends a message, acknowledge it and repeat back the key points. Keep responses short."
  }' | head -c 200
echo ""

# Step 3: 创建 API Key
echo ""
echo "=== Step 3: Create API Key ==="
KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/builder/tenants/$TENANT_ID/api-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{"name": "Chat Key", "scopes": ["chat", "skills:read", "skills:execute"]}')

RAW_KEY=$(echo "$KEY_RESPONSE" | grep -o '"rawKey":"[^"]*"' | cut -d'"' -f4)
echo "Raw Key: $RAW_KEY"

# Step 4: 发起对话
echo ""
echo "=== Step 4: Send Message ==="
SESSION_ID="smoke-$(date +%s)"

curl -N -X POST "$BASE_URL/api/v1/sessions/$SESSION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RAW_KEY" \
  -d "{
    \"message\": \"Hello from builder smoke test!\",
    \"tenantId\": \"$TENANT_ID\",
    \"enabledSkills\": [\"echo-chat\"]
  }"
```

## 8. API 速查表

### Builder Tenants API

所有端点需要 `builder` scope。

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/builder/tenants` | 创建 tenant |
| GET | `/api/v1/builder/tenants` | 列出自己的 tenant |
| GET | `/api/v1/builder/tenants/:id` | 获取 tenant 详情 |
| PUT | `/api/v1/builder/tenants/:id` | 更新 tenant |

### Builder API Keys API

所有端点需要 `builder` scope，且只能操作自己拥有的 tenant。

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/builder/tenants/:tenantId/api-keys` | 创建 API key |
| GET | `/api/v1/builder/tenants/:tenantId/api-keys` | 列出 API key |
| PUT | `/api/v1/builder/api-keys/:id` | 更新 API key |
| POST | `/api/v1/builder/api-keys/:id/revoke` | 吊销 API key |
| DELETE | `/api/v1/builder/api-keys/:id` | 删除 API key |

### Skills API

需要 `skills:write` scope + `X-Tenant-Id` header。

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/skills` | 创建 skill |
| GET | `/api/v1/skills` | 列出 skill |
| GET | `/api/v1/skills/:id` | 获取 skill 详情 |
| PUT | `/api/v1/skills/:id` | 更新 skill |
| DELETE | `/api/v1/skills/:id` | 删除 skill |

### Sessions API

需要 `chat` scope。

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/sessions/:sessionId/messages` | 发送消息（SSE 流式响应） |
| GET | `/api/v1/sessions/:sessionId` | 获取 session 状态 |
| POST | `/api/v1/sessions/:sessionId/cancel` | 取消当前 turn |
| POST | `/api/v1/sessions/:sessionId/restart` | 重启 session |
| GET | `/api/v1/sessions/:sessionId/events` | 订阅推送事件（长连接 SSE） |

## 9. 常见问题 & 排错

### 403: Builder API key must be linked to a user

**原因**：Builder key 没有绑定 `userId`。

**解决**：
- **修复存量 key**：`PUT /api/v1/admin/api-keys/:id`，body 中传 `{ "userId": "<user-id>" }`
- **重建**：通过 `POST /api/v1/admin/builder-users` 一站式创建（推荐）

> 注：当前版本已在创建时做防呆，builder scope 不带 userId 会直接返回 400。

### 403: You do not have access to this tenant

**原因**：Builder 用户没有该 tenant 的 UserTenant 关联记录。只有 Builder 自己创建的 tenant 才会自动关联。

**解决**：确认你操作的是自己创建的 tenant，或联系管理员手动添加 UserTenant 关联。

### 403: Builder cannot create keys with scopes: admin, builder

**原因**：Builder 不允许创建 `admin` 或 `builder` scope 的 API key，这是防止权限提升的安全机制。

**解决**：只使用允许的 scope（`chat`, `skills:*`, `mcp:*`, `analytics:read`）。

### 409: Skill slug already exists

**原因**：该 tenant 下已有相同 slug 的 skill。

**解决**：使用不同的 slug，或先通过 `PUT /api/v1/skills/:id` 更新已有 skill。

### MISSING_TENANT_ID

**原因**：`POST /api/v1/sessions/:sessionId/messages` 请求体中没有 `tenantId` 字段。

**解决**：确保 body 中包含 `tenantId`。这是一个 SSE 级别的错误（不是 HTTP 400），会作为 error 事件返回。

### 401: Invalid or missing API key

**原因**：Authorization header 缺失或 key 无效/已过期/已吊销。

**解决**：检查 header 格式 `Authorization: Bearer sk-xxx`，确认 key 状态为 active。

### Skill 不生效

**原因**：Skill 可能未发布（status 不是 `published`），或 `enabledSkills` 中的 slug 拼写错误。

**解决**：
1. 通过 `GET /api/v1/skills` 确认 skill 存在且已发布
2. 检查 `enabledSkills` 数组中的 slug 是否正确
3. 如果不传 `enabledSkills`，系统会自动加载 tenant 下所有已发布 skill
