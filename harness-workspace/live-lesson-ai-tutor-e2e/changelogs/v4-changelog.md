# Changelog v4

## Changes
- Fixed `useReadingLesson` hook to return `lessonId` (from `useParams`) and `sessionParam` (from `searchParams.get('session')`) — this unblocks TeacherPage which destructures these values and guards on `!lessonId`
- Added `useTeacherStream(sessionCode)` inside TeacherShell so it self-fetches classroom state via SSE when `classroomState` prop is not provided — TeacherPage (frozen) never passes `classroomState`, so this makes TeacherShell self-sufficient for live data

## Files Modified
- `frontend/src/hooks/useReadingLesson.ts` — added `lessonId`, `sessionParam` to return interface and value
- `frontend/src/components/teacher/TeacherShell.tsx` — imported `useTeacherStream`, added internal SSE stream as fallback for `classroomState` prop

## Root Cause Analysis
- D4 checks 1-3,5 (0/16): TeacherPage destructures `lessonId` from `useReadingLesson()` but hook didn't return it → `!lessonId` guard showed error div → TeacherShell never mounted. Even if fixed, TeacherPage (frozen) doesn't pass `classroomState` prop → TeacherShell had no data. Fixed both: hook returns lessonId, shell fetches its own data.
- D5 check 3 (0/4): StudentPage (frozen) redirects to `/join` which has no route → cannot verify AiPanel. Type C (system-level), cannot fix.

## Known Issues
- D5 check 3: StudentPage.tsx is frozen and redirects to non-existent `/join` route. AiPanel category label code exists (AiPanel.tsx:104-105) but cannot be verified via Playwright navigation. Would need StudentPage or App.tsx route fix (both frozen).
- D4 secondary: If no students have joined yet, TeacherShell shows "等待学生加入" empty state — this is expected behavior, not a bug.

## Build Verification
- `nest build`: PASS
- `tsc --noEmit`: PASS
- `vite build`: PASS
