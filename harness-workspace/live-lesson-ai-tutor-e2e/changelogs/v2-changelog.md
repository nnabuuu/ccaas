# Changelog v2

## Root Cause

v1 scored 0/100 because frozen files were modified (entities/, dto/, pages/, lesson/, module, orchestrator). The implementation itself was functionally excellent (would-be 94/100). Two fixes targeted:

1. **[CRITICAL] Frozen file violations** — P2 (entities), P3 (dto), P4 (pages), P5 (lesson) all triggered penalties
2. **[D1] Response length** — Q4 exceeded 200 chars (D1 check 4 partial)

## Changes

### Fix 1: Revert all frozen files + move state to in-memory maps
- Reverted `backend/src/entities/student.entity.ts` and `submission.entity.ts` — removed added columns
- Reverted `backend/src/classroom/dto/ai-ask.dto.ts` — removed modifications
- Reverted all 6 files in `frontend/src/pages/` — BoardPage, CourseSelectionPage, DemoPage, JoinPage, StudentPage, TeacherPage
- Reverted `backend/src/lesson/lesson.service.ts`
- Reverted `backend/src/classroom/classroom.module.ts`
- Reverted `frontend/src/components/orchestrator/DemoShell.tsx`
- Added `progressMap` (Map<string, {currentTask, currentPhase, stepStartedAt}>) to ClassroomService for student progress tracking without entity columns
- Added `scoreMap` (Map<string, score>) to ClassroomService for submission scores without entity column
- Added `ensureProgress()` and `getProgress()` helper methods
- Updated `join()` to initialize student progress in memory
- Updated `submit()` to store scores in scoreMap and progress in progressMap
- Updated `getState()` to read from progressMap and scoreMap instead of entity fields
- Updated `endSession()` to clean up new maps

### Fix 2: Tighten response length constraint
- Changed prompt from "30-200字" to "30-150字，绝不超过150字"
- Reduced `max_tokens` from 512 to 256

## Files Modified
- `backend/src/classroom/classroom.service.ts` — in-memory state maps, tighter prompt

## Files Reverted (frozen)
- `backend/src/entities/student.entity.ts`
- `backend/src/entities/submission.entity.ts`
- `backend/src/classroom/dto/ai-ask.dto.ts`
- `backend/src/classroom/classroom.module.ts`
- `backend/src/lesson/lesson.service.ts`
- `frontend/src/pages/BoardPage.tsx`
- `frontend/src/pages/CourseSelectionPage.tsx`
- `frontend/src/pages/DemoPage.tsx`
- `frontend/src/pages/JoinPage.tsx`
- `frontend/src/pages/StudentPage.tsx`
- `frontend/src/pages/TeacherPage.tsx`
- `frontend/src/components/orchestrator/DemoShell.tsx`

## Known Issues
- Student progress and scores are in-memory only — lost on server restart (acceptable for classroom sessions)
- Response length tightened but depends on LLM compliance with the instruction
