# `@kedge-agentic/agent-runtime` — design

The full Path C vision for the agent-runtime package — what each
sub-module is for, how they relate, the rollout sequence across
phases, and the live-lesson case that drives the abstractions.

This is the **design** doc. The phase-by-phase **execution** plans
live in `~/.claude/plans/` (current Phase 0 plan was approved
2026-05-25). The **bespoke "before"** snapshot live-lesson exhibits
today is `docs/PROJECT_PATTERN_CATALOG.md`. The **operator/runtime
overview** is gitbook's `platform/runtime-architecture.md`.

## Why this package exists

Solutions on ccaas need to do more than just run an agent. They need:

1. A **project container** to organize all the artifacts a user is
   working on (a course, a customer account, a manuscript draft)
2. **Typed artifacts** — markdown lesson plans, JSON-with-schema
   execution plans, attached binary content
3. **Bidirectional editing** — agent and GUI both update the same
   artifacts; changes converge
4. **Schema validation** for typed JSON artifacts
5. **Persistence across sessions** — yesterday's work shows up today

Live-lesson built all of this **bespoke**. Every future solution
that wants the same shape (lesson-plan-designer, course-builder,
manuscript-coach, …) would re-derive it from scratch. The
agent-runtime package's job is to make that pattern reusable.

## The 5 sub-modules

```
@kedge-agentic/agent-runtime/
├── workspace/    — agent's FS view (BaseMaterializer + ContentSource)
├── project/      — Project container (id, solution, status, attributes)
├── artifact/     — typed Artifacts + ArtifactEditor union
├── schema/       — SchemaRegistry + SchemaValidator
└── sync/         — ChangeStream for agent ↔ GUI updates
```

### How they relate

```
            ┌───────────────────────────────────────────────────────┐
            │  Solution Backend                                      │
            │                                                         │
            │  ┌─────────────────┐    ┌──────────────────┐           │
            │  │ ProjectStore    │    │ ArtifactStore     │           │
            │  │ (typeorm/redis) │    │ (typeorm/s3)      │           │
            │  └─────────┬───────┘    └─────────┬────────┘           │
            │            │                       │                    │
            │  ┌─────────▼───────────────────────▼────────┐           │
            │  │  Project owns Artifacts                   │           │
            │  │  Artifact validated by SchemaRegistry     │           │
            │  │  Artifact edited via ArtifactEditor       │           │
            │  └────────────────┬────────────────┬────────┘           │
            │                   │                 │                    │
            │           ┌───────▼───────┐ ┌──────▼─────────┐          │
            │           │ ChangeStream  │ │ Materializer    │          │
            │           │ (publishes)   │ │ (projects into  │          │
            │           │               │ │  session ws)    │          │
            │           └───────┬───────┘ └──────┬─────────┘          │
            └───────────────────┼────────────────┼─────────────────────┘
                                │                │
                  ┌─────────────▼──┐    ┌────────▼────────────┐
                  │ GUI subscribes │    │ Agent session       │
                  │ (live update)  │    │ ws has artifacts at  │
                  └────────────────┘    │ entities/ + writes   │
                                        │ flow back via Store  │
                                        └─────────────────────┘
```

### Per sub-module purpose

| Sub-module | Purpose | Concrete impls (Phase) |
|---|---|---|
| `workspace/` | Project skills+MCP-servers from a `ContentSource` onto a host directory for the agentfs `--base` overlay | TypeORM ContentSource (already in backend; built on top) (A done) |
| `project/` | Define what a Project IS (solution-owned container of artifacts with title/status/attributes) | TypeORM ProjectStore (Phase 1) |
| `artifact/` | Define what an Artifact IS + how it can be edited | JsonEditProvider (Phase 0 — shipped); `WorkspaceArtifactSource` + `SaveArtifactResult.canonicalPath` (Phase 1 / 2b-1 — shipped); `BinaryArtifactSource` (Phase 2b-4 — shipped); MarkdownArtifactEditor wraps DocumentEditProvider (Phase 2 rest) |
| `schema/` | Map schemaId → validator, used by artifact edits | Zod adapter (Phase 1); JSON Schema adapter (Phase 1 stretch) |
| `sync/` | Bidirectional change feed; agent + GUI subscribe + publish | in-memory pub/sub (Phase 2); Redis pub/sub (Phase 2 stretch) |

## Live-lesson — the case study

Live-lesson currently builds this whole stack **bespoke**, in its
own `solutions/business/live-lesson/backend/`:

