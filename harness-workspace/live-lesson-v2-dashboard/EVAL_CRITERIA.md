# Evaluation Criteria — live-lesson-v2-dashboard

**Total: 100 points** across 5 dimensions (20 each).

---

## Scoring Anchors

| Score | Meaning |
|-------|---------|
| 5/5 (20/20) | All checks pass, data is real and correct |
| 3/5 (12/20) | Core structure present but some checks fail or data is hardcoded |
| 1/5 (4/20) | Dimension attempted but mostly broken or placeholder |

---

## D1: Backend Data Layer (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Manifest `answerKey` field exists for all 5 task steps | 3 | `grep -c "answerKey" data/lessons/ideal-beauty-reading/manifest.json` ≥ 5 |
| 2 | Submit API returns score in response | 4 | `curl -X POST /api/classroom/:code/submit` → response body contains `"score"` with numeric value |
| 3 | ClassroomState contains `students[].currentTask` | 3 | `curl /api/classroom/:code/state` → verify `students[0].currentTask` is a number |
| 4 | ClassroomState contains `stepMetrics` with `completionRate` | 3 | `curl /api/classroom/:code/state` → verify `stepMetrics` object with numeric `completionRate` |
| 5 | Step time tracking (`stepStartedAt`) | 3 | `curl /api/classroom/:code/state` → verify `students[0].stepStartedAt` or equivalent timestamp field |
| 6 | Question persistence via `ai/ask` | 2 | `curl -X POST /ai/ask` → then `curl /state` → verify `questions[]` array contains the submitted question |
| 7 | NestJS backend builds successfully | 2 | `cd backend && npx nest build` exits 0 |

**Detection flow for D1:**
1. Start backend on :3007
2. Create session: `curl -X POST /api/classroom/sessions -d '{"lessonId":"ideal-beauty-reading"}'` → get `code`
3. Join as student: `curl -X POST /api/classroom/{code}/join -d '{"name":"TestBot"}'` → get `studentId`
4. Submit answer: `curl -X POST /api/classroom/{code}/submit -d '{"studentId":"...","step":1,"data":{...}}'`
5. Check state: `curl /api/classroom/{code}/state`
6. Submit question: `curl -X POST /api/classroom/{code}/ai/ask -d '{"studentId":"...","question":"test","step":1}'`
7. Re-check state for questions

---

## D2: Teacher V2 — Layout + Swimlane (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Band + Timeline bar rendered | 2 | Playwright snapshot: `.band` or `[class*=band]` visible, timeline/scrubber area visible |
| 2 | Health Cards 4-grid (最快进度/中位进度/卡点学生/AI对话) | 3 | Playwright: 4 health card elements with real step numbers or counts (not all zeros after submissions) |
| 3 | Swimlane 5 rows rendered (one per task) | 4 | Playwright: 5 swim-row elements or equivalent, each with task label |
| 4 | Student dots with name + color coding | 3 | Playwright: student dot/chip elements visible with green/blue/amber coloring |
| 5 | Click swim-row → StepDetail panel opens | 3 | Playwright: click a row → detail panel becomes visible with step info |
| 6 | StepDetail quality bars show real data | 3 | Playwright: quality/accuracy bars visible with non-zero width after submissions exist |
| 7 | Click student dot → Student Modal opens | 2 | Playwright: click a dot → modal/overlay with student name + submission data |

**Detection flow for D2:**
1. Navigate to teacher URL (e.g., `http://localhost:5283/teacher/ideal-beauty-reading`)
2. Wait for classroom to load
3. Take snapshot, verify layout elements
4. Simulate student submissions via curl in parallel
5. Refresh/wait for SSE update, verify data binding

---

## D3: Teacher V2 — Right Column + Modal (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | AI Section shows empty state correctly | 2 | Playwright: AI section area visible with "—" or empty state text |
| 2 | Question Queue shows real questions | 3 | Playwright: after `ai/ask` curl, queue section has question row elements |
| 3 | Student Modal displays submission matrix/data | 4 | Playwright: modal shows table or structured data from student's submission |
| 4 | Student Modal error marking on wrong answers | 3 | Playwright: incorrect cells have error styling (red text, strikethrough, or error class) |
| 5 | Coaching section collapsible | 2 | Playwright: coaching toggle → body expands/collapses |
| 6 | Patterns section has empty state text | 2 | Playwright: patterns area shows placeholder text |
| 7 | `tsc --noEmit` passes | 2 | `cd frontend && npx tsc --noEmit` exits 0 |
| 8 | `vite build` passes | 2 | `cd frontend && npx vite build` exits 0 |

---

## D4: Student V2 (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | 5 Task progress dots rendered | 3 | Playwright: 5 progress indicator elements (dots or numbered steps) |
| 2 | 4 Phase progressive unlock (Listen → Practice → Discuss → Takeaway) | 4 | Playwright: initially only Listen+Practice visible; after Practice submit, Discuss unlocks |
| 3 | Quiz exercise with immediate feedback | 3 | Playwright: select quiz option → correct/incorrect feedback shown |
| 4 | Matrix exercise with table inputs | 3 | Playwright: Step 3 shows matrix table with input fields |
| 5 | TextPanel with paragraph display + focus dimming | 3 | Playwright: right panel shows article text, non-focus paragraphs are dimmed |
| 6 | Submit sends to backend and receives score | 2 | curl verify: after Playwright submit action, state API shows submission with score |
| 7 | Task completion → can proceed to next task | 2 | Playwright: complete all phases → "Next" or next task becomes accessible |

**Detection flow for D4:**
1. Navigate to student URL via join flow
2. Verify initial Task 1 layout
3. Interact with exercises
4. Verify phase progression

---

## D5: End-to-End Integration (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Student submit → Teacher swimlane real-time update | 5 | Playwright dual-tab: student submits → teacher tab's student dot changes color/position |
| 2 | Teacher Health Cards update on submissions | 3 | Playwright: after submissions, health card values change (completion count increases) |
| 3 | StepDetail accuracy bars update on submissions | 3 | Playwright: after submissions, quality bar widths change |
| 4 | Teacher Question Queue updates on ai/ask | 3 | curl `ai/ask` → Playwright: teacher's queue section gains a new question row |
| 5 | Legacy `/lesson` route still works | 3 | Playwright: navigate `/lesson/math-linear-eq-intro` → page renders without error |
| 6 | CourseSelectionPage reading card navigation | 3 | Playwright: click reading lesson card → navigates to correct teacher/student route |

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | Any file in `packages/` modified | D1 = 0 |
| P2 | Any file in `mcp-server/src/` modified | D1 = 0 |
| P3 | `/lesson` route broken (doesn't render) | D5 = 0 |

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
| D1: Backend Data Layer | X/20 |
| D2: Teacher Layout + Swimlane | X/20 |
| D3: Teacher Right Col + Modal | X/20 |
| D4: Student V2 | X/20 |
| D5: E2E Integration | X/20 |
| **Penalties** | -X |
| **Total** | **X/100** |

总分: X/100
```

The last line `总分: X/100` is machine-parsed by the harness script. It MUST appear exactly in this format.
