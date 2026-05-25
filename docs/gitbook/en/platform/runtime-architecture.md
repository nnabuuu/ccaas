# Runtime Architecture

> Read this in 10 minutes to understand how the new sandbox layer is organized. By the end you should be able to: spot each layer in the logs, know where the extension points are, and pick the right file to change for a new use case.

## One-liner

ccaas backend receives session requests → uses the `WorkspaceProvider` abstraction to set up a per-session working directory (real dir for `local`, virtual FUSE/NFS mount for `agentfs`) → injects a sandbox MCP so claude's bash runs inside an isolated interpreter → spawns the `claude` CLI as the agent → exposes a runtime REST API so operators can see/modify what the agent did in the sandbox.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser / curl / admin-next                                            │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ HTTPS
            ┌──────────┴──────────────────────────────────────┐
            │ Solution Backend (optional, e.g. demo-sandbox :3010) │
            │  · POSTs solution.json on bootstrap                  │
            │  · proxies SSE / exposes domain REST                 │
            └──────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────────────────┐
│  ccaas Backend (:3001) — NestJS, TypeORM                                │
│                                                                         │
│  Session lifecycle           Skill registry         Runtime REST API    │
│  ────────────────            ──────────────         ─────────────────   │
│  SessionService              SkillsService          SessionFsService    │
│   ↓ create                    ↓                      · fs/diff          │
│  WorkspaceProvider           BaseMaterializer        · fs/timeline      │
│   ├─ Local: mkdir                ↓ skills → disk     · fs/snapshot      │
│   └─ Agentfs:                AgentfsProvider          · fs/rollback     │
│       agentfs init           SessionAssetMaterializer SessionMetadataS  │
│        + mount (FUSE/NFS)     · entities/ + resources/  · meta KV CRUD  │
│                                                                         │
│  SandboxService              CliProcessService                          │
│   · injects __ccaas_bash      ↓ spawn                                   │
│     MCP server                                                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                       ┌──────────┴──────────────────┐
                       │ claude CLI child process     │
                       │  · cwd = workspace mount     │
                       │  · MCP: solution + sandbox    │
                       │  · native Bash disabled,      │
                       │    forced to use              │
                       │    mcp____ccaas_bash__bash    │
                       └──────────────────────────────┘
```

Three orthogonal axes to keep in mind:
1. **Workspace** = file view (what files can the agent see)
2. **Sandbox** = tool view (what does the agent's bash go through)
3. **Asset materialization** = content source view (what files are pre-staged into the workspace)

Below: walk through each layer in the order a session encounters them.

---

## 1. Session lifecycle

### 1.1 Create (`POST /api/v1/sessions/:id/messages`)

A caller (frontend / solution-backend proxy / curl) sending the first message triggers session creation. Entry points:

- `packages/backend/src/sessions/sessions.controller.ts:281-415` — receives the request, resolves tenant + skills
- `packages/backend/src/sessions/session.service.ts:_createNewSession` — actual creation logic

Key steps (in code order):

```
1. SessionService.getOrCreateSession()
   ├─ pendingCreates Map dedup (concurrent same-id safe)
   └─ _createNewSession()
       ├─ WorkspaceProvider.create({ sessionId, tenantId })
       │    → returns WorkspaceHandle { path, snapshot, rollback, diff, timeline }
       │    → path = agent's cwd
       ├─ SessionAssetMaterializer.materialize(handle.path, tenantId)
       │    → copies the solution's entities/ + resources/ to the workspace root
       ├─ persist ManagedSession to in-memory Map + DB
       └─ then spawn claude (in CliProcessService.ensureCLIProcess())
