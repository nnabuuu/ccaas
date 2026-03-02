# CLAUDE.md - Claude Code as a Service

This file provides context for AI assistants working with this codebase.

## Project Overview

**Claude Code as a Service** is a production-ready relay server built with NestJS that spawns AgentEngine instances (Claude Code, OpenCode, custom engines) as subprocesses and streams events to frontend clients via SSE (Server-Sent Events). It provides multi-tenant API key authentication, skill management, MCP server integration, and message persistence.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend  │◄───►│  NestJS Server   │◄───►│  AgentEngine        │
│   (SSE)     │     │  (Sessions API)  │     │ (claude/opencode)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │MCP Pool  │  │ Skill Router │
              └──────────┘  └──────────────┘
```

**Supported AgentEngine Types:**
- **Claude Code** - Default, `npx claude-code`
- **OpenCode** - Open-source, configurable via `AGENT_ENGINE_PATH`
- **Custom Engines** - Your own implementation

## Directory Structure

```
claude-code-as-a-service/
├── src/                          # NestJS implementation
│   ├── main.ts                   # Bootstrap
│   ├── app.module.ts             # Root module
│   │
│   ├── protocol/                 # Event types, errors, validation
│   │   ├── events.ts             # Frontend event types
│   │   ├── errors.ts             # Error codes & recovery
│   │   ├── metrics.ts            # Token/latency tracking
│   │   ├── output-schema.ts      # JSON Schema registry
│   │   ├── output-transformer.service.ts
│   │   ├── validation.service.ts # Ajv validation
│   │   └── protocol.module.ts
│   │
│   ├── auth/                     # Authentication & authorization
│   │   ├── api-key.service.ts    # API key management
│   │   ├── types.ts              # Auth types & errors
│   │   ├── guards/               # API key & scopes guards
│   │   ├── decorators/           # @Auth, @Public, @TenantId
│   │   └── entities/             # ApiKey entity
│   │
│   ├── mcp/                      # MCP server management
│   │   ├── mcp-pool.service.ts   # Server lifecycle & health
│   │   ├── rest-adapter.service.ts # REST→MCP adapter
│   │   ├── types.ts              # MCP types
│   │   └── entities/             # McpServer entity
│   │
│   ├── chat/                     # Core relay module
│   │   ├── chat.gateway.ts       # Socket.io WebSocket gateway
│   │   ├── chat.controller.ts    # REST endpoints
│   │   ├── session.service.ts    # CLI process management
│   │   └── event-mapper.service.ts
│   │
│   ├── skills/                   # Skill management
│   │   ├── skills.service.ts     # CRUD operations
│   │   ├── skill-sync.service.ts # File sync
│   │   ├── skill-router.service.ts # Routing logic
│   │   └── entities/             # Skill, SkillVersion entities
│   │
│   ├── tenants/                  # Multi-tenancy
│   ├── messages/                 # Message persistence
│   ├── files/                    # File management
│   ├── scheduler/                # Scheduled task execution
│   │   ├── scheduler.service.ts  # CRUD + cron registration + execution orchestration
│   │   ├── scheduler.controller.ts # REST API endpoints
│   │   ├── headless-execution.service.ts # Headless CLI execution (no WebSocket)
│   │   ├── entities/             # ScheduledTask, ScheduledTaskExecution
│   │   └── dto/                  # Create/Update DTOs
│   │
│   ├── hooks/                    # Tool hooks
│   └── common/                   # Shared utilities
│
├── .agent-workspace/             # Runtime data (gitignored)
│   ├── sessions/                 # Per-session directories
│   ├── files/                    # Persistent file storage
│   └── data.db                   # SQLite database
│
├── package.json
├── tsconfig.json
├── nest-cli.json
├── MIGRATION.md                  # Migration documentation
└── CLAUDE.md                     # This file
```

## Key Modules

### Error Handling (protocol/, common/filters/)

Standardized HTTP error handling system with protocol-aware exceptions.

**Error Code System:**
- 12 standard ErrorCode types (shared with WebSocket)
- HTTP status mapping (400, 401, 403, 404, 429, 500, 502, 503, 504)
- Retry hints and recovery flags

**Exception Classes (protocol/http-exceptions.ts):**
- `ValidationException` - 400 Bad Request
- `SessionExpiredException` - 401 Unauthorized
- `PermissionDeniedException` - 403 Forbidden
- `SkillNotFoundException` - 404 Not Found
- `RateLimitedException` - 429 Too Many Requests
- `InternalException` - 500 Internal Server Error
- `CliException` - 500 CLI process error
- `McpException` - 502 Bad Gateway
- `ConnectionLostException` - 503 Service Unavailable
- `TimeoutException` - 504 Gateway Timeout

**Global Filter (common/filters/http-exception.filter.ts):**
- Catches all HTTP exceptions
- Transforms to standardized JSON response
- Includes retry hints, failed fields, partial output
- Request ID tracking
- Automatic logging with context

**Response Format:**
```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: skill-123",
  "statusCode": 404,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2026-02-09T10:30:00.000Z",
  "path": "/api/v1/skills/skill-123",
  "requestId": "req_123"
}
```

**Usage:**
```typescript
// In controllers/services
throw new SkillNotFoundException(skillId);
throw new ValidationException('Invalid input', ['email', 'name']);
throw new RateLimitedException(60000); // Retry after 60s
```

See [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md) for complete documentation.

### ChatModule (chat/)

Core relay functionality. Manages SSE connections and AgentEngine process lifecycle.

**AgentEngine Lifecycle:**
- `SessionService` spawns and manages AgentEngine instances
- Supports resume via `--resume <session-id>`
- Handles process cleanup, cancellation (SIGTERM/SIGKILL), and timeout
- See [docs/advanced/AGENT_ENGINE_LIFECYCLE.md](../../docs/advanced/AGENT_ENGINE_LIFECYCLE.md) for details

**SSE Endpoints (SessionsController):**
- `POST /api/v1/sessions/:id/messages` - Send message, receive SSE event stream
- `GET /api/v1/sessions/:id/events` - Subscribe to push channel (cross-turn)
- `POST /api/v1/sessions/:id/cancel` - Cancel current operation

**REST Endpoints (ChatController):**
- `GET /api/v1/health` - Health check
- `GET /api/v1/chat/status` - Session stats

> **Deprecated:** Socket.IO WebSocket gateway (`ChatGateway`) is deprecated and will be removed in a future release. New Solutions must use SSE.

**Background Task Monitoring (SessionService):**
- Automatically detects Task tool calls with `run_in_background: true`
- Polls output file every 3 seconds to detect completion
- Sends `subagent_completed` event when task finishes (via SSE push channel)
- 30-minute timeout protection with automatic cleanup
- Session cleanup automatically stops all monitors

### AuthModule (auth/)

API key authentication with scope-based authorization.

**9 Scopes:**
- `skills:read`, `skills:write`, `skills:execute`, `skills:delete`
- `mcp:read`, `mcp:write`
- `chat`
- `analytics:read`
- `admin`

**Decorators:**
```typescript
@Public()              // Skip authentication
@OptionalAuth()        // Auth optional
@Auth('skills:write')  // Require specific scope
@RequireScopes('a', 'b') // Multiple scopes
@TenantId()            // Get tenant ID
@Ctx()                 // Get full request context
```

### McpModule (mcp/)

MCP server pool management with REST API adapter.

**McpPoolService:**
- Server lifecycle management
- Health checks (configurable interval)
- Tool execution across servers

**RestAdapterService:**
- Convert REST APIs to MCP tools
- OAuth2, API key, bearer, basic auth support
- Rate limiting and retry logic

### SkillsModule (skills/)

Skill CRUD, versioning, and routing.

**SkillRouterService:**
- Trigger-based routing (keyword, pattern, intent, context)
- System prompt generation
- CLI args generation
- Caching for performance

**Skill Types:**
- `prompt` - Simple prompt skills
- `workflow` - Multi-step workflows
- `sub-agent` - Specialized sub-agents
- `tool-config` - Tool configuration

**Skill Registration:**

Solutions define skills in `solution.json`, but these must be registered to the backend database:

```bash
cd packages/backend
npm run skill:import -- <solution-name>

