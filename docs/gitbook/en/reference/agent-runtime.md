# `@kedge-agentic/agent-runtime` Package Reference

> Framework-free runtime for ccaas agentic services. Current version v0.3 (Phase 1).
> **2026-05 rename note**: this package was previously `@kedge-agentic/agentfs-runtime` (v0.1) when it contained only the workspace layer. The rename signals the broader scope: workspace + project + artifact + schema + sync.

## Phase status

| Phase | Sub-module | Status |
|---|---|---|
| A | `workspace/` — BaseMaterializer + ContentSource + Logger | ✅ shipped |
| 0 | `artifact/` — types + `JsonEditProvider` | ✅ shipped |
| 0 | `project/` `schema/` `sync/` — interface skeletons | ✅ shipped |
| **1** | **`artifact/ProjectArtifactSource` + `sync/SyncEngine` + `sync/InMemoryChangeStream` + `sync/SnapshotStore`** | **✅ shipped (this version)** |
| **1 (backend)** | **`SessionAssetSyncer` + `RestProjectArtifactSource` + `/projects/:id/{changes,invalidate}` REST + `bindToProject` hook** | **✅ shipped (packages/backend)** |
| 2 | Redis-backed ChangeStream (cross-process); BinaryArtifactSource; MarkdownArtifactEditor | ⏳ later |
| 3 | live-lesson full migration onto the new abstractions | ⏳ last |

Full design rationale: `docs/AGENT_RUNTIME_DESIGN.md`.

## Import paths

Root re-exports the full surface:

```ts
import {
  // workspace
  BaseMaterializer, ContentSource, Logger, noopLogger,
  // artifact
  JsonEditProvider, Artifact, ArtifactEditor, EditOperation, EditResult,
  // project
  Project, ProjectStore,
  // schema
  SchemaValidator, SchemaRegistry,
  // sync
  ChangeStream, ChangeEvent,
} from '@kedge-agentic/agent-runtime';
```

Sub-path imports (requires `moduleResolution: node16 | nodenext | bundler` in tsconfig):

```ts
import { BaseMaterializer } from '@kedge-agentic/agent-runtime/workspace';
import { JsonEditProvider } from '@kedge-agentic/agent-runtime/artifact';
import type { Project } from '@kedge-agentic/agent-runtime/project';
```

`testing/` exposes `InMemoryContentSource` separately for test use.

## `workspace/`

```ts
interface ContentSource {
  listActiveSkills(): Promise<ReadonlyArray<SkillContent>>;
  listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>>;
}

class BaseMaterializer {
  constructor(source: ContentSource, baseDir: string, logger?: Logger);
  getBaseDir(): string;
  materialize(): Promise<MaterializeResult>;
}
```

Projects skills + MCP servers from a `ContentSource` (a port you implement against your storage) to a host directory for agentfs's `--base` overlay. See [Runtime Architecture](../platform/runtime-architecture.md) § 4.1.

ccaas backend's TypeORM adapter: `packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts`.

## `artifact/`

**Phase 0 shipped: `JsonEditProvider`** — concrete implementation for editing JSON artifacts.

```ts
interface Artifact<TContent = unknown> {
  id: string;
  projectId: string;
  path: string;                      // relative path within the project
  type: 'markdown' | 'json' | 'binary' | string;
  content: TContent;
  attributes: Readonly<Record<string, unknown>>;
  schemaId?: string;                  // triggers SchemaRegistry validation
  updatedAt: string;
}

type EditOperation =
  | { op: 'field_set'; path: string; value: unknown }            // JSON Pointer
  | { op: 'json_patch'; ops: ReadonlyArray<unknown> }             // RFC 6902
  | { op: 'str_replace'; old_string: string; new_string: string } // for markdown editor
  | { op: 'replace'; content: unknown };

interface ArtifactEditor<TContent = unknown> {
  serialize(artifact: Artifact<TContent>): string;
  edit(artifact: Artifact<TContent>, ops: ReadonlyArray<EditOperation>): Promise<EditResult<TContent>>;
}
```

### JsonEditProvider usage

