# Recent changes — 2026-05 runtime + sandbox sprint

> Catch-up doc for engineers who haven't been tracking commits the last
> two weeks. Lists the runtime / sandbox / agentfs-runtime work in
> chronological order with commit refs. If you're new, **don't read
> this**; read [gitbook → Runtime 架构](./gitbook/zh/platform/runtime-architecture.md)
> first. This page is for "I was here before, what did I miss".

## TL;DR (the new mental model)

ccaas backend now has a per-session **sandbox** (agentfs FS + just-bash
MCP bash), an **asset-materialization** layer that seeds solution data
into each session, a **runtime REST API** for observing + checkpointing
the agent's FS, and a clean-architecture **package extraction**
(`@kedge-agentic/agentfs-runtime`) that decouples the materializer
logic from TypeORM / NestJS.

Six new gitbook pages exist (`platform/runtime-architecture`,
`getting-started/local-self-host`, `reference/runtime-api`,
`reference/agentfs-runtime`, `examples/demo-sandbox`,
`guide/extending-runtime`) — see [`docs/gitbook/zh/SUMMARY.md`](./gitbook/zh/SUMMARY.md).

---

## Chronological digest

### Week 1: Stage-1 sandbox (FS + bash)

| Date | Commit | What |
|---|---|---|
| 2026-05-23 | `c9ebd806` (pre-window) | `WorkspaceProvider` abstraction lands: `LocalWorkspaceProvider` + `AgentfsWorkspaceProvider` + `BaseMaterializer` (originally in backend) |
| 2026-05-24 | `d9f895f2` | Graceful shutdown awaits agentfs unmount (previously leaked) |
| 2026-05-25 | `c7c57124` + `2c0934b6` | Bash sandbox: `SandboxService` + just-bash MCP server. Injects `__ccaas_bash` MCP, denies native `Bash`, steers via system prompt |
| 2026-05-25 | `f7c90e41` | Review fixes: `--disallowed-tools` dedup, `existsSync` gated on mode, steering delimiter |

After this week: `WORKSPACE_PROVIDER=agentfs npm run start:prod` gives you full FS + bash sandbox per session.

### Week 1.5: Per-session asset materialization + demo-sandbox

| Commit | What |
|---|---|
| `cdb7d82f` | New `SessionAssetMaterializer`: copies `SOLUTION_DIRS[slug]/{entities,resources}/` into each session's workspace root. 64KB/file, 256KB total caps. Symlink rejection. |
| `c8234ca5` | demo-sandbox solution data: B2B SaaS theme + progressive-disclosure skill (`sandbox-explorer`) + entities (customers/revenue/plans) + resources (glossary/playbooks/data-dictionary) |
| `04f77ef3` | demo-sandbox solution backend (:3010): bootstrap registration + chokidar hot-reload + `DemoEntityProvider` extending `DocumentEditProvider` + REST `/api/demo-sandbox/entities/:id` |
| `14736e9b` | Review fixes: symlink guard tightened, fetch timeout, slug validation, `__dirname` boot sanity |
| `7d82c3ae` | demo-sandbox single-page frontend (vanilla HTML/JS) + `/demo/run` SSE proxy |

### Week 2: Runtime REST API

| Commit | What |
|---|---|
| `c75d7f42` | Session FS endpoints: `GET /sessions/:id/fs/{diff,timeline}` + `POST /sessions/:id/fs/{snapshot,rollback}`. Wraps agentfs CLI via snapshot-cp pattern; surfaces existing `WorkspaceHandle.snapshot/rollback` methods. |
| `b7b7829d` | Session metadata KV API: `/sessions/:id/meta[/:key]` CRUD. Backend SQLite, not agentfs KvStore. 64KB/value, 256KB/session caps. |
| `91e23dc9` | demo-sandbox frontend "FS changes" panel + `/demo/fs-diff/:sessionId` proxy. Visualizes everything the agent touched per run. |
| `5fd230cd` | Docs: `STAGE1_LOCAL_SELFHOST.md` + `WORKSPACE_PROVIDER.md` gain the runtime API curl examples. |
| `4ce06c46` | Review fixes: WAL copy order, mid-turn 409, parseDiff warn log, timeline filter validation, demo proxy sessionId regex. |

