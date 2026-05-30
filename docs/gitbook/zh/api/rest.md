# REST API 端点

所有端点的基础路径为 `/api/v1`。

## 错误响应

所有 API 错误返回标准化的 JSON 响应。完整的错误处理文档请参见 [错误处理](error-handling.md)。

**标准错误格式:**

```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: skill-123",
  "statusCode": 404,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2026-02-09T10:30:00.000Z",
  "path": "/api/v1/skills/skill-123",
  "requestId": "req_abc123"
}
```

**常见错误代码:**
- `VALIDATION_ERROR` (400) - 请求数据无效
- `SESSION_EXPIRED` (401) - 需要认证
- `PERMISSION_DENIED` (403) - 权限不足
- `SKILL_NOT_FOUND` (404) - 资源未找到
- `RATE_LIMITED` (429) - 超过速率限制
- `INTERNAL_ERROR` (500) - 服务器错误
- `TIMEOUT` (504) - 请求超时

详细的错误代码、重试策略和客户端实现示例，请参见 [错误处理指南](error-handling.md)。

## API 控制器职责划分

### ChatController - 监控与健康检查

**路径**: `/api/v1/chat`
**职责**: 仅用于服务健康检查和监控指标
**特点**: 🔓 无需认证（Public）

所有端点均不需要 API Key，主要用于：
- 负载均衡器健康检查
- 监控系统采集指标
- DevOps 服务状态监控

### SessionsController - 核心业务 API

**路径**: `/api/v1/sessions`
**职责**: AI 消息交互 + 会话生命周期管理
**特点**: 🔐 需要 API Key 认证

所有业务逻辑的标准入口，包括：
- 发送消息给 AI
- 取消正在执行的操作
- 管理会话状态和上下文
- 获取消息历史和文件
- 提交用户对交互式提示的回答

### MessagesController - 消息与会话数据查询

**路径**: `/api/v1/sessions/:sessionId/*` 和 `/api/v1/messages/*`
**职责**: 会话消息、文件、工具事件、Token 用量等只读查询
**特点**: 🔓🔐 可选认证（提供 API Key 时验证，未提供时允许匿名访问）

提供会话数据的多维度查询，包括：
- 消息历史和文件列表
- 工具调用事件和统计
- 思考块、Token 用量、进程事件
- 完整会话跟踪（full-trace）

---

## 监控端点（ChatController）

### GET /chat/health

检查服务是否正常运行。用于负载均衡器健康检查。

**认证**: 🔓 无需认证

**响应**：

```json
{ "status": "ok" }
```

### GET /chat/status

获取服务器运行状态和会话统计信息。用于监控系统采集指标。

**认证**: 🔓 无需认证

**响应**：

```json
{
  "authenticated": true,
  "status": "ready",
  "sessions": {
    "totalSessions": 7,
    "idleSessions": 3,
    "processingSessions": 4,
    "maxSessions": 100
  }
}
```

---

## 消息与会话（SessionsController）

> **💡 推荐使用**: 使用 `@kedge-agentic/react-sdk` 或 `@kedge-agentic/vue-sdk` 进行集成，无需直接调用 HTTP API。SDK 会自动管理 WebSocket 连接和状态。

### POST /sessions/:sessionId/completion

发送消息（完整版，支持 Skill 路由）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `clientId` | string | 是 | 客户端标识 |
| `message` | string | 是 | 用户消息 |
| `solutionId` | string | 条件必填 | 租户 ID。使用绑定租户的 API Key（admin/builder）时可省略，系统会自动从 Key 上下文解析。 |
| `enabledSkills` | string[] | 否 | 启用的 Skill slug 列表 |
| `attachments` | object[] | 否 | 附件列表 |

**响应**：

```json
{
  "success": true,
  "sessionId": "session-uuid"
}
```

### DELETE /sessions/:sessionId/completion

取消正在执行的任务。

**认证**: 🔐 需要 API Key

**请求体**：

```json
{ "clientId": "client-uuid" }
```

**响应**：

```json
{ "success": true }
```

---

## 会话管理（SessionsController）

### GET /sessions/:sessionId

获取会话状态。

**响应**：

