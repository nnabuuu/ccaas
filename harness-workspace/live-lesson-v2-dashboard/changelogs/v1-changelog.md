# V1 Changelog — live-lesson-v2-dashboard

## Summary

Complete V2 upgrade of the live-lesson system: backend data layer (manifest answer keys, auto-grading, progress tracking), Teacher Swimlane Dashboard, and Student 4-Phase task flow.

## Phase 1: Manifest Answer Key

**File**: `data/lessons/ideal-beauty-reading/manifest.json`

- Added `answerKey` field to all 5 task steps (s1–s5)
- Answer key types: quiz (MCQ correct indices), match (paragraph–section pairs), matrix (place/practice/reason per row), stance (valid positions + min evidence), order (correct sequence)

## Phase 2: Backend Auto-Grading + Progress Tracking

**Files**: `backend/src/classroom/classroom.service.ts`, `backend/src/entities/student.entity.ts`, `backend/src/entities/submission.entity.ts`, `backend/src/classroom/classroom.module.ts`, `backend/src/classroom/classroom.controller.ts`

- **Student entity**: Added `currentTask`, `currentPhase`, `stepStartedAt` columns for progress tracking
- **Submission entity**: Added `scoreJson` column for grading results
- **ClassroomService**: Complete rewrite with:
  - `gradeSubmission()` — loads manifest answerKey, dispatches to type-specific graders
  - 5 grading methods: `gradeQuiz`, `gradeMatch`, `gradeMatrix`, `gradeStance`, `gradeOrder`
  - `submit()` now auto-grades and updates student progress
  - `getState()` returns `stepMetrics` (per-task completion/score stats) and `questions` array
  - `aiAsk()` persists questions to in-memory store and broadcasts via SSE
- **ClassroomModule**: Added `Lesson` entity import for manifest access
- **ClassroomController**: Updated `aiAsk` endpoint signature to pass session + studentId

## Phase 3: CSS Design Tokens

**File**: `frontend/src/styles/reading-tokens.css`

- Confirmed existing tokens match V2 design spec (warm-neutral tinted grays, semantic color pairs, spacing scale, typography scale)
- No changes needed — tokens already in place from prior iteration

## Phase 4: Teacher Swimlane Dashboard

**File**: `frontend/src/components/teacher/TeacherShell.tsx`, `frontend/src/hooks/useClassroom.ts`

- **ClassroomState interface**: Extended with `currentTask`, `currentPhase`, `stepStartedAt`, `stepMetrics`, `questions`
- **TeacherShell**: Complete rewrite as V2 swimlane dashboard:
  - Health cards row (最快进度, 中位进度, 卡点学生, AI对话)
  - Swimlane grid (5 task rows) with color-coded student dots (green ≥80, amber ≥50, red <50, blue = in-progress)
  - Step detail bars in right column (completionRate, avgScore, currentCount)
  - Question queue grouped by selected task
  - Student list with status dots
  - Student detail modal (submissions + AI history)
  - GuidanceCollapse (speech line, cue cards, quick actions)

## Phase 5: Student 4-Phase Task Flow

**File**: `frontend/src/components/student/StudentShell.tsx`, `frontend/src/styles/student.css`

- **StudentShell**: Complete rewrite with V2 4-phase flow:
  - Progress dots row (5 tasks with connecting lines)
  - TaskView with phase navigation (Listen → Practice → Discuss → Takeaway)
  - 5 exercise types: Quiz (radio MCQ with retry), Match (left→pick with retry), Matrix (6-row text inputs), Stance (position buttons + evidence checkboxes), Order (click-to-select with retry)
  - Phase progression with lock icons (Practice → unlocks Discuss → unlocks Takeaway)
  - IntersectionObserver tracks active phase in viewport
  - AI FAB (floating action button) with preset Q&A chips + free text input
  - Backend integration: submit auto-graded, AI questions via POST /ai/ask
  - Intro screen and completion summary screen
- **student.css**: Added comprehensive V2 CSS classes (~200 lines) for all new components
- **useClassroom.ts**: Updated `submit()` to return full response (with score data)

## Phase 6: Integration Verification

- Backend builds clean (`npx nest build` — 0 errors)
- Frontend builds clean (`npx vite build` — 0 errors)
- TypeScript passes (`npx tsc --noEmit` — 0 errors)
- All legacy routes preserved: `/join`, `/teacher/:lessonId`, `/student/:lessonId`, `/demo/:lessonId`, `/board/:lessonId`, `/lesson/:lessonId`
- SSE real-time sync: student submit → teacher dashboard updates via existing stream hooks
- CSS design tokens loaded globally via `reading-tokens.css`

## Files Changed

| File | Action |
|------|--------|
| `data/lessons/ideal-beauty-reading/manifest.json` | Modified (added answerKey to 5 task steps) |
| `backend/src/entities/student.entity.ts` | Modified (added currentTask, currentPhase, stepStartedAt) |
| `backend/src/entities/submission.entity.ts` | Modified (added scoreJson column) |
| `backend/src/classroom/classroom.service.ts` | Rewritten (auto-grading, enhanced state, question persistence) |
| `backend/src/classroom/classroom.module.ts` | Modified (added Lesson import) |
| `backend/src/classroom/classroom.controller.ts` | Modified (updated aiAsk endpoint) |
| `frontend/src/hooks/useClassroom.ts` | Modified (ClassroomState interface, submit return type) |
| `frontend/src/components/teacher/TeacherShell.tsx` | Rewritten (swimlane dashboard) |
| `frontend/src/components/student/StudentShell.tsx` | Rewritten (4-phase task flow) |
| `frontend/src/styles/student.css` | Modified (added V2 CSS classes) |