# Example:
npm run skill:import -- quiz-analyzer
npm run skill:import -- lesson-plan-designer
```

**Why Registration is Required:**
- Skills in `solution.json` are configuration files, not runtime registrations
- CCAAS backend needs skills in database to auto-load them for sessions
- Without registration, AI uses global/default skills instead of solution-specific tools

See [docs/SKILL_REGISTRATION.md](./docs/SKILL_REGISTRATION.md) for complete guide.

### SchedulerModule (scheduler/)

Scheduled background task execution with cron, interval, and one-time scheduling. Runs AgentEngine in headless mode without WebSocket dependency.

**Schedule Types:**
- `cron` - Cron expressions (e.g., `0 4 * * *`)
- `interval` - Millisecond intervals (e.g., `60000`)
- `once` - One-time ISO date execution

**Key Services:**
- `SchedulerService` - CRUD, cron registration via `SchedulerRegistry`, execution orchestration, retry logic, missed run detection on startup
- `HeadlessExecutionService` - Spawns AgentEngine with `--output-format stream-json --permission-mode bypassPermissions`, parses output via `EventMapperService`, manages workspace lifecycle

**REST Endpoints (SchedulerController):**
- `POST /api/v1/scheduled-tasks` - Create task
- `GET /api/v1/scheduled-tasks` - List tasks (with pagination/filters)
- `GET /api/v1/scheduled-tasks/:id` - Task detail
- `PUT /api/v1/scheduled-tasks/:id` - Update task
- `DELETE /api/v1/scheduled-tasks/:id` - Soft delete
- `POST /api/v1/scheduled-tasks/:id/pause` - Pause scheduling
- `POST /api/v1/scheduled-tasks/:id/resume` - Resume scheduling
- `POST /api/v1/scheduled-tasks/:id/trigger` - Manual trigger
- `GET /api/v1/scheduled-tasks/:id/executions` - Execution history
- `GET /api/v1/scheduled-tasks/:id/executions/:execId` - Execution detail

### ProtocolModule (protocol/)

Frontend-backend protocol definitions.

**Components:**
- **Events** - Strongly-typed frontend events
- **Errors** - Error codes with retry policies
- **Metrics** - Token accumulator, latency tracking
- **Validation** - Ajv-based schema validation
- **Transformation** - Field mapping for outputs

## Documentation

### Authentication and Authorization

Complete guide for Solution developers on API Key management, permissions, and integration.

📚 **[Authentication & Authorization Guide](./docs/AUTHENTICATION_AND_AUTHORIZATION.md)**

**Topics Covered:**
- **API Key System**: Tenant-Level vs User-Level Keys
- **Scopes**: 9 permission scopes (chat, skills:*, mcp:*, admin, analytics:read)
- **Guard Chain**: ApiKeyGuard → TenantGuard → SkillPermissionGuard
- **Bootstrap Workflow**: Solving the Chicken-and-Egg problem
- **Solution Integration**: Step-by-step guide for new solutions
- **Permission Patterns**: Public, Personal, and Hybrid models
- **Best Practices**: Security, key rotation, error handling

**Quick Start:**
```bash
# 1. Create Bootstrap API Key
cd solutions/your-solution
./create-bootstrap-key.sh

