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
- Submitting user answers for interactive prompts

### MessagesController - Messages & Session Data

**Path**: `/api/v1` (routes under `/sessions/:sessionId/*` and `/messages/*`)
**Responsibility**: Read-only access to persisted messages, files, and session diagnostics
**Features**: 🔓🔐 Optional Authentication (API Key validated if provided, anonymous access allowed if not)

Provides data retrieval for:
- Message history and file attachments
- Tool events, thinking blocks, token usage
- Full conversation trace export

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

> **💡 Recommended**: Use `@kedge-agentic/react-sdk` or `@kedge-agentic/vue-sdk` for integration. No need to call HTTP APIs directly. The SDK automatically manages WebSocket connections and state.

### POST /sessions/:sessionId/completion

Send a message (full version with Skill routing support).

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | string | Yes | Client identifier |
| `message` | string | Yes | User message |
| `solutionId` | string | Conditional | Solution ID. Required unless the API key has a bound solution (admin/builder keys auto-resolve solutionId from key context). |
| `enabledSkills` | string[] | No | List of enabled Skill slugs |
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
  "solutionId": "solution-uuid",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### POST /sessions/:sessionId/restart

Restart a session (reloads Skills).

**Request Body**:

```json
{ "solutionId": "solution-uuid" }
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

### POST /sessions/:sessionId/control-response

Submit user answers for an interactive prompt (AskUserQuestion). When the Agent Engine pauses to ask the user a question, the frontend collects the answer and submits it via this endpoint.

**Authentication**: 🔐 Requires API Key

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | Yes | The request ID from the `tool_activity` event's `toolInput.requestId` |
| `answers` | Record\<string, string\> | Yes | Key-value map of user answers (values must be strings, max 10KB each) |

**Response**:

```json
{ "success": true, "sessionId": "session-uuid", "requestId": "ctrl_req_abc123" }
```

After submission, the Agent Engine resumes execution with the structured answers.

### GET /sessions/:sessionId/queue-position

Get a session's current position in the message processing queue.

**Authentication**: 🔐 Requires API Key

**Response**:

```json
{
  "sessionId": "session-uuid",
  "status": "pending",
  "position": 5,
  "ahead": 4,
  "estimatedWaitMs": 150000
}
```

**Status values**:

| Status | Description |
|--------|-------------|
| `processing` | Session's message is currently being processed. `position: 0, ahead: 0, estimatedWaitMs: 0` |
| `pending` | Session is queued and waiting for a worker |
| `not_found` | No active queue item found for this session |

**`estimatedWaitMs`** is calculated from the average processing time of completed messages in the last hour. Defaults to 30 seconds per position if no history is available.

## Queue Management (QueueController)

Read-only observability endpoints for the message processing queue. Useful for monitoring worker saturation and implementing client-side backpressure or retry strategies.

**Authentication**: 🔐 Requires API Key

### GET /queue/stats

Get global queue statistics.

**Response**:

```json
{
  "pending": 3,
  "processing": 5,
  "workerCapacity": 5
}
```

| Field | Description |
|-------|-------------|
| `pending` | Messages waiting for a worker |
| `processing` | Messages currently being processed |
| `workerCapacity` | Maximum concurrent workers (fixed at 5) |

**Use case**: If `processing >= workerCapacity` and `pending > 0`, the queue is saturated. Clients can use this to delay or stagger new message submissions.

## Messages & Session Data (MessagesController)

Read-only endpoints for retrieving persisted messages, files, and session diagnostics. Useful for building message history UIs, exporting conversations, and debugging session behavior.

**Path**: `/api/v1`
**Authentication**: 🔓🔐 Optional Authentication (API Key validated if provided, anonymous access allowed if not)

### GET /sessions/:sessionId/messages

Get all messages for a session.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | Number of messages to return |
| `offset` | number | No | Number of messages to skip |
| `includeToolEvents` | boolean | No | Include tool call events with each message |

**Response**:

```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "sessionId": "session-uuid",
      "solutionId": "solution-uuid",
      "role": "user",
      "content": "Hello",
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

Get a single message by ID.

**Response**: Single message object (same shape as above). Returns `404` if not found.

### GET /sessions/:sessionId/files

Get all files associated with a session (both agent-generated and user-uploaded).

**Response**:

