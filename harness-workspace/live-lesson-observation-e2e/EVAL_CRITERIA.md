# Evaluation Criteria — live-lesson-observation-e2e

**Total: 100 points** across 5 dimensions (20 each).

---

## Scoring Anchors

| Score | Meaning |
|-------|---------|
| 5/5 (20/20) | All checks pass, feature complete and working |
| 3/5 (12/20) | Core structure present but some checks fail |
| 1/5 (4/20) | Dimension attempted but mostly broken |

---

## D1: Event Pipeline Completeness (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | `addSystemEvent` sync persists to DB (await, not fire-and-forget) | 4 | grep observation.service.ts: `await` before eventRepo.save or equivalent |
| 2 | `submit()` triggers `observeTurn()` with answer content | 4 | grep classroom.service.ts: submit method calls observeTurn |
| 3 | `observeTurn()` receives full conversation history (not just latest turn) | 4 | grep observation.service.ts: observeTurn accepts existingEvents or history array |
| 4 | Step transition triggers `step_complete` system event | 4 | grep classroom.service.ts or observation.service.ts: addSystemEvent.*step_complete |
| 5 | `observeTurn` systemContext contains real exerciseCorrectRate from student metrics | 4 | grep: exerciseCorrectRate computed from actual student submissions/metrics |

**Detection flow**: Static code grep of service files.

---

## D2: State Derivation Accuracy (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | `deriveStatus` considers knowledge anchors (K-prefixed) | 4 | grep observation.service.ts: deriveStatus references K anchor pattern |
| 2 | Thresholds are named constants (not hardcoded magic numbers) | 4 | grep: IDLE_THRESHOLD_MS or similar named constants defined |
| 3 | Mixed signal handling (event with both K and M anchors) | 4 | jest test: mixed signal scenario passes |
| 4 | `generateAlerts` produces correct severity levels | 4 | curl /state → alerts array with severity field (urgent/warning/info) |
| 5 | `computeAnchorStats` correctly counts per-anchor studentCount | 4 | curl /state → anchorStats[].studentCount is numeric and plausible |

**Detection flow**: Code grep + jest test run + curl API verification.

---

## D3: Real-time Alert Push (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | SSE broadcast payload includes `observation` field | 4 | curl SSE stream or grep broadcast call includes observation |
| 2 | `observeTurn` completion triggers broadcast | 4 | grep: observeTurn .then or await followed by broadcast/emit call |
| 3 | Incremental push (observation_update event or piggyback) | 4 | grep: observation_update event type or observation in broadcast payload |
| 4 | `useTeacherStream` receives and renders observation data | 4 | grep useClassroom.ts + Playwright teacher page snapshot |
| 5 | Heartbeat does NOT reset observation memory state | 4 | grep: heartbeat handler does not clear/reset observation state |

**Detection flow**: Code grep + curl SSE + Playwright teacher page.

---

## D4: Teacher Observation Panel (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Glance view: student dots colored by observation status | 4 | Playwright snapshot: colored dot elements or status-indicator class |
| 2 | Knowledge anchor progress bars with studentCount label | 4 | Playwright snapshot: progress bar + count text |
| 3 | Misconception anchors sorted by impacted student count (descending) | 4 | Playwright snapshot: misconception items in correct order |
| 4 | Alert list sorted by severity with correct badge styling | 4 | Playwright snapshot: alert items with severity badge |
| 5 | Alert badge count reflects real urgent alert quantity | 4 | Playwright snapshot: badge number matches urgent count |

**Detection flow**: Create multi-student session → inject varied observation states → navigate teacher page → Playwright snapshot verification.

---

## D5: Build + Tests + Frozen Files (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | `npx nest build` passes | 4 | cd backend && npx nest build exits 0 |
| 2 | `npx tsc --noEmit && npx vite build` passes | 4 | cd frontend && npx tsc --noEmit && npx vite build exits 0 |
| 3 | `npx jest observation --no-coverage` all pass | 4 | cd backend && npx jest observation --no-coverage exits 0 |
| 4 | No frozen files modified | 4 | git diff --name-only shows no frozen file changes |
| 5 | New tests ≥ 5 (above baseline 33) | 4 | grep -c 'it(' observation.service.spec.ts ≥ 38 |

**Detection flow**: Build commands + jest run + git diff + test count.

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | Any file in `packages/` modified | Total = 0 |
| P2 | Any file in `backend/src/entities/` modified | Total = 0 |
| P3 | Any file in `backend/src/classroom/dto/` modified | D1 = 0 |
| P4 | Any file in `frontend/src/pages/` modified | D4 = 0 |
| P5 | Any file in `frontend/src/components/student/` modified | D4 = 0 |

---

## What's Working Well

List dimensions or checks that scored full marks. Tell the generator:
> "These dimensions are solid — do NOT touch them unless absolutely necessary."

---

## Score Format

```
## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Event Pipeline Completeness | X/20 |
| D2: State Derivation Accuracy | X/20 |
| D3: Real-time Alert Push | X/20 |
| D4: Teacher Observation Panel | X/20 |
| D5: Build + Tests + Frozen Files | X/20 |
| **Penalties** | -X |
| **Total** | **X/100** |

总分: X/100
```

The last line `总分: X/100` is machine-parsed by the harness script. It MUST appear exactly in this format.