# 2. Register Skills and MCP Servers
export CCAAS_API_KEY=sk-bootstrap_xxx
./inject-skills.sh

# 3. Frontend Integration (React/Vue)
useAgentChat({ serverUrl, tenantId })  // That's it!
```

### Error Handling

Standardized HTTP error handling with protocol-aware exceptions.

📚 **[Error Handling Documentation](./docs/ERROR_HANDLING.md)**

**Features:**
- 12 standard ErrorCode types
- HTTP status mapping (400, 401, 403, 404, 429, 500, 502, 503, 504)
- Retry hints and recovery flags
- Global exception filter
- Request ID tracking

## Important Notes

### Nested Session Prevention

CCAAS spawns Claude Code CLI as subprocesses to handle AgentEngine requests. To prevent nested session errors, **the backend automatically removes the `CLAUDECODE` environment variable on startup** (see `src/main.ts`):

```typescript
// src/main.ts - bootstrap()
if (process.env.CLAUDECODE) {
  delete process.env.CLAUDECODE;
  console.log('[Bootstrap] Removed CLAUDECODE environment variable to prevent nested session errors');
}
```

**Why?** Claude Code CLI detects nested sessions (when launched inside another Claude Code session) and exits with:
```
Error: Claude Code cannot be launched inside another Claude Code session.
Nested sessions share runtime resources and will crash all active sessions.
```

By removing `CLAUDECODE` at the application level, the backend can spawn AgentEngine instances even when you're developing inside a Claude Code session. This approach is:
- ✅ **Reliable** - Works at code level, not dependent on shell
- ✅ **Cross-platform** - Works on Windows, macOS, Linux
- ✅ **Automatic** - No manual intervention needed

## Development Commands

```bash
# Development
npm run start:dev      # Start with hot reload (auto unsets CLAUDECODE)

