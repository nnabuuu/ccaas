# @kedge-agentic/agent-runtime

Framework-free runtime for ccaas agentic services. Zero dependencies
on NestJS, TypeORM, or Express — just `node:fs` / `node:crypto` /
`node:path` and pure TypeScript.

> **Naming history**: this package was `@kedge-agentic/agentfs-runtime`
> (v0.1) in May 2026 when it contained only the workspace layer
> (BaseMaterializer). Renamed to `@kedge-agentic/agent-runtime` in
> v0.2 to reflect the broader scope: workspace + project + artifact
> + schema + sync. See `docs/AGENT_RUNTIME_DESIGN.md` for the full
> roadmap.

## Phase status

| Phase | Sub-module | Status |
|---|---|---|
| A | `workspace/` — BaseMaterializer + ContentSource + Logger | ✅ shipped (was the entirety of v0.1) |
| 0 | `artifact/` — types + `JsonEditProvider` | ✅ shipped (this version) |
| 0 | `project/` `schema/` `sync/` — interface skeletons | ✅ shipped (interfaces only; no impls yet) |
| 1 | concrete impls (TypeORM ProjectStore + ArtifactStore + Zod adapter + MarkdownEditor) | ⏳ next |
| 2 | ChangeStream impl (in-memory then Redis-backed) | ⏳ later |
| 3 | live-lesson migration onto the new abstractions | ⏳ last |

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

### `sync/`

Interface skeleton for bidirectional change streams (agent ↔ GUI).
Phase 2. In-memory pub/sub impl first, Redis-backed later.

### `testing/`

`InMemoryContentSource` for tests that need a `ContentSource` fake.

```ts
import { InMemoryContentSource } from '@kedge-agentic/agent-runtime/testing';

const src = new InMemoryContentSource([{ id, tenantId, slug, content, files: [] }]);
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