```ts
import { JsonEditProvider } from '@kedge-agentic/agent-runtime';
import { z } from 'zod';

const ManifestSchema = z.object({ /* ... */ });
const validator = {
  validate: (v: unknown) => {
    const r = ManifestSchema.safeParse(v);
    return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.message };
  },
};

const editor = new JsonEditProvider({ validator });

const result = await editor.edit(artifact, [
  { op: 'field_set', path: '/lessons/0/title', value: 'Updated title' },
  { op: 'json_patch', ops: [{ op: 'remove', path: '/draft' }] },
]);

if (result.success) {
  await artifactStore.save(result.artifact!);
} else {
  console.error('edit failed:', result.error);
  // input is NOT mutated — atomicity guarantee
}
```

**Supported ops**:
- `field_set` — RFC 6901 JSON Pointer; missing intermediate objects are auto-created
- `json_patch` — RFC 6902 add / remove / replace subset
- `replace` — wholesale content replace

**Not supported**: `str_replace` (that's the markdown editor's job); `copy` / `move` / `test` (added when needed)

**Schema validation**: optional `validator` constructor arg. Validation runs *after* all ops apply; on failure returns `success: false` and **the input artifact is untouched** (atomicity).

### Future editors (Phase 1)

- `MarkdownArtifactEditor` — wraps `@kedge-agentic/context-layer`'s `DocumentEditProvider` so markdown artifacts use the same unified interface
- `BinaryEditor` — wholesale binary blob replacement, backed by an object-storage adapter

## `project/` (Phase 0 interface skeleton)

```ts
interface Project {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  attributes: Readonly<Record<string, unknown>>;  // solution-specific extras
  createdAt: string;
  updatedAt: string;
}

interface ProjectStore {
  load(projectId: string): Promise<Project | null>;
  list(tenantId: string, opts?: ProjectListOptions): Promise<ReadonlyArray<Project>>;
  save(project: Project): Promise<void>;
  delete(projectId: string): Promise<void>;
}
```

**Phase 0 has interfaces only, no impls**. Phase 1 will ship a TypeORM-based impl for the ccaas backend; solutions can write their own.

Primary driving case: live-lesson's `CourseProject` is currently bespoke; see [Project Pattern Catalog](../../../docs/PROJECT_PATTERN_CATALOG.md).

## `schema/` (Phase 0 interface skeleton)

```ts
interface SchemaValidator<T = unknown> {
  validate(value: unknown): { ok: true; value: T } | { ok: false; error: string };
}

interface SchemaRegistry {
  register(schemaId: string, validator: SchemaValidator): void;
  get(schemaId: string): SchemaValidator | undefined;
  validate(schemaId: string, value: unknown): ValidationResult;
}
```

Schema-library agnostic — Zod, JSON Schema, TypeBox, any of them can be wrapped as a `SchemaValidator` adapter.

Phase 1 will ship a Zod adapter.

## Phase 1 — bidirectional sync (pull-based)

**Headline**: solutions write their DB however they want (TypeORM, raw SQL, batch jobs); the runtime auto-projects changes into the agent's workspace `artifacts/` dir at every turn boundary, and propagates the agent's fs edits back to the DB. **No solution code changes** — only a ~30-line interface impl or 3 REST endpoints.

### Design center: `ProjectArtifactSource`

```ts
import type { ProjectArtifactSource, ArtifactSnapshot } from '@kedge-agentic/agent-runtime';

export interface ArtifactSnapshot {
  readonly path: string;       // workspace-relative, e.g. 'lesson-plan.md'
  readonly content: string;
  readonly type: string;       // 'md' | 'json' | solution-defined
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface ProjectArtifactSource {
  loadArtifacts(projectId: string): Promise<ReadonlyArray<ArtifactSnapshot>>;
  saveArtifact(projectId: string, artifact: ArtifactSnapshot): Promise<void>;
  deleteArtifact?(projectId: string, path: string): Promise<void>;
}
```

Solution implements this interface; runtime owns everything else: snapshot diff, conflict resolution, agent-workspace write-through, change broadcast.

### Conflict resolution (locked)

Per-path truth table:

