# WorkspaceProvider — backend integration design (DRAFT)

> Status: **IN PROGRESS** — sanity-check phase
> Owner: in-flight
> Last edit: 2026-05-25

The vfs-poc proves agentfs works on macOS NFS + Linux FUSE (see
[VALIDATION_REPORT](./VALIDATION_REPORT.md)). The next milestone is
integrating it into the ccaas backend behind a clean abstraction so we
can ship it (start with `WORKSPACE_PROVIDER=local`, flip selected
deployments to `agentfs`).

This doc captures the live design before we write code. It will become
the **implementation spec** once the open sanity-check items resolve.

## Goal

Add a `WorkspaceProvider` interface + two implementations:
- `LocalWorkspaceProvider` — wraps today's mkdir + symlink behavior, no behavior change
- `AgentfsWorkspaceProvider` — uses agentfs CLI for per-session FUSE/NFS mounts

Gate via `WORKSPACE_PROVIDER` env var (default `local`). Integrate into
`SessionService` only in this PR; downstream consumers (workspace.service
read paths, write-file-tracker hook, attachments, scheduled tasks) keep
using `session.workspaceDir` as a string path — provider populates it
identically for both impls.

## Surface area (mapped 2026-05-25)

**Workspace CREATION** (2 sites):
- `session.service.ts:155, 161` — `getOrCreateSession()` mkdirs session + `.claude/mcp-servers/`
- `headless-execution.service.ts:62, 66` — scheduled task workspace (out-of-scope this PR)

**Workspace READ** (10 sites): cli-process spawn cwd, workspace tree/file ops,
MCP symlinks, files.service path resolution, attachment path validation,
skill-router context.json. All read `session.workspaceDir` as a string.

**Workspace DESTROY**: `closeSession` does NOT delete on-disk dir (soft close).
Only `headless-execution.service.ts:444` hard-deletes (scheduled tasks).

**Config**: `WORKSPACE_DIR` env var only knob today.

(Full file:line refs in the sanity-check transcripts under the
agent-session-runtime project memory.)

## Findings that shaped the design

### F1 — `workspaceDir` is persisted to DB (RISKY)

`Session.entity.ts:119` defines `workspaceDir: string | null` column.
`session.service.ts:819` persists it. `messages.controller.ts:290` and
`session-manager.service.ts:359` read it back.

**Decision**: AgentfsProvider's mount path layout must equal LocalProvider's
(`${WORKSPACE_DIR}/sessions/{id}/`). DB column stays valid for both.

### F2 — 4+ sites reconstruct workspace paths outside SessionService (RISKY)

- `workspace.service.ts:167, 258` — fallback when session not in memory
- `files.controller.ts:245, 354` — same pattern
- All do `path.join(workspaceDir, 'sessions', sessionId)`

**Decision**: Same as F1 — by keeping path layout identical, these fallbacks
keep working. **Caveat**: for closed agentfs sessions the dir exists but
is empty (mount is down). UI showing "closed-session files" needs explicit
remount — out of scope this PR, documented limitation.

### F3 — WriteFileTrackerHook is synchronous during tool call (SAFE)

Fires within `afterToolResult` → live session lookup → gracefully fails
if session gone. Safe for AgentfsProvider to unmount on session close.

### F4 — Backend restart loses all in-memory sessions, no recovery (UNKNOWN-mitigated)

`ManagedSession` is in `Map`, not persisted. On restart all sessions
evaporate. Orphan on-disk dirs accumulate (no startup cleanup).

