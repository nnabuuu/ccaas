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
- **AuthModule** — API key + 10 scopes (`chat`, `skills:*`, `mcp:*`, `admin`, `builder`, `analytics:read`). Decorators: `@Public()`, `@Auth('scope')`, `@TenantId()`. Includes Dev Login (`POST /auth/login`, non-production only) and User Management (`/users`, `/users/tenants`). See [docs/AUTHENTICATION_AND_AUTHORIZATION.md](./docs/AUTHENTICATION_AND_AUTHORIZATION.md).
- **SkillsModule** — CRUD, versioning, trigger-based routing. Register skills: `npm run skill:import -- <solution-name>`. See [docs/SKILL_REGISTRATION.md](./docs/SKILL_REGISTRATION.md).
- **McpModule** — Server pool lifecycle, health checks, REST-to-MCP adapter. See [docs/MCP_SETUP_AND_TESTING.md](./docs/MCP_SETUP_AND_TESTING.md).
- **SchedulerModule** — Cron/interval/once tasks, headless AgentEngine execution, retry logic, missed-run detection.
- **ProtocolModule** — Shared event types, error codes, metrics, Ajv validation, field transformation.
- **Error Handling** — 12 ErrorCode types, HTTP status mapping, retry hints, global filter. See [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md).

## Sandbox + Workspace (stage-1, 2026-05)

The sessions module contains the new runtime layer. See **[gitbook → Runtime 架构](../../docs/gitbook/zh/platform/runtime-architecture.md)** for the full mental model; quick map of source files:

| Concept | File | One-line role |
|---|---|---|
| Workspace abstraction | `src/sessions/workspace/types.ts` | `WorkspaceProvider` + `WorkspaceHandle` interfaces |
| Local provider | `src/sessions/workspace/local-provider.ts` | mkdir + symlink (today's default) |
| Agentfs provider | `src/sessions/workspace/agentfs-provider.ts` | full agentfs CLI lifecycle (init/mount/snapshot/rollback/diff/timeline); FUSE on Linux, NFS on macOS |
| Provider selector | `src/sessions/workspace/workspace-provider.factory.ts` | `WORKSPACE_PROVIDER=local\|agentfs` |
| Base materializer | (extracted) `@kedge-agentic/agent-runtime` package (workspace sub-module) | DB skills → disk projection for agentfs `--base` overlay |
| TypeORM adapter | `src/sessions/workspace/typeorm-skill-content-source.ts` | implements `ContentSource` over our Skill/SkillFile/McpServer entities |
| Per-session asset seed | `src/sessions/services/session-asset-materializer.service.ts` | copies `SOLUTION_DIRS[slug]/{entities,resources}/` into each session's workspace root |
| Bash sandbox | `src/sessions/sandbox/sandbox.service.ts` + `just-bash-mcp/server.mjs` | injects `__ccaas_bash` MCP server, denies native Bash, steers via system prompt |
| Runtime fs API | `src/sessions/session-fs.controller.ts` + `services/session-fs.service.ts` | REST: `/sessions/:id/fs/{diff,timeline,snapshot,rollback}` (agentfs only) |
| Runtime meta API | `src/sessions/session-metadata.controller.ts` + `services/session-metadata.service.ts` + `entities/session-metadata.entity.ts` | REST: `/sessions/:id/meta[/:key]` CRUD (provider-agnostic) |

Operator quickstart: **[gitbook → 本地自托管](../../docs/gitbook/zh/getting-started/local-self-host.md)**.

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
| `DEV_LOGIN_USERNAME` | admin | Dev login admin username |
| `DEV_LOGIN_PASSWORD` | dev123 | Dev login admin password |
| `ADMIN_EMAIL` | admin@localhost | Dev login admin email |
| `WORKSPACE_PROVIDER` | `local` | `local` \| `agentfs` (FS sandbox) |
| `WORKSPACE_BASH_SANDBOX` | auto-on under `agentfs` | `just-bash` \| `none` (bash sandbox) |
| `WORKSPACE_AGENTFS_BIN` | `agentfs` | path to agentfs binary |
| `WORKSPACE_AGENTFS_BASE_DIR` | `${WORKSPACE_DIR}/_agentfs_base` | shared overlay base for materialized skills |
| `WORKSPACE_AGENTFS_DELTA_STORE` | `${WORKSPACE_DIR}/_agentfs_deltas` | per-session SQLite delta dbs |
| `SOLUTION_DIRS` | empty | CSV `slug:abspath` to register solution dirs for per-session asset seed |
| `SOLUTIONS_DIR` | empty | Root dir whose subdirs each contain a `solution.json`. `SolutionLoaderService.onModuleInit` auto-imports each at boot (tenant + skills + MCP + `tenant.config.artifactUrl`). Unset → no auto-import; use `POST /admin/solutions/import` instead. |

## Database Schema

TypeORM + SQLite (upgradeable to PostgreSQL): `tenants`, `users`, `user_tenants`, `api_keys` (SHA-256 hashed), `skills`, `skill_versions`, `mcp_servers`, `messages`, `agent_files`, `scheduled_tasks`, `scheduled_task_executions`.

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
7. **control_request Protocol** — AskUserQuestion pauses CLI, frontend renders Wizard, structured answers resume CLI

## control_request / control_response Protocol

When the CLI flag `--permission-prompt-tool stdio` is set, `AskUserQuestion` tool calls emit a `control_request` on stdout instead of failing. The backend intercepts this, sends a `tool_activity(start)` SSE event to the frontend, and waits for user input via `POST /sessions/:id/control-response`.

```
LLM calls AskUserQuestion → CLI emits control_request (stdout)
  → EventMapper stores pending request + emits tool_activity SSE
  → Frontend renders Wizard UI
  → User submits answers → POST /control-response
  → Backend writes control_response to CLI stdin
  → CLI resumes, LLM receives structured JSON answers
```

Key files:
- `cli-process.service.ts` — `--permission-prompt-tool stdio` flag, `sendControlResponse()` method
- `event-mapper.service.ts` — `case 'control_request'` handler, `pendingControlRequests` Map
- `sessions.controller.ts` — `POST /sessions/:id/control-response` endpoint

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