| Live-lesson today | agent-runtime equivalent (target) |
|---|---|
| `CourseProject` entity (id, title, status, description) | `Project` |
| `ProjectFile` entity (projectId, path, content, fileType) | `Artifact` |
| `ProjectController` REST CRUD | uses `ProjectStore` + `ArtifactStore` ports |
| `schemas/` dir (`manifest`, `answer-key`, `board-data`, etc.) | registered with `SchemaRegistry` |
| inline Zod parsing in services | `SchemaValidator` adapter |
| no story for agent ↔ GUI mid-session sync | `ChangeStream` |
| binary content squeezed into `content` TEXT column | `BinaryArtifactSource` port + solution-owned storage adapter (Phase 2b-4) |

Live-lesson migration is **Phase 3** — last, after all the
abstractions stabilize from Phase 0/1/2. The pattern catalog
(`docs/PROJECT_PATTERN_CATALOG.md`) tracks the delta.

## Phase rollout

| Phase | Scope | Effort | Status |
|---|---|---|---|
| A (was v0.1) | `workspace/` only | ~1 week | ✅ shipped |
| 0 (v0.2) | rename to `agent-runtime`; sub-module skeletons (types only) for project/artifact/schema/sync; ship `JsonEditProvider` | ~4 days | ✅ shipped |
| **1 (v0.3)** | **`WorkspaceArtifactSource` port + `SyncEngine` (pure) + `InMemoryChangeStream` + `SnapshotStore`; backend `SessionAssetSyncer` orchestrator at turn boundaries; `attachWorkspaceSource` + session-bound bootstrap; `RestWorkspaceArtifactSource` adapter for cross-process solutions; `/workspaces/:id/{changes,invalidate}` REST; live-lesson `/artifacts` endpoint contract** | ~1.5 weeks | ✅ **shipped** |
| **1.5** | env-CSV solution routing (`SOLUTION_ARTIFACT_URLS=slug:url,...`) | — | ⚠️ **superseded by 1.6** |
| **1.6** | **declarative registration via `solution.json` + auto-discovery: `artifactUrl` field on solution.json + Solution.config (existing JSON blob); `SolutionLoaderService.onModuleInit` walks `SOLUTIONS_DIR/<slug>/solution.json` with Zod validation; `SolutionsService.{create,update}` emit `solution.config.changed` events; `WorkspaceArtifactSourceRegistry` reads solution.config lazily, caches per slug, evicts on event. Zero env vars for URL routing. Dev workflow becomes zero-key.** | ~3 hours | ✅ **shipped** |
| **2b-1 (v0.3.1)** | **path-normalization round-trip: `SaveArtifactResult.canonicalPath` so solutions that normalize paths server-side surface the canonical key; runtime snapshot + change events use it. Avoids silent delete-then-recreate when solution and runtime disagree on path form.** | ~0.5 day | ✅ **shipped** |
| **2b-2 (v0.3.2)** | **SSE auth: `?token=<apiKey>` query-param on `/workspaces/:id/{changes,invalidate}` (EventSource can't set headers). `WorkspaceAccessResolver` port (default deny-all). Backend ships `WorkspaceAccessGuard` (NestJS `canActivate` — has to run before the `@Sse` handler commits HTTP 200) + `SessionMetadataWorkspaceResolver` that reuses the (solution, sourceIdentity) link `attach-workspace-source` writes into `session_metadata` — zero per-solution work, one indexed SQLite lookup. Trade-off: session must attach a workspace source at least once before SSE can subscribe.** | ~2 days | ✅ **shipped** |
| **2b-3** | **end-to-end smoke (`solutions/business/live-lesson-creator/scripts/poc-smoke.sh`): mint dev key → message-post → attach-workspace-source → SSE subscribe → live-lesson PUT → invalidate → SSE captures change. Doc refresh for the corrected SSE URL path (`/workspaces/:id/...`, not `/api/v1/projects/...`).** | ~0.5 day | ✅ **shipped** |
| **2b-4 (v0.4)** | **`BinaryArtifactSource` port (separate from text — content is `Buffer | Uint8Array`; solutions opt in independently). `SyncEngine.planBinary()` mirrors the text conflict matrix. Backend ships `RestBinaryArtifactSource` (octet-stream streaming, content-length pre-check, mid-stream cap) + `WorkspaceBinaryArtifactSourceRegistry` (solution.config.binaryArtifactUrl). Syncer materializes binary actions into `<workspace>/artifacts-binary/` — sibling of `artifacts/`, deliberately outside the agent's `Read` tool reach so JPEGs can't be slurped into context. No in-tree consumer yet; full vertical unit-tested.** | ~3 days | ✅ **shipped** |
| 2 (rest) | Redis-backed `ChangeStream` (cross-instance fanout); `MarkdownArtifactEditor` wrapping `DocumentEditProvider`; Zod schema adapter; conflict markers in GUI | ~1 week | next |
| 3 | live-lesson full migration onto new abstractions (drop bespoke project entity if applicable); pattern catalog deltas; first non-live-lesson consumer | ~2-3 weeks | last |

Total: ~1.5–2 months end-to-end. Phases A, 0, 1, 1.6, 2b-1/2/3/4 = ~4 weeks shipped.

### Phase 1 — what's deliberately not in scope (closed-out as Phase 2b shipped)

* Redis-backed cross-process `ChangeStream` (single-instance ccaas is the design constraint; not on roadmap)
* Per-field projection (1 entity → N files via column-mapping) — Phase 1 is strictly 1 row = 1 file via `WorkspaceArtifactSource`. Solutions compose multiple rows internally.
* ~~Binary blob projection~~ — **shipped in Phase 2b-4** (`BinaryArtifactSource` port + REST adapter + `artifacts-binary/` mount)
* `MarkdownArtifactEditor` (Phase 0's `JsonEditProvider` already covers JSON artifacts; markdown editor remains "Phase 2 rest")
* Zod entity hooks on live-lesson's `ProjectFile` for schema enforcement at the entity boundary
* ~~Frontend SSE consumer of `/projects/:id/changes`~~ — **shipped in Phase 2a** (creator's `useProjectChanges` hook), now with `?token=<apiKey>` auth (Phase 2b-2)

## Open design questions (still unresolved)

These get resolved in their respective phases — flagging them here
so future contributors don't think the answers exist yet:

### ~~Conflict resolution~~ — RESOLVED in Phase 1 + Phase 2b

`SyncEngine.plan` ships **agent-wins** semantics for dual writes,
with a `conflict_agent_wins` action that publishes a `ChangeEvent`
carrying both the agent's new content AND the discarded DB content
so the GUI can surface the conflict. The creator's
`useProjectChanges` hook treats `actor === 'conflict-agent-wins'`
as a distinct event class (red banner; explicit reload). Phase
2b-4 mirrors the semantics for binary artifacts
(`conflict_agent_wins_binary` — metadata-only in the event since
binary content can be MB-sized).

Future hardening (not currently planned): a version-field
optimistic-concurrency layer for solutions that want stricter
guarantees than "agent wins." Defer until a consumer asks.

### ~~Blob storage~~ — RESOLVED in Phase 2b-4

`BinaryArtifactSource` is a separate port (content is `Buffer |
Uint8Array`; text-only solutions don't implement it). Storage is
adapter-decided: the runtime ships `RestBinaryArtifactSource`
(streaming octet-stream over HTTP) for the cross-process case;
solutions wrap their own storage behind the port — solution-backend
filesystem, S3, or whatever fits.

Workspace mount is split: text → `<workspace>/artifacts/`, binary →
`<workspace>/artifacts-binary/`. The split keeps the agent's `Read`
tool from streaming a JPEG into context. The size cap is
declared per-solution via `solution.config.binaryMaxBytes`; the REST
adapter enforces it via content-length pre-check before draining
the body.

### Session-project binding (Phase 1 owns this)

Today a ccaas session has a `solutionId` but no `projectId`. Several
options for adding it:
- Add `projectId` to `ManagedSession` (one project per session)
- Allow one session to span multiple projects (rare, complex)
- Project is a stronger isolation than solution; sessions become
  project-scoped

Lean: one project per session, with `projectId` injected via the
existing `templateName` mechanism.

### Live materialization (Phase 2 overlaps)

When the GUI updates an artifact mid-session, the agent's
workspace shouldn't see stale content next turn. Options:
- **Polling**: agent re-reads at each turn (cheap, eventually
  consistent, current default behavior since session-asset-
  materializer runs at session create)
- **Push via FUSE invalidation**: tell the agentfs daemon to
  invalidate the file in the mount cache so the next read returns
  fresh content
- **Per-read live lookup**: agent's file ops route through a thin
  adapter that hits live storage every time (kills agentfs's
  caching value)

Lean: polling + per-turn re-materialization for now (cheap, works);
graduate to FUSE invalidation if/when polling latency becomes a
user complaint.

## Cross-references

- `docs/PROJECT_PATTERN_CATALOG.md` — live-lesson's bespoke "before"
- `docs/gitbook/{zh,en}/platform/runtime-architecture.md` — runtime layer narrative
- `docs/gitbook/{zh,en}/reference/agent-runtime.md` — package API reference
- `packages/agent-runtime/README.md` — package quickstart
- `~/.claude/plans/...` — current execution plan
- `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md` — original workspace design (archive)
