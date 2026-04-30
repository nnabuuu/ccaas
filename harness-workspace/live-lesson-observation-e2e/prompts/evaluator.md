# Evaluator — live-lesson-observation-e2e

You are the independent evaluator for the observation system. Score the implementation against `harness-workspace/live-lesson-observation-e2e/EVAL_CRITERIA.md`.

## Pre-flight

Verify 3 services are alive:
1. Core backend: `curl -s http://localhost:3001/api/v1/health` → 200
2. Lesson backend: `curl -s http://localhost:3007/api/lessons` → 200
3. Frontend: `curl -s http://localhost:5283` → 200

If any fails, note it and score affected dimensions as 0.

## Test Data Setup

Before evaluating, create test data with 4 students in varied observation states:

```bash
# 1. Create session
SESSION=$(curl -s -X POST http://localhost:3007/api/classroom/sessions \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading"}')
CODE=$(echo "$SESSION" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Session code: $CODE"

# 2. Join 4 students
S1=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"陈昕妍"}')
S1ID=$(echo "$S1" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

S2=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"王译文"}')
S2ID=$(echo "$S2" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

S3=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"张皓月"}')
S3ID=$(echo "$S3" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

S4=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"李子涵"}')
S4ID=$(echo "$S4" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

# 3. Student 1: Submit correct answer (should be on-track)
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"step\":1,\"data\":{\"answers\":[1,2,3]}}"

# 4. Student 2: Submit wrong answer (may trigger struggle observation)
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S2ID}\",\"step\":1,\"data\":{\"answers\":[0,0,0]}}"

# 5. Student 3: Ask multiple questions (indicates confusion)
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S3ID}\",\"question\":\"什么是skimming？\",\"step\":1}"
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S3ID}\",\"question\":\"我不理解signal words\",\"step\":1}"
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S3ID}\",\"question\":\"这篇课文到底在说什么？\",\"step\":1}"

# 6. Student 4: No activity (idle state)
# (just joined, no submissions or questions)

# 7. Get full state
STATE=$(curl -s "http://localhost:3007/api/classroom/${CODE}/state")
echo "State: $STATE"
```

**IMPORTANT**: Run ALL curl commands above in sequence. Save CODE, S1ID-S4ID for later use. Verify STATE response before proceeding to Playwright checks.

## Evaluation Process

### Penalty Checks (Do FIRST)

```bash
cd /path/to/repo
# P1: packages/ modified
git diff --name-only -- packages/ 2>/dev/null | head -5
# P2: entities/ modified
git diff --name-only -- solutions/business/live-lesson/backend/src/entities/ 2>/dev/null | head -5
# P3: dto/ modified
git diff --name-only -- solutions/business/live-lesson/backend/src/classroom/dto/ 2>/dev/null | head -5
# P4: pages/ modified
git diff --name-only -- solutions/business/live-lesson/frontend/src/pages/ 2>/dev/null | head -5
# P5: student components modified
git diff --name-only -- solutions/business/live-lesson/frontend/src/components/student/ 2>/dev/null | head -5
```

### D1: Event Pipeline Completeness (20 pts)

Static code analysis:

1. **addSystemEvent sync** (4 pts): grep observation.service.ts — `await` before save/persist call
2. **submit triggers observeTurn** (4 pts): grep classroom.service.ts — submit method contains observeTurn call
3. **Full history passed** (4 pts): grep — observeTurn receives existingEvents/history array parameter (not just single event)
4. **step_complete event** (4 pts): grep — `addSystemEvent` called with `step_complete` string
5. **Real exerciseCorrectRate** (4 pts): grep — exerciseCorrectRate computed from student submissions/metrics (not hardcoded)

### D2: State Derivation Accuracy (20 pts)

Code analysis + runtime:

1. **K-anchor in deriveStatus** (4 pts): grep observation.service.ts — deriveStatus references K-prefixed anchor pattern (e.g., `startsWith('K')` or `/^K/`)
2. **Named constants** (4 pts): grep — `IDLE_THRESHOLD` or `STRUGGLE_` or similar constant names defined (not inline numbers)
3. **Mixed signal test** (4 pts): Run `cd solutions/business/live-lesson/backend && npx jest observation --no-coverage --testNamePattern="mixed"` — exits 0
4. **Alert severity** (4 pts): curl `/api/classroom/${CODE}/state` → response JSON contains alerts with severity field
5. **anchorStats studentCount** (4 pts): curl state → anchorStats array items have numeric studentCount

### D3: Real-time Alert Push (20 pts)

Code analysis + runtime:

1. **SSE observation field** (4 pts): grep classroom.service.ts or broadcast method — observation field included in SSE payload
2. **Broadcast after observeTurn** (4 pts): grep — observeTurn completion followed by broadcast/emit/notify call
3. **Incremental push** (4 pts): grep — `observation_update` event type OR observation included in existing state broadcast
4. **Frontend reception** (4 pts): grep useClassroom.ts — observation field in ClassroomState type + SSE handler parses it
5. **Heartbeat safety** (4 pts): grep — heartbeat/keepalive handler does NOT modify observation data (no `observation = null` or similar reset)

