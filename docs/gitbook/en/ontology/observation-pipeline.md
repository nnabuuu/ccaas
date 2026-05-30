# Observation Pipeline

> Every observable event + LLM-derived conclusion across a lesson lands in the platform's `observations` table. This page covers the `Observation` type, the 5 types, each handler's I/O, and the observer-engine retirement timeline.

## `Observation` — database row AND business event

```typescript
interface Observation {
  id: string;             // UUID
  sessionId: string;
  entityId: string;       // usually studentId (also sessionId for session-level rows)
  solutionId: string;     // tenant isolation
  type: string;           // one of 5 types (below)
  data: Record<string, unknown>;   // type-specific payload
  triggerEventId: string;          // event/correlation id that produced this row (cascade trace)
  createdAt: number;               // epoch ms
  updatedAt: number;               // epoch ms (changes on cascade rewrite)
}
```

Storage: `packages/backend/src/workflow/persistence/observation-repository.ts` (TypeORM + SQLite/PG). Package `@kedge-agentic/observer-engine` now contains only this entity class + the type definition (M6.4 trimmed everything else out).

## 5 types

| type | Writer | Key `data` fields | Notes |
|---|---|---|---|
| `lifecycle` | LifecycleObservationService (M2/M3) | `action: 'join' \| 'translate_request' \| 'discuss_complete' \| 'continue_chat_turn'` + `studentName?` | Session / student lifecycle events |
| `exercise` | ExerciseObservationService (M3) | `step` + `score: number` (0–100) | Student exercise submission result |
| `progress` | ProgressObservationService (M3) | `step` + `taskNum` + `nextTask` | Student completed a step, advanced to next |
| `indicator_hit` | ChatTurnService (M4) | `anchors: string[]` + `gist` + `quote?` + `action: 'append' \| 'update'` | LLM classified a chat turn against one or more indicators |
| `student_status` | StatusChangeService (M4) | `status: 'active' \| 'struggling' \| 'stuck' \| 'idle' \| 'cruising'` + `previousStatus` + computed metrics + `alertMessage?` | Per-session status derivation (cascades from indicator_hit) |

## M4 cascade end-to-end

```
chat_turn event arrives on `events` stream (HTTP ingest OR in-process)
  ↓
ChatTurnTrigger predicate hits (payload.type === 'chat_turn')
  ↓
classify_chat_turn_indicators Action (LLM)
  ├─ reads IndicatorRegistry for the (solutionId, sessionId) catalog
  ├─ reads existing indicator_hit observations to decide append vs update
  ├─ LLM call → parse {action, anchors, gist, quote}
  ├─ filters hallucinated anchors (must be in the registered indicator id set)
  ├─ writes indicator_hit observation
  └─ engine.cascadeEvent({type: 'student_observation_changed', ...})  ← key: cascade into engine
  ↓
StatusChangeTrigger predicate hits (payload.type === 'student_observation_changed')
  ↓
derive_student_status Action
  ├─ reads all observations
  ├─ computes metrics (messageCount / misconception/knowledge counts / exerciseCorrectRate / lastActiveAt)
  ├─ LLM derives status (if any indicator registered), else heuristic
  ├─ writes OR updates student_status row
  └─ on alertable transition (stuck/struggling/idle) publishes student_alerts stream
```

## Heuristic status fallback

When LLM is unavailable / failed / returned garbage, `StatusChangeService.heuristicStatus()` applies:

| Condition | status |
|---|---|
| `Date.now() - metrics.lastActiveAt > 3 min` | `idle` |
| `misconceptionCount >= 3` | `struggling` |
| `exerciseCorrectRate >= 80%` AND `messageCount <= 2` | `cruising` |
| otherwise | `active` |

`lastActiveAt` counts only ACTIVITY_TYPES = {indicator_hit, exercise, progress} createdAt — **excludes** student_status (avoids self-cascade-bumping) and lifecycle (joining isn't "active"). M4 pass-1 MF2 was the bug; M5 pass-2 S2 added lifecycle as a last-resort fallback so a join-only student doesn't NaN.

## observer-engine retirement timeline

| Phase | State |
|---|---|
| M1–M2 | platform receives ingest; live-lesson still single-writes observer-engine |
| M3 | live-lesson **dual-writes** observer-engine + workflow client; dashboard still reads local observation table |
| M5.3b | dashboard cutover to platform projector (HTTP fetch); local fallback as safety net |
| M6.1 | live-lesson drops `engine.dispatch` call sites (single-write to workflow) |
| M6.2 | live-lesson deletes observer-engine handler dir + OBSERVER_ENGINE factory in classroom.module |
| M6.3 | live-lesson deletes ObservationQueryService + dashboard local fallback |
| M6.4 | `@kedge-agentic/observer-engine` package trimmed to storage layer (entities + types kept; engine/nestjs/stores deleted) |

Full commit log in `docs/ontology/PROGRESS.md`.

## Data-migration notes

- Platform `observations` table is new; written since M2.
- live-lesson local `observations` table was dual-written through M6; M6.2 stopped writes; M6 pass-1 S6 removed the entity registration (new live-lesson DB boots no longer create these tables).
- Existing live-lesson databases retain the legacy tables — no migration shipped; DROP TABLE is an ops decision.

## Troubleshooting cheatsheet

| Symptom | Likely cause | Where to look |
|---|---|---|
| Dashboard shows 0 messages for a student | indicator_hit never written; possibly IndicatorRegistry not pushed | `WorkflowIndicatorPushService` logs + platform IndicatorRegistry |
| Status always `active`, never `idle` | lastActiveAt includes student_status rows | M4 pass-1 MF2 / M5 pass-2 S2 are the fixes; verify build version |
| `student_observation_changed` cascade doesn't fire status derive | `accessor.publish` doesn't re-enter the engine | M4 pass-1 MF1 fix — use `engine.cascadeEvent` |
| chat_turn keeps logging "no indicators registered; skip" | platform IndicatorRegistry empty | Pre-M5.3a it really was empty; post-M5.3a check PUT `/indicators` endpoint + live-lesson `WorkflowIndicatorPushService` |
