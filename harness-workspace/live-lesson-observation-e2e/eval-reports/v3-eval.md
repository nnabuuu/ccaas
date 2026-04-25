# Evaluation Report — v3

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## Test Data
- Session code: A9GQMK
- Students: c43fadcc (陈昕妍), 641c1dd0 (王译文), 5f776615 (张皓月), 0cd97638 (李子涵)
- Submissions made: 2 (S1 correct 67%, S2 incorrect 0%)
- AI questions asked: 3 (S3 张皓月)
- Idle student: S4 (李子涵)

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS |
| P2 | entities/ modified | PASS |
| P3 | dto/ modified | PASS |
| P4 | pages/ modified | PASS |
| P5 | student/ modified | PASS |

## D1: Event Pipeline Completeness (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | addSystemEvent sync persist | PASS: observation.service.ts:235 `await this.eventRepo.save(...)` with explicit "Synchronous DB persist" comment | 4/4 |
| 2 | submit triggers observeTurn | PASS: classroom.service.ts:308-312 `await this.observationService.observeTurn(...)` called after submit with answer data | 4/4 |
| 3 | Full history passed | PASS: observation.service.ts:153 `callObserverGlm(anchors, log.events, latestTurn)` — `log.events` is full event history array, not single event | 4/4 |
| 4 | step_complete event | PASS: classroom.service.ts:299-303 `addSystemEvent(session.id, studentId, student.name, 'step_complete', {...})` triggered when `currentTask > taskNum` | 4/4 |
| 5 | Real exerciseCorrectRate | PASS: classroom.service.ts:307 `const exerciseCorrectRate = score?.total ?? 0` — computed from actual submission score result | 4/4 |

## D2: State Derivation Accuracy (16/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | K-anchor in deriveStatus | PASS: observation.service.ts:272-273 `e.anchors.some(a => a.startsWith('K'))` filters K-prefixed knowledge anchors | 4/4 |
| 2 | Named constants | PASS: observation.service.ts:68-73 defines `IDLE_THRESHOLD_MS`, `RECENT_WINDOW_MS`, `STRUGGLE_EVENT_COUNT`, `CRUISING_CORRECT_RATE`, `CRUISING_MAX_MESSAGES`, `PROGRESS_ANCHOR_MIN` | 4/4 |
| 3 | Mixed signal test | PASS: `npx jest observation --testNamePattern="mixed"` → 2 tests passed, exit 0 | 4/4 |
| 4 | Alert severity in API | PASS: curl state → 4 alerts with severity='info' field; `generateAlerts` produces 'urgent'/'warn'/'info' levels sorted by severity | 4/4 |
| 5 | anchorStats studentCount | FAIL: curl state → `anchorStats` array is empty (0 items). `getAnchors()` returns [] — anchors not loaded into in-memory map at runtime despite manifest having 9 anchors (K1-K5, M1-M4). Root cause: `initObservation` reads from DB `lesson.manifestJson` which may lack `observationAnchors` field | 0/4 |

## D3: Real-time Alert Push (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | SSE observation field | PASS: classroom.service.ts:484-488 `getState()` includes `observation: { logs, alerts, anchorStats, anchors }` in SSE payload | 4/4 |
| 2 | Broadcast after observeTurn | PASS: classroom.service.ts:312-314 `observeTurn().catch(...)` then `this.broadcast(session.id)`; also line 605-607 same pattern for AI ask | 4/4 |
| 3 | Incremental push | PASS: observation data piggybacked on every state broadcast (same SSE message type); state includes full observation snapshot each time | 4/4 |
| 4 | Frontend reception | PASS: useClassroom.ts:187-232 `ClassroomState.observation?` type fully defined with logs, alerts, anchorStats, anchors; `useTeacherStream` at line 332-334 parses SSE data via `setState(data)` | 4/4 |
| 5 | Heartbeat safety | PASS: classroom.service.ts:514-515 heartbeat writes `': heartbeat\n\n'` (SSE comment) — does NOT send data payload, does NOT modify observation state | 4/4 |

## D4: Teacher Observation Panel (12/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Glance dots | PASS: Playwright snapshot shows 4 colored student elements (张皓, 李子, 王译, 陈昕) with observation-derived colors via `deriveObsColor()` and last-event tooltips | 4/4 |
| 2 | Anchor progress bars | FAIL: No knowledge anchor progress bars visible in snapshot. `anchorStats` is empty at runtime (anchors not loaded). Code exists at TeacherShell.tsx:498-520 but never renders | 0/4 |
| 3 | Misconception sort | FAIL: No misconception items visible. Same root cause — empty `anchorStats`. Code at TeacherShell.tsx:523-543 sorts by `studentCount` descending but has nothing to render | 0/4 |
| 4 | Alert severity badges | PASS: Alert tab shows 4 alerts with severity indicators (ℹ for info), colored left borders (`borderLeft: 3px solid`), and tinted backgrounds via `severityBg` mapping | 4/4 |
| 5 | Alert badge count | PASS: 0 urgent alerts → badge correctly hidden (code at TeacherShell.tsx:423-424 conditionally renders `obs-badge urgent` span only when count > 0). Behavior matches real urgent count | 4/4 |

## D5: Build + Tests + Frozen Files (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS: `npx nest build` exits 0, no errors | 4/4 |
| 2 | tsc + vite build | PASS: `npx tsc --noEmit` exits 0; `npx vite build` exits 0 (442.70 kB JS) | 4/4 |
| 3 | jest observation | PASS: `npx jest observation --no-coverage` → 39 tests passed, 0 failed | 4/4 |
| 4 | No frozen files | PASS: `git diff --name-only` shows no changes to packages/, entities/, dto/, pages/, or student/ | 4/4 |
| 5 | New tests ≥ 5 | PASS: count=39 (baseline 33 + 6 new ≥ 5 threshold) | 4/4 |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Event Pipeline Completeness | 20/20 |
| D2: State Derivation Accuracy | 16/20 |
| D3: Real-time Alert Push | 20/20 |
| D4: Teacher Observation Panel | 12/20 |
| D5: Build + Tests + Frozen Files | 20/20 |
| **Penalties** | -0 |
| **Total** | **88/100** |

总分: 88/100

## What's Working Well
- **D1 is solid** — event pipeline is complete with sync persistence, full history passing, step_complete events, and real exerciseCorrectRate. Do NOT touch these.
- **D3 is solid** — SSE observation field piggybacked on state broadcast, frontend types fully defined, heartbeat is safe. Do NOT touch these.
- **D5 is solid** — all builds pass, 39 tests, no frozen file violations. Do NOT touch these.
- **D2 mostly solid** — deriveStatus logic, named constants, mixed signal handling, alert severity all work correctly. Only anchorStats runtime data is missing.

## Priority Fixes
1. [BACKEND] classroom.service.ts:1044-1053 — `initObservation` reads `lesson.manifestJson` from DB but the stored manifest may lack `observationAnchors`. Fix: either (a) re-import the manifest with the `observationAnchors` field into the DB, or (b) fall back to reading from the filesystem manifest.json when DB manifest lacks `observationAnchors`. This single fix would unblock D2.5 (+4), D4.2 (+4), and D4.3 (+4) = +12 points.
2. [BACKEND] Alternative simpler fix: Add a migration or startup hook that updates existing lesson records to include `observationAnchors` from the disk manifest files, ensuring the DB manifest stays in sync with the filesystem version.

Classification:
- [BACKEND]: server-side fix
