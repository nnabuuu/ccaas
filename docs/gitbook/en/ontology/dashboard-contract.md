# Dashboard Contract

> One dashboard endpoint, one wire shape. Pre-M5.2a the page documented two endpoints coexisting (legacy projector + new ontology-native); M5.2a deleted the legacy projector. This page describes the current `/dashboard` endpoint's `DashboardPayload` and the Solution-side adapter live-lesson uses until the M5.2b frontend rewrite lands.

## Current endpoint

| Endpoint | Method | Shape |
|---|---|---|
| `GET /api/v1/workflow/sessions/:id/dashboard` | GET | `DashboardPayload` (student-centric) |

Reads from the same `observations` table + the same `IndicatorRegistry`, tenant-isolated by `(solutionId, sessionId)`.

> **History:** M3 shipped the legacy `/observation-dashboard` endpoint + `ObservationDashboardProjector` emitting `{logs, alerts, indicatorStats, indicators}`. M5.2 added the new `/dashboard` endpoint. M5.2a deleted the legacy; live-lesson's frontend still consumes the 4-array shape, derived locally by `DashboardPayloadAdapter` (deleted in M5.2b).

## Solution-side adapter (transitional, M5.2a → M5.2b)

live-lesson's `WorkflowDashboardFetchService` fetches the new endpoint, then routes through `DashboardPayloadAdapter`:

```typescript
client.getDashboard(sessionId)
  → outcome.payload (unknown)
  → parseDashboardPayload(payload)  → DashboardPayload | null
  → adaptDashboardPayload(payload)  → { logs, alerts, indicatorStats, indicators }
  → returned to the frontend via /api/classroom/:code/state
```

The adapter (`solutions/business/live-lesson/backend/src/adapters/workflow-outbox/dashboard-payload-adapter.ts`) does four things:

1. **Derives `logs[]`** — flattens `students[].observations[]` into legacy `StudentLog.events[]`, rendering the Chinese gist per type
2. **Derives `alerts[]`** — filters students whose `status.current ∈ {stuck, struggling, idle}` into single Alert rows
3. **Groups `indicatorStats[]`** — aggregates all `indicator_hit` rows by anchor
4. **Filters `indicators[]`** — narrows the platform's open `type: string` to the `'knowledge' | 'misconception'` union (defensive against future schema evolution)

**Gist rendering table** (lifted from the deleted `ObservationQueryService` — restores the synthesis lost when M6.3 deleted that service):

| obs.type | data.action | Template |
|---|---|---|
| `lifecycle` | `join` | `${studentName} 加入课堂` |
| `lifecycle` | `leave` | `${studentName} 离开课堂` |
| `lifecycle` | `translate_request` | `查词：${data.text}` |
| `lifecycle` | `discuss_complete` | `完成讨论` |
| `lifecycle` | `continue_chat_turn` | `继续追问` |
| `exercise` | n/a | `提交 Step ${step} 答案，得分 ${score}%` |
| `progress` | n/a | `完成 Task ${taskNum}，进入 Task ${nextTask}` |
| `indicator_hit` | n/a | `data.gist` (LLM-generated, pass-through) |
| `student_status` | — | **NOT in events**, drives alert only |
| any other | — | `obs.type` (fallback; guarantees no `undefined`) |

After the M5.2b frontend rewrite this file + its spec get deleted entirely.

## Legacy shape (historical, used only inside the adapter)

The wire shape pre-M5.2a. After deleting `ObservationDashboardProjector`, this shape only lives in the `state.observation` field between live-lesson backend and frontend (derived by the adapter).

```typescript
interface ObservationDashboardPayload {
  logs: StudentLog[];                  // one row per student: event timeline + system metrics
  alerts: Alert[];                     // flat alert list (severity: info/warn/urgent)
  indicatorStats: IndicatorStats[];    // one row per indicator: student count, latest gist, updatedAt
  indicators: IndicatorCatalogEntry[]; // session indicator catalog
}

interface StudentLog {
  studentId: string;
  studentName: string;                 // resolved from join lifecycle
  events: StudentEvent[];
  systemMetrics: {
    messageCount: number;
    lastActiveAt: number | null;
    exerciseCorrectRate: number | null;
    currentStep: number | null;
  };
  status?: string;
}
```

**Why `alerts` is a flat array (instead of per-student filter):** the legacy frontend expects the flat alert list for the banner at the top of the teacher panel. The adapter emits the alert alongside `adaptDashboardPayload`'s per-student loop so the frontend doesn't re-filter.

**Why `indicatorStats` is its own field:** the legacy frontend expects per-indicator aggregates; pre-computing them in the adapter avoids forcing the frontend to groupBy `indicator_hit` rows.

## DashboardPayload shape (current wire)

```typescript
interface DashboardPayload {
  sessionId: string;
  indicators: DashboardIndicatorDef[];  // session catalog
  students: DashboardStudentSlice[];    // student-centric view
  generatedAt: number;
}

interface DashboardStudentSlice {
  studentId: string;
  studentName: string;
  status: DashboardStudentStatus | null;     // derived status + previous status
  metrics: DashboardStudentMetrics;          // same metrics as inside the status row
  observations: DashboardObservationView[];  // raw rows (ASC by createdAt)
}
```

**Key differences from legacy:**

