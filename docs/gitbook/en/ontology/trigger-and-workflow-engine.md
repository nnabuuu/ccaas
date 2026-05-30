# Trigger + Workflow Engine

> Phase 5 introduced a Palantir-Carbon-style **declarative trigger layer**: declare TriggerDef + ActionDef, and the platform's WorkflowEngine dispatches the Action automatically on events / state changes / object-set changes.

## TriggerDef — three trigger kinds

```typescript
type TriggerDef =
  | { kind: 'event';        watch: { stream } }
  | { kind: 'state-change'; watch: { state; equals?; transitionsTo? } }
  | { kind: 'object-set-change'; watch: { objectSet; on: 'added'|'removed'|'any' } };
```

Every TriggerDef has:

- `apiName` / `manifest` / `semantic` — declaration attributes
- `watch` — what to watch (stream name / state path / ObjectSet name)
- `when?` — optional pure-function predicate (O(1) filter; no accessor build inside)
- `then.action: ActionRef` — which ActionDef to dispatch on hit
- `then.args: (input) => Record<string, unknown>` — pure mapper from input → action params
- `then.as?` — defaults to `'agent'` role; can be `'admin'`
- `cascadeBudget?` / `priority?` — optional per-trigger cascade ceiling / dispatch priority

### event kind

Most common. When a stream receives a payload and the predicate passes, the action fires.

```typescript
const CHAT_TURN_TRIGGER: TriggerDef = {
  apiName: 'on_chat_turn_classify_indicators',
  manifest: 'LessonSession',
  semantic: 'On chat_turn arrival, LLM-classify against indicators.',
  kind: 'event',
  watch: { stream: 'events' },
  when: (input) => (input.event?.payload as any)?.type === 'chat_turn',
  then: {
    action: 'workflow-actions-chat-turn.classify_chat_turn_indicators',
    args: (input) => ({
      entityId: (input.event!.payload as any).studentId,
      student: (input.event!.payload as any).student,
      ai: (input.event!.payload as any).ai,
      triggerEventId: input.cascade.correlationId,
    }),
    as: 'admin',
  },
};
```

### state-change kind

Fires when a manifest state field is written. Optional `equals` / `transitionsTo` narrows it further.

### object-set-change kind (Phase 4)

Fires when an ObjectSetDef's filter result changes (added / removed / any). Phase 4 shipped ObjectSetDef + SetFilter but no consumer uses this trigger kind yet; the schema is reserved and the engine warn-skips at bootstrap.

## WorkflowEngine dispatch pipeline

`WorkflowEngineService` registers triggers at `onApplicationBootstrap` (via the `@WorkflowTrigger(def)` decorator OR `engine.registerTrigger(def)` programmatic API), then accepts events through two entry points:

1. **HTTP ingest** (`POST /api/v1/workflow/sessions/:id/events`) — cross-process entry
2. **In-process cascade** (`engine.cascadeEvent(...)`) — downstream events from inside an action handler

Both entries run the same dispatch pipeline:

```
input event
  ↓
WorkflowRegistry.lookup(manifest, {kind, stream/state/objectSet})
  ↓
for each matching trigger:
  ↓ predicate(input) — fail → metrics inc + skip
  ↓ then.args(input) — compute action params
  ↓ getAccessorFor({sessionId, solutionId, manifest, role}) — build boundary-bound ManifestAccessor
  ↓ accessor.invokeAction(action, args) — through Phase 3 bridge → ToolCallerProxy → boundary check → audit
  ↓ writes observation row / publishes stream events / triggers cascade
```

## Cascade — chained dispatch from one event

ChatTurnService writes `indicator_hit` and then calls `engine.cascadeEvent(...)` to feed the event back into the engine. StatusChangeTrigger hits → re-derives student_status → fires student_alerts. The diagram below is the actual M4 chain end-to-end:

```
   External HTTP ingest               Or in-process originator
   POST /workflow/.../events
            │
            ▼
   ┌─────────────────────────────┐
   │ engine.ingestEvent          │  ◀── withRootCascade(stream)
   │   depth = 0                 │      mints a fresh correlationId
   │   payload.type = chat_turn  │
   └────────────┬────────────────┘
                │
                ▼  WorkflowRegistry.lookup(manifest, kind=event, stream=events)
                │  per-session FIFO enqueueDispatch
                ▼
   ┌─────────────────────────────┐
   │ ChatTurnTrigger             │
   │   when(input) → true        │
   └────────────┬────────────────┘
                │ predicate hits
                ▼
   ┌─────────────────────────────┐
   │ classify_chat_turn_         │  ◀── through the Phase 3 bridge:
   │ indicators Action  (LLM)    │      ToolCallerProxy + boundary + audit
   │   ├─ writes indicator_hit   │
   │   └─ engine.cascadeEvent ───┼─┐
   └─────────────────────────────┘ │ withChildCascade
                                   │   depth = 1
                                   │   correlationId preserved
                                   ▼
                          ┌──────────────────────────────┐
                          │ StatusChangeTrigger          │
                          │  when payload.type ===       │
                          │    student_observation_      │
                          │    changed                   │
                          └────────────┬─────────────────┘
                                       │ predicate hits
                                       ▼
                          ┌──────────────────────────────┐
                          │ derive_student_status        │
                          │ Action  (LLM or heuristic)   │
                          │   ├─ writes student_status   │
                          │   └─ accessor.publish        │  ◀── student_alerts
                          │      (subscribers only,       │      is a terminal
                          │       does NOT re-enter)      │      stream
                          └──────────────────────────────┘
```

