# @kedge-agentic/agent-runtime

Framework-free runtime for ccaas agentic services. Zero dependencies
on NestJS, TypeORM, or Express — just `node:fs` / `node:crypto` /
`node:path` and pure TypeScript.

## Phase status

| Phase | Sub-module | Status |
|---|---|---|
| A | `workspace/` — BaseMaterializer + ContentSource + Logger | ✅ shipped |
| 0 | `artifact/` — types + `JsonEditProvider` | ✅ shipped |
| 0 | `project/` `schema/` `sync/` — interface skeletons | ✅ shipped |
| **1** | **pull-based bidirectional sync — `WorkspaceArtifactSource` port + `SyncEngine` (pure) + `InMemoryChangeStream` + `SnapshotStore`. Backend ships `SessionAssetSyncer` orchestrator hooked at agent turn boundaries.** | ✅ **shipped (this version)** |
| **1.5** | solution-keyed routing (later recanted into Phase 1.6 — see below) | ⚠️ superseded |
| **1.6** | **`solution.json` + auto-discovery: solutions declare `artifactUrl` in their config file; `SolutionLoaderService.onModuleInit` walks `SOLUTIONS_DIR/*/solution.json` and writes through to `solution.config.artifactUrl`. Registry caches per slug + invalidates via `solution.config.changed` event. Runtime updates via `PUT /solutions/:id` take effect on next sync without restart.** | ✅ **shipped** |
| **2b-1** | **Path normalization round-trip — `SaveArtifactResult.canonicalPath` so solutions can return their normalized path; snapshot + change events use the canonical form to avoid silent delete-then-recreate when the solution path-normalizes server-side.** | ✅ **shipped** |
| **2b-2** | **SSE auth (ccaas-side wiring): `?token=<apiKey>` on `/workspaces/:id/changes` + `/invalidate`; `WorkspaceAccessResolver` port (default `DenyAll`); ccaas ships `SessionMetadataWorkspaceResolver` using the attach-workspace-source `session_metadata` row for sourceIdentity→solution resolution.** | ✅ **shipped** |
| **2b-4** | **`BinaryArtifactSource` port + sync engine binary actions (`SyncEngine.planBinary`) + REST adapter (`RestBinaryArtifactSource`, octet-stream streaming, size-cap enforced pre-buffer) + syncer materialization into `artifacts-binary/` (sibling of `artifacts/`, isolated from agent `Read`).** | ✅ **shipped** |
| 2 (rest) | Redis-backed `ChangeStream` (cross-process fanout); `MarkdownArtifactEditor`; Zod schema adapter | ⏳ next |
| 3 | live-lesson full migration onto the new abstractions | ⏳ last |

## Import paths

The full package surface is re-exported from the root:

```ts
import {
  BaseMaterializer, JsonEditProvider,
  // types
  ContentSource, Artifact, ArtifactEditor, EditOperation, EditResult,
  Project, ProjectStore,
  SchemaValidator, SchemaRegistry,
  ChangeStream, ChangeEvent,
} from '@kedge-agentic/agent-runtime';
```

Sub-module imports work if your `tsconfig.json` uses
`moduleResolution: node16 | nodenext | bundler`:

```ts
import { BaseMaterializer } from '@kedge-agentic/agent-runtime/workspace';
import { JsonEditProvider } from '@kedge-agentic/agent-runtime/artifact';
```

Sub-paths exposed: `/workspace`, `/project`, `/artifact`, `/schema`,
`/sync`, `/testing`.

## Sub-modules

### `workspace/`

Pure projection of skills + MCP servers from a `ContentSource` (a
port the consumer implements against their storage) to a directory
tree that the agentfs binary overlays into each session mount.

```ts
import { BaseMaterializer, ContentSource } from '@kedge-agentic/agent-runtime';

class MyContentSource implements ContentSource {
  async listActiveSkills() { /* ... */ }
  async listActiveMcpServers() { /* ... */ }
}

const m = new BaseMaterializer(new MyContentSource(), '/path/to/_agentfs_base');
const r = await m.materialize();
// → { baseDir, skillsWritten, skillFilesWritten, mcpServersWritten, durationMs }
```

See `src/workspace/` for full surface. ccaas backend's TypeORM
adapter is at `packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts`.

### `artifact/`

Typed artifacts (markdown / json / binary / custom) with pluggable
editors. Phase 0 ships **JsonEditProvider** (`field_set`,
`json_patch` add/remove/replace, `replace`, optional schema
validation).

