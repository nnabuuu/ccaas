# REST API Endpoints

The base path for all endpoints is `/api/v1`.

## Health Check

### GET /chat/health

Check whether the service is running normally.

**Response**:

```json
{ "status": "ok" }
```

### GET /chat/agent/status

Get the Agent runtime status and session statistics.

**Response**:

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

## Messages & Sessions

### POST /chat/send

Send a message (responses are received as an event stream via WebSocket).

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | string | Yes | Client identifier |
| `message` | string | Yes | User message |
| `sessionId` | string | No | Session ID |
| `tenantId` | string | No | Tenant ID |
| `resumeSession` | boolean | No | Whether to resume a session |
| `mcpServers` | object | No | MCP Server configuration |

**Response**:

```json
{
  "success": true,
  "sessionId": "session-uuid"
}
```

### POST /sessions/:sessionId/completion

Send a message (full version with Skill routing support).

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | string | Yes | Client identifier |
| `message` | string | Yes | User message |
| `tenantId` | string | Yes | Tenant ID |
| `mcpServers` | object | No | MCP Server configuration |
| `skillPath` | string | No | Skill file path |
| `enabledSkillSlugs` | string[] | No | List of enabled Skill slugs |
| `attachments` | object[] | No | Attachment list |

**Response**:

```json
{
  "success": true,
  "sessionId": "session-uuid"
}
```

### DELETE /sessions/:sessionId/completion

Cancel a running task.

**Request Body**:

```json
{ "clientId": "client-uuid" }
```

### POST /chat/cancel

Cancel a running operation.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | string | Yes | Client identifier |
| `sessionId` | string | No | Session ID |

## Session Management

### GET /sessions/:sessionId

Get session status.

**Response**:

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

Restart a session (reloads Skills).

**Request Body**:

```json
{ "tenantId": "tenant-uuid" }
```

### PUT /sessions/:sessionId/context

Update session context (frontend form state).

**Request Body**:

```json
{
  "pageContext": {
    "route": "/lesson-plan/123",
    "pageType": "editor",
    "currentData": { "title": "Current Title" }
  }
}
```

## Skill Management

### GET /skills

Get the Skill list.

**Query Parameters**: `tenantId`, `status`, `type`

### POST /skills

Create a Skill.

**Request Body**:

```json
{
  "name": "My Skill",
  "slug": "my-skill",
  "description": "Description",
  "type": "prompt",
  "content": "Skill content...",
  "triggers": [{ "type": "keyword", "value": "keyword" }],
  "allowedTools": ["write_output"],
  "tenantId": "tenant-uuid"
}
```

### GET /skills/:id

Get Skill details.

### PUT /skills/:id

Update a Skill.

### DELETE /skills/:id

Delete a Skill (requires `skills:delete` scope).

### POST /skills/:id/publish

Publish a Skill version.

### POST /skills/:id/deprecate

Deprecate a Skill.

## MCP Server Management

### GET /mcp-servers

Get the MCP Server list.

### POST /mcp-servers

Register an MCP Server.

**Request Body**:

```json
{
  "name": "my-tools",
  "url": "http://localhost:3004",
  "description": "Tool service description",
  "tenantId": "tenant-uuid"
}
```

### GET /mcp-servers/:id

Get MCP Server details.

### DELETE /mcp-servers/:id

Delete an MCP Server.

### GET /mcp-servers/:id/health

Check MCP Server health status.

## File Management

### GET /files/sessions/:sessionId

Get the list of files associated with a session.

### GET /files/sessions/:sessionId/:filename

Download a session file.

## Tenant Management

### GET /tenants

Get the tenant list (requires `admin` scope).

### POST /tenants

Create a tenant.

### GET /tenants/:id

Get tenant details.

## API Key Management

### POST /api-keys

Create an API Key.

### GET /api-keys

Get the API Key list.

### DELETE /api-keys/:id

Revoke an API Key.

## Scheduled Task Management

### POST /scheduled-tasks

Create a scheduled task.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Tenant ID |
| `name` | string | Yes | Task name |
| `description` | string | No | Task description |
| `message` | string | Yes | Prompt message sent to Claude |
| `scheduleType` | string | Yes | `cron`, `interval`, or `once` |
| `scheduleValue` | string | Yes | Cron expression, millisecond interval, or ISO date |
| `mcpServers` | object | No | MCP Server configuration |
| `enabledSkillSlugs` | string[] | No | Enabled Skill slugs |
| `maxConcurrent` | number | No | Max concurrent executions (default: 1) |
| `maxRetries` | number | No | Retry count on failure (default: 0) |
| `retryDelayMs` | number | No | Retry delay in ms (default: 60000) |
| `timeoutMs` | number | No | Execution timeout in ms (default: 600000) |

**Response**:

```json
{
  "id": "task-uuid",
  "name": "Daily Summary",
  "scheduleType": "cron",
  "scheduleValue": "0 4 * * *",
  "status": "active"
}
```

### GET /scheduled-tasks

List scheduled tasks.

**Query Parameters**: `tenantId`, `status`, `page`, `limit`

**Response**:

```json
{
  "data": [{ "id": "...", "name": "...", "status": "active", "scheduleType": "cron" }],
  "total": 10
}
```

### GET /scheduled-tasks/:id

Get task detail (includes recent executions).

### PUT /scheduled-tasks/:id

Update a task (schedule, message, configuration).

### DELETE /scheduled-tasks/:id

Soft delete a task (sets status to `deleted`, stops scheduling).

### POST /scheduled-tasks/:id/pause

Pause a task (sets status to `paused`, removes cron job).

### POST /scheduled-tasks/:id/resume

Resume a paused task (sets status to `active`, re-registers cron job).

### POST /scheduled-tasks/:id/trigger

Manually trigger a task execution (does not affect the regular schedule).

**Response**:

```json
{
  "id": "execution-uuid",
  "taskId": "task-uuid",
  "status": "running",
  "startedAt": "2025-01-15T04:00:00Z"
}
```

### GET /scheduled-tasks/:id/executions

List execution history for a task.

**Query Parameters**: `page`, `limit`, `status`

### GET /scheduled-tasks/:id/executions/:execId

Get execution detail (result text, token usage, duration, error message).