```json
{
  "id": "session-uuid",
  "status": "idle",
  "solutionId": "solution-uuid",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### POST /sessions/:sessionId/restart

重启会话（重新加载 Skill）。

**请求体**：

```json
{ "solutionId": "solution-uuid" }
```

### PUT /sessions/:sessionId/context

更新会话上下文（前端表单状态）。

**请求体**：

```json
{
  "pageContext": {
    "route": "/lesson-plan/123",
    "pageType": "editor",
    "currentData": { "title": "当前标题" }
  }
}
```

### POST /sessions/:sessionId/control-response

提交用户对交互式提示（AskUserQuestion）的回答。当 Agent Engine 暂停并向用户提问时，前端收集用户回答后通过此端点提交。

**认证**: 🔐 需要 API Key

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `requestId` | string | 是 | `tool_activity` 事件中 `toolInput.requestId` 的请求 ID |
| `answers` | Record\<string, string\> | 是 | 用户答案的键值映射（值必须为字符串，每个最大 10KB） |

**响应**：

```json
{ "success": true, "sessionId": "session-uuid", "requestId": "ctrl_req_abc123" }
```

提交后，Agent Engine 带着结构化答案恢复执行。

### GET /sessions/:sessionId/queue-position

获取 Session 在消息处理队列中的当前位置。

**认证**: 🔐 需要 API Key

**响应**：

```json
{
  "sessionId": "session-uuid",
  "status": "pending",
  "position": 5,
  "ahead": 4,
  "estimatedWaitMs": 150000
}
```

**状态值说明**：

| 状态 | 描述 |
|------|------|
| `processing` | Session 的消息正在被处理中。`position: 0, ahead: 0, estimatedWaitMs: 0` |
| `pending` | Session 已入队，等待 worker 空闲 |
| `not_found` | 该 Session 没有活跃的队列项 |

**`estimatedWaitMs`** 基于最近一小时内已完成消息的平均处理时间计算。如无历史数据，默认每个位置按 30 秒估算。

## 队列管理（QueueController）

消息处理队列的只读观测端点。用于监控 worker 饱和度，或实现客户端背压/重试策略。

**认证**: 🔐 需要 API Key

### GET /queue/stats

获取全局队列统计信息。

**响应**：

```json
{
  "pending": 3,
  "processing": 5,
  "workerCapacity": 5
}
```

| 字段 | 说明 |
|------|------|
| `pending` | 等待 worker 处理的消息数 |
| `processing` | 当前正在处理的消息数 |
| `workerCapacity` | 最大并发 worker 数（固定为 5） |

**使用场景**：当 `processing >= workerCapacity` 且 `pending > 0` 时，队列已饱和。客户端可据此延迟或分散新消息的提交时间。

## 消息与会话数据（MessagesController）

会话消息和扩展数据的只读查询端点。用于获取消息历史、文件、工具调用统计、Token 用量等会话数据。

**认证**: 🔓🔐 可选认证（提供 API Key 时验证，未提供时允许匿名访问）

> **说明**：当环境变量 `AUTH_ALLOW_ANONYMOUS=true`（默认值）时，未提供 API Key 的请求被允许。提供了有效 API Key 时，认证上下文会附加到请求。提供了无效 API Key 时，返回 401。

### GET /sessions/:sessionId/messages

获取会话的消息列表。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | number | 否 | 返回条数限制 |
| `offset` | number | 否 | 跳过条数 |
| `includeToolEvents` | boolean | 否 | 是否包含工具调用事件 |

**响应**：

```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "sessionId": "session-uuid",
      "solutionId": "solution-uuid",
      "role": "user",
      "content": "你好",
      "metadata": {},
      "messageIndex": 0,
      "createdAt": "2025-01-15T10:00:00Z",
      "files": [],
      "toolEvents": []
    }
  ]
}
```

### GET /messages/:messageId

根据消息 ID 获取单条消息详情。

**响应**：返回 `MessageResponseDto`（结构同上述 `messages` 数组元素）。消息不存在时返回 404。

### GET /sessions/:sessionId/files

获取会话中所有文件资源（包含 Agent 生成和用户上传的文件）。

**响应**：

```json
{
  "files": [
    {
      "id": "file-uuid",
      "filename": "output.json",
      "mimeType": "application/json",
      "size": 1024,
      "messageId": "msg-uuid",
      "createdAt": "2025-01-15T10:00:00Z",
      "downloadUrl": "/api/v1/files/file-uuid/download"
    }
  ]
}
```

### GET /messages/:messageId/files

获取指定消息关联的文件列表。消息不存在时返回 404。

### GET /sessions/:sessionId/full-trace

获取会话的完整数据，用于重建对话或深度分析。并行获取所有维度数据，适用于会话导出、数据分析、问题诊断、成本核算等场景。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `include` | string | 否 | 要返回的数据段（逗号分隔）。不提供时返回全部数据。 |

**`include` 有效值**：

| 段名 | 说明 |
|------|------|
| `context` | 会话上下文（系统 Prompt、Skill 配置、MCP 工具列表等） |
| `messages` | 消息列表（含工具事件） |
| `thinkingBlocks` | 思考块 |
| `tokenUsage` | Token 用量摘要 |
| `processEvents` | AgentEngine 进程生命周期事件 |
| `apiErrors` | API 错误记录 |
| `userContext` | 用户上下文事件 |
| `toolStats` | 工具调用统计 |
| `sessionEvents` | 持久化会话事件（output_update、agent_status 等） |

**响应**：

```json
{
  "context": { "...会话上下文" },
  "messages": [ "...消息列表（含工具事件）" ],
  "thinkingBlocks": [ "...思考块" ],
  "tokenUsage": { "...Token 用量摘要" },
  "processEvents": [ "...进程生命周期事件" ],
  "apiErrors": [ "...API 错误记录" ],
  "userContext": [ "...用户上下文事件" ],
  "toolStats": { "...工具调用统计" },
  "sessionEvents": [ "...持久化会话事件" ]
}
```

**示例**：

```bash
# 获取全部数据（默认）
curl /api/v1/sessions/:sessionId/full-trace