```ts
import { JsonEditProvider, Artifact, SchemaValidator } from '@kedge-agentic/agent-runtime';

const validator: SchemaValidator = { validate: (v) => /* ... */ };
const editor = new JsonEditProvider({ validator });

const result = await editor.edit(artifact, [
  { op: 'field_set', path: '/title', value: 'New' },
  { op: 'json_patch', ops: [{ op: 'remove', path: '/draft' }] },
]);
if (result.success) {
  console.log(result.artifact);  // the new Artifact (input not mutated)
} else {
  console.error(result.error);
}
```

`MarkdownArtifactEditor` (wrapping `DocumentEditProvider` from
`@kedge-agentic/context-layer`) lands in Phase 1. `BinaryEditor`
(replace-only blob storage) also Phase 1.

### `project/`

Interface skeleton for the project container (Phase 0 — no impls
yet). Driving use case is live-lesson's `CourseProject` + `ProjectFile`
pattern.

```ts
import type { Project, ProjectStore } from '@kedge-agentic/agent-runtime';

class TypeOrmProjectStore implements ProjectStore { /* Phase 1 */ }
```

### `schema/`

Interface skeleton for a schema registry (Zod-friendly but
schema-library-agnostic). Phase 1 will ship a Zod adapter +
JSON Schema adapter.

```ts
import type { SchemaValidator, SchemaRegistry } from '@kedge-agentic/agent-runtime';
import { z } from 'zod';

const ManifestSchema = z.object({ /* ... */ });
const validator: SchemaValidator = {
  validate: (v) => {
    const r = ManifestSchema.safeParse(v);
    return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.message };
  },
};
```

### `sync/` — Phase 1 shipped

The bidirectional sync engine. Pure, framework-free, exhaustively
unit-tested.

```ts
import {
  InMemoryChangeStream,
  InMemorySnapshotStore,
  SyncEngine,
  type WorkspaceArtifactSource,
  type ArtifactSnapshot,
} from '@kedge-agentic/agent-runtime';

// 1. Solution implements this one interface (~30 lines wrapping
//    whatever storage they like — TypeORM, raw SQL, REST API):
class MySource implements WorkspaceArtifactSource {
  async loadArtifacts(projectId: string): Promise<ReadonlyArray<ArtifactSnapshot>> {
    /* ... query DB, return [{ path, content, type }] */ return [];
  }
  async saveArtifact(projectId: string, a: ArtifactSnapshot): Promise<void> {
    /* ... upsert into your store */
  }
}

// 2. At each agent turn boundary the orchestrator calls SyncEngine.plan
//    to resolve the 4-case conflict matrix per path:
const plan = new SyncEngine().plan({
  sessionId, dbNow, fsDelta, previousSnapshot,
  now: new Date().toISOString(),
  hasher: (s) => createHash('sha256').update(s).digest('hex'),
  allowDelete: typeof source.deleteArtifact === 'function',
});
// plan.actions: SyncAction[] (write_fs | delete_fs | save_db | delete_db | conflict_agent_wins)
// plan.nextSnapshot: SnapshotEntry[] — commit after applying actions
```

Conflict semantics (locked): **agent wins on dual writes**. Provable
from the turn-bounded snapshot-diff invariant. No timestamps, no
clock comparisons.

Phase 2 will swap `InMemoryChangeStream` for a Redis-backed impl
without touching the `ChangeStream` interface.

### `testing/`

`InMemoryContentSource` for tests that need a `ContentSource` fake.

```ts
import { InMemoryContentSource } from '@kedge-agentic/agent-runtime/testing';

const src = new InMemoryContentSource([{ id, solutionId, slug, content, files: [] }]);
const m = new BaseMaterializer(src, '/tmp/test-base');
await m.materialize();
```

## Why this exists

ccaas solutions like live-lesson have re-derived the same Project +
ProjectFile + Schema pattern from scratch. This package's goal is to
extract those into reusable abstractions so the next solution
(lesson-plan-designer, course-builder, etc.) doesn't re-derive them
poorly.

Design rationale + the live-lesson case study driving the
abstractions: `docs/AGENT_RUNTIME_DESIGN.md`.

## See also

- Design doc: `docs/AGENT_RUNTIME_DESIGN.md` (full Path C vision)
- Pattern catalog: `docs/PROJECT_PATTERN_CATALOG.md` (live-lesson's bespoke pattern, the "before" snapshot)
- Workspace integration spec: `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md` (archive; original design)
- Gitbook reference page: `docs/gitbook/{zh,en}/reference/agent-runtime.md`