```

### 1.2 Spawn claude (`CliProcessService.ensureCLIProcess`)

File: `packages/backend/src/sessions/services/cli-process.service.ts`

`spawn(this.claudeCliPath, args, { cwd: session.workspaceDir, env: { ... } })`. Args are built by `applyMcpAndSandbox()` (same file, ~line 62):
- `--output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions --permission-prompt-tool stdio`
- `--mcp-config <json>` — solution-provided MCP servers + ccaas-injected `__ccaas_bash`
- `--disallowed-tools Bash` — **the key bit**: disables claude's native Bash, forcing it through the sandbox MCP
- `--append-system-prompt <text>` — solution's prompt + sandbox steering (separated by a hard delimiter)

### 1.3 Agent runs (inside claude process)

What claude sees:
- `cwd` is `session.workspaceDir` (under `agentfs`, this is the FUSE/NFS mount point)
- File operations (`Read`/`Write`/`Edit`/`Grep`/`Glob`) go through host fs syscalls → land on the mount → routed by the agentfs daemon to the SQLite delta
- bash commands go through `mcp____ccaas_bash__bash` MCP tool → just-bash interpreter → `ReadWriteFs` → also lands on the mount

→ Both tool paths land in the same agentfs delta DB.

### 1.4 Close (`SessionService.shutdown` / TTL expiry)

`workspaceProvider.close(sessionId)`:
- Local provider: no-op (directory stays)
- Agentfs provider: `umount` + stop the daemon child process, but **delta DB stays on disk** (per-session `_agentfs_deltas/<id>.db`)

→ Can you still hit `fs/diff` on a closed session? **No** — once it's purged from the in-memory Map these endpoints 404. Forensic re-mount is on the backlog.

---

## 2. WorkspaceProvider — the file-layer abstraction

Files: `packages/backend/src/sessions/workspace/`

| Implementation | When to use | Agent's file view |
|---|---|---|
| `LocalWorkspaceProvider` | dev / no agentfs binary handy | real host directory `${WORKSPACE_DIR}/sessions/<id>/` |
| `AgentfsWorkspaceProvider` | stage-1 self-host / want a sandbox | agentfs mount point (macOS NFS / Linux FUSE) backed by SQLite delta |

Selected via `WORKSPACE_PROVIDER=local | agentfs` env. `WorkspaceProviderFactory` picks at module init.

`WorkspaceHandle` interface (`workspace/types.ts`):
```ts
{
  sessionId: string;
  path: string;                              // always present, agent's cwd
  snapshot?(label): Promise<string>;         // agentfs only
  rollback?(label): Promise<void>;           // agentfs only
  diff?(): Promise<FsDiffEntry[]>;           // agentfs only — see runtime-api
  timeline?(opts?): Promise<FsTimelineEntry[]>; // agentfs only
}
```

**Why the abstraction**: (1) main backend code paths (CliProcessService, SessionService) don't care about storage details; (2) agentfs's init/mount/snapshot complexity is contained inside AgentfsProvider; (3) unit tests can use LocalProvider without an agentfs binary.

Design derivation: `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md` (concurrency safety, agentfs init --force race, stale mount cleanup at startup, etc.).

---

## 3. The sandbox layer — how bash gets isolated

Files: `packages/backend/src/sessions/sandbox/`

Two components:

### 3.1 `SandboxService` (`sandbox.service.ts`)

Reads `workspace.bashSandbox` config (auto-default: `just-bash` if `WORKSPACE_PROVIDER=agentfs`, else `none`). Provides:
- `bashMcpSpec(workspaceDir, sessionId?)` → returns the MCP server spec (reserved name `__ccaas_bash`) telling CliProcessService how to spawn the just-bash MCP child
- `disallowedTools()` → returns `['Bash']` when active, used to append to claude's `--disallowed-tools`
- `systemPromptSteer()` → a steering paragraph telling the model to use `mcp____ccaas_bash__bash` instead of native Bash

### 3.2 `just-bash-mcp/server.mjs`

Standalone stdio MCP process. One per session. Env `CCAAS_SANDBOX_ROOT` points at the session workspace dir. Internally uses [just-bash](https://github.com/vercel-labs/just-bash)'s `ReadWriteFs({ root })` for the isolated bash interpreter.

**Key**: under `WORKSPACE_PROVIDER=agentfs`, `CCAAS_SANDBOX_ROOT` IS the agentfs mount point, so **bash and claude's native Read/Write/Edit land in the same SQLite delta** — no data inconsistency.

Why not use Turso's `agentfs-sdk/just-bash` direct integration (skip the mount)? See [[sandbox-mount-vs-sdk]] design record: the mount has to exist anyway (claude's native tools go through host fs), so we put bash on the same code path. Single mental model.

---

## 4. Asset materialization — how content gets into the workspace

Two different materializers, two different jobs:

### 4.1 `BaseMaterializer` (@kedge-agentic/agentfs-runtime)

Runs **at backend startup**, once. Projects DB skills + MCP servers to `${baseDir}/tenants/<tenantId>/{skills,mcp-servers}/`. This baseDir is the agentfs `--base` argument, overlaid into every session mount.

`@kedge-agentic/agentfs-runtime` is the Phase A extracted pure version, zero framework deps. `ContentSource` is the port (backend provides a TypeORM adapter). See `reference/agentfs-runtime.md`.

Code: `packages/agentfs-runtime/src/core/base-materializer.ts` (pure) + `packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts` (adapter).

### 4.2 `SessionAssetMaterializer` (backend)

Runs **at every session create**. Copies `entities/` and `resources/` from the current tenant's solution dir to `handle.path` root. In other words, the agent starts off able to `ls entities/` and see seed data.

The source path comes from the `SOLUTION_DIRS=<slug>:<absPath>,<slug2>:<absPath2>` env var.

File: `packages/backend/src/sessions/services/session-asset-materializer.service.ts`. Has SHA-1 idempotency + symlink rejection + size caps (500 files / 1MB per file / 10MB total).

**Two materializers, side by side**:

| | BaseMaterializer | SessionAssetMaterializer |
|---|---|---|
| When | backend startup | every session create |
| Where | `${WORKSPACE_DIR}/_agentfs_base/...` (overlay base) | `<session-root>/...` (session's own delta) |
| Source | DB (Skills / McpServer entities) | Disk (solution directory) |
| For | skill content shared across all sessions | this session's own data copy |
| Package | `@kedge-agentic/agentfs-runtime` | backend-private |

---

## 5. Runtime REST API — operational visibility

Files: `packages/backend/src/sessions/{session-fs.controller.ts, session-metadata.controller.ts}`

8 endpoints, all under `/api/v1/sessions/:id/`:

```
GET    /fs/diff           list files the agent changed in the sandbox
GET    /fs/timeline       agentfs's built-in tool-call audit
POST   /fs/snapshot       checkpoint the current delta state
POST   /fs/rollback       revert to a prior snapshot
GET    /meta              list this session's KV
GET    /meta/:key         single-key read
PUT    /meta/:key         64KB/value, 256KB/session caps
DELETE /meta/:key
```

The 4 FS endpoints require `WORKSPACE_PROVIDER=agentfs` (local returns 400 with a clear message). The 4 meta endpoints are provider-agnostic (use the backend's own SQLite, not the agentfs KvStore).

Full spec + curl examples: `reference/runtime-api.md`.

---

## 6. How a solution gets into the system

`solutions/business/<slug>/` is an independent NestJS process (its own port). On startup:

1. **Bootstrap**: reads its `solution.json`, POSTs to `/api/v1/admin/solutions/import` to register the tenant + sessionTemplates in the ccaas DB
2. **Skill registration**: for each `skills/<slug>/SKILL.md` (+ subfiles `tools/`, `examples/`), POSTs to `/api/v1/skills` + PUT files + publish
3. **Hot reload** (optional): chokidar watches `skills/`, debounces 500ms, re-runs the skill registration step
4. **Domain API** (optional): exposes its own REST endpoint (e.g. demo-sandbox's DocumentEditProvider)
5. **Env wiring**: when the operator boots ccaas, `SOLUTION_DIRS=<slug>:<absPath>` tells `SessionAssetMaterializer` where to copy `entities/` + `resources/` from

Concrete walkthrough + screenshots: `examples/demo-sandbox.md`. Extension recipes: `guide/extending-runtime.md`.

---

## What to recognize in the logs

ccaas backend startup + one session running, the logs roughly go:

```
[SessionAssetMaterializer] Session asset materializer active for 1 tenant(s): demo-sandbox
[SandboxService]   Bash sandbox mode: just-bash (server: ...)
[AgentfsWorkspaceProvider] agentfs binary OK: agentfs <sha>
[BaseMaterializer] materialized 1 skills (6 files) + 0 mcp servers → /tmp/.../_agentfs_base (4ms)
[Bootstrap]        Application is running on: http://localhost:3009