# Production
npm run build          # Compile TypeScript
npm run start:prod     # Run compiled version (auto unsets CLAUDECODE)

# Type check
npm run typecheck      # Type check without emitting

# Skill Registration
npm run skill:import -- <solution-name>  # Register solution skills to database
# Example: npm run skill:import -- quiz-analyzer
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3001 | Server port |
| `NODE_ENV` | development | Environment |
| `DATABASE_PATH` | .agent-workspace/data.db | SQLite database |
| `WORKSPACE_DIR` | .agent-workspace | Session storage |
| `AUTH_ALLOW_ANONYMOUS` | true | Allow unauthenticated requests |
| `AUTH_ENABLE_RATE_LIMITING` | true | Enable rate limiting |
| `MCP_HEALTH_CHECK_INTERVAL_MS` | 60000 | Health check interval |
| `DEBUG` | false | Debug logging |

## Database Schema

Using TypeORM with SQLite (configurable to PostgreSQL):

- **tenants** - Multi-tenant configuration
- **api_keys** - API key storage (SHA-256 hashed)
- **skills** - Skill definitions
- **skill_versions** - Skill version history
- **mcp_servers** - MCP server configuration
- **messages** - Chat message persistence
- **agent_files** - Written files tracking
- **scheduled_tasks** - Scheduled task definitions (cron/interval/once)
- **scheduled_task_executions** - Task execution history and results

## API Documentation

### Swagger/OpenAPI (中英文双语)

CCAAS 提供完整的 Swagger/OpenAPI 文档，支持中英文双语：

**访问地址：**
- **中文版（默认）**: http://localhost:3001/api/docs
- **英文版**: http://localhost:3001/api/docs/en
- **OpenAPI JSON**: http://localhost:3001/api/docs-json
- **OpenAPI YAML**: http://localhost:3001/api/docs-yaml

**功能特性：**
- ✅ 交互式 API 调试
- ✅ 完整的类型定义和示例
- ✅ API Key 认证支持
- ✅ 按模块分组（sessions, messages, files, skills, etc.）
- ✅ 可导出 OpenAPI 规范生成客户端 SDK

详细使用说明请参考：[docs/SWAGGER.md](./docs/SWAGGER.md)

## API Endpoints

### Authentication
```
GET    /api/v1/tenants/:tenantId/api-keys
POST   /api/v1/tenants/:tenantId/api-keys
PUT    /api/v1/api-keys/:id
DELETE /api/v1/api-keys/:id
```

### Skills
```
GET    /api/v1/skills
POST   /api/v1/skills
GET    /api/v1/skills/:id
PUT    /api/v1/skills/:id
DELETE /api/v1/skills/:id
POST   /api/v1/skills/:id/publish
POST   /api/v1/skills/:id/unpublish
```

### MCP Servers
```
GET    /api/v1/mcp-servers
POST   /api/v1/mcp-servers
GET    /api/v1/mcp-servers/:id
PUT    /api/v1/mcp-servers/:id
DELETE /api/v1/mcp-servers/:id
POST   /api/v1/mcp-servers/:id/health
```

### Messages & Files
```
GET    /api/v1/sessions/:id/messages
GET    /api/v1/messages/:id
GET    /api/v1/messages/:id/files
GET    /api/v1/files/:id/download
```

### Admin - API Keys
```
GET    /api/v1/admin/api-keys                    # List keys (requires tenantId query param)
POST   /api/v1/admin/api-keys                    # Create key (returns raw key once)
GET    /api/v1/admin/api-keys/:id                # Get single key
PUT    /api/v1/admin/api-keys/:id                # Update key
POST   /api/v1/admin/api-keys/:id/revoke         # Revoke key
DELETE /api/v1/admin/api-keys/:id                # Delete key
```

**List API Keys:**
- Query params: `tenantId` (required), `page` (default: 1), `limit` (default: 50, max: 100)
- Returns: `{ items: ApiKeyResponse[], total, page, limit }`
- Validates: Tenant exists

**Create API Key:**
- Body: `{ tenantId, name, scopes?, rateLimitRpm?, rateLimitRpd?, expiresAt? }`
- Returns: `{ apiKey, rawKey, warning }` (⚠️ rawKey shown only once)
- Creates audit log entry

**Update API Key:**
- Body: `{ name?, scopes?, rateLimitRpm?, rateLimitRpd?, status?, expiresAt? }`
- Logs before/after values in audit