| dbChanged | fsChanged | Resolution |
|---|---|---|
| no | no | no-op |
| yes | no | DB content → write into fs (gui edit) |
| no | yes | read fs → saveArtifact to DB (agent edit) |
| yes | yes | **AGENT WINS**: persist agent's version to DB; emit `conflict_agent_wins` ChangeEvent with the discarded DB version so the GUI can warn the user |

No timestamps, no clock comparisons. Correctness follows from the turn-bounded snapshot-diff invariant.

### `SyncEngine.plan()` — pure logic

```ts
import { SyncEngine, type SyncPlan, type FsDelta } from '@kedge-agentic/agent-runtime';

const plan: SyncPlan = new SyncEngine().plan({
  sessionId, dbNow, fsDelta, previousSnapshot, now: new Date().toISOString(),
  hasher: (s) => createHash('sha256').update(s).digest('hex'),
});
// plan.actions: SyncAction[] — write_fs / delete_fs / save_db / delete_db / conflict_agent_wins
// plan.nextSnapshot: SnapshotEntry[] — what the SnapshotStore should commit after apply
```

Pure function, no I/O — exhaustively unit-testable against the 4-case conflict matrix.

### `InMemoryChangeStream`

The single-process default `ChangeStream` impl. Per-projectId fanout + microtask scheduling (a throwing listener doesn't break siblings; unsubscribe-during-dispatch is safe). Phase 2 will swap to Redis for multi-process deployments.

### `SnapshotStore`

```ts
interface SnapshotStore {
  list(sessionId: string): Promise<ReadonlyArray<SnapshotEntry>>;
  put(entry: SnapshotEntry): Promise<void>;
  remove(sessionId: string, path: string): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
```

Runtime ships `InMemorySnapshotStore` for tests; backend provides a TypeORM-backed impl over `SessionArtifactSnapshot` entity, storing `(sessionId, path) → sha256(content)` rows at ~64 bytes each. After a process restart the syncer's diff invariant remains intact.

## Backend wiring (packages/backend-private, documented here for the flow)

### `SessionAssetSyncer` (orchestrator)

`@OnEvent('session.turn.complete')` — hooked on `CliProcessService`'s cli-exit boundary. Per turn:

1. Look up bound projectId from `session_metadata['projectId']` (no binding → no-op).
2. Parallel-fetch `(source.loadArtifacts, /fs/diff, snapshotStore.list)`.
3. `SyncEngine.plan()` produces the action list.
4. Apply: writes through the mount (Spike 0 verified host fs.writeFile through FUSE is safe in the idle window), calls source.saveArtifact, deletes on either side.
5. Replace snapshot.
6. Publish ChangeEvents.

`@OnEvent('session.bound')` — fires when `SessionService.bindToProject()` is called, runs the same `sync()`. Empty snapshot ⇒ every DB-side artifact bootstraps into the workspace before the agent's first turn.

### `RestProjectArtifactSource` (cross-process adapter)

For solutions running as a **separate process** from ccaas (e.g., live-lesson on :3007, ccaas on :3001). Solution exposes 3 REST endpoints:

```
GET  {base}/projects/:projectId/artifacts
     → [{ path, content, type, attributes? }]

PUT  {base}/projects/:projectId/artifacts?path=<encoded>
     body { content, type, attributes? }   # upsert
     response (JSON, optional but recommended): { path: <canonical>, ... }
     ↑ If the solution normalizes path server-side (posix.normalize, case-fold, leading-slash strip, etc),
       it MUST return the canonical path in the response. Otherwise the runtime snapshot records the
       SENT path; the next loadArtifacts returns the canonical path; the engine treats them as separate
       files and plans a spurious delete_fs against the old sent-path entry (Phase 1 review M1).

DELETE {base}/projects/:projectId/artifacts?path=<encoded>
     # idempotent — 404 treated as already-deleted
```

**Solution registration (v0.3.2+)**: the baseUrl is no longer an env var. It's stored on `tenant.config.artifactUrl` — same field family as `webhookUrl` and `customSystemPrompt`. Two ways to set it:

### Path A: solution.json + auto-discovery (recommended, zero-key in dev)

Each solution ships a `solution.json` in its source tree:

```jsonc
{
  "schemaVersion": "3.0",
  "tenant": { "name": "Live Lesson", "slug": "live-lesson" },
  "artifactUrl": "http://localhost:3007/api",
  "skills": ["./skills/*"]
}
```

Backend `.env`:

```bash
SOLUTIONS_DIR=./solutions/business
```

At startup, `SolutionLoaderService.onModuleInit` walks `SOLUTIONS_DIR/*/solution.json` and calls `tenants.update()` to write `artifactUrl` into `tenant.config`. Zero curl, zero admin key, zero env var for the URL.

### Path B: REST registration (prod / runtime updates)

```bash
# 1. Grab the admin key (auto-printed at first boot, or POST /auth/login)
# 2. Create or find the tenant
# 3. Write artifactUrl to its config
curl -X PUT $CCAAS/api/v1/tenants/$ID \
  -H "x-api-key: $K" \
  -d '{"config":{"artifactUrl":"https://prod.example.com/api"}}'
```

`PUT /tenants/:id` is a partial merge — other config keys (`webhookUrl` etc.) are preserved.

### Runtime updates take effect without a restart

`tenants.update()` emits a `tenant.config.changed` event when the update payload carried a `config` field; `ProjectArtifactSourceRegistry` subscribes and evicts the cached source for that slug. The next sync turn re-reads `tenant.config.artifactUrl` from the fresh DB row — no backend restart.

### REST endpoints (consumed by GUI)

```
GET   /projects/:projectId/changes    # SSE feed of ChangeEvents
POST  /projects/:projectId/invalidate # request early sync (optional optimization)
```

Note: these endpoints sit at the **bare namespace** (no `/api/v1/` prefix), unlike the `sessions` controller. Source: `packages/backend/src/sessions/agent-runtime/project-changes.controller.ts:@Controller('projects/:projectId')`.

### Authentication (Phase 2b-2)

Both endpoints require a `?token=<apiKey>` query param:

```
GET   /projects/:projectId/changes?token=ccaas_xxxx
POST  /projects/:projectId/invalidate?token=ccaas_xxxx
```

Why a query param and not an `Authorization` header? Because the browser's `EventSource` doesn't support custom headers — a W3C spec constraint, not a ccaas implementation choice.

Verification chain:

1. `ApiKeyService.validateKey(token)` resolves the caller's tenant.
2. `ProjectTenantResolver.verifyProjectAccess(projectId, callerTenantId)` returns true iff the caller owns the project.
3. False → 403; missing or invalid token → 401.

**`ProjectTenantResolver` port**: solutions can register their own resolver (e.g. querying their own project table) under the `PROJECT_TENANT_RESOLVER` DI token. If none is registered, agent-runtime falls back to `DenyAllProjectTenantResolver` — every request 403s.

**ccaas default resolver (`SessionMetadataProjectTenantResolver`)**: a deviation from the original 2b-2 design. ccaas doesn't require every solution to ship a resolver. It reuses the `(tenantId, projectId)` row that `bind-project` already writes into `session_metadata` — a single indexed SQLite lookup, zero solution-side work.

- ✅ Pro: solutions don't need a `tenantId` column, a new REST endpoint, or a cross-process callback.
- ⚠️ Trade-off: **projects that have never been bind-project'd resolve to false → 403.** Callers must bind a session before subscribing to SSE. This matches `poc-smoke.sh`'s flow and is the canonical pattern.

To override, register your resolver against `PROJECT_TENANT_RESOLVER` in your SessionsModule providers.

**Security caveat**: query-param tokens leak into access logs / proxy logs. Acceptable for single-tenant dev and trusted-network prod. For true multi-tenant prod, a short-lived exchange token (e.g. `POST /sessions/exchange` for a one-time SSE token) is the right hardening — Phase 3, not in scope here.

### Binary artifacts (Phase 2b-4)

Text artifacts go through `ProjectArtifactSource` (content is `string`); images, audio, PDFs go through a separate `BinaryArtifactSource` (content is `Buffer | Uint8Array`). **Two ports are independent** — text-only solutions don't implement the binary port and vice versa.

Why separate?

- Content type differs (`string` vs `Buffer`) — mixing them in one port would complicate every consumer's type story.
- REST transport differs — text is `application/json` (content inlined); binary is `application/octet-stream` (streaming via `node:stream/pipeline`, never buffered).
- Filesystem mount differs — text under `<workspace>/artifacts/`, binary under `<workspace>/artifacts-binary/`. **This split is a security boundary**: the agent's `Read` / `cat` tool only walks the text directory, so a JPEG can never be slurped into context.

ccaas-side registration: a solution sets `tenant.config.binaryArtifactUrl` (a separate field from `artifactUrl`). `ProjectBinaryArtifactSourceRegistry` mirrors the text registry — lazy load + `tenant.config.changed` invalidation. Optional `tenant.config.binaryMaxBytes` pins a per-tenant size cap.

Solution-side REST contract:

```
GET    {base}/projects/:projectId/binary-artifacts
     # 200: [{ path, type, sizeBytes, contentHash?, attributes? }]
     # Metadata only — no bytes; full-read every turn would be too expensive.
     # If contentHash is included, runtime uses it directly against the snapshot;
     # otherwise runtime fetches and hashes once via the endpoint below.

GET    {base}/projects/:projectId/binary-artifacts?path=<encoded>
     # 200 application/octet-stream + Content-Length + X-Artifact-Type
     # Streamed download; ccaas consumes via stream.pipeline and aborts before
     # draining the body if Content-Length exceeds maxBytes.

PUT    {base}/projects/:projectId/binary-artifacts?path=<encoded>&type=<encoded>
     # body: application/octet-stream
     # 200 (idempotent); may return JSON { path } for path canonicalization
     # (same convention as text — Phase 2b-1).

DELETE {base}/projects/:projectId/binary-artifacts?path=<encoded>
     # 200 (idempotent; 404 treated as already-deleted)
```

**Sync behavior**:

- Same conflict matrix as text: agent write → `save_db_binary`; GUI write → `write_fs_binary_from_listing` (fetch on demand); dual write → agent wins + `conflict_agent_wins_binary` event.
- Same `SnapshotStore`; binary entries carry the `artifacts-binary/` prefix so paths can't collide with text.
- Same `ChangeStream`; binary events carry `actor: 'binary'` (or `actor: 'binary-conflict-agent-wins'`); event `path` is binary-mount-relative (no prefix) so GUI consumers can route to the binary fetch endpoint.
- Same per-`projectId` mutex — text and binary halves run serially per project, no race.

**Not yet (Phase 2c or later)**:

- No in-tree solution implements the binary REST endpoints yet. The runtime side is complete and unit-tested; end-to-end will be exercised when a real binary use case appears.
- Explicit agent-tool deny rules for `artifacts-binary/*` (e.g. blocking `Read` on the path). Today the directory split + naming convention is the entire enforcement; an explicit deny is a hardening item.
- True streaming uploads (current PUT wraps the buffer in a Blob). Switch to a streaming wrapper when uploads exceed ~100MB.

### Solution integration — 2 lines

> **β-1 rename (2026-05-26)**: the canonical route is now `attach-workspace-source` with the opaque body `{ sourceUrl, sourceIdentity, tenantId }` (no `projectId` — ccaas no longer pretends to know what a "project" is). The old `bind-project` route stays as an alias for one release and hits the same service code. New solutions: use the new route. Existing solutions: migrate at your convenience during the compat window.

```ts
// Solution backend: right after creating a workspace-attached agent session
await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/attach-workspace-source`, {
  method: 'POST',
  body: JSON.stringify({
    sourceUrl: 'http://your-solution/api/projects',  // base URL ccaas calls back
    sourceIdentity: projectId,                        // opaque ID, ccaas does not parse
    tenantId,                                         // transitional during β
  }),
});

