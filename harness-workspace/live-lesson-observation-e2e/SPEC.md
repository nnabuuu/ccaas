# SPEC — live-lesson-observation-e2e

## Objective

Complete the observation system integration: event pipeline, state derivation, real-time push, and teacher observation panel.

The three-layer observation architecture (ObservationService 475 lines + 33 tests) has a basic implementation. This harness drives the remaining integration work:
1. **Event pipeline**: Persistent system events, submit triggers observeTurn, enriched context
2. **State derivation**: Knowledge anchor awareness, configurable thresholds, mixed signal handling
3. **Real-time alerts**: SSE broadcast after observeTurn, incremental push, frontend reception
4. **Teacher panel**: Glance view with status-colored dots, anchor progress bars, alert badges

## Artifact Scope

| File | What to Change |
|------|---------------|
| `backend/src/classroom/observation.service.ts` | Core observation logic: event persistence, deriveStatus enhancements, alert generation |
| `backend/src/classroom/observation.service.spec.ts` | Extend test suite (baseline: 33 tests, target: ≥38) |
| `backend/src/classroom/classroom.service.ts` | Integration hooks: submit→observeTurn, step_complete events, broadcast after observe |
| `frontend/src/hooks/useClassroom.ts` | Type extensions for observation data in ClassroomState |
| `frontend/src/components/teacher/TeacherShell.tsx` | Observation panel: Glance view, anchor stats, alert list |
| `frontend/src/styles/teacher.css` | Observation panel styles |
| `data/lessons/ideal-beauty-reading/manifest.json` | Anchor definitions (K/M anchors for observation) |

All paths are relative to `solutions/business/live-lesson/`.

## Frozen Constraints

```
packages/                                            # DO NOT MODIFY — penalty: total=0
solutions/business/edu-platform/                     # DO NOT MODIFY
solutions/business/recipe-book/                      # DO NOT MODIFY
solutions/business/live-lesson/mcp-server/           # DO NOT MODIFY
solutions/business/live-lesson/backend/src/entities/ # DO NOT MODIFY
solutions/business/live-lesson/backend/src/lesson/   # DO NOT MODIFY
solutions/business/live-lesson/backend/src/classroom/dto/ # DO NOT MODIFY
solutions/business/live-lesson/backend/src/classroom/classroom.module.ts # DO NOT MODIFY
solutions/business/live-lesson/backend/src/main.ts   # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/pages/   # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/components/student/ # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/App.tsx  # DO NOT MODIFY
```

## Existing System (Read-Only Context)

### ObservationService Current State

The service already implements:
- `observeTurn(sessionCode, studentId, events, systemContext)` — LLM-based observation
- `deriveStatus(events)` — derives student observation status from events
- `generateAlerts(sessionState)` — generates teacher alerts from session observation state
- `computeAnchorStats(sessionState)` — computes per-anchor student statistics
- `addSystemEvent(sessionCode, event)` — adds system-generated events

### Backend API (Existing)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/classroom/sessions` | Create session |
| POST | `/api/classroom/:code/join` | Student joins |
| POST | `/api/classroom/:code/submit` | Submit answer |
| GET | `/api/classroom/:code/state` | Full state snapshot |
| GET | `/api/classroom/:code/stream` | SSE real-time push |
| POST | `/api/classroom/:code/ai/ask` | AI question |

### ClassroomState Type (current)

```typescript
export interface ClassroomState {
  currentStep: number
  students: Array<{
    id: string; name: string; currentTask: number; currentPhase: string; stepStartedAt: string
    submissions: Record<number, { step: number; data: any; score: any; submittedAt: string }>
  }>
  metrics: { total: number; submitted: number; inProgress: number }
  stepMetrics: Record<number, { ... }>
  questions: Array<{ studentId: string; studentName: string; step: number; question: string; timestamp: string }>
}
```

After implementation, ClassroomState gains `observation?: { students: ObservationStudentState[], alerts: Alert[], anchorStats: AnchorStat[] }`.

## Implementation Plan (5 Phases)

### Phase 1: Event Pipeline Hardening
1. `addSystemEvent` must `await eventRepo.save()` (sync persistence, not fire-and-forget)
2. `submit()` in classroom.service.ts must trigger `observeTurn()` with answer content
3. `observeTurn()` must receive full conversation history (existingEvents array), not just latest turn
4. Step transitions trigger `addSystemEvent('step_complete', ...)` with step metadata
5. `observeTurn` systemContext includes real `exerciseCorrectRate` from student metrics

### Phase 2: State Derivation Enhancement
6. `deriveStatus` considers knowledge anchors (K-prefixed anchor IDs in events)
7. Thresholds extracted to named constants: `IDLE_THRESHOLD_MS`, `STRUGGLE_EVENT_COUNT`, etc.
8. Mixed signal handling: events containing both K (knowledge) and M (misconception) anchors
9. `generateAlerts` produces correct severity levels (urgent/warning/info)
10. `computeAnchorStats` correctly counts per-anchor student participation

### Phase 3: Real-time Push
11. SSE broadcast includes `observation` field in state payload
12. `observeTurn` completion triggers broadcast to teacher stream
13. Incremental push via `observation_update` event or piggyback on existing state broadcast
14. `useTeacherStream` (or equivalent) in frontend receives and renders observation data
15. Heartbeat events must NOT reset observation in-memory state

### Phase 4: Teacher Observation Panel
16. Glance view: student dots colored by observation status (green/yellow/red)
17. Knowledge anchor progress bars with `studentCount` labels
18. Misconception anchors sorted by impacted student count (descending)
19. Alert list sorted by severity with correct badge styling
20. Alert badge count reflects real urgent alert quantity

### Phase 5: Test Extension
21. Add ≥5 new tests beyond the baseline 33 (target: ≥38 passing tests)
22. Tests cover: event persistence, mixed signal deriveStatus, anchorStats computation, alert severity, enriched context

## Exit Conditions

- **Target score**: 80/100 (LLM-dependent behaviors may lose points without API key)
- **Max iterations**: 8
- **Diminishing returns**: < 3 points improvement for 2 consecutive iterations
- **Regression**: > 5 points drop triggers auto-revert
