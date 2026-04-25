# Evaluation Report — v1

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## Test Data
- Session code: RFAK97
- Students: 4d8c4436 (陈昕妍), 157bf670 (王译文), 2e5bf1e3 (张皓月), 18d53786 (李子涵)
- Submissions made: 2 (S1 correct 67%, S2 incorrect 0%)
- AI questions asked: 3 (S3 张皓月)
- Idle student: S4 (李子涵)

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS |
| P2 | entities/ modified | PASS |
| P3 | dto/ modified | PASS |
| P4 | pages/ modified | FAIL — DemoPage.tsx, StudentPage.tsx |
| P5 | student/ modified | FAIL — HelpButton.tsx, StudentShell.tsx, TaskPanel.tsx, TextPanel.tsx |

P4 + P5 → **D4 zeroed to 0**.

## D1: Event Pipeline Completeness (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | addSystemEvent sync persist | PASS: `await this.eventRepo.save(...)` at observation.service.ts:235 | 4/4 |
| 2 | submit triggers observeTurn | PASS: `this.observationService.observeTurn(...)` at classroom.service.ts:307 | 4/4 |
| 3 | Full history passed | PASS: `callObserverGlm(anchors, log.events, latestTurn)` at observation.service.ts:153 — `log.events` is the full array | 4/4 |
| 4 | step_complete event | PASS: `addSystemEvent(..., 'step_complete', ...)` at classroom.service.ts:298-301 | 4/4 |
| 5 | Real exerciseCorrectRate | PASS: `const exerciseCorrectRate = score?.total ?? 0` at classroom.service.ts:306, passed to observeTurn systemContext | 4/4 |

## D2: State Derivation Accuracy (12/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | K-anchor in deriveStatus | PASS: `e.anchors.some(a => a.startsWith('K'))` at observation.service.ts:273 | 4/4 |
| 2 | Named constants | PASS: `IDLE_THRESHOLD_MS`, `RECENT_WINDOW_MS`, `STRUGGLE_EVENT_COUNT`, `CRUISING_CORRECT_RATE`, `CRUISING_MAX_MESSAGES`, `PROGRESS_ANCHOR_MIN` at lines 68-74 | 4/4 |
| 3 | Mixed signal test | PASS: `npx jest observation --testNamePattern="mixed"` → 2 tests passed, exit 0 | 4/4 |
| 4 | Alert severity in API | FAIL: `curl /state` → `observation.alerts: []` (empty array). Code correctly defines severity types but no alerts generated at runtime — session was never started so observation anchors weren't loaded, preventing M-anchor events | 0/4 |
| 5 | anchorStats studentCount | FAIL: `curl /state` → `observation.anchorStats: []` (empty). Same root cause: `initObservation` only runs during `startSession`, which wasn't called. Code at lines 361-385 correctly computes numeric studentCount | 0/4 |

**Note**: D2.4 and D2.5 fail at runtime because `startSession` was never called during test data setup. The `initObservation` method (classroom.service.ts:1046-1051) loads anchors from manifest only on session start. Without anchors, `observeTurn` returns early (line 142), preventing anchor-tagged events, alerts, and anchorStats. The code structure is correct; the issue is a lifecycle gap in the test scenario.

## D3: Real-time Alert Push (16/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | SSE observation field | PASS: `observation: { logs, alerts, anchorStats, anchors }` in `getState()` at classroom.service.ts:483-488 — included in every broadcast | 4/4 |
| 2 | Broadcast after observeTurn | FAIL: `observeTurn()` is fire-and-forget (`.catch()` at line 311), broadcast at line 313 executes before observeTurn completes. No `.then` or `await` before broadcast. System events (addSystemEvent) ARE properly awaited before broadcast | 0/4 |
| 3 | Incremental push | PASS: observation data piggybacks on main state broadcast via `getState()`. Every `broadcast(sessionId)` call includes full observation snapshot | 4/4 |
| 4 | Frontend reception | PASS: `ClassroomState.observation` typed at useClassroom.ts:187-232, `useTeacherStream` sets full state via `setState(data)` at line 334 | 4/4 |
| 5 | Heartbeat safety | PASS: heartbeat at classroom.service.ts:513-514 writes `': heartbeat\n\n'` only — no state mutation, no observation reset | 4/4 |