```json
{
  "files": [
    {
      "id": "file-uuid",
      "filename": "output.json",
      "mimeType": "application/json",
      "size": 1234,
      "messageId": "msg-uuid",
      "createdAt": "2025-01-15T10:00:00Z",
      "downloadUrl": "/api/v1/files/file-uuid/download"
    }
  ]
}
```

### GET /messages/:messageId/files

Get files attached to a specific message. Returns `404` if the message does not exist.

### GET /sessions/:sessionId/full-trace

Get complete session data for conversation reconstruction or deep analysis. Fetches all data in parallel and returns a combined object.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `include` | string | No | Sections to return (comma-separated). Returns all sections when omitted. |

**Valid `include` values**:

| Section | Description |
|---------|-------------|
| `context` | Conversation context (system prompt, Skill config, MCP tools, etc.) |
| `messages` | Messages with tool events |
| `thinkingBlocks` | Thinking/reasoning blocks |
| `tokenUsage` | Token usage and cost summary |
| `processEvents` | AgentEngine process lifecycle events |
| `apiErrors` | API error records |
| `userContext` | User context events |
| `toolStats` | Tool call statistics |
| `sessionEvents` | Persisted session events (output_update, agent_status, etc.) |

**Response**:

```json
{
  "context": { "...conversation context..." },
  "messages": [ "...all messages with tool events..." ],
  "thinkingBlocks": [ "...thinking/reasoning blocks..." ],
  "tokenUsage": { "...cost and token summary..." },
  "processEvents": [ "...AgentEngine process lifecycle..." ],
  "apiErrors": [ "...API error records..." ],
  "userContext": [ "...user context events..." ],
  "toolStats": { "totalEvents": 12, "successCount": 11, "errorCount": 1, "..." },
  "sessionEvents": [ "...persisted session events..." ]
}
```

**Examples**:

```bash
# Get all data (default)
curl /api/v1/sessions/:sessionId/full-trace

# Get only messages, session events, and token usage
curl /api/v1/sessions/:sessionId/full-trace?include=messages,sessionEvents,tokenUsage
```

**Use cases**: Session export/backup, data analysis, debugging, cost accounting.

> **💡 Viewing session data via the Admin UI**
>
> The same session data is also accessible through the Admin dashboard with a graphical interface:
>
> 1. **Session list**: Navigate to the "Sessions" page. Filter by solution, status, or time range.
> 2. **Session detail**: Click a session row to open its detail page.
> 3. **Timeline tab**: View all events (messages, tool calls, thinking blocks, process events, API errors, output updates). Supports filtering by Turn.
> 4. **Turns tab**: View turn-by-turn summaries. Click a turn to jump to the corresponding Timeline events.
> 5. **Files tab**: Browse the session workspace file tree.
> 6. **Export logs**: Click "Export Logs" to download the full timeline as JSON.
> 7. **Terminate session**: Click "Terminate Process" on active sessions to force stop.

### Extended Data Capture Endpoints

The following endpoints provide granular access to individual data categories. Each corresponds to one section of the `full-trace` response above.

| Endpoint | Description |
|----------|-------------|
| `GET /messages` | Query messages with filters (via query params) |
| `GET /messages/:messageId/tool-events` | Tool call events for a message |
| `GET /sessions/:sessionId/tool-stats` | Tool event statistics (counts, success rate, avg duration) |
| `GET /sessions/:sessionId/context` | Conversation context (system prompt hash, MCP tools, model) |
| `GET /sessions/:sessionId/process-events` | AgentEngine process lifecycle events with stats |
| `GET /sessions/:sessionId/api-errors` | API errors with stats (rate limits, retries) |
| `GET /messages/:messageId/thinking` | Thinking blocks for a single message |
| `GET /sessions/:sessionId/thinking` | All thinking blocks for a session with stats |
| `GET /sessions/:sessionId/token-usage` | Per-request token usage with cost summary |
| `GET /sessions/:sessionId/user-context` | User context events (page URL, viewport, etc.) |
| `GET /sessions/:sessionId/events` | Persisted session events (supports `type`, `limit`, `offset` filters) |

## Conversation Management (ConversationsController)

Endpoints for managing conversation metadata: listing, searching, updating, and deleting conversations. Distinct from SessionsController (runtime operations) and MessagesController (message queries).

