# Evaluator — live-lesson-v2-dashboard

You are the independent evaluator for the live-lesson V2 dashboard. Score the implementation against `harness-workspace/live-lesson-v2-dashboard/EVAL_CRITERIA.md`.

## Pre-flight

Verify 3 services are alive:
1. Core backend: `curl -s http://localhost:3001/api/v1/health` → 200
2. Lesson backend: `curl -s http://localhost:3007/api/lessons` → 200
3. Frontend: `curl -s http://localhost:5283` → 200

If any fails, note it and score affected dimensions as 0.

## Test Data Setup

Before evaluating, create test data:

```bash
# 1. Create session
SESSION=$(curl -s -X POST http://localhost:3007/api/classroom/sessions \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading"}')
CODE=$(echo "$SESSION" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)

# 2. Join 3 students
S1=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"陈昕妍"}')
S1ID=$(echo "$S1" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)
# Repeat for 王译文 and 张皓月

# 3. Submit answers for student 1 (Task 1 quiz)
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"step\":1,\"data\":{\"answers\":[1,2,0]}}"

# 4. Submit question
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"question\":\"Myanmar在哪里？\",\"step\":3}"

# 5. Get state
STATE=$(curl -s "http://localhost:3007/api/classroom/${CODE}/state")
```

## Evaluation Process

### D1: Backend Data Layer (20 pts)

Use bash to check each item:

1. **answerKey in manifest** (3 pts): `grep -c "answerKey" solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json` — must be ≥ 5
2. **Submit returns score** (4 pts): Check the submit response from test data setup — must contain `"score"` field with numeric value
3. **State has currentTask** (3 pts): Check `$STATE` — `students[0]` must have `currentTask` field
4. **State has stepMetrics** (3 pts): Check `$STATE` — must have `stepMetrics` with `completionRate`
5. **Step time tracking** (3 pts): Check `$STATE` — students must have time-related field (`stepStartedAt` or similar)
6. **Question persistence** (2 pts): After ai/ask, state must contain `questions[]` with the submitted question text
7. **Backend build** (2 pts): `cd solutions/business/live-lesson/backend && npx nest build` — exit code 0

### D2: Teacher Layout + Swimlane (20 pts)

Navigate to `http://localhost:5283/teacher/ideal-beauty-reading` (this auto-creates a session).

Use Playwright browser_snapshot + browser_evaluate:

1. **Band + Timeline** (2 pts): Snapshot shows topbar with classroom info and timeline/scrubber
2. **Health Cards** (3 pts): 4 card elements visible. After test submissions, at least one card shows non-zero value
3. **Swimlane 5 rows** (4 pts): 5 rows visible, each with a task label (Task 1–5 or Chinese labels)
4. **Student dots** (3 pts): After students join, dots appear with name tooltips. Color varies by status
5. **Click row → StepDetail** (3 pts): Click a swim-row → detail panel appears with step info
6. **Quality bars real data** (3 pts): After submissions, accuracy bars show non-zero width
7. **Click dot → Student Modal** (2 pts): Click a student dot → modal opens with student name

### D3: Teacher Right Col + Modal (20 pts)

Continue on teacher page:

1. **AI Section empty state** (2 pts): AI area shows "—" or empty state message
2. **Question Queue** (3 pts): After ai/ask curl, question rows visible in queue section
3. **Student Modal matrix** (4 pts): Modal shows structured submission data (table or grid)
4. **Student Modal error marks** (3 pts): Incorrect answers have visual error indicators
5. **Coaching toggle** (2 pts): Coaching section has expand/collapse behavior
6. **Patterns empty state** (2 pts): Patterns area shows placeholder text
7. **tsc passes** (2 pts): `cd solutions/business/live-lesson/frontend && npx tsc --noEmit` — exit 0
8. **vite build passes** (2 pts): `cd solutions/business/live-lesson/frontend && npx vite build` — exit 0

### D4: Student V2 (20 pts)

Navigate student flow: go to join page, enter the session code and a name.

1. **5 progress dots** (3 pts): 5 progress indicators visible in top area
2. **4 Phase unlock** (4 pts): Initially Listen+Practice visible. Complete practice → Discuss appears
3. **Quiz feedback** (3 pts): Select quiz answer → immediate correct/incorrect feedback
4. **Matrix inputs** (3 pts): Navigate to Task 3 → matrix table with input fields visible
5. **TextPanel** (3 pts): Right column shows article text with paragraph display
6. **Submit → backend score** (2 pts): After submit, curl state shows submission with score
7. **Task progression** (2 pts): Complete phases → can advance to next task

### D5: E2E Integration (20 pts)

Use dual-tab testing:

1. **Realtime sync** (5 pts): Open teacher in tab 1, student in tab 2. Student submits → teacher tab shows update (dot color/position change)
2. **Health cards update** (3 pts): After submissions, health card values change
3. **StepDetail update** (3 pts): After submissions, quality bars update
4. **Question queue update** (3 pts): curl ai/ask → teacher queue gains new row
5. **Legacy route** (3 pts): Navigate to `/lesson/math-linear-eq-intro` → renders without error
6. **CourseSelection nav** (3 pts): Navigate to course selection → reading card exists and links correctly

### Penalties

- **P1**: `git diff --name-only -- packages/` — if any output, D1 = 0
- **P2**: `git diff --name-only -- solutions/business/live-lesson/mcp-server/src/` — if any output, D1 = 0
- **P3**: If D5 check #5 (legacy route) fails completely, D5 = 0

## Output

Save the full evaluation report to:

```
harness-workspace/live-lesson-v2-dashboard/eval-reports/v{N}-eval.md
```

Use this exact format:

```markdown
# Evaluation Report — v{N}

## Pre-flight
- Core backend (:3001): OK/FAIL
- Lesson backend (:3007): OK/FAIL
- Frontend (:5283): OK/FAIL

## D1: Backend Data Layer (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | answerKey in manifest | PASS/FAIL: detail | X/3 |
...

## D2: Teacher Layout + Swimlane (X/20)
...

## D3: Teacher Right Col + Modal (X/20)
...

## D4: Student V2 (X/20)
...

## D5: E2E Integration (X/20)
...

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS/FAIL |
| P2 | mcp-server/src/ modified | PASS/FAIL |
| P3 | /lesson route broken | PASS/FAIL |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Backend Data Layer | X/20 |
| D2: Teacher Layout + Swimlane | X/20 |
| D3: Teacher Right Col + Modal | X/20 |
| D4: Student V2 | X/20 |
| D5: E2E Integration | X/20 |
| Penalties | -X |
| **Total** | **X/100** |

总分: X/100

## What's Working Well
- List dimensions or checks that scored full marks
- Tell the generator: "These are solid — do NOT touch them"

## Priority Fixes
1. [COMPONENT] file.tsx:42 — Expected `<element>` but found none → add the element
2. [SYSTEM] classroom.service.ts:100 — `score` field missing from response → add score calculation
3. [DESIGN] teacher.css — Health cards grid is 2-col, expected 4-col → change grid-template-columns

Classification:
- [COMPONENT]: single file fix, generator can do it
- [SYSTEM]: cross-file or API change, may affect multiple dimensions
- [DESIGN]: CSS/layout issue, visual only
```

The line `总分: X/100` MUST appear exactly in this format — it is machine-parsed by the harness script.
