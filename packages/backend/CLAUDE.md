# CLAUDE.md — @kedge-agentic/backend

NestJS relay server: spawns AgentEngine (Claude Code / OpenCode / custom) as subprocesses, streams events via SSE, manages sessions, skills, MCP servers, and scheduled tasks.

## Architecture

```
Frontend (SSE) ◄──► NestJS Server ◄──► AgentEngine (claude/opencode)
                        │
                  ┌─────┴─────┐
                  MCP Pool   Skill Router
```

## Directory Structure

```
src/
├── main.ts
├── app.module.ts
├── protocol/          # Events, errors, metrics, validation
├── auth/              # API key auth, guards, decorators
├── chat/              # SSE relay, session management
├── skills/            # Skill CRUD, versioning, routing
├── mcp/               # MCP server pool, REST adapter
├── scheduler/         # Cron/interval/once task execution
├── tenants/           # Multi-tenancy
├── messages/          # Message persistence
├── files/             # File management
├── hooks/             # Tool hooks
└── common/            # Shared utilities, filters
```

## Key Modules

- **ChatModule** — SSE endpoints for session messages, events, cancellation. Socket.IO gateway is deprecated. See [gitbook SSE docs](../../docs/designs/).
- **AuthModule** — API key + 9 scopes (`chat`, `skills:*`, `mcp:*`, `admin`, `analytics:read`). Decorators: `@Public()`, `@Auth('scope')`, `@TenantId()`. See [docs/AUTHENTICATION_AND_AUTHORIZATION.md](./docs/AUTHENTICATION_AND_AUTHORIZATION.md).
- **SkillsModule** — CRUD, versioning, trigger-based routing. Register skills: `npm run skill:import -- <solution-name>`. See [docs/SKILL_REGISTRATION.md](./docs/SKILL_REGISTRATION.md).
- **McpModule** — Server pool lifecycle, health checks, REST-to-MCP adapter. See [docs/MCP_SETUP_AND_TESTING.md](./docs/MCP_SETUP_AND_TESTING.md).
- **SchedulerModule** — Cron/interval/once tasks, headless AgentEngine execution, retry logic, missed-run detection.
- **ProtocolModule** — Shared event types, error codes, metrics, Ajv validation, field transformation.
- **Error Handling** — 12 ErrorCode types, HTTP status mapping, retry hints, global filter. See [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md).

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

TypeORM + SQLite (upgradeable to PostgreSQL): `tenants`, `api_keys` (SHA-256 hashed), `skills`, `skill_versions`, `mcp_servers`, `messages`, `agent_files`, `scheduled_tasks`, `scheduled_task_executions`.

## Development Commands

```bash
npm run start:dev              # Dev server with hot reload
npm run build                  # Compile TypeScript
npm run start:prod             # Run compiled version
npm run typecheck              # Type check only
npm run skill:import -- <name> # Register solution skills
```

## Important Notes

- **Nested Session Prevention**: Backend auto-removes `CLAUDECODE` env var on startup (`src/main.ts`) so AgentEngine can spawn when developing inside Claude Code.
- **Swagger**: Available at `/api/docs` (中文) and `/api/docs/en` (English). See [docs/SWAGGER.md](./docs/SWAGGER.md).

## Key Design Decisions

1. **NestJS Architecture** — Modular, testable, enterprise-ready
2. **Delegate to CLI** — AgentEngine handles tools, streaming, context
3. **TypeORM + SQLite** — Simple persistence, upgradeable to PostgreSQL
4. **API Key Auth** — SHA-256 hashed, scope-based permissions
5. **MCP Pool** — Centralized MCP server management
6. **Skill Router** — Trigger-based skill matching and routing

## Detailed Documentation

- [Authentication & Authorization](./docs/AUTHENTICATION_AND_AUTHORIZATION.md)
- [Error Handling](./docs/ERROR_HANDLING.md)
- [Swagger / OpenAPI](./docs/SWAGGER.md)
- [Skill Registration](./docs/SKILL_REGISTRATION.md)
- [MCP Setup & Testing](./docs/MCP_SETUP_AND_TESTING.md)
- [File Management API](./docs/FILE_MANAGEMENT_API.md)
- API Endpoints: see Swagger at `/api/docs` or gitbook REST reference

## Quick Reference

- New controllers **MUST** have `@ApiTags` decorator
- API changes → update gitbook docs in sync
- Commit: `<type>(backend): <lowercase subject>`
- Run `npm run typecheck` before pushing

## Response Language

Respond in the same language as the user's message.