**Path**: `/api/v1/conversations`
**Authentication**: 🔐 Requires API Key (`chat` scope)

### GET /conversations

List conversations with pagination and optional filters.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `isPinned` | boolean | No | Filter by pinned status |
| `templateName` | string | No | Filter by session template name (e.g., `farmer-advisor`, `bank-assessor`) |

**Response**:

```json
{
  "conversations": [
    {
      "sessionId": "conv_abc123",
      "solutionId": "solution-uuid",
      "title": "Conversation Title",
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

**`templateName` filtering**: Use this parameter to retrieve conversations belonging to a specific session template. This is useful for multi-template Solutions (e.g., one Solution with both a "farmer advisor" and a "bank assessor" role).

### GET /conversations/search

Search conversations by title with optional date range filtering.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Search query for conversation titles (max: 255 chars) |
| `dateFrom` | string | No | Filter by creation date (ISO 8601) |
| `dateTo` | string | No | Filter by creation date (ISO 8601) |

**Response**: Array of matching `Session` objects (up to 50 results, ordered by last activity).

### PATCH /conversations/:id

Update conversation metadata (title, pinned status).

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | New title (max: 255 chars) |
| `isPinned` | boolean | No | Pin or unpin |

**Response**: Updated `Session` object.

### DELETE /conversations/:id

Soft delete a conversation. Sets `closedAt` and status to `closed`. Data is preserved and can be recovered.

**Response**:

```json
{ "success": true }
```

### GET /conversations/:id/turns

Get all turns (user-assistant exchanges) for a conversation, including token usage and duration metrics.

**Response**:

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

## Skill Management

### GET /skills

Get the Skill list.

**Query Parameters**: `solutionId`, `status`, `type`

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
  "solutionId": "solution-uuid"
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

### PATCH /skills/:id/toggle

Toggle skill enabled/disabled state. Flips the `enabled` boolean.

**Auth**: Required — `X-API-Key` header with `skills:write` scope.

**Path Parameters**: `id` — Skill ID or slug

**Response** (200):

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

**Errors**: `404` if skill not found, `403` if unauthorized.

## MCP Server Management

### GET /mcp-servers

Get the MCP Server list.

### POST /mcp-servers

Register an MCP Server.

**Slug format**: Must match `^[a-z0-9][a-z0-9-]*$` — lowercase alphanumeric with hyphens, starting with a letter or digit.

**Request Body**:

```json
{
  "name": "my-tools",
  "slug": "my-tools",
  "url": "http://localhost:3004",
  "description": "Tool service description",
  "solutionId": "solution-uuid"
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

## Solution Management

### GET /solutions

Get the solution list (requires `admin` scope).

### POST /solutions

Create a solution.

### GET /solutions/:id

Get solution details.

## Builder API

API for builder-scoped developers to manage their own solutions and API keys. All endpoints require `builder` scope. Builders can only operate on solutions they own and cannot create `admin` or `builder` scoped API keys.

### POST /builder/solutions

Create a solution and auto-link the current builder as its admin via UserSolution.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Solution name |
| `slug` | string | No | Solution identifier (auto-generated) |

**Response**: The created solution object. The builder user is automatically linked as `admin` role via UserSolution.

### GET /builder/solutions

List solutions owned by the current builder (filtered via UserSolution).

**Response**: Array of solutions with `active` status only.

### GET /builder/solutions/:id

Get details of a builder-owned solution. Returns 403 if the solution is not owned by the current builder.

### PUT /builder/solutions/:id

Update a builder-owned solution.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Update name |

### POST /builder/solutions/:solutionId/api-keys

Create an API key for a builder-owned solution. Cannot create keys with `admin` or `builder` scopes.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable name |
| `scopes` | string[] | No | Permission scopes (cannot include `admin` or `builder`) |
| `rateLimitRpm` | number | No | Requests per minute |
| `rateLimitRpd` | number | No | Requests per day |
| `expiresAt` | string | No | Expiration date (ISO 8601) |

**Response**:

```json
{
  "apiKey": { "id": "key-uuid", "keyPrefix": "ccaas_live_abc123", "..." },
  "rawKey": "ccaas_live_abc123def456...",
  "warning": "This is the only time the raw API key will be displayed. Please save it securely."
}
```

### GET /builder/solutions/:solutionId/api-keys

List API keys for a builder-owned solution.

### PUT /builder/api-keys/:id

Update an API key (verifies solution ownership). Cannot add `admin` or `builder` scopes.

### POST /builder/api-keys/:id/revoke

Revoke an API key (verifies solution ownership). Returns 400 if already revoked.

### DELETE /builder/api-keys/:id

Delete an API key (verifies solution ownership).

**Response**:

```json
{
  "success": true,
  "message": "API key ccaas_live_abc123... deleted successfully"
}
```

## Authentication

### POST /auth/login

Dev Login endpoint for non-production environments. Returns a session API key.

**Authentication**: No authentication required

**Availability**: Development and test environments only (`NODE_ENV !== 'production' && NODE_ENV !== 'staging'`)

**Rate Limit**: 5 requests per minute

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Username (1-64 chars) |
| `password` | string | Yes | Password (1-128 chars) |

**Response**:

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

**Default Accounts** (development only):

| Username | Password | Role |
|----------|----------|------|
| `admin` | `dev123` | Admin |
| `demo` | `Demo123` | Admin |

> **Warning**: This endpoint is disabled in production and staging environments. The returned API key expires after 24 hours and has `admin` scope.

## User Management

Endpoints for managing platform users. All endpoints require `admin` scope.

**Authentication**: Requires API Key (`admin` scope)

### POST /users

Create a new user.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email (unique) |
| `name` | string | Yes | Display name |

**Response**: Created `User` object.

### GET /users

List all active users.

**Response**: Array of `User` objects.

### GET /users/:id

Get user details by ID.

**Response**: `User` object. Returns `404` if not found.

### PATCH /users/:id

Update a user.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Update display name |
| `status` | string | No | Update status (`active`, `suspended`, `deleted`) |

**Response**: Updated `User` object.

### DELETE /users/:id

Soft delete a user (sets status to `deleted`).

**Response**: `204 No Content`

## User-Solution Association

Endpoints for managing user-solution relationships. Each user can have one role per solution. All endpoints require `admin` scope.

**Authentication**: Requires API Key (`admin` scope)

### POST /users/solutions

Add a user to a solution with a specific role.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User UUID |
| `solutionId` | string | Yes | Solution UUID |
| `role` | string | Yes | `admin`, `developer`, or `viewer` |
| `canCreateSkills` | boolean | No | Override skill creation permission (auto-derived from role if omitted) |

**canCreateSkills auto-derivation**: `admin` and `developer` -> `true`, `viewer` -> `false`.

**Response**: Created `UserSolution` object. Returns `409` if the user-solution association already exists.

### GET /users/solutions/by-solution/:solutionId

List all users in a solution.

**Response**: Array of `UserSolution` objects (with user details).

### GET /users/solutions/by-user/:userId

List all solutions a user belongs to.

**Response**: Array of `UserSolution` objects (with solution details).

### PATCH /users/solutions/:id

Update a user-solution association.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | No | Update role (`admin`, `developer`, `viewer`) |
| `canCreateSkills` | boolean | No | Update skill creation permission |
| `isActive` | boolean | No | Activate or deactivate |

**Response**: Updated `UserSolution` object.

### DELETE /users/solutions/:id

Soft remove a user from a solution (sets `isActive` to `false`).

**Response**: `204 No Content`

## Admin - API Key Management

Admin API for managing API keys across solutions. All endpoints require `admin` scope.

### GET /admin/api-keys

List API keys for a specific solution with pagination support.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `solutionId` | string | Yes | Solution ID to filter keys |
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

Create a new API key. The raw key is returned only once and cannot be retrieved later.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `solutionId` | string | Yes | Solution ID for the key |
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
- `builder` - Builder developer access (manage own solutions and API keys)

**Response**:

```json
{
  "apiKey": {
    "id": "key-uuid",
    "keyPrefix": "ccaas_live_abc123",
    "name": "Production API Key",
    "solutionId": "solution-uuid",
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

## Admin - Session Management

Admin API for session monitoring and debugging. All endpoints require `admin` scope.

### GET /admin/sessions

List sessions with filtering and pagination.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `solutionId` | string | No | Filter by solution |
| `status` | string | No | Filter by status (`idle`, `processing`, `error`, `closed`) |
| `startDate` | string | No | Filter by creation date (ISO 8601) |
| `endDate` | string | No | Filter by creation date (ISO 8601) |
| `page` | number | No | Page number (default: 1) |
| `pageSize` | number | No | Items per page (default: 50, max: 250) |

**Response**:

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
      "title": "Session Title",
      "isPinned": false
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 50
}
```

### GET /admin/sessions/:sessionId

Get session detail.

### GET /admin/sessions/:sessionId/timeline

Get session timeline with all events (messages, tool calls, thinking blocks, process events, API errors, output updates).

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | Max events to return (default: 100, max: 1000) |
| `offset` | number | No | Pagination offset (default: 0) |
| `turnNumber` | integer | No | Filter events to a specific turn (0-based) |

**Response**:

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
        "content": "Hello",
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

**Event Types**:

| Type | Description | `messageId` | `turnNumber` |
|------|-------------|-------------|--------------|
| `message` | User or assistant message | Message PK | Turn number if matched |
| `tool_event` | Tool invocation (start/end phase) | Parent message ID | Inherited from message |
| `thinking_block` | Model thinking/reasoning | Parent message ID | Inherited from message |
| `process_event` | AgentEngine process lifecycle | `null` | `null` |
| `api_error` | API call error | Parent message ID (nullable) | Inherited from message |
| `output_update` | Derived from tool results | Inherited from tool | Inherited from tool |

**Filtering by Turn**: When `turnNumber` is provided, only events belonging to that turn are returned. Process events (which have no `messageId`) are excluded from turn-filtered results.

### GET /admin/sessions/:sessionId/turns

Get turn summaries for a session. A turn represents one user-assistant exchange.

**Response**:

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

| Field | Description |
|-------|-------------|
| `turnNumber` | 0-based turn index within the session |
| `assistantMessageId` | `null` if the turn is still in progress |
| `toolCount` | Number of completed tool calls in this turn |
| `hasThinking` | Whether the assistant used extended thinking |
| `hasErrors` | Whether any API errors occurred during this turn |

### GET /admin/sessions/:sessionId/tokens

Get token usage breakdown for a session.

**Response**:

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

Force terminate a session's AgentEngine process.

**Response**:

```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

### POST /admin/sessions/bulk-kill

Bulk terminate multiple sessions.

**Request Body**:

```json
{
  "sessionIds": ["session-uuid-1", "session-uuid-2"]
}
```

**Response**:

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

## Scheduled Task Management

### POST /scheduled-tasks

Create a scheduled task.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `solutionId` | string | Yes | Solution ID |
| `name` | string | Yes | Task name |
| `description` | string | No | Task description |
| `message` | string | Yes | Prompt message sent to Claude |
| `scheduleType` | string | Yes | `cron`, `interval`, or `once` |
| `scheduleValue` | string | Yes | Cron expression, millisecond interval, or ISO date |
| `enabledSkills` | string[] | No | Enabled Skill slugs |
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

**Query Parameters**: `solutionId`, `status`, `page`, `limit`

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

## Workflow (Ontology & Workflow Layer)

Phase 5 introduced a declarative workflow layer. A Solution uses this group of endpoints to push events, register the indicator catalog, fetch the dashboard, and signal session-end. Full wire shape + auth + error handling: [Ontology & Workflow — Cross-Process Events](../ontology/cross-process-events.md).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/workflow/sessions/:sessionId/events` | Cross-process event ingest (dedup via eventId) |
| `PUT` | `/api/v1/workflow/sessions/:sessionId/indicators` | Register session indicator catalog |
| `DELETE` | `/api/v1/workflow/sessions/:sessionId` | Session-end teardown (frees indicators + engine queue) |
| `GET` | `/api/v1/workflow/sessions/:sessionId/observation-dashboard` | Dashboard (legacy projector shape) |
| `GET` | `/api/v1/workflow/sessions/:sessionId/dashboard` | Dashboard (new ontology-native shape) |

All endpoints require `Authorization: Bearer <chat-scope key>` and resolve a solutionId via `@TenantId()` (400 if missing).

## Ontology Schema

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/ontology/schema` | JSON Schema projection of the entire ontology + ETag/304 |

See [Ontology & Workflow — Schema Primitives](../ontology/schema-primitives.md) §Serialization + projection.