# 仅获取消息、会话事件和 Token 用量
curl /api/v1/sessions/:sessionId/full-trace?include=messages,sessionEvents,tokenUsage
```

> **💡 通过 Admin 管理页面查看会话数据**
>
> 除了 REST API，同样的会话数据可以在 Admin 管理面板中通过图形化界面查看和操作：
>
> 1. **进入会话列表**：导航至「Sessions」页面，可按租户、状态、时间范围过滤
> 2. **查看会话详情**：点击会话行进入详情页
> 3. **Timeline 标签页**：查看所有事件（消息、工具调用、思考块、进程事件、API 错误、输出更新），支持按 Turn 过滤
> 4. **Turns 标签页**：以对话轮次视角查看摘要，点击可跳转到对应 Turn 的 Timeline
> 5. **Files 标签页**：浏览会话工作区的文件树
> 6. **导出日志**：点击「Export Logs」下载完整时间线 JSON
> 7. **终止会话**：对活跃会话点击「Terminate Process」强制停止

### 扩展数据查询端点

以下端点提供会话的各维度细粒度数据：

| 端点 | 说明 |
|------|------|
| `GET /messages` | 按条件查询消息（支持 `sessionId`、`solutionId`、`limit`、`offset`） |
| `GET /messages/:messageId/tool-events` | 获取消息的工具调用事件 |
| `GET /sessions/:sessionId/tool-stats` | 获取工具调用统计（总数、成功/失败、平均耗时） |
| `GET /sessions/:sessionId/context` | 获取会话上下文（系统 Prompt、Skill 配置、MCP 工具列表等） |
| `GET /sessions/:sessionId/process-events` | 获取 AgentEngine 进程生命周期事件及统计 |
| `GET /sessions/:sessionId/api-errors` | 获取 API 错误记录及统计 |
| `GET /messages/:messageId/thinking` | 获取消息的思考块 |
| `GET /sessions/:sessionId/thinking` | 获取会话的思考块及统计 |
| `GET /sessions/:sessionId/token-usage` | 获取 Token 用量明细和摘要（含模型维度拆分） |
| `GET /sessions/:sessionId/user-context` | 获取用户上下文事件 |
| `GET /sessions/:sessionId/events` | 获取持久化会话事件（支持 `type`、`limit`、`offset` 过滤） |

---

## 会话管理（ConversationsController）

会话元数据管理端点：列表、搜索、更新和删除会话。与 SessionsController（运行时操作）和 MessagesController（消息查询）职责分离。

**路径**: `/api/v1/conversations`
**认证**: 🔐 需要 API Key（`chat` 权限范围）

### GET /conversations

获取会话列表，支持分页和可选过滤。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | 否 | 页码（默认：1） |
| `limit` | number | 否 | 每页条数（默认：20，最大：100） |
| `isPinned` | boolean | 否 | 按置顶状态过滤 |
| `templateName` | string | 否 | 按会话模板名过滤（如 `farmer-advisor`、`bank-assessor`） |

**响应**：

```json
{
  "conversations": [
    {
      "sessionId": "conv_abc123",
      "solutionId": "solution-uuid",
      "title": "会话标题",
      "templateName": "farmer-advisor",
      "messageCount": 8,
      "lastActivity": "2025-01-15T10:30:00Z",
      "createdAt": "2025-01-15T10:00:00Z",
      "isPinned": false
    }
  ],
  "total": 42,
  "hasMore": true
}
```

**`templateName` 过滤**：使用此参数获取特定会话模板的会话。适用于多模板 Solution（例如，同一 Solution 同时包含「农户顾问」和「银行评估」两种角色）。

### GET /conversations/search

按标题搜索会话，支持日期范围过滤。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 标题搜索关键词（最大：255 字符） |
| `dateFrom` | string | 否 | 按创建时间过滤（ISO 8601 格式） |
| `dateTo` | string | 否 | 按创建时间过滤（ISO 8601 格式） |

**响应**：匹配的 `Session` 对象数组（最多 50 条，按最后活动时间降序排列）。

### PATCH /conversations/:id

更新会话元数据（标题、置顶状态）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 否 | 新标题（最大：255 字符） |
| `isPinned` | boolean | 否 | 置顶或取消置顶 |

**响应**：更新后的 `Session` 对象。

### DELETE /conversations/:id

软删除会话。设置 `closedAt` 和状态为 `closed`。数据保留在数据库中，可恢复。

**响应**：

```json
{ "success": true }
```

### GET /conversations/:id/turns

获取会话的所有 Turn（用户-助手对话轮次），包含 Token 用量和耗时统计。

**响应**：

```json
[
  {
    "turnId": "turn-uuid",
    "turnNumber": 0,
    "userMessageId": "user-msg-uuid",
    "assistantMessageId": "assistant-msg-uuid",
    "totalTokens": 1523,
    "durationMs": 4500,
    "createdAt": "2025-01-15T10:00:00Z",
    "completedAt": "2025-01-15T10:00:04Z",
    "toolCount": 3,
    "hasThinking": true,
    "hasErrors": false
  }
]
```

---

## Skill 管理

### GET /skills

获取 Skill 列表。

**查询参数**：`solutionId`, `status`, `type`

### POST /skills

创建 Skill。

**请求体**：

```json
{
  "name": "My Skill",
  "slug": "my-skill",
  "description": "描述",
  "type": "prompt",
  "content": "Skill 内容...",
  "triggers": [{ "type": "keyword", "value": "关键词" }],
  "allowedTools": ["write_output"],
  "solutionId": "solution-uuid"
}
```

### GET /skills/:id

获取 Skill 详情。

### PUT /skills/:id

更新 Skill。

### DELETE /skills/:id

删除 Skill（需 `skills:delete` scope）。

### POST /skills/:id/publish

发布 Skill 版本。

### POST /skills/:id/deprecate

废弃 Skill。

### PATCH /skills/:id/toggle

切换 Skill 的启用/停用状态。翻转 `enabled` 布尔值。

**认证**: 需要 — `X-API-Key` header，需 `skills:write` 权限。

**路径参数**: `id` — Skill ID 或 slug

**响应** (200):

```json
{
  "id": "uuid",
  "name": "My Skill",
  "slug": "my-skill",
  "enabled": false,
  "status": "published",
  ...
}
```

**错误**: `404` Skill 不存在，`403` 未授权。

## MCP Server 管理

### GET /mcp-servers

获取 MCP Server 列表。

### POST /mcp-servers

注册 MCP Server。

**Slug 格式**：必须匹配 `^[a-z0-9][a-z0-9-]*$` — 小写字母、数字和连字符，以字母或数字开头。

**请求体**：

```json
{
  "name": "my-tools",
  "slug": "my-tools",
  "url": "http://localhost:3004",
  "description": "工具服务描述",
  "solutionId": "solution-uuid"
}
```

### GET /mcp-servers/:id

获取 MCP Server 详情。

### DELETE /mcp-servers/:id

删除 MCP Server。

### GET /mcp-servers/:id/health

检查 MCP Server 健康状态。

## 文件管理

### GET /files/sessions/:sessionId

获取会话关联的文件列表。

### GET /files/sessions/:sessionId/:filename

下载会话文件。

## 租户管理

### GET /solutions

获取租户列表（需 `admin` scope）。

### POST /solutions

创建租户。

### GET /solutions/:id

获取租户详情。

## Builder API（Builder 开发者接口）

Builder 开发者管理自有租户和 API Key 的接口。所有端点需要 `builder` 权限范围。Builder 只能操作自己创建的租户，不能创建 `admin` 或 `builder` 级别的 API Key。

### POST /builder/solutions

创建租户并自动将当前 Builder 关联为该租户的管理员。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 租户名称 |
| `slug` | string | 否 | 租户标识（自动生成） |

**响应**：返回创建的租户对象。Builder 用户自动通过 UserSolution 关联为该租户的 `admin` 角色。

### GET /builder/solutions

获取当前 Builder 拥有的租户列表（通过 UserSolution 过滤）。

**响应**：仅返回状态为 `active` 的租户数组。

### GET /builder/solutions/:id

获取 Builder 拥有的单个租户详情。如果租户不属于当前 Builder，返回 403。

### PUT /builder/solutions/:id

更新 Builder 拥有的租户信息。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 更新名称 |

### POST /builder/solutions/:solutionId/api-keys

为 Builder 拥有的租户创建 API Key。不允许创建 `admin` 或 `builder` 级别的 Key。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 可读的名称 |
| `scopes` | string[] | 否 | 权限范围（不能包含 `admin` 或 `builder`） |
| `rateLimitRpm` | number | 否 | 每分钟请求数 |
| `rateLimitRpd` | number | 否 | 每天请求数 |
| `expiresAt` | string | 否 | 过期时间（ISO 8601） |

**响应**：

```json
{
  "apiKey": { "id": "key-uuid", "keyPrefix": "ccaas_live_abc123", "..." },
  "rawKey": "ccaas_live_abc123def456...",
  "warning": "This is the only time the raw API key will be displayed. Please save it securely."
}
```

### GET /builder/solutions/:solutionId/api-keys

获取 Builder 拥有的租户的 API Key 列表。

### PUT /builder/api-keys/:id

更新 API Key（验证租户所有权）。不允许添加 `admin` 或 `builder` 级别的 scope。

### POST /builder/api-keys/:id/revoke

吊销 API Key（验证租户所有权）。已吊销的 Key 返回 400 错误。

### DELETE /builder/api-keys/:id

删除 API Key（验证租户所有权）。

**响应**：

```json
{
  "success": true,
  "message": "API key ccaas_live_abc123... deleted successfully"
}
```

## 认证

### POST /auth/login

开发环境登录端点。返回会话 API Key。

**认证**: 🔓 无需认证

**可用环境**: 仅开发和测试环境（`NODE_ENV !== 'production' && NODE_ENV !== 'staging'`）

**速率限制**: 每分钟 5 次请求

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名（1-64 字符） |
| `password` | string | 是 | 密码（1-128 字符） |

**响应**：

```json
{
  "apiKey": "sk-session_abc123...",
  "user": {
    "id": "user-uuid",
    "username": "admin",
    "name": "Dev Admin"
  }
}
```

**预置账号**（仅开发环境）：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `dev123` | 管理员 |
| `demo` | `Demo123` | 管理员 |

> **⚠️ 安全提示**：此端点在生产和预发布环境中禁用。返回的 API Key 24 小时后过期，具有 `admin` 权限范围。

## 用户管理

平台用户管理端点。所有端点需要 `admin` 权限范围。

**认证**: 🔐 需要 API Key（`admin` 权限范围）

### POST /users

创建新用户。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string | 是 | 用户邮箱（唯一） |
| `name` | string | 是 | 显示名称 |

**响应**：创建的 `User` 对象。

### GET /users

获取所有活跃用户列表。

**响应**：`User` 对象数组。

### GET /users/:id

根据 ID 获取用户详情。

**响应**：`User` 对象。不存在时返回 `404`。

### PATCH /users/:id

更新用户信息。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 更新显示名称 |
| `status` | string | 否 | 更新状态（`active`、`suspended`、`deleted`） |

**响应**：更新后的 `User` 对象。

### DELETE /users/:id

软删除用户（状态设为 `deleted`）。

**响应**：`204 No Content`

## 用户-租户关联

用户与租户关联关系管理端点。每个用户在每个租户中只能有一个角色。所有端点需要 `admin` 权限范围。

**认证**: 🔐 需要 API Key（`admin` 权限范围）

### POST /users/solutions

将用户添加到租户并分配角色。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | 是 | 用户 UUID |
| `solutionId` | string | 是 | 租户 UUID |
| `role` | string | 是 | `admin`、`developer` 或 `viewer` |
| `canCreateSkills` | boolean | 否 | 覆盖 Skill 创建权限（未设置时根据角色自动推导） |

**canCreateSkills 自动推导**：`admin` 和 `developer` → `true`，`viewer` → `false`。

**响应**：创建的 `UserSolution` 对象。用户-租户关联已存在时返回 `409`。

### GET /users/solutions/by-solution/:solutionId

获取租户下的所有用户。

**响应**：`UserSolution` 对象数组（包含用户详情）。

### GET /users/solutions/by-user/:userId

获取用户所属的所有租户。

**响应**：`UserSolution` 对象数组（包含租户详情）。

### PATCH /users/solutions/:id

更新用户-租户关联。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `role` | string | 否 | 更新角色（`admin`、`developer`、`viewer`） |
| `canCreateSkills` | boolean | 否 | 更新 Skill 创建权限 |
| `isActive` | boolean | 否 | 启用或停用 |

**响应**：更新后的 `UserSolution` 对象。

### DELETE /users/solutions/:id

软移除用户与租户的关联（设置 `isActive` 为 `false`）。

**响应**：`204 No Content`

## 管理员 - API Key 管理

用于管理租户 API Key 的管理员接口。所有端点都需要 `admin` 权限范围。

### GET /admin/api-keys

获取指定租户的 API Key 列表，支持分页。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `solutionId` | string | 是 | 租户 ID（用于过滤） |
| `page` | number | 否 | 页码（默认：1） |
| `limit` | number | 否 | 每页条数（默认：50，最大：100） |

**响应**：

```json
{
  "items": [
    {
      "id": "key-uuid",
      "keyPrefix": "ccaas_live_abc123",
      "name": "生产环境 API Key",
      "solutionId": "solution-uuid",
      "scopes": ["chat", "skills:read", "skills:write"],
      "status": "active",
      "rateLimitRpm": 60,
      "rateLimitRpd": 1000,
      "usageCount": 1523,
      "lastUsedAt": "2025-01-15T10:30:00Z",
      "expiresAt": null,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 50
}
```

### POST /admin/api-keys

创建新的 API Key。完整密钥仅在创建时返回一次，之后无法再次获取。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `solutionId` | string | 是 | 租户 ID |
| `name` | string | 是 | 可读的名称 |
| `scopes` | string[] | 否 | 权限范围（默认：`["chat"]`） |
| `rateLimitRpm` | number | 否 | 每分钟请求数（默认：60） |
| `rateLimitRpd` | number | 否 | 每天请求数（默认：1000） |
| `expiresAt` | string | 否 | 过期时间（ISO 8601 格式） |

**可用权限范围**：
- `chat` - 发送聊天消息
- `skills:read` - 查看技能
- `skills:write` - 创建/更新技能
- `skills:execute` - 执行技能
- `skills:delete` - 删除技能
- `mcp:read` - 查看 MCP 服务器
- `mcp:write` - 管理 MCP 服务器
- `analytics:read` - 查看分析数据
- `admin` - 完整管理权限
- `builder` - Builder 开发者权限（管理自有租户和 API Key）

**响应**：

```json
{
  "apiKey": {
    "id": "key-uuid",
    "keyPrefix": "ccaas_live_abc123",
    "name": "生产环境 API Key",
    "solutionId": "solution-uuid",
    "scopes": ["chat", "skills:read"],
    "status": "active",
    "createdAt": "2025-01-15T12:00:00Z"
  },
  "rawKey": "ccaas_live_abc123def456ghi789jkl012mno345pqr678stu901",
  "warning": "这是唯一一次显示完整密钥。请妥善保存。"
}
```

**⚠️ 安全提示**：`rawKey` 字段包含完整的 API 密钥，仅在创建时显示一次。请妥善保存 - 之后无法再次获取。

### GET /admin/api-keys/:id

获取指定 API Key 的详细信息。

**响应**：

```json
{
  "id": "key-uuid",
  "keyPrefix": "ccaas_live_abc123",
  "name": "生产环境 API Key",
  "solutionId": "solution-uuid",
  "scopes": ["chat", "skills:read"],
  "status": "active",
  "rateLimitRpm": 60,
  "rateLimitRpd": 1000,
  "usageCount": 1523,
  "lastUsedAt": "2025-01-15T10:30:00Z",
  "expiresAt": null,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

### PUT /admin/api-keys/:id

更新现有 API Key。所有更改都会记录在审计日志中。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 更新名称 |
| `scopes` | string[] | 否 | 更新权限范围 |
| `rateLimitRpm` | number | 否 | 更新每分钟请求数 |
| `rateLimitRpd` | number | 否 | 更新每天请求数 |
| `status` | string | 否 | 更新状态（`active`、`revoked`） |
| `expiresAt` | string | 否 | 更新过期时间（ISO 8601 格式） |

**响应**：

```json
{
  "id": "key-uuid",
  "keyPrefix": "ccaas_live_abc123",
  "name": "已更新名称",
  "scopes": ["chat", "skills:read", "skills:write"],
  "status": "active",
  "updatedAt": "2025-01-15T12:30:00Z"
}
```

**审计日志**：所有更新都会记录修改前后的值，以便追踪变更。

### POST /admin/api-keys/:id/revoke

吊销 API Key，禁止后续使用。此操作无法撤销。

**响应**：

```json
{
  "id": "key-uuid",
  "status": "revoked",
  "revokedAt": "2025-01-15T12:45:00Z"
}
```

**注意**：已吊销的密钥会保留在数据库中用于审计，但无法再用于身份验证。

### DELETE /admin/api-keys/:id

永久删除 API Key。此操作会在删除前创建审计日志记录。

**响应**：

```json
{
  "success": true,
  "message": "API Key 已成功删除"
}
```

**⚠️ 警告**：此操作会永久从数据库中删除密钥。建议使用吊销功能以保留审计记录。

## 管理员 - 会话管理

用于会话监控和调试的管理员接口。所有端点都需要 `admin` 权限范围。

### GET /admin/sessions

获取会话列表，支持过滤和分页。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `solutionId` | string | 否 | 按租户过滤 |
| `status` | string | 否 | 按状态过滤（`idle`、`processing`、`error`、`closed`） |
| `startDate` | string | 否 | 按创建时间过滤（ISO 8601 格式） |
| `endDate` | string | 否 | 按创建时间过滤（ISO 8601 格式） |
| `page` | number | 否 | 页码（默认：1） |
| `pageSize` | number | 否 | 每页条数（默认：50，最大：250） |

**响应**：

```json
{
  "data": [
    {
      "sessionId": "session-uuid",
      "solutionId": "solution-uuid",
      "clientId": "client-uuid",
      "status": "idle",
      "messageCount": 12,
      "totalTokens": 45230,
      "estimatedCost": 0.15,
      "createdAt": "2025-01-15T10:00:00Z",
      "lastActivity": "2025-01-15T10:30:00Z",
      "hasActiveProcess": false,
      "title": "会话标题",
      "isPinned": false
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 50
}
```

### GET /admin/sessions/:sessionId

获取会话详情。

### GET /admin/sessions/:sessionId/timeline

获取会话时间线，包含所有事件（消息、工具调用、思考块、进程事件、API 错误、输出更新）。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | number | 否 | 最大返回事件数（默认：100，最大：1000） |
| `offset` | number | 否 | 分页偏移量（默认：0） |
| `turnNumber` | integer | 否 | 按 Turn 过滤事件（从 0 开始） |

**响应**：

```json
{
  "sessionId": "session-uuid",
  "events": [
    {
      "id": "event-uuid",
      "type": "message",
      "timestamp": "2025-01-15T10:00:00Z",
      "messageId": "msg-uuid",
      "turnNumber": 0,
      "data": {
        "role": "user",
        "content": "你好",
        "metadata": {},
        "messageIndex": 0
      }
    },
    {
      "id": "event-uuid",
      "type": "tool_event",
      "timestamp": "2025-01-15T10:00:01Z",
      "messageId": "assistant-msg-uuid",
      "turnNumber": 0,
      "data": {
        "toolName": "write_output",
        "phase": "end",
        "input": {},
        "output": {},
        "durationMs": 150,
        "success": true
      }
    },
    {
      "id": "event-uuid",
      "type": "process_event",
      "timestamp": "2025-01-15T10:00:00Z",
      "messageId": null,
      "turnNumber": null,
      "data": {
        "eventType": "spawn",
        "pid": 12345
      }
    }
  ],
  "totalEvents": 45
}
```

**事件类型**：

| 类型 | 说明 | `messageId` | `turnNumber` |
|------|------|-------------|--------------|
| `message` | 用户或助手消息 | 消息主键 | 匹配的 Turn 编号 |
| `tool_event` | 工具调用（开始/结束阶段） | 父消息 ID | 继承自消息 |
| `thinking_block` | 模型思考/推理 | 父消息 ID | 继承自消息 |
| `process_event` | AgentEngine 进程生命周期 | `null` | `null` |
| `api_error` | API 调用错误 | 父消息 ID（可为 null） | 继承自消息 |
| `output_update` | 从工具结果派生 | 继承自工具 | 继承自工具 |

**按 Turn 过滤**：提供 `turnNumber` 参数时，仅返回属于该 Turn 的事件。进程事件（没有 `messageId`）会从按 Turn 过滤的结果中排除。

### GET /admin/sessions/:sessionId/turns

获取会话的 Turn 摘要列表。每个 Turn 代表一次用户-助手对话交换。

**响应**：

```json
[
  {
    "turnId": "turn-uuid",
    "turnNumber": 0,
    "userMessageId": "user-msg-uuid",
    "assistantMessageId": "assistant-msg-uuid",
    "totalTokens": 1523,
    "durationMs": 4500,
    "createdAt": "2025-01-15T10:00:00Z",
    "completedAt": "2025-01-15T10:00:04Z",
    "toolCount": 3,
    "hasThinking": true,
    "hasErrors": false
  }
]
```

| 字段 | 说明 |
|------|------|
| `turnNumber` | 会话内从 0 开始的 Turn 索引 |
| `assistantMessageId` | Turn 仍在进行中时为 `null` |
| `toolCount` | 该 Turn 中已完成的工具调用次数 |
| `hasThinking` | 助手是否使用了扩展思考 |
| `hasErrors` | 该 Turn 中是否发生了 API 错误 |

### GET /admin/sessions/:sessionId/tokens

获取会话的 Token 用量明细。

**响应**：

```json
{
  "inputTokens": 12000,
  "outputTokens": 8500,
  "cachedInputTokens": 3000,
  "cacheReadTokens": 1500,
  "cacheCreationTokens": 500,
  "reasoningTokens": 2000,
  "totalTokens": 22500,
  "estimatedCost": 0.15
}
```

### POST /admin/sessions/:sessionId/kill

强制终止会话的 AgentEngine 进程。

**响应**：

```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

### POST /admin/sessions/bulk-kill

批量终止多个会话。

**请求体**：

```json
{
  "sessionIds": ["session-uuid-1", "session-uuid-2"]
}
```

**响应**：

```json
{
  "totalRequested": 2,
  "successCount": 1,
  "failedCount": 1,
  "results": [
    { "sessionId": "session-uuid-1", "status": "success" },
    { "sessionId": "session-uuid-2", "status": "failed", "error": "Session has no active process" }
  ]
}
```

## 定时任务管理

### POST /scheduled-tasks

创建定时任务。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `solutionId` | string | 是 | 租户 ID |
| `name` | string | 是 | 任务名称 |
| `description` | string | 否 | 任务描述 |
| `message` | string | 是 | 发送给 Claude 的 Prompt |
| `scheduleType` | string | 是 | `cron`、`interval` 或 `once` |
| `scheduleValue` | string | 是 | Cron 表达式、毫秒间隔或 ISO 日期 |
| `enabledSkills` | string[] | 否 | 启用的 Skill slug 列表 |
| `maxConcurrent` | number | 否 | 最大并发执行数（默认：1） |
| `maxRetries` | number | 否 | 失败重试次数（默认：0） |
| `retryDelayMs` | number | 否 | 重试间隔（默认：60000ms） |
| `timeoutMs` | number | 否 | 执行超时（默认：600000ms） |

**响应**：

```json
{
  "id": "task-uuid",
  "name": "每日摘要",
  "scheduleType": "cron",
  "scheduleValue": "0 4 * * *",
  "status": "active"
}
```

### GET /scheduled-tasks

获取定时任务列表。

**查询参数**：`solutionId`, `status`, `page`, `limit`

**响应**：

```json
{
  "data": [{ "id": "...", "name": "...", "status": "active", "scheduleType": "cron" }],
  "total": 10
}
```

### GET /scheduled-tasks/:id

获取任务详情（包含最近执行记录）。

### PUT /scheduled-tasks/:id

更新任务（调度配置、消息、参数等）。

### DELETE /scheduled-tasks/:id

软删除任务（状态设为 `deleted`，停止调度）。

### POST /scheduled-tasks/:id/pause

暂停任务（状态设为 `paused`，移除 cron job）。

### POST /scheduled-tasks/:id/resume

恢复暂停的任务（状态设为 `active`，重新注册 cron job）。

### POST /scheduled-tasks/:id/trigger

手动触发一次执行（不影响正常调度）。

**响应**：

```json
{
  "id": "execution-uuid",
  "taskId": "task-uuid",
  "status": "running",
  "startedAt": "2025-01-15T04:00:00Z"
}
```

### GET /scheduled-tasks/:id/executions

获取任务的执行历史。

**查询参数**：`page`, `limit`, `status`

### GET /scheduled-tasks/:id/executions/:execId

获取执行详情（结果文本、Token 用量、耗时、错误信息）。

## Workflow（Ontology & Workflow 层）

Phase 5 引入的声明式工作流层。Solution 通过这一组 endpoint 推事件、注册 indicator 目录、拉 dashboard、信号 session 结束。详细 wire shape + 鉴权 + 出错处理见 [Ontology & Workflow — 跨进程事件推送](../ontology/cross-process-events.md)。

| Method | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/v1/workflow/sessions/:sessionId/events` | 跨进程事件 ingest（dedup via eventId） |
| `PUT` | `/api/v1/workflow/sessions/:sessionId/indicators` | 注册 session indicator 目录 |
| `DELETE` | `/api/v1/workflow/sessions/:sessionId` | session-end teardown（清 indicator + engine queue） |
| `GET` | `/api/v1/workflow/sessions/:sessionId/observation-dashboard` | dashboard（legacy projector shape） |
| `GET` | `/api/v1/workflow/sessions/:sessionId/dashboard` | dashboard（新 ontology-native shape） |

所有 endpoint 都需 `Authorization: Bearer <chat-scope key>`，并通过 `@TenantId()` 解析出 solutionId（缺失返回 400）。

## Ontology Schema

| Method | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/v1/ontology/schema` | 整个 ontology 的 JSON Schema 投影 + ETag/304 |

详见 [Ontology & Workflow — Schema 原语](../ontology/schema-primitives.md) §序列化 + 投影。