**Revoke API Key:**
- Sets status to 'revoked'
- Validates key is not already revoked

**Delete API Key:**
- Permanently deletes key
- Creates audit log BEFORE deletion

### Scheduled Tasks
```
POST   /api/v1/scheduled-tasks
GET    /api/v1/scheduled-tasks
GET    /api/v1/scheduled-tasks/:id
PUT    /api/v1/scheduled-tasks/:id
DELETE /api/v1/scheduled-tasks/:id
POST   /api/v1/scheduled-tasks/:id/pause
POST   /api/v1/scheduled-tasks/:id/resume
POST   /api/v1/scheduled-tasks/:id/trigger
GET    /api/v1/scheduled-tasks/:id/executions
GET    /api/v1/scheduled-tasks/:id/executions/:execId
```

## Adding Custom Features

### Adding a New Module

```typescript
// 1. Create module file
@Module({
  imports: [TypeOrmModule.forFeature([MyEntity])],
  controllers: [MyController],
  providers: [MyService],
  exports: [MyService],
})
export class MyModule {}

// 2. Add to app.module.ts imports
```

### Adding a Tool Hook

```typescript
// hooks/my-tool.hook.ts
export interface ToolHook {
  preInvoke?(toolName: string, input: unknown): Promise<unknown>;
  postInvoke?(toolName: string, result: unknown): Promise<void>;
}
```

### Adding a Custom Event

```typescript
// protocol/events.ts
export interface MyCustomEvent extends FrontendEvent {
  type: 'my_custom_event';
  payload: { /* ... */ };
}

// Add to FrontendEventType union
export type FrontendEventType =
  | 'text_delta'
  | 'tool_activity'
  | 'my_custom_event'
  // ...
```

## Session Lifecycle

```
1. Client sends POST /sessions/:id/messages with SSE Accept header
2. Auth guard validates API key (if provided)
3. SkillRouter matches triggers (optional)
4. CLI spawned with --output-format stream-json (or resumed with --resume)
5. CLI stdout → EventMapperService → SSE event stream
6. Messages persisted to database
7. CLI exits → agent_status: complete → SSE connection closes
8. Follow-up message → new POST /messages, CLI resumed
9. Idle timeout → session cleanup
```

## Background Task Lifecycle

```
1. Task tool called with run_in_background: true
2. EventMapperService detects isPersistent flag
3. Tool result contains output_file path
4. EventMapperService triggers callback → SessionService
5. SessionService starts monitor (3s polling interval)
6. Monitor reads last 20 lines of output_file
7. Detects completion markers:
   - "Agent completed successfully"
   - '"type":"result"'
   - "agentId:"
8. SessionService calls EventMapperService.markBackgroundTaskComplete()
9. Socket.io emits subagent_completed event
10. Frontend removes SubAgentCard
11. Timeout: 30 minutes → auto-fail
12. Session cleanup → all monitors stopped
```

## Headless Execution Lifecycle (Scheduled Tasks)

```
1. Cron/interval/timeout fires → SchedulerService.triggerExecution()
2. Concurrency check (count running < maxConcurrent)
3. Create ScheduledTaskExecution record (status=running)
4. Update task.lastRunAt / nextRunAt
5. HeadlessExecutionService creates workspace
6. Write .claude/settings.local.json (permissions whitelist)
7. SkillSyncService syncs enabled skills
8. CLI spawned with --output-format stream-json --permission-mode bypassPermissions
9. stdin receives user message, stdout parsed via EventMapperService
10. Events emitted to SSE push channel or Socket.io room scheduler:{tenantId}
11. On completion: persist messages, update execution status
12. Cleanup workspace directory
```

## Testing

```bash
# Start server
npm run start:dev

# Health check
curl http://localhost:3001/api/v1/health

# Use test frontend
open test-frontend.html
```

## Key Design Decisions

1. **NestJS Architecture** - Modular, testable, enterprise-ready
2. **Delegate to CLI** - Claude Code CLI handles tools, streaming, context
3. **TypeORM + SQLite** - Simple persistence, upgradeable to PostgreSQL
4. **API Key Auth** - SHA-256 hashed, scope-based permissions
5. **MCP Pool** - Centralized MCP server management
6. **Skill Router** - Trigger-based skill matching and routing

## Migration History

The project was migrated from a legacy plain TypeScript/Socket.io implementation to NestJS architecture. See `MIGRATION.md` for documentation of the migration process.

## Response Language

Respond in the same language as the user's message.
