# Ontology & Workflow Overview

> KedgeAgentic's **ontology layer** + **kinetics layer** — a Palantir-Carbon-style declarative architecture that lets a Solution describe its business with typed objects, actions, and triggers instead of hand-rolled NestJS services.

## Two packages, two responsibilities

```
@kedge-agentic/ontology  (framework-free)        Ontology = data + relations + actions
  ├── ObjectTypeDef    (Lesson / Student / ...)
  ├── ActionDef        (emit_todo_card / record_observation / ...)
  ├── ManifestDef      (LessonSession = objects + state + event streams bound at session scope)
  ├── StreamDef        (events / student_alerts / ...)
  └── checkBoundary    (action access control: role / state / slot preconditions)

packages/backend/src/workflow/  (NestJS)         Workflow = triggers + engine + handlers
  ├── TriggerDef       (event / state-change / object-set-change — three trigger kinds)
  ├── WorkflowEngine   (cascade + per-session FIFO + backpressure)
  ├── handlers/        (LifecycleObservation / ChatTurn / StatusChange / ...)
  └── cross-process    (POST /api/v1/workflow/sessions/:id/events)
```

**Why two packages:** Ontology is the **type specification** a Solution author uses to describe business; it must be framework-free, cross-process, and serializable (schema endpoint + agent prompt projection). Workflow is the platform-side NestJS **execution runtime** that depends on DI, TypeORM, HTTP. Keeping ontology standalone lets Solutions share one type definition between browser, CLI, and Node CLI consumers.

## Why you'd read this section

| You are | You care about | Start here |
|---|---|---|
| Solution author | Modeling business with ObjectType + Action so Agents can call them | [Schema primitives](schema-primitives.md) → [Trigger + Workflow](trigger-and-workflow-engine.md) |
| Backend engineer | Cross-process events, cascade depth, teardown wiring | [Cross-process events](cross-process-events.md) → [Session lifecycle](session-lifecycle.md) |
| Frontend engineer | Teacher-dashboard wire shape; how observations project | [Dashboard contract](dashboard-contract.md) → [Observation pipeline](observation-pipeline.md) |
| Ops / SRE | schema endpoint, ingest endpoint, auth, tenant isolation | [Cross-process events](cross-process-events.md) §auth + [Session lifecycle](session-lifecycle.md) §tenant scoping |

## Design philosophy

**Palantir-Carbon pure:** the ontology package describes schema only (the 5 primitives: ObjectType / Manifest / Action / Stream / State). Concepts like Carbon / Workshop / Notification — i.e. the "kinetics / execution / notify" layer — are separate products in Palantir, and in KedgeAgentic they map to `packages/backend/src/workflow/`. This layering keeps the ontology package from being polluted by NestJS / TypeORM.

**Type + runtime consistency:** Solution authors write `defineObjectType(...)` and get TypeScript types; at boot `OntologyRegistry.seal()` does cross-def validation; at runtime `checkBoundary(...)` enforces access. The same Zod schema is serialized to JSON Schema at the schema endpoint for agent-prompt projection.

**Single-write, single-read:** before Phase 5 live-lesson ran observer-engine (local observation store) alongside the new workflow (cross-process push) — a dual-write transition. After Phase 5 M6 the workflow path is the only one: live-lesson pushes events, the platform writes the observation table, live-lesson HTTP-fetches the dashboard.

## Section map

| Page | Content |
|---|---|
| [Schema primitives](schema-primitives.md) | ObjectTypeDef / ActionDef / ManifestDef / StreamDef / StateDef + `defineXxx` helpers |
| [Trigger + Workflow engine](trigger-and-workflow-engine.md) | TriggerDef three kinds / WorkflowEngine dispatch / cascade / queue |
| [Observation pipeline](observation-pipeline.md) | `Observation` row type / 5 types (lifecycle / exercise / progress / indicator_hit / student_status) / observer-engine retirement timeline |
| [Indicator catalog](indicator-catalog.md) | IndicatorRegistry / PUT `/indicators` endpoint / M4 LLM cascade end-to-end |
| [Dashboard contract](dashboard-contract.md) | `DashboardPayload` (new) + `ObservationDashboardPayload` (legacy projector) + the two endpoints |
| [Cross-process events](cross-process-events.md) | `@kedge-agentic/workflow-client` / outbox / dedup / retry |
| [Session lifecycle](session-lifecycle.md) | PUT indicators / DELETE session / tenant scoping / engine queue |

## Implementation progress

Detailed phase / milestone / decision log lives in [`docs/ontology/PROGRESS.md`](../../../ontology/PROGRESS.md). Current status (2026-05):

- Phase 1 ✅ Ontology v0.1 (5 primitives + package tests + serialize/digest/projection)
- Phase 2 ✅ context-layer refactor (EntityRegistry → OntologyRegistry delegation)
- Phase 3 ✅ live-lesson integration + Action → Tool bridge
- Phase 4 🔵 Tier 2 primitives (ObjectSetDef shipped; InterfaceDef + BoundaryPredicate await real-world triggers)
- Phase 5 🔵 Workflow rewrite (M1–M6 done; M5 second-pass frontend rewrite remains in backlog)
