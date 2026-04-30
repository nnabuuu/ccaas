# Evaluator — live-lesson-teacher-v2-fidelity

You are the independent evaluator for the teacher shell high-fidelity rewrite. Score the implementation against `harness-workspace/live-lesson-teacher-v2-fidelity/EVAL_CRITERIA.md`.

## Pre-flight

Verify 3 services are alive:
1. Core backend: `curl -s http://localhost:3001/api/v1/health` → 200
2. Lesson backend: `curl -s http://localhost:3007/api/lessons` → 200
3. Frontend: `curl -s http://localhost:5283` → 200

If any fails, note it and score affected dimensions as 0.

## Test Data Setup

Before evaluating, create test data via curl:

```bash
# 1. Create session
SESSION=$(curl -s -X POST http://localhost:3007/api/classroom/sessions \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading"}')
CODE=$(echo "$SESSION" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Session code: $CODE"

# 2. Join 3 students
S1=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"陈昕妍"}')
S1ID=$(echo "$S1" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

S2=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"王译文"}')
S2ID=$(echo "$S2" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

S3=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"张皓月"}')
S3ID=$(echo "$S3" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

# 3. Submit answers — Student 1: Task 1 (quiz, all correct)
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"step\":1,\"data\":{\"answers\":[1,2,0]}}"

# 4. Submit answers — Student 1: Task 2 (match)
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"step\":2,\"data\":{\"answers\":[\"Phenomenon\",\"History\",\"Culture\",\"Conclusion\"]}}"

# 5. Submit answers — Student 2: Task 1 (quiz, 2/3 correct)
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S2ID}\",\"step\":1,\"data\":{\"answers\":[1,0,0]}}"

# 6. Submit question
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"question\":\"Myanmar在哪里？\",\"step\":3}"

# 7. Get state to verify
STATE=$(curl -s "http://localhost:3007/api/classroom/${CODE}/state")
echo "State: $STATE"
```

**IMPORTANT**: Run ALL curl commands above in sequence. Save CODE, S1ID, S2ID, S3ID for later use. Verify STATE has students + submissions before proceeding to Playwright.

## Evaluation Process

### Penalty Checks (Do FIRST)

Before scoring dimensions, check for frozen file violations:

```bash
cd solutions/business/live-lesson
# P1: packages/ modified
git diff --name-only -- ../../../packages/ 2>/dev/null | head -5
# P2: backend/src/ modified
git diff --name-only -- backend/src/ 2>/dev/null | head -5
# P3: frontend/src/hooks/ modified
git diff --name-only -- frontend/src/hooks/ 2>/dev/null | head -5
# P4: frontend/src/pages/ modified
git diff --name-only -- frontend/src/pages/ 2>/dev/null | head -5
# P5: frontend/src/components/student/ modified
git diff --name-only -- frontend/src/components/student/ 2>/dev/null | head -5
```

If any penalty triggers, apply it per EVAL_CRITERIA.md.

### D1: Layout Fidelity (20 pts)

Navigate to the teacher page. The URL format is:
`http://localhost:5283/teacher/ideal-beauty-reading`

Wait for the page to load, then use `browser_snapshot` to check:

1. **Band + badges** (3 pts): Look for band/topbar with "课堂观察台", mode badge, self badge
2. **Live indicator** (2 pts): Green dot + "实时同步中" text
3. **Timeline** (3 pts): Timeline/scrubber area with track/markers
4. **Health Cards** (4 pts): 4 cards with labels: 最快进度, 中位进度, 卡点学生, AI对话
5. **Body grid** (4 pts): Two-column layout (focus left + overview right)
6. **Step Card structure** (4 pts): `.step-card` elements with header/metrics/dots — NOT `.swim-row`

### D2: Step Cards + Data Binding (20 pts)

Continue on the teacher page (with test data already created):

1. **5 step cards** (3 pts): Count step-card elements = 5
2. **Card headers** (3 pts): Each has step number + name + type badge
3. **Metrics strip** (3 pts): Accuracy bar + metrics text visible
4. **Student dots** (3 pts): After 3 students joined, dots visible with color variation
5. **Click → step detail** (4 pts): Click a step card → right column updates with step info
6. **Quality bars** (4 pts): After submissions, bars show non-zero widths

### D3: Student Modal + Journey (20 pts)

Continue on the teacher page:

1. **Click dot → modal** (3 pts): Click a student dot → modal opens with student name
2. **Journey Strip** (4 pts): Modal has 5-step horizontal timeline
3. **Journey status icons** (3 pts): Nodes show different status icons based on progress
4. **Click journey node** (2 pts): Click node → modal content changes to show that step
5. **Submission detail** (4 pts): Left column shows quiz ✓/✗ or matrix table
6. **Class Compare bars** (4 pts): Right column shows comparison bars (student vs class avg)

### D4: Real Data Only — Zero Mock (20 pts)

1. **grep DEMO/MOCK** (5 pts):
```bash
grep -c "DEMO_STUDENTS\|MOCK_QUEUE\|MOCK_.*_SUB" solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
```
Must return 0. Also check any new sub-component files under `teacher/`.

