# `@kedge-agentic/agent-runtime` Package Reference

> Framework-free runtime for ccaas agentic services. Current version v0.2 (Phase 0).
> **2026-05 rename note**: this package was previously `@kedge-agentic/agentfs-runtime` (v0.1) when it contained only the workspace layer. The rename signals the broader scope: workspace + project + artifact + schema + sync.

## Phase status

| Phase | Sub-module | Status |
|---|---|---|
| A | `workspace/` — BaseMaterializer + ContentSource + Logger | ✅ shipped (was v0.1's entirety) |
| 0 | `artifact/` — types + `JsonEditProvider` | ✅ shipped (this version) |
| 0 | `project/` `schema/` `sync/` — interface skeletons | ✅ shipped (interfaces only, no impls) |
| 1 | TypeORM `ProjectStore` + `ArtifactStore`; Zod schema adapter; `MarkdownArtifactEditor` | ⏳ next |
| 2 | ChangeStream impl (in-memory → Redis) | ⏳ later |
| 3 | live-lesson migration onto the new abstractions | ⏳ last |

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

## `sync/` (Phase 0 interface skeleton)

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

Bidirectional update stream between agent and GUI. Phase 2 will ship an in-memory pub/sub first, Redis-backed later. Conflict-resolution strategy is **unresolved** (design doc lists candidates).

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
