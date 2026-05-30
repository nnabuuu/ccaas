# Cross-Process Events

> Solution backends (separate NestJS processes) push events to the platform's WorkflowEngine over HTTP. `@kedge-agentic/workflow-client` + an outbox + retry + dedup make the channel reliable.

## Why cross-process

The Solution backend (e.g. live-lesson :3007) and the platform backend (:3001) run in different processes. Pre-Phase-5 each Solution ran its own local observer-engine; post-Phase-5 the engine consolidates to the platform side. `@kedge-agentic/workflow-client` is the stable HTTP interface between the two.

## `@kedge-agentic/workflow-client` — framework-free client

```typescript
import { WorkflowClient } from '@kedge-agentic/workflow-client';

const client = new WorkflowClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.CCAAS_API_KEY!,
  timeoutMs: 5000,
  // onBehalfOfSolutionId: ...,  // optional, for multi-tenant admin keys
});

// 1. Push an event (M2 onwards)
await client.pushEvent('sess-123', {
  eventId: randomUUID(),                  // for dedup
  manifestName: 'LessonSession',
  streamApiName: 'events',
  entityId: 'student-abc',
  payload: { type: 'student_joined', studentId: 'student-abc', classroomCode: 'HX3KM7' },
});

// 2. PUT indicators (M5.3a onwards)
await client.setIndicators('sess-123', [
  { id: 'K1', type: 'knowledge', label: '...', description: '...' },
]);

// 3. GET dashboard (M5.3b onwards; M5.2a switched to getDashboard returning DashboardPayload)
const outcome = await client.getDashboard('sess-123');

// 4. DELETE session (M6 pass-1/2 onwards)
await client.clearSession('sess-123');
```

Zero NestJS, zero TypeORM, only `globalThis.fetch` (Node 18+). Solutions wrap it however they like.

## Returns outcomes (never throws)

Every `WorkflowClient.*` method returns a discriminated-union outcome:

```typescript
type WorkflowPushOutcome =
  | { status: 'accepted'; eventId }                        // platform accepted, trigger fires async
  | { status: 'duplicate'; eventId }                       // same eventId seen before; idempotent
  | { status: 'disabled'; eventId }                        // WORKFLOW_INGEST=disabled
  | { status: 'failed'; httpStatus?; error; retryable };   // upstream 4xx/5xx/network
```

The caller handles each arm (`accepted` / `duplicate` / `disabled` → mark delivered; `failed` retryable → backoff + retry; `failed` terminal → poison the row).

## Outbox + Drain Worker pattern (recommended)

Events cannot be pushed synchronously on the request thread — a brief platform outage would drop them. Live-lesson uses the classic transactional outbox pattern: atomically write the event row to a local `ontology_event_outbox` table, and a separate drain worker periodically picks up the pending rows, calls `WorkflowClient.pushEvent`, and advances row state based on the outcome.

### Row state machine

```
   Application service
   (e.g. ClassroomService.join)
            │
            │ workflowDispatch.pushEvent({eventId, payload, ...})
            │ outbox.enqueue(row)
            ▼
   ┌──────────────────────┐
   │  pending             │ ◀── freshly inserted; nextAttemptAtEpoch = now
   │  attempts = 0        │
   └──────────┬───────────┘
              │ drain tick (default every 2s)
              │ findPendingDue(now, batch=50)
              ▼
   ┌──────────────────────┐
   │  in-flight           │ ◀── drain is calling client.pushEvent
   └──┬───────┬───────┬───┘
      │       │       │
      │       │       │ outcome.status =
      │       │       │   'failed' & retryable=false
      │       │       │   OR attempts ≥ POISON_AFTER (8)
      │       │       └──────────────────────┐
      │       │                              │
      │       │ outcome.status =             │
      │       │   'failed' & retryable=true  │
      │       │   & attempts < POISON_AFTER  │
      │       │                              │
      │       │ markRetry:                   │
      │       │   attempts++                 │
      │       │   nextAttemptAtEpoch =       │
      │       │     now + backoff_sec(N)     │
      │       │                              │
      │       ▼                              │
      │ ┌──────────────────────┐             │
      │ │  retry (= pending +  │             │
      │ │   future due time)   │             │
      │ │  attempts = N        │             │
      │ └──────────┬───────────┘             │
      │            │  ↺ when now >= nextAttemptAtEpoch │
      │            │  drain re-picks via findPendingDue
      │            ▼                              │
      │  (back to in-flight)                      │
      │                                            │
      │ outcome.status ∈                           ▼
      │   {accepted, duplicate, disabled}    ┌────────────┐
      │ markDelivered                       │  poisoned   │
      ▼                                      │  (terminal; │
   ┌──────────────────────┐                  │ ops review) │
   │  delivered           │                  └────────────┘
   │  (terminal)          │
   └──────────────────────┘
```