### Cascade depth + ceiling

| Frame | How it's entered | depth |
|---|---|---|
| Root | `engine.ingestEvent` (HTTP) or `engine.cascadeEvent` (in-process root) | 0 |
| Child | `engine.cascadeEvent` from inside an action handler | parent + 1 |
| Drop | `depth >= cascadeBudget ?? maxCascadeDepth` (default 5) | trigger dropped + `cascade_depth_exceeded` counter |

Depth tracking uses Node's `AsyncLocalStorage` via `cascade-context.ts` (`withChildCascade` / `withRootCascade`); the `correlationId` is preserved across the entire cascade for trace stitching.

### The crucial gotcha: `cascadeEvent` vs `accessor.publish`

| Call | What it triggers | When to use |
|---|---|---|
| `engine.cascadeEvent(...)` | Re-enters the engine (fires matching event-kind triggers) AND publishes to subscribers | An action handler emitting a downstream event that needs to fire follow-on triggers |
| `accessor.publish(...)` | ONLY fans out to subscribers; does NOT re-enter the engine | Sending a stream event to frontend SSE / debug console / terminal events (like `student_alerts`) that no trigger needs to react to |

**M4 pass-1 MF1 was exactly this trap:** ChatTurnService originally used `accessor.publish` to emit `student_observation_changed`, so StatusChangeTrigger never fired — and there was no visible failure because `accessor.publish` still delivered to subscribers. The fix routes through `cascadeEvent` so `withChildCascade` preserves depth tracking. If your downstream event needs trigger reactions, you MUST use `cascadeEvent`.

## Per-session FIFO queue + backpressure

Each sessionId owns a tail-promise queue, guaranteeing same-session triggers run in order (so two cascades cannot race on the same student_status row). Different sessions run concurrently.

Capacity `maxQueuePerSession = 100`; overflow uses `drop_oldest` (matching the stream's declared `backpressure`) and increments the `events_dropped_queue_full` counter.

## Registering triggers

Two ways:

**Decorator (recommended for services with one ActionDef)**:

```typescript
@Injectable()
@WorkflowTrigger(CHAT_TURN_TRIGGER)
export class ChatTurnService implements OnApplicationBootstrap { ... }
```

`WorkflowEngineService.discoverDecoratorTriggers()` scans all `@Injectable()` providers' metadata at bootstrap.

**Programmatic (recommended for services with multiple triggers)**:

```typescript
async onApplicationBootstrap() {
  this.engine.registerTrigger(CHAT_TURN_TRIGGER);
  this.engine.registerTrigger(STATUS_CHANGE_TRIGGER);
}
```

Reference: the 5 services under [`packages/backend/src/workflow/handlers/`](../../../../packages/backend/src/workflow/handlers/) each register their own triggers.

## Failure modes + observability

`WorkflowMetricsService` counters (process-lifetime):

| Counter | Meaning |
|---|---|
| `triggers_fired` | total dispatched triggers |
| `triggers_predicate_rejected` | predicate returned false or threw |
| `triggers_action_failed` | action invoke failed (boundary / validation / handler error) |
| `triggers_action_not_found` | action missing from ToolCallerRegistry (usually a namespace config gap) |
| `cascade_depth_exceeded` | cascade depth >= ceiling → trigger dropped |
| `events_dropped_queue_full` | per-session queue full → drop_oldest |
| `events_dropped_duplicate` | HTTP ingest dedup hit |

## Source map

| File | Responsibility |
|---|---|
| `workflow-engine.service.ts` | main dispatcher; event/state-change routing; cascade; queue |
| `workflow-registry.ts` | trigger index map; lookup by (manifest, kind, watchKey) |
| `cascade-context.ts` | AsyncLocalStorage wrapper; `withChildCascade` / `withRootCascade` |
| `workflow-metrics.service.ts` | counters + test-helper reset |
| `event-ingest/event-ingest.controller.ts` | `POST /workflow/sessions/:id/events` |
| `indicator-ingest/indicator-ingest.controller.ts` | `PUT /workflow/sessions/:id/indicators` |
| `session-lifecycle/session-lifecycle.controller.ts` | `DELETE /workflow/sessions/:id` (M6 pass-2) |
| `handlers/` | 6 handler services (lifecycle / exercise / progress / chat-turn / status-change / dashboard projector) |