## D4: Teacher Observation Panel (0/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Glance dots | ZEROED by P4+P5 (code exists: GlanceView at TeacherShell.tsx:451-496 with colored dots) | 0/4 |
| 2 | Anchor progress bars | ZEROED by P4+P5 (code exists: lines 499-520 with progress bars and studentCount) | 0/4 |
| 3 | Misconception sort | ZEROED by P4+P5 (code exists: `.sort((a, b) => b.studentCount - a.studentCount)` at line 456) | 0/4 |
| 4 | Alert severity badges | ZEROED by P4+P5 (code exists: AlertView lines 560-598 with severity color mapping) | 0/4 |
| 5 | Alert badge count | ZEROED by P4+P5 (code exists: urgent count badge at lines 423-425) | 0/4 |

**Note**: The ObservationPanel implementation (TeacherShell.tsx:388-598) appears functionally complete with glance/alert modes, colored status dots, anchor progress bars, sorted misconceptions, and severity-styled alerts. D4 is zeroed solely due to frozen file violations in `pages/` and `components/student/`.

## D5: Build + Tests + Frozen Files (16/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS: `npx nest build` exits 0 | 4/4 |
| 2 | tsc + vite build | PASS: `npx tsc --noEmit` exits 0, `npx vite build` exits 0 (442KB bundle) | 4/4 |
| 3 | jest observation | PASS: 39 tests passed, 0 failed | 4/4 |
| 4 | No frozen files | FAIL: `git diff` shows changes in `frontend/src/pages/` (DemoPage.tsx, StudentPage.tsx) and `frontend/src/components/student/` (4 files) | 0/4 |
| 5 | New tests ≥ 5 | PASS: count=39 (≥ 38 threshold) | 4/4 |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Event Pipeline Completeness | 20/20 |
| D2: State Derivation Accuracy | 12/20 |
| D3: Real-time Alert Push | 16/20 |
| D4: Teacher Observation Panel | 0/20 |
| D5: Build + Tests + Frozen Files | 16/20 |
| **Penalties** | P4+P5 → D4=0 |
| **Total** | **64/100** |

总分: 64/100

## What's Working Well
- **D1 is perfect (20/20)** — event pipeline is solid. addSystemEvent properly awaits persistence, submit/ask/discuss all trigger observeTurn, full history is passed to GLM, step_complete events fire on task transitions, and exerciseCorrectRate is computed from real submissions. **Do NOT touch these.**
- **D2 core logic is strong (12/20)** — deriveStatus correctly handles K/M anchor interactions, mixed signal test passes, all thresholds are named constants. The only gap is runtime verification (no alerts/anchorStats generated because session wasn't started during test).
- **D3 architecture is sound (16/20)** — observation data flows end-to-end from backend through SSE to frontend. Heartbeat is clean. The only issue is observeTurn not being awaited before broadcast.
- **D5 builds are clean (16/20)** — nest build, tsc, and vite all pass. 39 observation tests all green.
- **D4 panel code looks complete** — glance dots, anchor bars, misconception sort, alert badges all implemented in TeacherShell.tsx. Zeroed only by frozen file penalties.

## Priority Fixes
1. **[FRONTEND] Revert frozen file changes** — `git checkout -- solutions/business/live-lesson/frontend/src/pages/ solutions/business/live-lesson/frontend/src/components/student/` to fix P4, P5, and D5.4. This would restore D4 to its earned score and fix D5.4. **Estimated impact: +20 (D4) + 4 (D5.4) = +24 points.**

2. **[BACKEND] classroom.service.ts:307 — Await observeTurn before broadcast** — Change the submit handler to `await` observeTurn (or use `.then(() => this.broadcast(...))`) so the broadcast includes GLM-derived observation data. Same pattern needed at lines 600-604 (ai/ask) and 644-648 (ai/discuss). **Estimated impact: +4 points (D3.2).**

3. **[BACKEND] classroom.service.ts — Ensure observation anchors are loaded before test data** — The test setup creates a session and adds students without calling `startSession`, which means `initObservation` never runs and anchors aren't loaded. Either: (a) call `initObservation` during `createSession` as well, or (b) ensure the test/eval setup calls `POST /start` before submitting data. This would make alerts and anchorStats populate at runtime. **Estimated impact: +8 points (D2.4, D2.5).**

Classification:
- [FRONTEND]: Revert frozen file changes (fix #1)
- [BACKEND]: Await observeTurn before broadcast (fix #2)
- [BACKEND]: Load anchors during createSession or document startSession requirement (fix #3)
