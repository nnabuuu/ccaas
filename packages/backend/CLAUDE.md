# CLAUDE.md - Claude Code as a Service

This file provides context for AI assistants working with this codebase.

## Project Overview

**Claude Code as a Service** is a production-ready relay server built with NestJS that spawns AgentEngine instances (Claude Code, OpenCode, custom engines) as subprocesses and streams events to frontend clients via Socket.io. It provides multi-tenant API key authentication, skill management, MCP server integration, and message persistence.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend  │◄───►│  NestJS Server   │◄───►│  AgentEngine        │
│ (Socket.io) │     │  (ChatGateway)   │     │ (claude/opencode)   │
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

### ChatModule (chat/)

Core relay functionality. Manages WebSocket connections and AgentEngine process lifecycle.

**AgentEngine Lifecycle:**
- `SessionService` spawns and manages AgentEngine instances
- Supports resume via `--resume <session-id>`
- Handles process cleanup, cancellation (SIGTERM/SIGKILL), and timeout
- See [docs/advanced/AGENT_ENGINE_LIFECYCLE.md](../../docs/advanced/AGENT_ENGINE_LIFECYCLE.md) for details

**WebSocket Events (ChatGateway):**
- `chat` - Send message to Claude
- `cancel` - Cancel current operation
- `reconnect_session` - Reconnect to existing session
- `get_stats` - Get server statistics

**REST Endpoints (ChatController):**
- `GET /api/v1/chat/health` - Health check
- `GET /api/v1/chat/status` - Session stats

**Background Task Monitoring (SessionService):**
- Automatically detects Task tool calls with `run_in_background: true`
- Polls output file every 3 seconds to detect completion
- Sends `subagent_completed` WebSocket event when task finishes
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

## Development Commands

```bash
# Development
npm run start:dev      # Start with hot reload

# Production
npm run build          # Compile TypeScript
npm run start:prod     # Run compiled version

# Type check
npm run typecheck      # Type check without emitting
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
1. Client connects → WebSocket handshake
2. Auth guard validates API key (if provided)
3. Client sends chat message → session created
4. SkillRouter matches triggers (optional)
5. CLI spawned with --output-format stream-json
6. CLI stdout → EventMapperService → Socket.io emit
7. Messages persisted to database
8. CLI exits → agent_status: complete
9. Follow-up message → CLI spawned with --resume
10. Idle timeout → session cleanup
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
10. Events emitted to Socket.io room scheduler:{tenantId}
11. On completion: persist messages, update execution status
12. Cleanup workspace directory
```

## Testing

```bash
# Start server
npm run start:dev

# Health check
curl http://localhost:3001/api/v1/chat/health

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
