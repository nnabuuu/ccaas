# CLAUDE.md — @kedge-agentic/backend

NestJS relay server: spawns AgentEngine (Claude Code / OpenCode / custom) as subprocesses, streams events via SSE, manages sessions, skills, MCP servers, and scheduled tasks.

## Solution-free boundary (phase 5.5)

`@kedge-agentic/backend` is **solution-free infrastructure**. Its source + dist contain zero references to live-lesson or any other specific solution. `AppModule` is a `DynamicModule.register({ extraModules })` factory; solution-specific handler bundles are loaded into the NestJS module tree at boot from packages named in the `PLATFORM_HANDLER_PACKAGES` env var (CSV).

```bash
# Boot with live-lesson handlers
PLATFORM_HANDLER_PACKAGES=@kedge-agentic/live-lesson-platform-handlers \
  node packages/backend/dist/src/main.js

# Boot truly generic (no handlers; triggers won't fire)
node packages/backend/dist/src/main.js
```

Each handler package is a workspace under `solutions/<biz-or-mock>/<slug>/platform-handlers/`. The first such package is [`@kedge-agentic/live-lesson-platform-handlers`](../../solutions/business/live-lesson/platform-handlers/CLAUDE.md) which holds the `LessonSession` ontology registrar + 5 workflow handlers (lifecycle / exercise / progress / chat-turn / status-change) + dashboard endpoints. To add a second solution, mirror that layout and add the new package name to the env var — no changes to ccaas backend required.

Cross-package mechanics: backend's `package.json` declares an NPM `exports` map with wildcard `./*` so consumers can `import "@kedge-agentic/backend/<subpath>"`. Handler-package typecheck resolves through backend's built `dist/src/*.d.ts` (build backend first); runtime resolves through Node's native exports-map support (Node 18+). See the handler package's CLAUDE.md for the full setup.

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
├── tool-caller/       # ToolCallerProxy + adapter + registry + StdioMcpToolkit
├── scheduler/         # Cron/interval/once task execution
├── solutions/         # Solution CRUD
├── messages/          # Message persistence
├── files/             # File management
├── hooks/             # Tool hooks
└── common/            # Shared utilities, filters
```

## Key Modules

- **ChatModule** — SSE endpoints for session messages, events, cancellation. Socket.IO gateway is deprecated. See [gitbook SSE docs](../../docs/designs/).
- **AuthModule** — API key + 10 scopes (`chat`, `skills:*`, `mcp:*`, `admin`, `builder`, `analytics:read`). Decorators: `@Public()`, `@Auth('scope')`, `@SolutionId()`. Includes Dev Login (`POST /auth/login`, non-production only) and User Management (`/users`, `/users/solutions`). See [docs/AUTHENTICATION_AND_AUTHORIZATION.md](./docs/AUTHENTICATION_AND_AUTHORIZATION.md).
- **SkillsModule** — CRUD, versioning, trigger-based routing. Register skills: `npm run skill:import -- <solution-name>`. See [docs/SKILL_REGISTRATION.md](./docs/SKILL_REGISTRATION.md).
- **McpModule** — Server pool lifecycle, health checks, REST-to-MCP adapter. See [docs/MCP_SETUP_AND_TESTING.md](./docs/MCP_SETUP_AND_TESTING.md).
- **ToolCallerModule** — Platform-owned tool-call boundary. `ToolCallerProxyService` runs the 6-step pipeline (sanitize / validate / context-inject / dispatch / audit), `SolutionToolkitRegistry` holds per-solution toolkits, `McpEngineAdapterService` manages per-session secret tokens, `InternalToolCallerController` is the loopback HTTP API the proxy bundle calls back into, `StdioMcpToolkit` wraps legacy solution stdio MCP servers. Identity is **ambient** (bound at session creation via `X-Ccaas-On-Behalf-Of` header, never agent-writable). See [docs/design-tool-caller-proxy.md](../../docs/design-tool-caller-proxy.md) + [gitbook → Runtime 架构 §7](../../docs/gitbook/zh/platform/runtime-architecture.md).
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
| Binary artifact mount (Phase 2b-4) | `<workspace>/artifacts-binary/` (sibling of `<workspace>/artifacts/` for text) | bytes from solutions that implement `BinaryArtifactSource`; deliberately **not visible to agent `Read` / `cat`** so a JPEG can't be streamed into context |
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
| `SOLUTIONS_DIR` | empty | Root dir whose subdirs each contain a `solution.json`. `SolutionLoaderService.onModuleInit` auto-imports each at boot (solution + skills + MCP + `solution.config.artifactUrl`). Unset → no auto-import; use `POST /admin/solutions/import` instead. |

## Database Schema

TypeORM + SQLite (upgradeable to PostgreSQL): `solutions`, `users`, `user_solutions`, `api_keys` (SHA-256 hashed), `skills`, `skill_versions`, `mcp_servers`, `messages`, `agent_files`, `scheduled_tasks`, `scheduled_task_executions`. The env var name `CCAAS_API_KEY` and `solution.json` schema field `tenant: { name, slug }` are kept as-is intentionally (operator-facing constants + wire format that solutions ship).

## Development Commands

```bash
npm run start:dev              # Dev server with hot reload
npm run build                  # Compile TypeScript
npm run start:prod             # Run compiled version
npm run typecheck              # Type check only
npm run skill:import -- <name> # Register solution skills
```

### End-to-end agent-runtime smoke

`solutions/business/live-lesson-creator/scripts/poc-smoke.sh` is the canonical end-to-end test for the agent-runtime sync layer (`attach-workspace-source` → bootstrap → SSE change events). Needs both backends running:

```bash
# terminal 1: ccaas (load all solutions from SOLUTIONS_DIR)
SOLUTIONS_DIR=$(pwd)/solutions/business AUTH_ALLOW_ANONYMOUS=true \
  WORKSPACE_PROVIDER=local node packages/backend/dist/src/main.js

# terminal 2: live-lesson backend on :3007
cd solutions/business/live-lesson/backend && node dist/main.js

# terminal 3: the smoke
bash solutions/business/live-lesson-creator/scripts/poc-smoke.sh
# expects exit 0 + "✓ end-to-end PoC passed: N change events delivered" (N ≥ 2)
```

The script auto-mints a solution-scoped API key (`scripts/create-dev-api-key.ts <slug> --raw-only`) for the Phase 2b-2 `?token=…` SSE auth. Set `CCAAS_API_KEY=<key>` to use a pre-existing key instead.

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