// Or keep using the legacy alias during the compat window:
await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/bind-project`, {
  method: 'POST', body: JSON.stringify({ projectId, tenantId }),
});
```

`SessionService.bindToProject(sessionId, tenantId, sourceIdentity)` writes metadata + emits `session.bound` → triggers bootstrap → agent's first turn sees the current DB state. (The service method will be renamed to `attachWorkspaceSource` in β-2; β-1 changes the wire route + DTO only.)

### GUI side: consume the SSE so users see agent edits (Phase 2a)

The backend `/projects/:projectId/changes` SSE emits every ChangeEvent. A frontend subscriber renders banners in real time when the agent touches a file the user is editing.

**Critical design rule**: the browser **never holds a ccaas key.** ccaas knows tenants, not end users — each solution backend is one tenant and holds the one ccaas key. End users belong to the solution, not to ccaas. They authenticate to the solution backend (using whatever the solution's own auth is — cookie session, JWT, anything) and the solution backend mediates every ccaas call.

Concretely for SSE:

```
[browser]
  → GET /api/projects/:id/changes              # relative path; hits solution backend
[solution backend (live-lesson :3007)]
  → verifies the browser user (solution's own auth)
  → verifies the user can access this project
  → opens upstream EventSource:
      GET ${CCAAS_URL}/projects/:id/changes?token=${CCAAS_API_KEY}
[ccaas (:3001)]
  → ProjectAccessGuard verifies token + tenant owns the project
  → SSE stream
```

The solution-side proxy implementation lives at `solutions/business/live-lesson/backend/src/adapters/http/ccaas-proxy.controller.ts`. Env vars:
- `CCAAS_URL` (default `http://localhost:3001`) — the base URL for ccaas
- `CCAAS_API_KEY` (required) — the solution tenant's ccaas API key

Browser-side reference impl: `solutions/business/live-lesson/creator/src/hooks/useProjectChanges.ts` — a React hook that uses `EventSource` to subscribe to the relative path, filters out heartbeat / subscribed / own-gui writes, and returns agent-side events to the UI:

```tsx
import { useProjectChanges } from './hooks/useProjectChanges';

function ProjectEditorPage({ projectId }) {
  // Zero ccaas key on the browser. The hook fetches
  // /api/projects/:id/changes, proxied by the solution backend.
  const { events, isConnected, error } = useProjectChanges(projectId);
  // `events` contains only source==='agent' changes, including
  // actor==='conflict-agent-wins' (when an agent edit overrode a GUI edit).
  return <ProjectChangeNotice events={events} ... />;
}
```

`ProjectChangeNotice` color-codes by actor / kind (red = conflict-agent-wins, yellow = updated, orange = deleted) and offers [Reload]/[Dismiss] buttons. Reload never runs automatically — the user must click it explicitly to avoid losing unsaved edits.

URL routing: the creator app uses relative `/api/projects/...` paths. In dev, the Vite `/api/*` proxy routes to the solution backend on :3007; the solution backend then proxies to ccaas on :3001. In production, a reverse proxy (nginx / Caddy / etc.) does the same routing.

## Legacy `sync/` (Phase 0 interface skeleton, still present)

```ts
interface ChangeEvent {
  projectId: string;
  path: string;
  source: 'agent' | 'gui' | 'system';
  kind: 'created' | 'updated' | 'deleted';
  at: string;
  actor?: string;
}

interface ChangeStream {
  subscribe(projectId: string, listener: (ev: ChangeEvent) => void): () => void;
  publish(event: ChangeEvent): void;
}
```

Phase 1's `InMemoryChangeStream` implements the above. Phase 2's Redis-backed variant swaps the impl without touching the interface.

## `testing/`

```ts
import { InMemoryContentSource } from '@kedge-agentic/agent-runtime/testing';

const src = new InMemoryContentSource([
  { id: 's1', tenantId: 't1', slug: 'hello', name: 'Hello', content: '# H', files: [] },
]);
const m = new BaseMaterializer(src, '/tmp/test-base');
await m.materialize();
```

For downstream adapter unit tests.

## See also

- Full design intent: `docs/AGENT_RUNTIME_DESIGN.md`
- live-lesson's current bespoke implementation: `docs/PROJECT_PATTERN_CATALOG.md`
- Use the workspace abstraction in your own solution: [Solution Runtime Extension Points](../guide/extending-runtime.md)
- Source: `packages/agent-runtime/`
