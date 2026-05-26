# Builder Flow 教程

本教程面向**外部 Solution 开发者**，从零讲解如何通过 Builder API 完成完整的接入流程。

## 什么是 Builder Flow

Builder 是拥有 `builder` scope API key 的外部开发者。通过 Builder API，开发者可以自助完成租户创建、技能注册、API key 管理，无需平台管理员介入日常操作。

**核心流程：**

```
获取 Builder Key → 创建 Solution → 注册 Skill → 创建 API Key → 发起对话
     (管理员)        (Builder)     (Builder)     (Builder)     (终端用户)
```

### Builder vs Admin

| 能力 | Builder | Admin |
|------|---------|-------|
| 创建 Solution | 只能管理自己创建的 | 管理所有 |
| 管理 API Key | 只能管理自己 tenant 下的 | 管理所有 |
| 创建 admin/builder scope 的 key | 禁止 | 允许 |

Builder key 自动拥有除 `admin` 和 `builder` 外的所有 scope。

## 前置条件

- CCAAS 后端运行中（`npm run dev:backend`，默认 port 3001）
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
    "solutionId": "<platform-tenant-id>",
    "name": "Builder: Acme Corp",
    "scopes": ["builder"],
    "userId": "<builder-user-id>"
  }'
```

{% hint style="warning" %}
保存返回的 `rawKey`，后续所有步骤都需要它。创建 builder key 时不带 `userId` 会直接返回 400 Bad Request。
{% endhint %}

## Step 1: 创建 Solution

每个 Builder 可以创建多个 tenant，每个 tenant 代表一个独立的业务空间。

```bash
BUILDER_KEY="sk-builder_xxx"

curl -X POST http://localhost:3001/api/v1/builder/solutions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{
    "name": "My Solution",
    "slug": "my-solution",
    "description": "A demo solution for testing"
  }'
```

**响应示例：**

```json
{
  "id": "a1b2c3d4-...",
  "tenant": {
    "id": "a1b2c3d4-...",
    "name": "My Solution",
    "slug": "my-solution",
    "status": "active"
  }
}
```

{% hint style="info" %}
**Auto-link 机制**：创建 tenant 后，Builder 自动成为该 tenant 的 admin（通过 UserSolution 关联）。
{% endhint %}

## Step 2: 注册 Skill

Skill 定义了 AI 助手的行为和能力。

### 方式 A：通过 API 注册

需要携带 `X-Solution-Id` header。

```bash
TENANT_ID="a1b2c3d4-..."

curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -H "X-Solution-Id: $TENANT_ID" \
  -d '{
    "name": "echo-chat",
    "slug": "echo-chat",
    "content": "You are a simple echo assistant. When a user sends a message, acknowledge it and repeat back the key points. Keep responses short.",
    "description": "Simple echo skill for testing"
  }'
```

**CreateSkillDto 字段：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | Skill 名称 |
| `content` | 是 | Skill prompt 内容 |
| `slug` | 否 | URL 友好的唯一标识 |
| `description` | 否 | Skill 描述 |
| `type` | 否 | `skill`（默认）或 `sub-agent` |
| `triggers` | 否 | 触发条件数组 |
| `allowedTools` | 否 | 允许使用的 MCP 工具列表 |

## Step 3: 创建 API Key

为 tenant 创建供终端用户或前端应用使用的 API key。

```bash
curl -X POST http://localhost:3001/api/v1/builder/solutions/$TENANT_ID/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{
    "name": "Frontend Key",
    "scopes": ["chat", "skills:read", "skills:execute"]
  }'
