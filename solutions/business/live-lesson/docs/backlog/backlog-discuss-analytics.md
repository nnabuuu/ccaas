# Backlog: Discuss Pass/Fail Analytics Aggregation

**Status**: Backlog (deferred)
**Created**: 2026-05-03

## Summary

Add backend aggregation for discuss completion statistics, providing teacher dashboard with pre-computed metrics like pass rate, average rounds to goal, and fallback distribution — without requiring frontend to manually filter raw observation logs.

## Current State

- `discuss_complete` events are persisted in `ObservationEvent` table with fields: `completionType`, `method`, `goalReached`, `roundsUsed`, `timeUsedSeconds`, `mcSelectedIndex`, `mcCorrect`
- Teacher dashboard receives raw `observation.logs` via `GET /api/classroom/:code/state`
- Frontend must filter `systemType === 'discuss_complete'` and compute stats client-side
- No dedicated aggregation endpoint or summary field exists

## Proposed Additions

### 1. Backend aggregation in `getState()` → `stepMetrics`

Per-step discuss metrics:
```ts
stepMetrics[taskNum].discuss = {
  total: number,          // students who entered discuss for this task
  passCount: number,      // goalReached === true
  passRate: number,       // passCount / total
  avgRoundsToPass: number | null,
  fallbackCount: number,  // fallback_rounds + fallback_time
  mcCorrectRate: number | null,
  avgTimeSeconds: number,
}
```

### 2. Optional: dedicated endpoint

`GET /api/classroom/:code/discuss-stats` — lightweight endpoint returning only discuss metrics (useful for polling without full state payload).

### 3. Timeline view data

Per-student discuss timeline: when they started, each round timestamp, when they passed/fell back. Could power a teacher timeline visualization.

## Dependencies

- Requires `discuss_complete` events (already implemented)
- Requires `continue_chat_turn` events for extended discussion tracking (already implemented)

## Priority Considerations

- Low urgency: frontend can compute from raw logs for now
- Becomes important when class size grows (30+ students) and client-side filtering becomes sluggish
- Required for any post-class analytics/reports feature