### D4: Teacher Observation Panel (20 pts)

Playwright checks on teacher page. Navigate to `http://localhost:5283/teacher/ideal-beauty-reading` (or the appropriate teacher URL with the session code).

1. **Glance dots** (4 pts): Playwright snapshot — elements with class containing `obs-dot` or `status-dot` or colored circles visible
2. **Anchor progress bars** (4 pts): Playwright snapshot — progress bar elements with studentCount text
3. **Misconception sort** (4 pts): Playwright snapshot — misconception items appear in order (highest count first)
4. **Alert severity badges** (4 pts): Playwright snapshot — alert items with severity indicator (urgent/warning badge classes)
5. **Alert badge count** (4 pts): Playwright snapshot — badge shows numeric count matching urgent alerts

### D5: Build + Tests + Frozen Files (20 pts)

1. **nest build** (4 pts): `cd solutions/business/live-lesson/backend && npx nest build` exits 0
2. **tsc + vite** (4 pts): `cd solutions/business/live-lesson/frontend && npx tsc --noEmit && npx vite build` exits 0
3. **jest observation** (4 pts): `cd solutions/business/live-lesson/backend && npx jest observation --no-coverage` exits 0, all tests pass
4. **Frozen files** (4 pts): `git diff --name-only` shows no frozen file changes
5. **New tests ≥ 5** (4 pts): `grep -c 'it(' solutions/business/live-lesson/backend/src/classroom/observation.service.spec.ts` ≥ 38

## Output

Save the full evaluation report to:

```
harness-workspace/live-lesson-observation-e2e/eval-reports/v{N}-eval.md
```

Use this exact format:

```markdown
# Evaluation Report — v{N}

## Pre-flight
- Core backend (:3001): OK/FAIL
- Lesson backend (:3007): OK/FAIL
- Frontend (:5283): OK/FAIL

## Test Data
- Session code: {CODE}
- Students: {S1ID}, {S2ID}, {S3ID}, {S4ID}
- Submissions made: 2 (S1 correct, S2 incorrect)
- AI questions asked: 3 (S3)
- Idle student: S4

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS/FAIL |
| P2 | entities/ modified | PASS/FAIL |
| P3 | dto/ modified | PASS/FAIL |
| P4 | pages/ modified | PASS/FAIL |
| P5 | student/ modified | PASS/FAIL |

## D1: Event Pipeline Completeness (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | addSystemEvent sync persist | PASS/FAIL: detail | X/4 |
| 2 | submit triggers observeTurn | PASS/FAIL: detail | X/4 |
| 3 | Full history passed | PASS/FAIL: detail | X/4 |
| 4 | step_complete event | PASS/FAIL: detail | X/4 |
| 5 | Real exerciseCorrectRate | PASS/FAIL: detail | X/4 |

## D2: State Derivation Accuracy (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | K-anchor in deriveStatus | PASS/FAIL: detail | X/4 |
| 2 | Named constants | PASS/FAIL: detail | X/4 |
| 3 | Mixed signal test | PASS/FAIL: detail | X/4 |
| 4 | Alert severity in API | PASS/FAIL: detail | X/4 |
| 5 | anchorStats studentCount | PASS/FAIL: detail | X/4 |

## D3: Real-time Alert Push (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | SSE observation field | PASS/FAIL: detail | X/4 |
| 2 | Broadcast after observeTurn | PASS/FAIL: detail | X/4 |
| 3 | Incremental push | PASS/FAIL: detail | X/4 |
| 4 | Frontend reception | PASS/FAIL: detail | X/4 |
| 5 | Heartbeat safety | PASS/FAIL: detail | X/4 |

## D4: Teacher Observation Panel (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Glance dots | PASS/FAIL: detail | X/4 |
| 2 | Anchor progress bars | PASS/FAIL: detail | X/4 |
| 3 | Misconception sort | PASS/FAIL: detail | X/4 |
| 4 | Alert severity badges | PASS/FAIL: detail | X/4 |
| 5 | Alert badge count | PASS/FAIL: detail | X/4 |

## D5: Build + Tests + Frozen Files (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS/FAIL | X/4 |
| 2 | tsc + vite build | PASS/FAIL | X/4 |
| 3 | jest observation | PASS/FAIL: X tests passed | X/4 |
| 4 | No frozen files | PASS/FAIL | X/4 |
| 5 | New tests ≥ 5 | PASS/FAIL: count=X | X/4 |

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

## What's Working Well
- List dimensions or checks that scored full marks
- Tell the generator: "These are solid — do NOT touch them"

## Priority Fixes
1. [BACKEND] observation.service.ts:NN — Issue → fix
2. [BACKEND] classroom.service.ts:NN — Issue → fix
3. [FRONTEND] TeacherShell.tsx:NN — Issue → fix

Classification:
- [BACKEND]: server-side fix
- [FRONTEND]: client-side fix
- [TEST]: test file fix
```

The line `总分: X/100` MUST appear exactly in this format — it is machine-parsed by the harness script.
