# v4 Changelog — live-lesson-v2-dashboard

**Starting score:** 79/100 (v3)
**Focus:** D4 (Student V2) — 13 pts recoverable

## Strategy

Single-focus on D4 (Student V2 task flow), the highest-impact dimension.
D1 (20/20), D2 (20/20), D5 (20/20) untouched to avoid regression.

## Root Cause Analysis

| Fix ID | Dimension | Root Cause | Type | Points |
|--------|-----------|-----------|------|--------|
| F1 | D4 #3 | Quiz uses text inputs instead of radio MCQ | B (Wrong) | 3 |
| F2 | D4 #6 | Submit handler sends local state only, no backend call | B (Wrong) | 2 |
| F3 | D4 #2 | No phase unlock (instruction → exercise gating) | A (Missing) | 4 |
| F4 | D4 #7 | No task progression (dot fill + auto-advance) | A (Missing) | 2 |
| F5 | D4 #4 | Matrix unreachable because tasks don't progress | A (Missing) | 3 |

## Changes

### 1. `types/reading.ts` — Add manifest type fields
- Added `type?: 'instruction' | 'task'` to `ReadingStep`
- Added `answerKey?` with typed structure for quiz/match/matrix/stance/order
- Added `studentView?` for instruction content (title, body, keyPoints, confirmLabel)
- Added `teacherView?` for teacher-facing metadata

### 2. `App.tsx` — Add /join route
- Imported `JoinPage` and added `<Route path="/join" element={<JoinPage />} />`
- Enables session-based student join flow

### 3. `StepTabs.tsx` — Support completed task tracking
- Added optional `completed?: Set<number>` prop
- When provided, uses `completed.has(i)` for 'done' class instead of positional check
- Backward compatible: falls back to `i < current` when not provided

### 4. `StudentShell.tsx` — Phase system + session integration (MAJOR)
- **Props**: Added optional `sessionCode` and `lessonId` props
- **Task grouping**: Filters manifest into 5 task steps + 5 instruction steps; StepTabs shows 5 dots instead of 10
- **Phase system**: Each task has listen (instruction) → practice (exercise) phases
  - `instructionConfirmed` set tracks which tasks have passed the instruction phase
  - When instruction not confirmed, renders `InstructionPanel`; after confirm, renders `TaskPanel`
- **Session integration**: Uses `useStudentSession(sessionCode)` hook for backend submission
  - `handleSubmit` calls `session.submit(stepIdx, data)` when session available
  - Falls back to mock success for embed/demo mode
- **Task progression**: `taskCompleted` set tracks finished tasks
  - After submit, auto-advances to next task via `handleTaskComplete`
  - StepTabs highlights completed tasks with filled dots
  - Navigation gated: can only go to tasks where `previous task completed`
- **DemoShell sync**: Maps step indices to task groups (step/2 = taskIdx, odd = practice phase)

### 5. `TaskPanel.tsx` — Complete exercise rewrite (MAJOR)
- **New interface**: Accepts `taskNumber` (1-5), `onSubmit` callback, `onComplete` callback
- **Task 1 (Quiz)**: Radio MCQ with 3 questions (was: text inputs)
  - Hardcoded questions from reference design with 4 options each
  - Submits `{ answers: [selectedIdx, ...] }` at `step.idx` (=1)
- **Task 2 (Match)**: Structure decode with 4 paragraph groups (was: 3)
  - Added ¶1-2 → Phenomenon pair
  - Options: Phenomenon/History/Culture/Conclusion
  - Submits `{ answers: ['Phenomenon', 'History', 'Culture', 'Conclusion'] }` at step.idx (=3)
- **Task 3 (Matrix)**: 6-row matrix with demo row (was: 5 rows)
  - Added 1600s Europe row
  - Controlled inputs with state tracking
  - Submits `{ rows: [{place, practice, reason}, ...] }` at step.idx (=5)
- **Task 4 (Stance)**: Position selector + evidence inputs (was: single textarea)
  - 3 position buttons: agree/partly/disagree
  - Dynamic evidence inputs with "add more" button
  - Submits `{ position, evidence: [...] }` at step.idx (=7)
- **Task 5 (Order)**: Drag-to-reorder with up/down buttons (was: static display)
  - Shuffled initial order: Scan, Evaluate, Predict, Skim
  - Submits `{ order: [...] }` at step.idx (=9)
- **All tasks**: Show loading state during submit, success feedback after, "下一任务 →" button

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `frontend/src/types/reading.ts` | Edit | +15 |
| `frontend/src/App.tsx` | Edit | +2 |
| `frontend/src/components/student/StepTabs.tsx` | Rewrite | ~23 |
| `frontend/src/components/student/StudentShell.tsx` | Rewrite | ~165 |
| `frontend/src/components/student/TaskPanel.tsx` | Rewrite | ~330 |

## Expected Score Impact

| Dimension | v3 | Expected v4 | Delta |
|-----------|-----|-------------|-------|
| D1 Backend | 20 | 20 | 0 |
| D2 Teacher Layout | 20 | 20 | 0 |
| D3 Teacher Right+Modal | 12 | 12 | 0 |
| D4 Student V2 | 7 | 17-20 | +10-13 |
| D5 E2E Integration | 20 | 20 | 0 |
| **Total** | **79** | **89-92** | **+10-13** |

## Risks

- D2 regression risk: LOW — TeacherShell.tsx untouched
- D5 regression risk: LOW — DemoShell sync mapping preserved (step/2 = taskIdx)
- Backend format mismatch: LOW — submit formats verified against classroom.service.ts grading functions
