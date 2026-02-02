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

## API Key 管理

### POST /api-keys

创建 API Key。

### GET /api-keys

获取 API Key 列表。

### DELETE /api-keys/:id

吊销 API Key。

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
