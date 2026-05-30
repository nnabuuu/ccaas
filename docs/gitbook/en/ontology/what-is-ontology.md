# What is an Ontology

> Before diving into ObjectTypeDef, ActionDef and the rest, understand **what an ontology is, what problem it solves, and when a Solution would adopt one**. This page explains the concept with minimal code.

## In one sentence

**An ontology = a single typed description that answers all four questions about your business at once: what objects exist, how they relate, what you can do to them, and who's allowed to do what.**

It's not a database schema (the DB answers only the first two questions), and it's not API documentation (an API answers only the third). An ontology binds these four together as the single source of truth.

## Palantir-style design motivation

KedgeAgentic's ontology design borrows from **Palantir Foundry's Ontology Object Model**. In enterprise BI Palantir observed:

- The same "customer" concept is `Customer` to the business team, `Account` in the sales system, `Contact` in CRM — each system has its own schema, its own API, its own permission rules.
- Cross-system business processes force engineers to hand-roll joins + translations + permission checks repeatedly.
- AI / Agents made it worse: an agent needs to know what entities exist, what actions it can take, what preconditions apply — but that information is spread across DB schemas + REST docs + service code.

Palantir's answer: **describe the world first (the Ontology), then build everything on top of it.** Object Type once, Action once, Boundary once; BI reports, data apps, and AI agents all consume the same definition.

KedgeAgentic inherits the same "describe first, execute later" philosophy and implements it in TypeScript + Zod's type system.

## The 4 questions an ontology answers

| Question | The primitive that answers it | Example |
|---|---|---|
| **What objects exist?** | `ObjectTypeDef` | Lesson, Student, Resource, ClassroomSession |
| **How do objects connect?** | `LinkDef` (Phase 4) + `ManifestDef.slots` | A LessonSession binds 1 Lesson + 1 ClassroomSession + N Students at session scope |
| **What can I do with them?** | `ActionDef` | `emit_todo_card`, `record_lifecycle_observation`, `classify_chat_turn_indicators` |
| **Who's allowed to do what?** | `AccessBoundary` + `checkBoundary` | Agent can read `currentStep` only; admin can read/write everything |

`ManifestDef` ties these four together into a session-scoped runtime unit ("what objects + state + event streams exist in this session, and who can touch what"); `StreamDef` describes the in-session event bus entries that external events ingest into.

## Without an ontology vs. with one

### Without: traditional NestJS Solution

The "student submits exercise, notify the teacher" flow typically looks like:

```typescript
// student.controller.ts
@Post('/students/:id/submit')
async submit(@Param('id') studentId, @Body() data, @Req() req) {
  if (req.user.role !== 'student') throw new ForbiddenException();
  const result = await this.gradingService.grade(data);
  await this.submissionRepo.insert({...});
  await this.notifyService.notifyTeacher({...});   // notify hard-coded here
  return { ok: true, score: result.total };
}
```

Problems:
- An Agent asking "is there an action I can call? What are the params? Who's allowed?" has to read OpenAPI / Swagger, then dig into the service to find the role check.
- Changing the notification logic touches the controller, the service, possibly a hook.
- Every controller writes its "who can do what" check differently → permission rules drift.
- No "declarative event → reaction" — adding a rule like "3 cumulative misconceptions → alert" forces hand-rolled polling or listeners.

### With: declarative ontology

```typescript
// 1. Declare the ObjectType once
const StudentType = defineObjectType({ apiName: 'Student', schema: ..., displayName: 'Student' });

// 2. Declare the Action once (role + params + sideEffects + audit level)
const SubmitAction = defineAction({
  apiName: 'submit_exercise',
  params: z.object({ studentId: z.string(), data: z.unknown() }),
  allowedRoles: ['student'],
  sideEffects: ['observation:append', 'emits:student_submitted'],
  auditLevel: 'log',
});

// 3. Declare the Trigger once (event → reaction)
const NOTIFY_TEACHER_ON_SUBMIT: TriggerDef = {
  kind: 'event',
  watch: { stream: 'events' },
  when: (input) => input.event?.payload.type === 'student_submitted',
  then: {
    action: 'notify_teacher',
    args: (input) => ({ studentId: input.event.payload.studentId, ... }),
    as: 'admin',
  },
};
```

Wins:
- The agent fetches `GET /api/v1/ontology/schema` and gets the full ActionDef catalog + params + allowedRoles. No OpenAPI grep, no source reading.
- Boundary checks run automatically (`checkBoundary`) — every controller behaves consistently.
- Notification logic is an independent TriggerDef + ActionDef, fully decoupled from submission. Changing the notify doesn't touch submit.
- Adding a new rule ("3 misconceptions → alert") = adding one TriggerDef. No loops, no polling.
- Cross-process works too: the Solution backend declares ObjectType types once; browser, CLI, Node all reuse the same definitions.

## What kind of Solution is this for?

**Good fit:**
- The business has a clear "entities + actions" model (teacher / student / lesson / submission; doctor / patient / diagnosis; customer / order / refund …)
- AI Agents need to discover callable actions (instead of hard-coding a handful of tools)
- Business rules contain many "event → reaction" chains (post-submit grading, status-change notifications, threshold-based alerts)
- Multiple ends / processes share the same type definitions (frontend + backend + Agent)
- You want a long-lived, stable permission model (no per-controller role-check drift)

**Not a fit:**
- Single-file prototypes / toy Solutions where one file holds everything
- Solutions that are "call LLM, parse reply" with almost no domain objects
- One-off scripts and demos

KedgeAgentic designs Ontology + Workflow as **opt-in** — the platform's core capabilities (Skill, MCP, Agent Engine, Workspace, Session) all work without it. Solutions that adopt it (like live-lesson) get declarative + type-safe + agent-introspectable behavior as a bonus.

## Relationship to the Workflow layer

The ontology **describes the world**: what objects, what actions, what boundary.

The workflow **enforces the rules**: it watches TriggerDefs, dispatches ActionDefs on hits, manages cascade, tenant isolation, and cross-process ingest.

The two layers are deliberately separated (see [Overview](README.md) §design philosophy):
- The ontology package is framework-free; same types reused in browser, CLI, Node CLI.
- The workflow package is the NestJS implementation; depends on DI / TypeORM / HTTP.

When writing a Solution you use both APIs but at different levels: ontology is how you **describe** the business, workflow is how the platform **executes** what you described.

## Next steps

After understanding the concept:

1. **Want to write code:** [Schema primitives](schema-primitives.md) — full API of the 5 primitives + Zod schema + `defineXxx` helpers
2. **Want to see how Triggers dispatch:** [Trigger + Workflow engine](trigger-and-workflow-engine.md)
3. **Want a complete example:** `packages/backend/src/ontology/live-lesson/` — live-lesson's 4 ObjectTypes + 1 Manifest + 1 ActionDef end-to-end
4. **Want phase progress:** [`docs/ontology/PROGRESS.md`](../../../ontology/PROGRESS.md)
