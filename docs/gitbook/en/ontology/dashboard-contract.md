# Dashboard Contract

> Two dashboard endpoints, two wire shapes: the legacy projector and the new ontology-native. This page tells you what each returns, when to use which, and how the transition closes out.

## Two endpoints coexist

| Endpoint | Vintage | Shape | Status |
|---|---|---|---|
| `GET /api/v1/workflow/sessions/:id/observation-dashboard` | M3 / live | `{logs, alerts, indicatorStats, indicators}` (legacy) | live-lesson frontend consumes this |
| `GET /api/v1/workflow/sessions/:id/dashboard` | M5.2 / awaiting consumer | `DashboardPayload` (student-centric) | Awaits M5 second-pass frontend rewrite |

Both endpoints read from the same `observations` table + the same IndicatorRegistry; only the wire shape differs.

## Legacy shape: `ObservationDashboardPayload`

```typescript
interface ObservationDashboardPayload {
  logs: StudentLog[];                  // one row per student: event timeline + system metrics
  alerts: Alert[];                     // flat alert list (severity: info/warn/urgent)
  indicatorStats: IndicatorStats[];    // one row per indicator: hit students, latest gist, updatedAt
  indicators: IndicatorCatalogEntry[]; // session indicator catalog (added M6.3)
}

interface StudentLog {
  studentId: string;
  studentName: string;                 // resolved from join lifecycle (fixed in M5 pass-1 MF1)
  events: StudentEvent[];
  systemMetrics: {
    messageCount: number;
    lastActiveAt: number | null;       // ACTIVITY_TYPES + lifecycle fallback (M5 pass-2 S2)
    exerciseCorrectRate: number | null;
    currentStep: number | null;
  };
  status?: string;                     // status field from the M4 student_status row
}
```

Produced by `ObservationDashboardProjector.project(solutionId, sessionId)` (tenant arg required since M5 pass-1 MF3).

**Why both `alerts` and `StudentLog.status`:** the legacy frontend expects a flat alert list (banner at the top of the teacher panel). The projector emits the alert alongside `buildStudentLog` so the frontend doesn't re-filter.

**Why `indicatorStats` is its own field:** the legacy frontend expects per-indicator aggregates (how many students hit each indicator). Having the projector pre-compute it avoids the frontend re-groupBy on `indicator_hit` rows.

## New shape: `DashboardPayload`

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

- **Today / live-lesson in prod:** legacy. `WorkflowDashboardFetchService` calls `WorkflowClient.getObservationDashboard`; the 3 teacher tabs consume directly.
- **After M5 second pass:** rewrite the 3 teacher tabs against `DashboardPayload`; delete `ObservationDashboardProjector` + the legacy endpoint. Not scheduled yet; tracked as outstanding in PROGRESS.md.
- **New Solutions:** use the new shape; legacy lives only for live-lesson migration continuity.

## Metric algorithm (three implementations must agree)

`DashboardService.computeMetrics` + `ObservationDashboardProjector.buildStudentLog` + `StatusChangeService.computeMetrics` all compute metrics. **They must stay in sync** or the dashboard view and status derivation drift.

- `messageCount` = count of indicator_hit rows
- `misconceptionCount` = sum of `anchors.filter(a => a.startsWith('M')).length` over indicator_hit
- `knowledgeCount` = same for K
- `exerciseCorrectRate` = round(avg(exercise.score)); empty → null
- `lastActiveAt` = max(createdAt over ACTIVITY_TYPES = {indicator_hit, exercise, progress}); empty → fall back to lifecycle createdAt; both empty → null

The M5 pass-2 backlog (S2) calls out extracting ACTIVITY_TYPES into one const (three copies will drift); still outstanding.

## Auth model

Both endpoints:

- `@Auth('chat')` — chat-scope key
- `@TenantId()` must resolve a solutionId — 400 otherwise
- The session's observation rows are **NOT tenant-filtered**: the projector queries `getBySession` directly because sessionIds are UUIDs (globally unique).

**Potential future hardening:** if sessionIds can no longer be assumed globally unique, the controller layer should add a session-ownership check ("does this sessionId actually belong to my tenant"). Not needed today thanks to UUIDs.

## Relevant files

| File | Responsibility |
|---|---|
| `packages/backend/src/workflow/handlers/dashboard/observation-dashboard.projector.ts` | Legacy projector |
| `packages/backend/src/workflow/handlers/dashboard/observation-dashboard.controller.ts` | Legacy GET endpoint |
| `packages/backend/src/workflow/handlers/dashboard/dashboard.service.ts` | New projector |
| `packages/backend/src/workflow/handlers/dashboard/dashboard.controller.ts` | New GET endpoint |
| `packages/backend/src/workflow/handlers/dashboard/dashboard-payload.types.ts` | New shape types + design notes |
| `packages/workflow-client/src/index.ts` `getObservationDashboard` | Client-side fetch (legacy shape) |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-dashboard-fetch.service.ts` | Solution-side wrapper + defensive narrowPayload |
