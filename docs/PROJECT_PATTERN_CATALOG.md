# live-lesson's Project + Artifact pattern (catalog)

Snapshot, as of 2026-05-25, of how `solutions/business/live-lesson/`
implements the project + artifact + schema pattern **bespoke**. This
doc serves three purposes:

1. **Inform future solutions** considering the same shape — copy
   *deliberately* from a known reference rather than re-derive
2. **Track the abstraction delta** — when Phase 3 migrates
   live-lesson onto `@kedge-agentic/agent-runtime`, this catalog
   becomes the "before" against which the refactor's correctness is
   measured
3. **Highlight design decisions** worth questioning before extraction
   (e.g. "is `ProjectFile.content TEXT` really the right shape, or
   does it break under binary attachments?")

## The entities

### `CourseProject`

`solutions/business/live-lesson/backend/src/adapters/persistence/entities/course-project.entity.ts`

```ts
@Entity('course_projects')
class CourseProject {
  id: string;                                  // uuid PK
  title: string;
  description: string;                          // default ''
  status: 'draft' | 'published' | 'archived';  // default 'draft'
  files: ProjectFile[];                         // OneToMany
  createdAt: string;
  updatedAt: string;
}
```

Maps to **`Project`** in `agent-runtime/project/`. Live-lesson lacks
the `tenantId` field — added in the abstract `Project`. Live-lesson's
`status` union extends the abstract's `'active'` to `'published'`
(semantic difference: published = visible to students). The
abstract's `attributes: Record<string, unknown>` would absorb the
domain-specific extras.

### `ProjectFile`

`solutions/business/live-lesson/backend/src/adapters/persistence/entities/project-file.entity.ts`

```ts
@Entity('project_files')
@Unique(['projectId', 'path'])
class ProjectFile {
  id: string;                       // uuid PK
  projectId: string;                // FK → CourseProject
  path: string;                     // relative path within project
  content: string;                  // TEXT — content
  fileType: string;                 // 'json' default; loosely typed
  updatedAt: string;
}
```

Maps to **`Artifact`** in `agent-runtime/artifact/`. Live-lesson:
- `content` is TEXT only → fails for binary attachments. The
  abstract `Artifact<TContent>` is parameterized over content; the
  store decides the storage.
- `fileType` is a free-form string. The abstract restricts to a
  known enum (`'markdown' | 'json' | 'binary' | <custom string>`)
  but is permissive enough for solutions to extend.
- No `schemaId` field. Validation happens **inline in services**
  ad-hoc, with no contract between "this artifact type" and "this
  schema must match". The abstract makes the binding explicit via
  `Artifact.schemaId`.

### Schemas dir

`solutions/business/live-lesson/backend/src/schemas/`

Files (all Zod):
- `manifest.schema.ts` — the execution plan (lessons, exercises, …)
- `answer-key.schema.ts` — per-exercise scoring rules
- `board-data.schema.ts` — Socratic-discussion board state
- `exercise-spec.schema.ts` — per-exercise spec
- `grade-result.schema.ts` — grading output
- `observation.schema.ts` — teacher observation events

These are imported and `.safeParse()`'d **inline** in
controllers / services. There's no registry. Adding a new schema
means adding a new import everywhere it's checked. Maps to
**`SchemaRegistry`** in `agent-runtime/schema/` — Phase 1 will
provide a Zod adapter and live-lesson can register existing
schemas under stable ids.

## The controllers

### `ProjectController`

`solutions/business/live-lesson/backend/src/project/project.controller.ts`

Surface (paraphrased):

```
POST   /projects                          create project
GET    /projects                          list
GET    /projects/:id                      get project + (?) files inline
DELETE /projects/:id                      delete project + cascade files
GET    /projects/:id/files                list files
POST   /projects/:id/files                upsert single/batch
PUT    /projects/:id/files                bulk upsert
DELETE /projects/:id/files                delete (some? all?)
POST   /projects/:id/publish              status change to 'published'
```

Maps to a thin wrapper over `ProjectStore` + `ArtifactStore` in the
abstract. The publish action stays solution-specific (publish has
domain meaning, not a runtime concept).

### `LessonController` (public-facing)

`solutions/business/live-lesson/backend/src/adapters/http/lesson.controller.ts`

```
GET /lessons/:id              read-only public view of a project
GET /lessons/:id/manifest      project's manifest artifact
GET /lessons/:id/audio/:filename
GET /lessons/:id/resources/:filename
```

This is solution-specific (lessons-as-public-shape != projects-as-author-view).
Stays in live-lesson; doesn't need agent-runtime abstraction.

## Patterns worth keeping in the abstraction

✅ **`@Unique(['projectId', 'path'])`** — every artifact uniquely
identified by (project, path). The abstract should enforce this in
the `ArtifactStore` contract.

✅ **Soft status field on Project** (draft / active / archived /
custom). The abstract keeps this generic; solutions can extend.

✅ **Bulk file upsert endpoint** — many uses want to write 5+ files
in one round-trip. The abstract's `ArtifactStore.save` should
support batch.

✅ **Cascade delete on Project removal** — clean semantics. Should
be the default in any `ProjectStore` impl.

## Patterns worth challenging during extraction

⚠️ **`content` as TEXT column** — fails for binaries (audio, images,
PDFs). live-lesson works around it by base64-encoding or by storing
URLs and externalizing storage. The abstract should split into
`text` and `binary` artifact subtypes with adapter-decided storage.

⚠️ **`fileType` as free string** — leads to drift. live-lesson uses
`'json'`, `'manifest'`, `'audio'`, `'board'` — mostly redundant
with what the schema or content shape already says. The abstract's
constrained `ArtifactType` union catches typos.

⚠️ **No `schemaId` field on the artifact row** — validation happens
in service code ad-hoc; reviewer can't tell "what schema should
this match" without grepping callers. The abstract's
`Artifact.schemaId` (optional) closes the gap.

⚠️ **No `tenantId` on `CourseProject`** — live-lesson assumes
single-tenant; multi-tenant would need this added. The abstract
makes it required from day one.

⚠️ **No versioning** — re-saving silently clobbers prior content.
Optimistic concurrency or per-artifact history (Phase 2 / Phase 3
backlog item).

⚠️ **No bidirectional sync** — live-lesson agent reads files at
session start; if GUI updates a file mid-session, agent has stale
view. The abstract's `ChangeStream` exists for this (Phase 2).

## When the migration happens (Phase 3)

Plan-of-record will be:

1. Live-lesson keeps its `CourseProject` + `ProjectFile` entities
2. Implements `ProjectStore` + `ArtifactStore` interfaces from
   `@kedge-agentic/agent-runtime` against its existing tables
3. Refactors `ProjectController` to use the abstract's ports
   internally (REST surface stays the same — no breaking change for
   the live-lesson frontend)
4. Registers schemas in a shared `SchemaRegistry`
5. Adopts `MarkdownArtifactEditor` for the lesson-plan markdown
   artifacts; `JsonEditProvider` for manifest JSON; figures out a
   `BinaryEditor` story for audio/images
6. Begins emitting `ChangeStream` events; GUI subscribes; per-turn
   re-materialization picks up GUI edits

When this is done, this catalog gets a "migrated" note at the top
and serves as historical context for why each abstraction looks the
way it does.

## See also

- Design doc: `docs/AGENT_RUNTIME_DESIGN.md`
- Package: `packages/agent-runtime/`
- Live-lesson source: `solutions/business/live-lesson/backend/`
