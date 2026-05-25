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
├── project/      — Project container (id, tenant, status, attributes)
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
| `project/` | Define what a Project IS (tenant-owned container of artifacts with title/status/attributes) | TypeORM ProjectStore (Phase 1) |
| `artifact/` | Define what an Artifact IS + how it can be edited | JsonEditProvider (Phase 0 — shipped); MarkdownArtifactEditor wraps DocumentEditProvider (Phase 1); BinaryEditor for blobs (Phase 1) |
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
| binary content squeezed into `content` TEXT column | `BinaryEditor` + blob storage adapter |

Live-lesson migration is **Phase 3** — last, after all the
abstractions stabilize from Phase 0/1/2. The pattern catalog
(`docs/PROJECT_PATTERN_CATALOG.md`) tracks the delta.

## Phase rollout

| Phase | Scope | Effort | Status |
|---|---|---|---|
| A (was v0.1) | `workspace/` only | ~1 week | ✅ shipped |
| 0 (v0.2) | rename to `agent-runtime`; sub-module skeletons (types only) for project/artifact/schema/sync; ship `JsonEditProvider` | ~4 days | ✅ shipped |
| **1 (v0.3)** | **`ProjectArtifactSource` port + `SyncEngine` (pure) + `InMemoryChangeStream` + `SnapshotStore`; backend `SessionAssetSyncer` orchestrator at turn boundaries; `bindToProject` + session-bound bootstrap; `RestProjectArtifactSource` adapter for cross-process solutions; `/projects/:id/{changes,invalidate}` REST; live-lesson `/artifacts` endpoint contract** | ~1.5 weeks | ✅ **shipped** |
| **1.5** | env-CSV tenant routing (`SOLUTION_ARTIFACT_URLS=slug:url,...`) | — | ⚠️ **superseded by 1.6** |
| **1.6** | **declarative registration via `solution.json` + auto-discovery: `artifactUrl` field on solution.json + Tenant.config (existing JSON blob); `SolutionLoaderService.onModuleInit` walks `SOLUTIONS_DIR/<slug>/solution.json` with Zod validation; `TenantsService.{create,update}` emit `tenant.config.changed` events; `ProjectArtifactSourceRegistry` reads tenant.config lazily, caches per slug, evicts on event. Zero env vars for URL routing. Dev workflow becomes zero-key.** | ~3 hours | ✅ **shipped** |
| 2 | Redis-backed `ChangeStream` (cross-instance fanout); `BinaryArtifactSource` + blob storage; `MarkdownArtifactEditor` wrapping `DocumentEditProvider`; Zod schema adapter; conflict markers in GUI | ~1-2 weeks | next |
| 3 | live-lesson full migration onto new abstractions (drop bespoke project entity if applicable); pattern catalog deltas; first non-live-lesson consumer | ~2-3 weeks | last |

Total: ~1.5–2 months end-to-end. Phases A, 0, 1, 1.6 = ~3 weeks shipped.

### Phase 1 — what's deliberately not in scope (Phase 2+ backlog)

* Redis-backed cross-process `ChangeStream` (single-instance only today)
* Per-field projection (1 entity → N files via column-mapping) — Phase 1 is strictly 1 row = 1 file via `ProjectArtifactSource`. Solutions compose multiple rows internally.
* Binary blob projection
* `MarkdownArtifactEditor` (Phase 0's `JsonEditProvider` already covers JSON artifacts)
* Zod entity hooks on live-lesson's `ProjectFile` for schema enforcement at the entity boundary
* Frontend SSE consumer of `/projects/:id/changes`

## Open design questions (still unresolved)

These get resolved in their respective phases — flagging them here
so future contributors don't think the answers exist yet:

### Conflict resolution (Phase 2 owns this)

When agent and GUI both edit the same artifact mid-session, what
happens? Options:
- **Last-write-wins** with a UI warning ("the agent updated this
  file 3 seconds ago; reload?")
- **Optimistic concurrency** with a version field on Artifact;
  edits fail loudly when version is stale
- **CRDT-style merge** (overkill for our domain; nope)
- **Per-artifact lock** held briefly during agent's edit window

Current lean: optimistic concurrency. But this needs real
multi-user testing in Phase 2.

### Blob storage (Phase 1 owns this)

Where do binary attachments live?
- Solution-backend filesystem (works locally, doesn't scale)
- S3-compatible object store (the "right" answer for cloud)
- agentfs delta (current live-lesson hack — TEXT column with
  base64; doesn't scale)

Lean toward an `ArtifactStore` port that supports both `text` (for
markdown/JSON) and `binary` (Buffer/stream) content, with
adapter-decided storage. The interface might need a `getBinaryUrl()`
for the GUI to fetch large attachments directly.

### Session-project binding (Phase 1 owns this)

Today a ccaas session has a `tenantId` but no `projectId`. Several
options for adding it:
- Add `projectId` to `ManagedSession` (one project per session)
- Allow one session to span multiple projects (rare, complex)
- Project is a stronger isolation than tenant; sessions become
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
