## Critical Premise — Fresh Context

You are running via `claude -p` with ZERO memory of previous iterations.
The following files are your COMPLETE memory — read them in order:

1. `harness-workspace/live-lesson-v2-dashboard/SPEC.md` — what to build
2. Current artifact code — what exists now
3. `harness-workspace/live-lesson-v2-dashboard/eval-reports/v{N-1}-eval.md` — what's wrong
4. `harness-workspace/live-lesson-v2-dashboard/progress.md` — iteration history
5. Design reference files listed in SPEC.md — design truth

If a file doesn't exist yet (e.g., first iteration), skip it.

---

# Generator — live-lesson-v2-dashboard

You are the implementation agent for the live-lesson V2 dashboard upgrade. Your job is to implement changes to the backend data layer, teacher dashboard, and student task flow based on the V2 design prototypes.

## Step 0: Read Context

1. Read `harness-workspace/live-lesson-v2-dashboard/SPEC.md` — full specification
2. Read `harness-workspace/live-lesson-v2-dashboard/progress.md` — iteration history
3. Read the latest eval report in `harness-workspace/live-lesson-v2-dashboard/eval-reports/` (if exists)
4. Read `solutions/business/live-lesson/CLAUDE.md` — system architecture

## Step 1: Read Design References

Read ALL of these files — they are your design truth:

```
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/teacher.html
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/student-app.jsx
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/student.html
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/demo.html
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/colors_and_type.css
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/teacher-dashboard-design.md
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/student-modal-redesign.md
```

Also read the existing code you'll be modifying:
```
solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json
solutions/business/live-lesson/backend/src/classroom/classroom.service.ts
solutions/business/live-lesson/backend/src/entities/  (all files)
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/components/student/StudentShell.tsx
solutions/business/live-lesson/frontend/src/hooks/useClassroom.ts
solutions/business/live-lesson/frontend/src/hooks/useReadingLesson.ts
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/frontend/src/styles/student.css
solutions/business/live-lesson/frontend/src/types/reading.ts
solutions/business/live-lesson/frontend/src/pages/CourseSelectionPage.tsx
solutions/business/live-lesson/frontend/src/App.tsx (or router file)
```

## Step 2: Implementation Phases

Execute these phases IN ORDER. After each phase, run the validation command shown.

### Phase 1: Manifest Answer Key

Add `answerKey` to each task step in `manifest.json`:

- **s1 (Task 1, quiz)**: 3 MCQ correct answer indices. Look at the quiz data in `student-app.jsx` TASKS[0].exercise to find the correct answers.
- **s2 (Task 2, match)**: 4 paragraph-section correct pairs: ¶1-2→Phenomenon, ¶3-4→History, ¶5-7→Culture, ¶8→Conclusion
- **s3 (Task 3, matrix)**: 6 rows with Place/Practice/Reason. Row 0 (Egypt) is demo. Rows 1-5 from the article.
- **s4 (Task 4, stance)**: Valid positions (agree/partly/disagree) + minEvidence=2
- **s5 (Task 5, order)**: Correct order = [Predict, Skim, Scan, Evaluate]

Place the `answerKey` inside each task step's object (same level as `teacherView`/`studentView`).

**Validation**: `grep -c "answerKey" solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json` should return ≥ 5.

### Phase 2: Backend — Auto-Grading + Progress

Modify `backend/src/`:

1. **Submission entity**: Add `score` JSON column to store grading result
2. **Student entity**: Add `currentTask` (number), `currentPhase` (string), `stepStartedAt` (datetime) columns
3. **classroom.service.ts**:
   - In `submit()`: load manifest → get answerKey → compare → calculate score → store in submission → return score
   - In `getState()`: include `students[].currentTask`, `students[].stepStartedAt`, `stepMetrics` computed from submissions, `questions[]` array
   - In `join()`: initialize `currentTask=1`, `currentPhase='listen'`, `stepStartedAt=now`
   - In `aiAsk()`: persist the question to a `questions` table or in-memory array, broadcast via SSE
4. **Question storage**: Either add a `Question` entity or store questions as JSON in session

**Validation**: `cd solutions/business/live-lesson/backend && npx nest build`

### Phase 3: Frontend — Design Tokens + CSS

1. Update `reading-tokens.css` (or create if needed) with ALL V2 CSS variables from `colors_and_type.css`
2. Rewrite `teacher.css` — extract all styles from `teacher.html`'s `<style>` block
3. Update `student.css` with student-specific styles from `student-app.jsx`'s `S` style object

**Validation**: `cd solutions/business/live-lesson/frontend && npx tsc --noEmit`

### Phase 4: Frontend — Teacher V2

Rewrite `TeacherShell.tsx`:

From `teacher.html`, implement:
- `.band` topbar (44px) with classroom info
- `.timeline` scrubber (40px) with task markers
- `.body` grid (1fr 330px):
  - Left `.focus`: health cards (4-grid) + swimlane (5 rows) + patterns (empty state) + coaching (collapsible, empty state)
  - Right `.overview`: step detail panel + AI section (empty state: "—") + question queue

**Critical: Use REAL backend data**:
- Health cards bind to `stepMetrics` (fastest/median step, stuck count)
- Swimlane dots bind to `students[].currentTask` and submission scores
- Step detail bars bind to per-step accuracy from `stepMetrics`
- Question queue binds to `state.questions[]`

**Student Detail Modal**: Click student dot → modal with:
- Header: name, step, phase, time, submission count
- Left: submission data table (matrix with error marks for wrong answers)
- Right: empty state for AI (out of scope)

**Validation**: `cd solutions/business/live-lesson/frontend && npx tsc --noEmit`

### Phase 5: Frontend — Student V2

Rewrite `StudentShell.tsx` based on `student-app.jsx`:

- Top bar + 5 progress dots
- `TaskView` with sticky phase nav: Listen → Practice → Discuss → Takeaway
- Phase unlock logic: Practice submission → Discuss unlocks → Discuss completion → Takeaway unlocks
- 5 exercise types: quiz, match, matrix, stance, order
- `TextPanel` (right column): article paragraphs with focus dimming + signal word highlighting
- `AIFloat` (fixed FAB): preset Q&A chips + free text → sends to `ai/ask` endpoint
- On exercise submit: POST to backend → show score feedback → update progress

**Validation**: `cd solutions/business/live-lesson/frontend && npx tsc --noEmit && npx vite build`

### Phase 6: Integration Verification

1. Verify SSE sync: student submit → teacher dashboard updates via `useClassroom` SSE hook
2. Verify health cards and swimlane update when `classroomState` changes
3. Verify question queue updates on `ai/ask`
4. Verify legacy route: `/lesson/math-linear-eq-intro` still works — DO NOT remove or break existing routes
5. Verify CourseSelectionPage: reading lesson card navigates correctly

## Frozen Directories — DO NOT MODIFY

```
packages/
solutions/business/edu-platform/
solutions/business/recipe-book/
solutions/business/live-lesson/mcp-server/src/
```

You CAN modify:
- `solutions/business/live-lesson/backend/src/` (backend service code)
- `solutions/business/live-lesson/data/` (manifest data)
- `solutions/business/live-lesson/frontend/` (frontend code)

## Changelog

After completing all phases, write a changelog to the path specified in the injected iteration context. Format:

```markdown
# Changelog v{N}

## Changes
- [Phase 1] Added answerKey to manifest for all 5 task steps
- [Phase 2] ...
- ...

## Files Modified
- `data/lessons/ideal-beauty-reading/manifest.json`
- `backend/src/classroom/classroom.service.ts`
- ...

## Known Issues
- ...
```