```

**响应示例：**

```json
{
  "apiKey": {
    "id": "key-uuid-...",
    "name": "Frontend Key",
    "keyPrefix": "sk-xxxx",
    "scopes": ["chat", "skills:read", "skills:execute"],
    "status": "active"
  },
  "rawKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
  "warning": "This is the only time the raw API key will be displayed. Please save it securely."
}
```

{% hint style="danger" %}
`rawKey` 只在创建时返回一次，请立即保存。丢失后只能重新创建。
{% endhint %}

{% hint style="info" %}
**Builder Key vs 子 Key**：你刚刚创建的是一个 "Solution key"——它只能调用 chat/skills/MCP 等 API，无法创建 tenant 或管理其他 key。只有你的原始 Builder key（拥有 `builder` scope 且绑定了 `userId`）才有管理能力。
{% endhint %}

**可用 scope：**

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

> Builder **禁止**创建 `admin` 或 `builder` scope 的 key。

## Step 4: 发起对话

使用上一步创建的 API key 发起对话，响应为 SSE 流。

```bash
CHAT_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
SESSION_ID="test-session-$(date +%s)"

curl -N -X POST "http://localhost:3001/api/v1/sessions/$SESSION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CHAT_KEY" \
  -d "{
    \"message\": \"Hello, this is a test message!\",
    \"solutionId\": \"$TENANT_ID\",
    \"enabledSkills\": [\"echo-chat\"]
  }"
```

**SendMessageDto 关键字段：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `message` | 是 | 用户消息内容 |
| `solutionId` | 是 | 租户 ID |
| `enabledSkills` | 否 | 启用的 skill slug 列表（不传则自动加载全部） |
| `context` | 否 | 页面上下文 |
| `afterSeq` | 否 | 断线重连序号 |

### SSE 事件类型

| 事件 | 说明 |
|------|------|
| `agent_status` | 状态变更（`processing`, `complete`, `error`） |
| `text_delta` | 文本增量（流式输出） |
| `token_usage` | Token 消耗统计 |
| `tool_activity` | 工具调用活动 |
| `error` | 错误事件 |

## API 速查表

### Builder Solutions API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/builder/solutions` | 创建 tenant |
| GET | `/api/v1/builder/solutions` | 列出自己的 tenant |
| GET | `/api/v1/builder/solutions/:id` | 获取详情 |
| PUT | `/api/v1/builder/solutions/:id` | 更新 |

### Builder API Keys API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/builder/solutions/:solutionId/api-keys` | 创建 key |
| GET | `/api/v1/builder/solutions/:solutionId/api-keys` | 列出 key |
| PUT | `/api/v1/builder/api-keys/:id` | 更新 key |
| POST | `/api/v1/builder/api-keys/:id/revoke` | 吊销 key |
| DELETE | `/api/v1/builder/api-keys/:id` | 删除 key |

### Sessions API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/sessions/:id/messages` | 发送消息（SSE） |
| GET | `/api/v1/sessions/:id` | 获取状态 |
| POST | `/api/v1/sessions/:id/cancel` | 取消 turn |

### Solutions API（Admin/Builder）

> 这些端点位于 admin 路径下，需要 `admin` 或 `builder` scope。

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/solutions/status` | 获取 loader 状态 |
| POST | `/api/v1/admin/solutions/import` | 从 config body 导入 solution |

## 常见问题

| 错误 | 原因 | 解决 |
|------|------|------|
| 403: builder key must be linked to a user | Builder key 没有 `userId` | 通过 `PUT /api/v1/admin/api-keys/:id` 补充 `userId`，或通过 `POST /api/v1/admin/builder-users` 重建 |
| 403: You do not have access to this solution | 无 UserSolution 关联 | 只能操作自己创建的 tenant |
| 403: cannot create keys with scopes: admin | 权限提升防护 | 只用允许的 scope |
| 409: Skill slug already exists | slug 冲突 | 换 slug 或 PUT 更新 |
| MISSING\_TENANT\_ID | body 缺 `solutionId` | 确保请求体包含该字段 |
| 401: Invalid or missing API key | key 无效/过期/吊销 | 检查 Authorization header |

## 完整参考

完整的 curl 命令集和 builder-smoke-test 示例，参见项目根目录下的 [`docs/BUILDER_TUTORIAL.md`](../../../BUILDER_TUTORIAL.md)。
