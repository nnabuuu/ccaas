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

// 3. GET dashboard (M5.3b onwards)
const outcome = await client.getObservationDashboard('sess-123');

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

Events cannot be pushed synchronously on the request thread — a brief platform outage would drop them. Live-lesson uses this pattern:

```
Application service (e.g. ClassroomService.join)
  ↓ enqueue
WorkflowOutboxRepository (TypeORM table ontology_event_outbox)
  ↓ persisted
WorkflowOutboxDrainService (setInterval 2s)
  ↓ findPendingDue(now, 50)
  ↓ for each row:
       client.pushEvent → outcome
       handleOutcome:
         accepted/duplicate/disabled → markDelivered
         failed retryable + nextAttempts < POISON_AFTER → markRetry + exp backoff
         failed terminal OR > POISON_AFTER → markPoisoned
```

Reference:
- `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-outbox-drain.service.ts`
- `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-dispatch.service.ts`

Backoff schedule: attempt N fails → retry after `min(2^(2N-1), 600)` seconds; poison after 8 attempts (~10 minutes).

Re-entrancy guard: if a drain tick is in flight, the next interval skips (prevents setInterval overlap + multi-write on the same row).

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
| `/api/v1/workflow/sessions/:id/observation-dashboard` | GET | Dashboard (legacy) | [Dashboard contract](dashboard-contract.md) |
| `/api/v1/workflow/sessions/:id/dashboard` | GET | Dashboard (new) | [Dashboard contract](dashboard-contract.md) |
| `/api/v1/ontology/schema` | GET | Ontology schema + ETag | (Phase 3) |
