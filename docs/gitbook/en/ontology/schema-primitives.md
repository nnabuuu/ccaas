# Schema Primitives

> The 5 description primitives `@kedge-agentic/ontology` exports + their `defineXxx` helpers. Solutions describe business using these.

## ObjectTypeDef — your domain entities

`ObjectType` is the most basic type in the ontology: lesson, student, resource, submission. Each ObjectType carries a schema, display metadata, and an optional `implements` field (Phase 4+).

```typescript
import { defineObjectType } from '@kedge-agentic/ontology';
import { z } from 'zod';

export const LessonObjectType = defineObjectType({
  apiName: 'Lesson',
  displayName: '课程 / Lesson',
  semantic: 'A lesson\'s metadata: title, learning goals, sequence of step tasks.',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    subject: z.string(),
    gradeLevel: z.string(),
  }),
});
```

Reference: [`packages/backend/src/ontology/live-lesson/object-types.ts`](../../../../packages/backend/src/ontology/live-lesson/object-types.ts) — live-lesson's 4 complete ObjectType examples.

## ActionDef — what Agents and Workflow triggers can invoke

`ActionDef` is the unified action unit Agents call through ToolCaller AND Workflow Triggers fire. Each Action declares a params schema, `allowedRoles`, `sideEffects`, and optional `preconditions`.

```typescript
import { defineAction } from '@kedge-agentic/ontology';
import { z } from 'zod';

export const EmitTodoCardAction = defineAction({
  apiName: 'emit_todo_card',
  displayName: 'Emit TODO Card',
  semantic: 'creator agent emits a TODO card rendered into the chat stream.',
  params: z.object({
    threadId: z.string(),
    items: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
  allowedRoles: ['agent'],          // agent can call; admin / picker cannot
  sideEffects: ['emits:todo_card'], // documented side-effect catalog
  auditLevel: 'log',
});
```

**Phase 3 bridge:** the platform compiles ActionDef into a `ToolDefinition` via `compileActionToToolDefinition(action, handler, manifest)`, mounts it on `ToolCallerProxy`, and Agent calls + Workflow Engine dispatches go through the exact same audit + boundary check pipeline.

## ManifestDef — session-scoped binding of ObjectTypes + state + streams

A `Manifest` binds several ObjectTypes to session scope. It declares: which ObjectTypes exist in the session, what state fields (K/V in-memory + DB-persisted) the session has, what event streams it carries, and which boundary (which role can read/write which state paths) applies.

```typescript
import { defineManifest } from '@kedge-agentic/ontology';

export const LessonSessionManifest = defineManifest({
  name: 'LessonSession',
  semantic: 'Runtime context of one lesson run: lesson + classroom session + students + resources.',
  slots: [
    { apiName: 'lesson', target: { kind: 'objectType', apiName: 'Lesson' } },
    { apiName: 'session', target: { kind: 'objectType', apiName: 'ClassroomSession' } },
    { apiName: 'students', target: { kind: 'objectType', apiName: 'Student' }, collection: true },
  ],
  state: [
    { apiName: 'currentStep', initial: 0 /* number */ },
    { apiName: 'indicators', initial: [] /* IndicatorDef[] */ },
  ],
  streams: [
    { apiName: 'events', payloadSchema: EventPayloadSchema },
    { apiName: 'student_alerts', payloadSchema: AlertPayloadSchema },
  ],
  boundaries: {
    agent: {
      readable: ['currentStep'],
      writable: [],
      subscribable: ['events'],
    },
    admin: { readable: ['*'], writable: ['*'], subscribable: ['*'] },
  },
});
```

Full example: [`packages/backend/src/ontology/live-lesson/lesson-session.manifest.ts`](../../../../packages/backend/src/ontology/live-lesson/lesson-session.manifest.ts).

## StreamDef + StateDef — event streams + persistent state

`StreamDef` defines an in-session event bus entry (pushed via `ManifestAccessor.publish` + triggers event-kind Triggers). `StateDef` defines an in-session K/V field. Phase 5 M2-M5 introduced 6 event types — `student_joined / student_submitted / step_completed / discuss_complete / chat_turn / student_observation_changed` — all sharing the `LessonSession.events` stream and distinguished by a discriminated-union payload schema.

## checkBoundary — the access-control primitive

`checkBoundary({manifest, role, op})` is a pure function. Given the manifest, the caller's role, the operation (read/write/subscribe/invokeAction), and an optional state/slot snapshot, it returns `{allowed, reason?}`. Both Workflow Engine and ToolCallerProxy use the same checkBoundary to enforce access.

```typescript
const decision = checkBoundary({
  manifest: LessonSessionManifest,
  role: 'agent',
  op: { kind: 'write', path: 'currentStep' },
  state: { currentStep: 3 /* optional snapshot for state-equals preconditions */ },
});
if (!decision.allowed) throw new Error(decision.reason);
```

## defineXxx helpers

| Helper | Purpose |
|---|---|
| `defineObjectType(...)` | Typed passthrough; catches schema-field-name typos at compile time |
| `defineAction(...)` | Same, plus meta-key validation |
| `defineManifest(...)` | Same, plus slot/state/stream/boundary name validation |
| `defineStream(...)` | Same |
| `defineState(...)` | Same |

These helpers **deliberately fail to compile** on Tier 2 / Phase 4 fields like `implements` and `derivedFrom` — so Tier 2 semantics cannot silently leak into Tier 1 code.

## Serialization + projection

`serializeRegistry(registry)` serializes the entire Registry to JSON Schema (Zod → zod-to-json-schema), stably sorted, with a sha256 digest, served at `GET /api/v1/ontology/schema`. `projectManifest(manifest, role, format)` projects a manifest into agent-prompt-friendly formats: `anthropic-tools` / `mcp-tools` / `system-prompt`, so an Agent prompt directly knows which Actions are callable, what params they take, and what their boundary is.

See: [`packages/ontology/src/distribution/`](../../../../packages/ontology/src/distribution/) + [`packages/ontology/src/semantic/`](../../../../packages/ontology/src/semantic/).