# a session arrives
[AgentfsWorkspaceProvider] session demo-abc mounted at /tmp/.../sessions/demo-abc
[SessionAssetMaterializer] Materialized session assets for demo-sandbox → /tmp/.../sessions/demo-abc (copied=11, ...)
[CliProcessService] Session demo-abc bash sandbox active (just-bash) → __ccaas_bash
[CliProcessService] Spawning new AgentEngine for session demo-abc

# agent runs a bash command
$ tail /tmp/.../_sandbox_logs/bash-mcp.log
2026-XX-XX [demo-abc] exec cwd=/ cmd=ls entities/customers/
2026-XX-XX [demo-abc] exec done exit=0

# session closes
[AgentfsWorkspaceProvider] umount /tmp/.../sessions/demo-abc
```

Every line traces back to one of the layers above.

---

## See also

- **Run it locally**: `getting-started/local-self-host.md`
- **REST API spec**: `reference/runtime-api.md`
- **Write a custom ContentSource / use snapshot / metadata KV**: `guide/extending-runtime.md`
- **A complete case study**: `examples/demo-sandbox.md`
- **Design rationale + sanity checks + risk register**: `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md` (archive; original design source)
- **What the agentfs binary itself can do**: [tursodatabase/agentfs](https://github.com/tursodatabase/agentfs) + our fork [nnabuuu/agentfs](https://github.com/nnabuuu/agentfs)
- **just-bash**: [vercel-labs/just-bash](https://github.com/vercel-labs/just-bash)
