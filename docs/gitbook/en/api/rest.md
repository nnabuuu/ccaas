# REST API Endpoints

The base path for all endpoints is `/api/v1`.

## Error Responses

All API errors return a standardized JSON response. For complete error handling documentation, see [Error Handling](error-handling.md).

**Standard Error Format:**

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

**Common Error Codes:**
- `VALIDATION_ERROR` (400) - Invalid request data
- `SESSION_EXPIRED` (401) - Authentication required
- `PERMISSION_DENIED` (403) - Insufficient permissions
- `SKILL_NOT_FOUND` (404) - Resource not found
- `RATE_LIMITED` (429) - Rate limit exceeded
- `INTERNAL_ERROR` (500) - Server error
- `TIMEOUT` (504) - Request timeout

See the [Error Handling Guide](error-handling.md) for detailed error codes, retry strategies, and client implementation examples.

## API Controller Responsibilities

### ChatController - Monitoring & Health Checks

**Path**: `/api/v1/chat`
**Responsibility**: Service health checks and monitoring metrics only
**Features**: 🔓 No authentication required (Public)

All endpoints do not require an API Key. Primary uses:
- Load balancer health checks
- Monitoring system metrics collection
- DevOps service status monitoring

### SessionsController - Core Business API

**Path**: `/api/v1/sessions`
**Responsibility**: AI message interaction + session lifecycle management
**Features**: 🔐 Requires API Key authentication

Standard entry point for all business logic, including:
- Sending messages to AI
- Canceling running operations
- Managing session state and context
- Retrieving message history and files

---

## Monitoring Endpoints (ChatController)

### GET /chat/health

Check whether the service is running normally. Used for load balancer health checks.

**Authentication**: 🔓 No authentication required

**Response**:

```json
{ "status": "ok" }
```

### GET /chat/status

Get server runtime status and session statistics. Used for monitoring system metrics collection.

**Authentication**: 🔓 No authentication required

**Response**:

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

## Messages & Sessions (SessionsController)

> **💡 Recommended**: Use `@ccaas/react-sdk` or `@ccaas/vue-sdk` for integration. No need to call HTTP APIs directly. The SDK automatically manages WebSocket connections and state.

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

**Authentication**: 🔐 Requires API Key

**Request Body**:

```json
{ "clientId": "client-uuid" }
```

**Response**:

```json
{ "success": true }
```

---

## Session Management (SessionsController)

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

## Admin - API Key Management

Admin API for managing API keys across tenants. All endpoints require `admin` scope.

### GET /admin/api-keys

List API keys for a specific tenant with pagination support.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Tenant ID to filter keys |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50, max: 100) |

**Response**:

```json
{
  "items": [
    {
      "id": "key-uuid",
      "keyPrefix": "ccaas_live_abc123",
      "name": "Production API Key",
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

Create a new API key. The raw key is returned only once and cannot be retrieved later.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Tenant ID for the key |
| `name` | string | Yes | Human-readable name |
| `scopes` | string[] | No | Permission scopes (default: `["chat"]`) |
| `rateLimitRpm` | number | No | Requests per minute (default: 60) |
| `rateLimitRpd` | number | No | Requests per day (default: 1000) |
| `expiresAt` | string | No | Expiration date (ISO 8601) |

**Available Scopes**:
- `chat` - Send chat messages
- `skills:read` - View skills
- `skills:write` - Create/update skills
- `skills:execute` - Execute skills
- `skills:delete` - Delete skills
- `mcp:read` - View MCP servers
- `mcp:write` - Manage MCP servers
- `analytics:read` - View analytics
- `admin` - Full admin access

**Response**:

```json
{
  "apiKey": {
    "id": "key-uuid",
    "keyPrefix": "ccaas_live_abc123",
    "name": "Production API Key",
    "tenantId": "tenant-uuid",
    "scopes": ["chat", "skills:read"],
    "status": "active",
    "createdAt": "2025-01-15T12:00:00Z"
  },
  "rawKey": "ccaas_live_abc123def456ghi789jkl012mno345pqr678stu901",
  "warning": "This is the only time the full key will be displayed. Store it securely."
}
```

**⚠️ Security Note**: The `rawKey` field contains the complete API key and is shown only once during creation. Store it securely - it cannot be retrieved later.

### GET /admin/api-keys/:id

Get details of a specific API key.

**Response**:

```json
{
  "id": "key-uuid",
  "keyPrefix": "ccaas_live_abc123",
  "name": "Production API Key",
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

Update an existing API key. Changes are logged in the audit log.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Update the name |
| `scopes` | string[] | No | Update permission scopes |
| `rateLimitRpm` | number | No | Update requests per minute |
| `rateLimitRpd` | number | No | Update requests per day |
| `status` | string | No | Update status (`active`, `revoked`) |
| `expiresAt` | string | No | Update expiration date (ISO 8601) |

**Response**:

```json
{
  "id": "key-uuid",
  "keyPrefix": "ccaas_live_abc123",
  "name": "Updated Name",
  "scopes": ["chat", "skills:read", "skills:write"],
  "status": "active",
  "updatedAt": "2025-01-15T12:30:00Z"
}
```

**Audit Log**: All updates are logged with before/after values for tracking changes.

### POST /admin/api-keys/:id/revoke

Revoke an API key, preventing further use. This action cannot be undone.

**Response**:

```json
{
  "id": "key-uuid",
  "status": "revoked",
  "revokedAt": "2025-01-15T12:45:00Z"
}
```

**Note**: Revoked keys remain in the database for audit purposes but cannot be used for authentication.

### DELETE /admin/api-keys/:id

Permanently delete an API key. This action creates an audit log entry before deletion.

**Response**:

```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

**⚠️ Warning**: This permanently removes the key from the database. Consider using revoke instead for audit trail preservation.

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
