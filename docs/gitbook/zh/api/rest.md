# REST API 端点

所有端点的基础路径为 `/api/v1`。

## 健康检查

### GET /chat/health

检查服务是否正常运行。

**响应**：

```json
{ "status": "ok" }
```

### GET /chat/agent/status

获取 Agent 运行状态和会话统计。

**响应**：

```json
{
  "authenticated": true,
  "status": "ready",
  "sessions": {
    "active": 3,
    "idle": 1,
    "total": 4
  }
}
```

## 消息与会话

### POST /chat/send

发送消息（通过 WebSocket 接收响应事件流）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `clientId` | string | 是 | 客户端标识 |
| `message` | string | 是 | 用户消息 |
| `sessionId` | string | 否 | 会话 ID |
| `tenantId` | string | 否 | 租户 ID |
| `resumeSession` | boolean | 否 | 是否恢复会话 |
| `mcpServers` | object | 否 | MCP Server 配置 |

**响应**：

```json
{
  "success": true,
  "sessionId": "session-uuid"
}
```

### POST /sessions/:sessionId/completion

发送消息（完整版，支持 Skill 路由）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `clientId` | string | 是 | 客户端标识 |
| `message` | string | 是 | 用户消息 |
| `tenantId` | string | 是 | 租户 ID |
| `mcpServers` | object | 否 | MCP Server 配置 |
| `skillPath` | string | 否 | Skill 文件路径 |
| `enabledSkillSlugs` | string[] | 否 | 启用的 Skill slug 列表 |
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

**请求体**：

```json
{ "clientId": "client-uuid" }
```

### POST /chat/cancel

取消正在执行的操作。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `clientId` | string | 是 | 客户端标识 |
| `sessionId` | string | 否 | 会话 ID |

## 会话管理

### GET /sessions/:sessionId

获取会话状态。

**响应**：

```json
{
  "id": "session-uuid",
  "status": "idle",
  "tenantId": "tenant-uuid",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### POST /sessions/:sessionId/restart

重启会话（重新加载 Skill）。

**请求体**：

```json
{ "tenantId": "tenant-uuid" }
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

## Skill 管理

### GET /skills

获取 Skill 列表。

**查询参数**：`tenantId`, `status`, `type`

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
  "tenantId": "tenant-uuid"
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

## MCP Server 管理

### GET /mcp-servers

获取 MCP Server 列表。

### POST /mcp-servers

注册 MCP Server。

**请求体**：

```json
{
  "name": "my-tools",
  "url": "http://localhost:3004",
  "description": "工具服务描述",
  "tenantId": "tenant-uuid"
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

### GET /tenants

获取租户列表（需 `admin` scope）。

### POST /tenants

创建租户。

### GET /tenants/:id

获取租户详情。

## 管理员 - API Key 管理

用于管理租户 API Key 的管理员接口。所有端点都需要 `admin` 权限范围。

### GET /admin/api-keys

获取指定租户的 API Key 列表，支持分页。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tenantId` | string | 是 | 租户 ID（用于过滤） |
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
      "tenantId": "tenant-uuid",
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
| `tenantId` | string | 是 | 租户 ID |
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

**响应**：

```json
{
  "apiKey": {
    "id": "key-uuid",
    "keyPrefix": "ccaas_live_abc123",
    "name": "生产环境 API Key",
    "tenantId": "tenant-uuid",
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
  "tenantId": "tenant-uuid",
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

## 定时任务管理

### POST /scheduled-tasks

创建定时任务。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tenantId` | string | 是 | 租户 ID |
| `name` | string | 是 | 任务名称 |
| `description` | string | 否 | 任务描述 |
| `message` | string | 是 | 发送给 Claude 的 Prompt |
| `scheduleType` | string | 是 | `cron`、`interval` 或 `once` |
| `scheduleValue` | string | 是 | Cron 表达式、毫秒间隔或 ISO 日期 |
| `mcpServers` | object | 否 | MCP Server 配置 |
| `enabledSkillSlugs` | string[] | 否 | 启用的 Skill slug 列表 |
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

**查询参数**：`tenantId`, `status`, `page`, `limit`

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