### Week 2.5: Package extraction (Phase A)

| Commit | What |
|---|---|
| `1609c997` | Archive `packages/vfs-poc/`: delete `src/`, `test/`, validation runners, Docker setup; keep `docs/`, `validation/results/`, `scripts/build-agentfs-fix.sh`. Update backend "Ported from" comments to point at `docs/` instead. |
| `2aef2e33` | **Phase A extraction**: new `@kedge-agentic/agentfs-runtime` package with `BaseMaterializer` + `ContentSource` port + `Logger` port. Backend gains `TypeOrmSkillContentSource` adapter + factory. Pure tests in vitest; backend tests still in jest. |
| `45ba906c` | Review fixes: path-traversal guard in materializer + 3 specs; root build chain includes the new package; explicit `"type": "commonjs"`; `InMemoryContentSource` exported at `/testing` subpath. |

### Today (2026-05-25 late)

| Commit (this) | What |
|---|---|
| (current) | Documentation refresh: 6 new gitbook pages + 4 in-repo entry-point updates + this CHANGES file |

### Week 3-4: agent-runtime bidirectional sync (Phase 1/1.6/2b)

| Date | Commit | What |
|---|---|---|
| 2026-05-25 | `523710cc` | **Phase 2b-1** path-normalization round-trip: `SaveArtifactResult.canonicalPath` flows from `RestProjectArtifactSource` → `SessionAssetSyncer` → snapshot/change-event. Live-lesson's `upsertArtifact` returns `{ path: safePath, fileType }`. Closes the silent delete-then-recreate path when solution and runtime disagree on path form. |
| 2026-05-26 | `924191f3` | **Phase 2b-4 runtime**: `BinaryArtifactSource` port + `SyncEngine.planBinary()` (parallel to text, same 4-case conflict matrix, agent-wins). New action kinds `write_fs_binary_from_listing` / `save_db_binary` / `delete_*_binary` / `conflict_agent_wins_binary`. Includes a **lost-write fix** for both engines: `!db && fsMod` (agent re-creates a path the DB deleted between turns) was silently dropped; now persists back to DB. `ProjectTenantResolver.verifyProjectAccess(projectId, callerTenantId)` API (refactored from "resolveTenant" — keys the lookup on the pair so a tenant can't piggyback on another's binding). Bumps to `@kedge-agentic/agent-runtime@0.4.0`. |
| 2026-05-26 | `63c7b072` | **Phase 2b-2 backend**: SSE auth via `?token=<apiKey>` query-param on `/projects/:id/{changes,invalidate}` (EventSource can't send headers). Auth runs in `ProjectAccessGuard.canActivate` — **not** inside the `@Sse` Observable, because `@Sse` commits HTTP 200 + `text/event-stream` before subscribing; an Observable-internal `from(Promise).pipe(switchMap)` auth fails the request silently. Default impl `SessionMetadataProjectTenantResolver` reuses the (tenant, project) row `bind-project` already writes into `session_metadata` — zero per-solution work, single indexed SQLite lookup. Trade-off: project must be bound at least once before SSE can subscribe. **Phase 2b-4 backend**: `RestBinaryArtifactSource` (streaming octet-stream upload/download via `node:stream/pipeline`, content-length pre-check + mid-stream cap), `ProjectBinaryArtifactSourceRegistry` (tenant.config.binaryArtifactUrl), syncer's binary half materializes into `<workspace>/artifacts-binary/` (sibling of `artifacts/`, deliberately outside the agent's `Read` tool reach). Includes review fixes: guard rejects array-shaped `?token`, save uses `content.byteLength` (not caller-supplied `sizeBytes`). |
| 2026-05-26 | `3d572c63` | **Phase 2b-2 frontend**: `useProjectChanges(projectId, apiKey?)` — second arg required for SSE auth; hook skips opening EventSource when key is missing. `getChangesStreamUrl` appends `?token=…` and **corrects the URL path** to `/projects/:id/changes` (no `/api/v1/` prefix — that controller mounts at the bare namespace). |
| 2026-05-26 | `fde74eff` | **Phase 2b-3 smoke**: `poc-smoke.sh` reordered for auth flow — `bind-project` first (writes the metadata row that auth requires) → SSE subscribe → live-lesson PUT (sim GUI edit) → `/invalidate` → assert SSE captures the change. Also: `create-dev-api-key.ts` extended with positional tenant-slug + `--raw-only` flag so the smoke can mint a tenant-scoped key inline. |
| 2026-05-26 | `eb4eda16` | **Phase 2b-3 docs**: gitbook (zh) `reference/agent-runtime.md` gains "认证" + "二进制 artifact" subsections + corrected SSE URL path. `agent-runtime/README.md` phase table updated. `packages/backend/CLAUDE.md` end-to-end smoke + binary mount note. `poc-result.md` reflects the new auth + reordered flow. |

**Net mental-model deltas this sprint**:

1. The agent-runtime sync layer is **end-to-end auth'd** in dev and ready for multi-solution prod (with the documented query-param-in-access-logs caveat tracked for Phase 3 hardening).
2. Binary artifacts (images, audio, PDFs) are a **first-class concern** — separate port, separate REST adapter, separate workspace mount. No in-tree consumer yet, but the abstraction is locked so the next solution that needs a JPEG drops straight in.
3. `SyncEngine` no longer silently drops agent re-creates of DB-deleted paths (long-latent bug, found in code review of the binary version, fixed in both halves).

**Smoke check after pulling**: `bash solutions/business/live-lesson-creator/scripts/poc-smoke.sh` against a booted ccaas + live-lesson backend pair should print `✓ end-to-end PoC passed: 1 change events delivered (auth + sync + SSE)`.

### Week 5 (2026-05-28..29): ToolCallerProxy — ambient identity + tool-call audit

| Commit | What |
|---|---|
| `b7a541f6` | Platform fix: `SolutionLoader.materializeMcpServerBundle` symlinks `<solutionDir>` into `<workspace>/tenants/<id>/mcp-servers/<slug>`. Without this MCP servers shipped by solutions silently failed to spawn (ENOENT on `node …/dist/index.js`). |
| `ce88f189` | Reverted speculative `ensureTenant` defensive guard — independent repro proved the alleged TypeORM/SQLite "edge case" doesn't exist; turned out I was querying the wrong (dead) `tenants` table. |
| `0a65bec6` | Purged 5,925 lines of dead AI-classroom code: `mcp-server/` + `LessonPage`/`useLiveLesson` + 11 board components + `socratic-teacher` skill + `teaching` session template. None of it was routed. Cleared the slate before flipping the proxy on. |
| `ee7c5027` | ToolCallerProxy infra — `packages/backend/src/tool-caller/` module + per-session proxy bundle at `packages/mcp/tool-caller-proxy-server/`. Pipeline: reserved-field strip → Zod validate → context inject → handler dispatch → audit. Identity is ambient (bound at session creation via `X-Ccaas-On-Behalf-Of` header), never agent-writable. Permission/scope/visibility stubbed until use cases land. |
| `0d96ab2a` | First migration: `live-lesson-creator-tools.proxyEnabled = true`. SolutionLoader probes the stdio MCP server at import (`tools/list`), captures real schemas, registers `StdioMcpToolkit` in the registry. Solution stdio binary unchanged. |
| `b430dfc8` | Code-review fixes (H1 namespace match, H2 `releaseSession` wired into `closeSession`, H3 dispose race, M1 conflict logging, M2 env scrubbing for stdio subprocesses, M3 path traversal bound, M4 fetch timeouts in proxy bundle, M5 derived-not-cached routing predicate). |
| `6b6bd192` | Live E2E smoke surfaced H1 v2: Claude Code sanitizes `.` → `_` in MCP tool names, so wire form is `mcp__tool-caller-proxy__live-lesson-creator-tools_emit_todo_card` (single underscore at namespace/name boundary). Extended trigger match to accept `_<toolName>` suffix in addition to `.<toolName>`. All unit tests had passed; only live smoke caught it. |

**Net effect:** the cards POC (`emit_todo_card` / `emit_verify_card` / `emit_questions_card`) still works exactly as before from the user's perspective, but every tool call now goes through `ToolCallerProxy.invoke()` — sanitized, audited, identity-bound. Any solution can opt in by flipping `proxyEnabled: true` on its MCP server entry.

Mental model: **[gitbook → Runtime 架构 §7](./gitbook/zh/platform/runtime-architecture.md)**.
Full design: **[design-tool-caller-proxy.md](./design-tool-caller-proxy.md)**.
Decision archive (META arc across episodes): **[decision-archive-tool-design-arc-2026-05-28.html](./decision-archive-tool-design-arc-2026-05-28.html)**.

---

## Surface area added (so you know where to grep)

```
NEW packages:
  packages/agentfs-runtime/                     ← framework-free
    src/core/{types,logger,base-materializer}.ts
    src/testing/in-memory-content-source.ts

NEW backend files (sessions module):
  src/sessions/sandbox/sandbox.service.ts
  src/sessions/sandbox/just-bash-mcp/server.mjs
  src/sessions/services/session-asset-materializer.service.ts
  src/sessions/services/session-fs.service.ts
  src/sessions/services/session-metadata.service.ts
  src/sessions/session-fs.controller.ts
  src/sessions/session-metadata.controller.ts
  src/sessions/workspace/local-provider.ts
  src/sessions/workspace/agentfs-provider.ts
  src/sessions/workspace/workspace-provider.factory.ts
  src/sessions/workspace/typeorm-skill-content-source.ts
  src/sessions/workspace/base-materializer.factory.ts
  src/sessions/entities/session-metadata.entity.ts

NEW solution (showcase + DX):
  solutions/business/demo-sandbox/{solution.json, skills/, entities/, resources/, backend/, frontend/}

NEW config:
  WORKSPACE_PROVIDER, WORKSPACE_BASH_SANDBOX, WORKSPACE_AGENTFS_*,
  SOLUTION_DIRS — see packages/backend/CLAUDE.md table
```

---

## What hasn't shipped yet (open backlog)

See `~/.claude/projects/.../memory/backlog.md` for the full list. The
highest-leverage ones:

- **Phase B**: extract `WorkspaceProvider` + local/agentfs impls into `@kedge-agentic/agentfs-runtime`. Currently still in backend.
- **Phase C**: extract `SandboxService` + just-bash MCP server.
- **HeadlessExecutionService provider integration**: scheduled tasks still use local fs only.
- **Forensic re-mount of closed sessions**: today fs/diff/timeline 404 once session is purged from in-memory map.
- **`sessions:fs` / `sessions:meta` granular scopes**: currently `admin` for stage-1; needed for multi-solution SaaS.
- **better-sqlite3 online backup for `fs/diff`**: current cp pattern can produce inconsistent reads under heavy writes; rare in practice but noted.
- **English gitbook parallel**: only zh updated in this doc-refresh PR.

---

## Where to look up something

```
"how do I run sandbox locally?"
  → docs/gitbook/zh/getting-started/local-self-host.md

"what does the agent actually see?"
  → docs/gitbook/zh/platform/runtime-architecture.md § 1.3 + § 6

"what REST endpoints exist?"
  → docs/gitbook/zh/reference/runtime-api.md

"how does the sandbox stack relate to vfs-poc?"
  → packages/vfs-poc/README.md (top-of-file note explains it)

"I want to write a solution that uses snapshot/rollback / KV"
  → docs/gitbook/zh/guide/extending-runtime.md

"design rationale + risk register"
  → packages/vfs-poc/docs/WORKSPACE_PROVIDER.md (archive, but authoritative for 'why')

"sandbox vs SDK direct integration — why mount?"
  → ~/.claude/projects/.../memory/sandbox-mount-vs-sdk.md (decision record)
```