### Backoff progression

| Nth failure | Wait seconds `min(2^(2N-1), 600)` | Approximate when |
|---|---|---|
| 1 | 2s | immediate retry |
| 2 | 8s | by ~10s in |
| 3 | 32s | by ~42s in |
| 4 | 128s | ~3 minutes |
| 5 | 512s | ~12 minutes |
| 6–7 | 600s (capped) | ~22 / ~32 minutes |
| 8 | — | **poison** (give up after ~10+ minutes) |

A poisoned row never gets re-fetched by drain; ops review `lastError` and decide whether to replay or drop.

### Re-entrancy + ordering guarantees

- **Re-entrancy guard:** when a drain tick is in flight, the next setInterval firing is skipped (the `tickInFlight` flag). Prevents setInterval-overlap and same-row races.
- **Ordering:** within a drain tick the rows are processed sequentially (one row's push completes before the next begins). Same-session events come out in createdAt-ASC order, so an upstream event always reaches the platform before its cascade downstream.
- **eventId dedup:** caller supplies the eventId (typically a UUID); pushing the same eventId twice returns `dropped: 'duplicate'` from the platform and the outbox marks delivered. Mid-restart races cannot double-fire triggers.

### Key files

- `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-dispatch.service.ts` — application-layer enqueue API
- `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-outbox.repository.ts` — TypeORM persistence + row state transitions
- `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-outbox-drain.service.ts` — drain worker + outcome → state routing
- Env: `LIVE_LESSON_WORKFLOW_DISPATCH=disabled` turns the outbox off entirely; `LIVE_LESSON_WORKFLOW_DRAIN_INTERVAL_MS` tunes the tick interval

## Platform ingest endpoint: POST `/api/v1/workflow/sessions/:sessionId/events`

```
POST /api/v1/workflow/sessions/:sessionId/events
Authorization: Bearer <chat-scope key>
Content-Type: application/json

{
  "eventId": "evt_018b1d3a-...",          // required; dedup key
  "manifestName": "LessonSession",
  "streamApiName": "events",
  "entityId": "student-abc",
  "payload": { ... },                     // must match stream.payloadSchema (Zod)
  "correlationId": "..."                  // optional; cross-process trace id
}

→ 202 Accepted ({accepted: true, eventId})
→ 200 OK ({accepted: false, dropped: 'duplicate', eventId})
→ 202 ({accepted: false, dropped: 'disabled', eventId})  if WORKFLOW_INGEST != enabled
→ 400 validation failure (manifest/stream/payload schema)
```

Controller pipeline:

1. `@Auth('chat')` + `@TenantId()` (no tenant → throw)
2. Validate manifest + stream + payload schema (Zod)
3. Dedup: `observerEvents.hasEvent(eventId)` pre-check; concurrent race recovers via the unique-constraint catch
4. Persist `observer_events` row (**before** engine.ingestEvent — mid-crash recovery via dedup replay)
5. When `WORKFLOW_INGEST=enabled`, fire-and-forget `engine.ingestEvent(...)`

## Auth + tenant model

- `@Auth('chat')` — chat-scope API key
- `@TenantId()` — resolves the key's tenant UUID; populates `event.solutionId`
- Solution config: `CCAAS_API_KEY` + `CCAAS_URL` in the Solution backend's env

Recommended pattern: mint a per-Solution chat-scope key via `scripts/create-dev-api-key.ts <slug>`. Don't put an admin-scope key in a Solution env (admin keys can PUT/DELETE any tenant's data).

## Metrics

`WorkflowMetricsService` counters (see [Trigger + Workflow engine](trigger-and-workflow-engine.md) §failure modes). HTTP ingest exercises: `events_dropped_duplicate` / `triggers_fired` / `triggers_action_failed`.

## Endpoint overview

| Endpoint | Method | Purpose | Page |
|---|---|---|---|
| `/api/v1/workflow/sessions/:id/events` | POST | Event ingest | This page |
| `/api/v1/workflow/sessions/:id/indicators` | PUT | Indicator catalog | [Indicator catalog](indicator-catalog.md) |
| `/api/v1/workflow/sessions/:id` | DELETE | Session lifecycle | [Session lifecycle](session-lifecycle.md) |
| `/api/v1/workflow/sessions/:id/dashboard` | GET | Dashboard (new) | [Dashboard contract](dashboard-contract.md) |
| `/api/v1/ontology/schema` | GET | Ontology schema + ETag | (Phase 3) |