| Legacy | New |
|---|---|
| `logs[]` + `alerts[]` + `indicatorStats[]` + `indicators[]` flat | `students[]` aggregates status + metrics + observations per student |
| `events[]` are already-rendered StudentEvents (Chinese gists, etc.) | `observations[]` are raw rows; frontend renders |
| Flat `alerts` list | Filter `students` by `status.current in [stuck, struggling, idle]` |
| `indicatorStats` pre-aggregated | Frontend groupBy `indicator_hit` rows (rare consumer) |

The new shape fetches once and lets the frontend decide how to present.

### Structural change at a glance (4 sibling arrays vs 1 student tree)

```
Legacy: 4 sibling arrays, frontend must JOIN
GET /api/v1/workflow/sessions/:id/observation-dashboard

   ObservationDashboardPayload
   ├── logs[]                                ◀── per-student
   │     { studentId, studentName, events[], systemMetrics, status }
   │
   ├── alerts[]                              ◀── per-alert (flat)
   │     { studentId, studentName, severity, message, indicatorId }
   │
   ├── indicatorStats[]                      ◀── per-indicator
   │     { indicatorId, label, type, studentCount, latestGist }
   │
   └── indicators[]                          ◀── session catalog
         { id, type, label, description }

   Putting one student's full picture together?
     1. logs.find(l => l.studentId === X)
     2. alerts.filter(a => a.studentId === X)
     3. indicatorStats isn't student-indexed → use logs[X].events to find anchors
     4 arrays, 3 joins, frontend glues it.


New: 1 students tree, no join
GET /api/v1/workflow/sessions/:id/dashboard

   DashboardPayload
   ├── sessionId
   ├── generatedAt
   ├── indicators[]                          ◀── session catalog (still flat)
   │     { id, type, label, description }
   │
   └── students[]                            ◀── student-centric tree
         {
           studentId, studentName,
           status: {                          ◀── embedded in the student
             current: 'struggling',
             previous: 'active',
             derivedAt, summary, alertMessage,
           },
           metrics: {
             messageCount, knowledgeCount, misconceptionCount,
             exerciseCorrectRate, lastActiveAt, currentStep,
           },
           observations: [                    ◀── raw rows (NOT translated StudentEvents)
             { id, type, data, createdAt, ... },
             ...
           ],
         }

   Putting one student's full picture together?
     students.find(s => s.studentId === X)     done.
```

**Equivalence derivations:** if the frontend wants to keep the legacy 4-array shape (pre-M5-second-pass), the new payload derives all four in one pass:

```typescript
const logs           = payload.students;
const alerts         = payload.students.filter(s =>
                          ['stuck', 'struggling', 'idle']
                          .includes(s.status?.current ?? ''));
const indicatorStats = groupBy(payload.students.flatMap(s =>
                          s.observations.filter(o => o.type === 'indicator_hit')
                       ), o => o.data.anchors);
const indicators     = payload.indicators;
```

## When to use which

- **New Solutions:** consume the new `/dashboard` endpoint and render `DashboardPayload` directly in your own frontend.
- **live-lesson (current state):** backend `WorkflowDashboardFetchService` fetches the new endpoint; `DashboardPayloadAdapter` derives the legacy 4-array shape for the existing frontend. **After M5.2b** the adapter + this transitional shape are both deleted.

## Metric algorithm (two implementations must agree)

`DashboardService.computeMetrics` + `StatusChangeService.computeMetrics` both compute metrics. **They must stay in sync** or the dashboard view and status derivation drift. (Pre-M5.2a `ObservationDashboardProjector` was the third site; deleting it left two.)

- `messageCount` = count of indicator_hit rows
- `misconceptionCount` = sum of `anchors.filter(a => a.startsWith('M')).length` over indicator_hit
- `knowledgeCount` = same for K
- `exerciseCorrectRate` = round(avg(exercise.score)); empty → null
- `lastActiveAt` = max(createdAt over ACTIVITY_TYPES = {indicator_hit, exercise, progress}); empty → fall back to lifecycle createdAt; both empty → null

The M5 pass-2 backlog (S2) calls out extracting ACTIVITY_TYPES into one const (two copies will drift); still outstanding.

## Auth model

- `@Auth('chat')` — chat-scope key
- `@TenantId()` must resolve a solutionId — 400 otherwise
- The session's observation rows are **NOT tenant-filtered** at the DB level: `DashboardService` queries `getBySession` directly because sessionIds are UUIDs (globally unique).
- IndicatorRegistry is keyed by `(solutionId, sessionId)` for tenant isolation — see [Session lifecycle](session-lifecycle.md) §tenant scoping.

**Potential future hardening:** if sessionIds can no longer be assumed globally unique, the controller layer should add a session-ownership check ("does this sessionId actually belong to my tenant"). Not needed today thanks to UUIDs.

## Relevant files

| File | Responsibility |
|---|---|
| `packages/backend/src/workflow/handlers/dashboard/dashboard.service.ts` | Produces `DashboardPayload` |
| `packages/backend/src/workflow/handlers/dashboard/dashboard.controller.ts` | `GET /dashboard` endpoint |
| `packages/backend/src/workflow/handlers/dashboard/dashboard-payload.types.ts` | Wire shape types + design notes |
| `packages/workflow-client/src/index.ts` `getDashboard` | Client-side HTTP fetch |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-dashboard-fetch.service.ts` | Solution-side wrapper |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/dashboard-payload-adapter.ts` | **Transitional**: new → legacy 4-array derivation + gist rendering (deleted in M5.2b) |
