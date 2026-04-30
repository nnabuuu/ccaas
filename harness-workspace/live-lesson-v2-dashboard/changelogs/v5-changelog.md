# v5 Changelog — live-lesson-v2-dashboard

**Starting score:** 79/100 (v3) — v4 failed with typecheck/build error
**Focus:** D4 (Student V2) — 13 pts recoverable; backend build fix from v4

## Strategy

Single-focus on D4 (Student V2 task flow), the highest-impact dimension.
D1 (20/20), D2 (20/20), D5 (20/20) untouched to avoid regression.
Fix v4's build error first to unblock all changes.

## Root Cause Analysis

| Fix ID | Dimension | Root Cause | Type | Points |
|--------|-----------|-----------|------|--------|
| F0 | Build | `backend/src/index.ts` uses `import.meta.url` (ESM) in CommonJS tsconfig — causes TS1343 | C (System) | FAIL→pass |
| F1 | D4 #3 | Quiz uses text inputs instead of radio MCQ | B (Wrong) | 3 |
| F2 | D4 #2 | No phase unlock (instruction → exercise gating) | A (Missing) | 4 |
| F3 | D4 #7 | No task progression (dot fill + auto-advance) | A (Missing) | 2 |
| F4 | D4 #6 | Submit handler sends local state only, no backend call | B (Wrong) | 2 |
| F5 | D4 #4 | Matrix unreachable because tasks don't progress | A (Missing) | 3 |

## Changes

### 1. `backend/tsconfig.json` — Fix v4 build error
- Added `"src/index.ts"` to `exclude` array
- `src/index.ts` is a standalone Express server using `import.meta.url` (ESM-only)
- NestJS tsconfig uses `"module": "commonjs"` — incompatible with `import.meta`

### 2. `frontend/src/types/reading.ts` — Add manifest type fields
- Added `type?: 'instruction' | 'task'` to `ReadingStep`
- Added `answerKey?: Record<string, any>` for backend grading data
- Added `studentView?` with `{ title, body, keyPoints?, confirmLabel? }` for instruction content
- Added `teacherView?: Record<string, any>` for teacher-facing metadata

### 3. `frontend/src/components/student/StudentShell.tsx` — Phase system + session integration (MAJOR)
- **Task grouping**: Filters 10 manifest readingSteps into 5 TaskGroups (instruction + task pairs)
  - StepTabs shows 5 dots instead of 10
- **Phase system**: Each task has listen (instruction) → practice (exercise) phases
  - `phase` state: `'listen' | 'practice'`
  - Shows `InstructionPanel` in listen phase, `TaskPanel` in practice phase
  - Auto-skips listen phase if no instruction step exists
- **Session integration**: `handleSubmit` callback reads studentId from localStorage and calls `POST /api/classroom/:code/submit`
  - Falls back to mock success `{ ok: true, score: { total: 100 } }` for embed/demo mode
- **Task progression**: `completedTasks` Set tracks finished tasks
  - Auto-advances to next task after successful submit
  - Navigation gated: can only visit completed or current tasks
- **DemoShell sync**: Maps orchestrator step to task group: `Math.floor(d.step / 2)`

### 4. `frontend/src/components/student/TaskPanel.tsx` — Complete exercise rewrite (MAJOR)
- **New Props**: `{ step, stepIdx, taskNumber, onJumpTo, onSubmit, onComplete, completed, isLastTask }`
- **Task 1 (Quiz)**: Radio MCQ with 3 questions, 4 options each
  - Submits `{ answers: [selectedIdx, ...] }` at step.idx (=1)
  - Shows per-question correct/incorrect highlighting after grading
- **Task 2 (Match)**: 4 paragraph-section pairs with dropdown selects
  - Submits `{ answers: ['Phenomenon', 'History', 'Culture', 'Conclusion'] }` at step.idx (=3)
- **Task 3 (Matrix)**: 6 rows (1 demo + 5 editable) with controlled text inputs
  - Submits `{ rows: [{place, practice, reason}, ...] }` at step.idx (=5)
- **Task 4 (Stance)**: 3 position buttons + 8 evidence checkboxes
  - Submits `{ position, evidence: [...] }` at step.idx (=7)
- **Task 5 (Order)**: 4 items with up/down reorder buttons
  - Submits `{ order: ['label', ...] }` at step.idx (=9)
- **All tasks**: Loading state during submit, ScoreFeedback component with percentage + dimension breakdown, "下一任务 →" button

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `backend/tsconfig.json` | Edit | +1 |
| `frontend/src/types/reading.ts` | Edit | +12 |
| `frontend/src/components/student/StudentShell.tsx` | Rewrite | ~287 |
| `frontend/src/components/student/TaskPanel.tsx` | Rewrite | ~400 |

## Build Verification

- `npx tsc --noEmit` (frontend): PASS
- `npx vite build` (frontend): PASS (434.57 kB gzip: 137.91 kB)
- `npx tsc --noEmit` (backend): PASS
- `npx nest build` (backend): PASS

## Expected Score Impact

| Dimension | v3 | Expected v5 | Delta |
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
- Backend format mismatch: LOW — submit formats verified against classroom.service.ts grading functions (STEP_TO_TASK: {1:1, 3:2, 5:3, 7:4, 9:5})