2. **No hardcoded student arrays** (3 pts):
```bash
grep -rn "const.*\[.*{.*name.*['\"]陈\|王\|张\|李" solutions/business/live-lesson/frontend/src/components/teacher/
```
Must return 0.

3. **Empty state** (4 pts): Open a FRESH teacher page with a new session (different from test data session). Before any students join, verify "等待学生加入" or equivalent empty state text is visible, plus the session code.

4. **Live data renders** (4 pts): Go back to the test data teacher page → health cards show non-zero values, dots visible

5. **Score in modal** (4 pts): Open modal for a student with submissions → score/submission data visible

### D5: Polish + Build (20 pts)

1. **tsc** (3 pts): `cd solutions/business/live-lesson/frontend && npx tsc --noEmit` — exit 0
2. **vite build** (3 pts): `cd solutions/business/live-lesson/frontend && npx vite build` — exit 0
3. **Patterns** (2 pts): Patterns area visible (empty state text OK)
4. **Coaching toggle** (3 pts): Click coaching toggle → section expands/collapses
5. **Question queue** (3 pts): After ai/ask curl, question rows visible in queue
6. **CSS tokens** (3 pts): `grep -c "var(--" solutions/business/live-lesson/frontend/src/styles/teacher.css` ≥ 10
7. **No frozen files** (3 pts): Verify no frozen files modified via git diff

## Output

Save the full evaluation report to:

```
harness-workspace/live-lesson-teacher-v2-fidelity/eval-reports/v{N}-eval.md
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
- Students: {S1ID}, {S2ID}, {S3ID}
- Submissions: {count} submitted
- Questions: {count} asked

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS/FAIL |
| P2 | backend/src/ modified | PASS/FAIL |
| P3 | hooks/ modified | PASS/FAIL |
| P4 | pages/ modified | PASS/FAIL |
| P5 | student/ modified | PASS/FAIL |

## D1: Layout Fidelity (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Band + badges | PASS/FAIL: detail | X/3 |
| 2 | Live indicator | PASS/FAIL: detail | X/2 |
| 3 | Timeline | PASS/FAIL: detail | X/3 |
| 4 | Health Cards 4-grid | PASS/FAIL: detail | X/4 |
| 5 | Body grid | PASS/FAIL: detail | X/4 |
| 6 | Step Card structure | PASS/FAIL: detail | X/4 |

## D2: Step Cards + Data Binding (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | 5 step cards | PASS/FAIL: detail | X/3 |
| 2 | Card headers | PASS/FAIL: detail | X/3 |
| 3 | Metrics strip | PASS/FAIL: detail | X/3 |
| 4 | Student dots | PASS/FAIL: detail | X/3 |
| 5 | Click → step detail | PASS/FAIL: detail | X/4 |
| 6 | Quality bars | PASS/FAIL: detail | X/4 |

## D3: Student Modal + Journey (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Click dot → modal | PASS/FAIL: detail | X/3 |
| 2 | Journey Strip | PASS/FAIL: detail | X/4 |
| 3 | Journey status icons | PASS/FAIL: detail | X/3 |
| 4 | Click journey node | PASS/FAIL: detail | X/2 |
| 5 | Submission detail | PASS/FAIL: detail | X/4 |
| 6 | Class Compare bars | PASS/FAIL: detail | X/4 |

## D4: Real Data Only — Zero Mock (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | grep DEMO/MOCK = 0 | PASS/FAIL: count | X/5 |
| 2 | No hardcoded arrays | PASS/FAIL: detail | X/3 |
| 3 | Empty state | PASS/FAIL: detail | X/4 |
| 4 | Live data renders | PASS/FAIL: detail | X/4 |
| 5 | Score in modal | PASS/FAIL: detail | X/4 |

## D5: Polish + Build (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | tsc --noEmit | PASS/FAIL | X/3 |
| 2 | vite build | PASS/FAIL | X/3 |
| 3 | Patterns section | PASS/FAIL: detail | X/2 |
| 4 | Coaching toggle | PASS/FAIL: detail | X/3 |
| 5 | Question queue | PASS/FAIL: detail | X/3 |
| 6 | CSS tokens | PASS/FAIL: count | X/3 |
| 7 | No frozen files | PASS/FAIL | X/3 |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Layout Fidelity | X/20 |
| D2: Step Cards + Data Binding | X/20 |
| D3: Student Modal + Journey | X/20 |
| D4: Real Data Only — Zero Mock | X/20 |
| D5: Polish + Build | X/20 |
| **Penalties** | -X |
| **Total** | **X/100** |

总分: X/100

## What's Working Well
- List dimensions or checks that scored full marks
- Tell the generator: "These are solid — do NOT touch them"

## Priority Fixes
1. [COMPONENT] file.tsx:NN — Expected `<element>` but found none → add the element
2. [DESIGN] teacher.css — Issue description → fix
3. [DATA] TeacherShell.tsx:NN — Issue description → fix

Classification:
- [COMPONENT]: single file fix, generator can do it
- [DESIGN]: CSS/layout issue, visual only
- [DATA]: data binding or mock removal issue
```

The line `总分: X/100` MUST appear exactly in this format — it is machine-parsed by the harness script.