**Decision**: AgentfsProvider implements `onModuleInit` startup scan to
unmount stale agentfs mounts (`mount | grep agentfs` → unmount stranded
ones). Stale plain dirs from previous local runs are NOT touched (we
don't know if some other code cares about them).

### F5 — No NestJS factory pattern for config-driven impl selection currently

Existing services use direct `ConfigService.get()` in constructor.
**Decision**: WorkspaceProvider is the first place we add a `useFactory`
pattern — selects Local vs Agentfs based on `config.workspace.provider`.

### F6 — No backend Dockerfile / deployment artifacts

Backend is raw Node.js. AgentfsProvider assumes `agentfs` binary in
PATH, configurable via `WORKSPACE_AGENTFS_BIN` (same pattern as
`CLAUDE_CLI_PATH`).

## Interface sketch

```ts
// packages/backend/src/sessions/workspace/types.ts

export interface WorkspaceProvider {
  create(opts: CreateOpts): Promise<WorkspaceHandle>
  destroy(sessionId: string): Promise<void>   // hard delete delta + dir
  close(sessionId: string): Promise<void>     // soft: release locks, keep data
  capabilities(): WorkspaceCapabilities
  /** Optional: called once at module init. Cleanup stale state. */
  onModuleInit?(): Promise<void>
}

export interface CreateOpts {
  sessionId: string
  tenantId?: string
  mcpServers?: Record<string, McpServerSpec>
}

export interface WorkspaceHandle {
  sessionId: string
  path: string                  // cwd for spawn + raw fs ops; same shape both impls
  snapshot?(label: string): Promise<string>
  rollback?(label: string): Promise<void>
}

export interface WorkspaceCapabilities {
  snapshot: boolean
  multiMount: boolean
  fastClone: boolean
}
```

## Implementation plan

### `LocalWorkspaceProvider`

Wraps current code 1:1.

- `create`: mkdir session + `.claude/mcp-servers/` + settings.local.json,
  call `WorkspaceService.createMcpSymlinks`. Returns handle with
  `path = ${WORKSPACE_DIR}/sessions/{id}`
- `close`: no-op (matches today)
- `destroy`: rm -rf (not used by SessionService today, but provided for future)
- `capabilities`: { snapshot: false, multiMount: false, fastClone: false }

### `AgentfsWorkspaceProvider`

Layered on the vfs-poc's `SessionFsManager`.

- `onModuleInit`:
  - sanity-check `WORKSPACE_AGENTFS_BIN` exists, executable, version sane
  - scan `${WORKSPACE_DIR}/sessions/`, for each subdir check if it's still
    mounted (parse `/proc/mounts` on Linux, `mount` cmd on macOS), unmount
    if mount predates this process
- `create`:
  - check session not already on disk; if it is and unmounted, log warn + reinit
  - `agentfs init {id} --base ${WORKSPACE_DIR}/_agentfs_base --force`
    (delta lands at `${WORKSPACE_DIR}/_agentfs_deltas/{id}.db`)
  - `agentfs mount -f -a {id} ${WORKSPACE_DIR}/sessions/{id}` (background)
  - `WorkspaceService.createMcpSymlinks` runs on the mount path (symlinks
    work — target host path resolves outside the mount)
  - write `.claude/settings.local.json` to mount
- `close`: unmount + kill daemon; keep delta db on disk
- `destroy`: close + rm delta db
- `snapshot`: copy delta db set (WAL-aware, as in vfs-poc)
- `rollback`: unmount, restore delta, remount
- `capabilities`: { snapshot: true, multiMount: false, fastClone: false }

### `BaseMaterializer` (new service)

Runs once at backend startup (before any session is created).

Reads ccaas main db (`Skills`, `McpServers`, `Tenants`), writes to
`${WORKSPACE_DIR}/_agentfs_base/` mirroring the layout LocalProvider
expects (`tenants/{tid}/skills/{slug}/`, `tenants/{tid}/mcp-servers/{slug}/`).

Skipped when `WORKSPACE_PROVIDER=local`.

### DI wiring (new pattern for this codebase)

```ts
// sessions.module.ts
providers: [
  {
    provide: 'WORKSPACE_PROVIDER',
    useFactory: (cfg: ConfigService, ws: WorkspaceService) => {
      const choice = cfg.get<string>('workspace.provider', 'local');
      if (choice === 'agentfs') return new AgentfsWorkspaceProvider(cfg, ws);
      if (choice === 'local')   return new LocalWorkspaceProvider(cfg, ws);
      throw new Error(`unknown workspace.provider=${choice}`);
    },
    inject: [ConfigService, WorkspaceService],
  },
  // ... existing providers
]
```

### `SessionService` integration

```ts
// in getOrCreateSession, replace:
fs.mkdirSync(workspaceDir, { recursive: true });
fs.mkdirSync(mcpDir, { recursive: true });
// ... settings.local.json write ...
this.workspaceService.createMcpSymlinks(...);

// with:
const handle = await this.workspaceProvider.create({
  sessionId, tenantId, mcpServers,
});
session.workspaceDir = handle.path;
session.workspaceHandle = handle;
```

`closeSession` calls `workspaceProvider.close(sessionId)`.

## Config additions

```
WORKSPACE_PROVIDER=local              # default; alt: 'agentfs'
WORKSPACE_AGENTFS_BIN=/usr/local/bin/agentfs
# When unset, the agentfs paths default relative to WORKSPACE_DIR:
WORKSPACE_AGENTFS_BASE_DIR=${WORKSPACE_DIR}/_agentfs_base
WORKSPACE_AGENTFS_DELTA_STORE=${WORKSPACE_DIR}/_agentfs_deltas
AGENTFS_DROP_APPLEDOUBLE=1            # passed through to agentfs binary
```

## Sanity-check resolutions

### A. `getOrCreateSession` concurrency safety — RESOLVED

**Current code** (`session.service.ts:113-214`): from `this.sessions.get` through
`this.sessions.set` runs **entirely synchronously** (no `await`). Node.js
single-threaded → atomic. Second concurrent caller for the same sessionId
sees the just-set entry and takes the "reusing" branch. The first `await`
is `persistSessionToDatabase`, which is too late to race the in-memory map.

**Today: safe.** Local fs `mkdirSync` is also race-safe due to `recursive: true`.

**With AgentfsProvider it breaks**: `agentfs init` and `agentfs mount` are
subprocess invocations → must be `await`-ed. The synchronous atomicity
window disappears between `sessions.get` returning undefined and
`sessions.set` placing the new entry. Two concurrent HTTP requests for the
same sessionId would both proceed past the early-return and both call
`provider.create` → race on `agentfs init --force` (see B).

**Decision**: add a `pendingCreates: Map<string, Promise<ManagedSession>>`
to `SessionService`. `Map.has` + `Map.set` are synchronous → atomicity
preserved. Pattern:

```ts
async getOrCreateSession(sessionId, ...) {
  if (this.sessions.has(sessionId)) { /* reuse path */ }
  if (this.pendingCreates.has(sessionId)) {
    return await this.pendingCreates.get(sessionId)!;
  }
  const p = this._createNew(...).finally(() => this.pendingCreates.delete(sessionId));
  this.pendingCreates.set(sessionId, p);
  return await p;
}
```

### B. `agentfs init --force` under concurrent invocation — RESOLVED (destructive)

Source: `~/Documents/GitHub/agentfs/cli/src/cmd/init.rs:108-128`. With
`--force`, agentfs:

1. Walks `.agentfs/` dir
2. Deletes every file whose name starts with the agent id (`{id}.db`,
   `{id}.db-wal`, `{id}.db-shm`)
3. Calls `AgentFS::open(options)` to create fresh files

**Race scenarios**:
- Call A walks + deletes; Call B walks AFTER A's delete (sees nothing) →
  both proceed to `AgentFS::open()` → race on SQLite file creation,
  undefined behavior, possible corruption.
- Worse: if a previous mount daemon's fd is still open to the old `.db`,
  unlink succeeds but the daemon writes to a now-orphan inode. Subsequent
  mount of the new `.db` ends up in an inconsistent state.

**Decision**: `AgentfsWorkspaceProvider` carries its own in-flight Map.
Pattern identical to SessionService above, but at provider level.
Defense in depth — provider mutex protects against any caller (including
future `HeadlessExecutionService` integration), service mutex protects
the in-memory `sessions` map invariant.

**Bonus**: at startup (`onModuleInit`), provider scans for stale
`{sessionId}.db` files that don't correspond to a currently-mounted
session and cleans them. This handles "backend was killed mid-init"
scenarios where files exist but no session is using them.

### Combined defense pattern

```
HTTP req → SessionService.getOrCreateSession
              ├─ sessions.has? fast-return
              ├─ pendingCreates.has? await existing promise
              └─ create new promise → provider.create
                                          ├─ inFlight.has? await existing
                                          └─ _doCreate → agentfs init / mount
```

Both layers use the same `Map`-of-Promises pattern, both delete entries
in `.finally()` to ensure cleanup on success and failure.

## Out of scope for this PR (queued follow-ups)

- `HeadlessExecutionService` (scheduled tasks) provider integration —
  same shape as SessionService but separate file, separate PR
- WriteFileTrackerHook / attachment.service / skill-router routed
  through provider methods (rather than raw `workspaceDir` string)
- Session admin tools to re-mount closed agentfs sessions for forensic
  file inspection (UI feature)
- Session migration tooling (local → agentfs)
- macOS dev experience polish (`npm run dev:backend` should "just work"
  when `WORKSPACE_PROVIDER=agentfs` — auto base-materialize, etc.)
- Backend Dockerfile (entirely missing today — opportunity to add a
  `--privileged` capable one when we ship agentfs production)
- Per-tenant agentfs encryption (`--key/--cipher` agentfs flags)

## Definition of Done

1. `WORKSPACE_PROVIDER=local npm run dev:backend` behavior bit-identical
   to before the PR (spawn claude, run session, close, cleanup)
2. `WORKSPACE_PROVIDER=agentfs ... npm run dev:backend` starts successfully,
   creates session that mounts via agentfs, claude runs in it, session
   closes cleanly
3. All existing backend tests pass with `WORKSPACE_PROVIDER` unset (default local)
4. New unit tests:
   - `local-provider.spec.ts` — mock fs, verify mkdir/symlink/settings calls
   - `workspace-provider-factory.spec.ts` — factory selects correct impl
5. New integration test (skip-if-no-binary):
   - `agentfs-provider.integration.spec.ts` — gated by `INTEGRATION_AGENTFS=1`
6. Code review on the diff
7. VALIDATION_REPORT.md gets a v5 section: "WorkspaceProvider integration"

## Risk register

| # | Risk | Mitigation | Severity | Status |
|---|---|---|---|---|
| R1 | Concurrent getOrCreateSession races | `pendingCreates` Map dedup in SessionService | HIGH | resolved (sanity A) |
| R2 | `agentfs init --force` data loss under race | `inFlight` Map dedup in AgentfsProvider + startup stale-file scan | HIGH | resolved (sanity B) |
| R3 | Backend restart leaves stranded mounts | `onModuleInit` startup scan: parse `mount` cmd, unmount agentfs entries that aren't in in-memory `sessions` | MEDIUM | designed |
| R4 | DB workspaceDir column stale after agentfs swap | path layout identical between providers (`${WORKSPACE_DIR}/sessions/{id}/` = mount point) | MEDIUM | designed |
| R5 | MCP symlinks inside agentfs mount break | agentfs SPEC supports symlinks; target = host fs absolute path; tested in vfs-poc | LOW | validated |
| R6 | Closed agentfs session shows no files via fallback paths | documented limitation; explicit remount API in follow-up PR | LOW | accepted |
| R7 | agentfs binary missing in deployment | startup-time `--version` check + fail-fast | LOW | designed |
| R8 | FUSE not available in container (non-privileged) | document `--privileged --device /dev/fuse` requirement | LOW | accepted |

## Revision history

- 2026-05-25 — initial draft, captures findings F1-F6, leaves A/B sanity checks pending
- 2026-05-25 — sanity checks A (concurrency) + B (init --force race) resolved; defense-in-depth dual-Map dedup pattern decided; risk register updated
