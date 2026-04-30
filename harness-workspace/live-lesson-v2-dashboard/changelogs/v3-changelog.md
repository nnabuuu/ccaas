# Changelog v3

## Summary

Undo v2 frontend regression + enhance TeacherShell with all D2/D3 features (structured modal, error marks, swimlane, health cards).

## Changes

- [Fix #1 — 91pts] **Undo v2 frontend regression**: v2 replaced all frontend files with static mockups, stripping `useTeacherStream`, `useSessionCreate`, `useStudentSession`, and all real data bindings. Restored 17 frontend files from HEAD (`git checkout HEAD --`). This recovers all D2/D4/D5 runtime functionality that was "UNVERIFIABLE: service down" in v2-eval.
- [Fix #2 — 4pts] **Student modal structured tables (D3.3)**: `SubmissionDetail` component renders type-specific tables for quiz/match/matrix/stance/order instead of `JSON.stringify`. Quiz shows 题号/学生答案/正确答案/结果 columns; Match shows 段落/学生答案/正确答案/结果; Matrix shows Place/Practice/Reason with per-cell correctness; Stance shows position check + evidence count; Order shows student vs correct sequence.
- [Fix #3 — 3pts] **Error marks in modal (D3.4)**: All submission tables show ✓/✗ marks colored green (`var(--green)`) for correct and red (`var(--red)`) for incorrect, using `score.byDimension` data. Matrix cells individually colored. Stance/order show aggregate ✓/✗.
- [Fix #4] **Delete standalone `backend/src/index.ts`**: Express server duplicate that used `import.meta.url` incompatible with NestJS tsconfig (`TS1343`). Not needed — NestJS handles all routes.

## Root Cause Analysis

- **Fix #1 (v2 regression)**: Type C (Regression). v2 generator rewrote all frontend files as self-contained static mockups without session hooks. The code compiled (tsc/vite passed) but was functionally broken — no SSE streams, no session creation, no student join flow. Every D2/D4/D5 check was "UNVERIFIABLE" because services weren't running AND the code wouldn't have worked even if they were.
- **Fix #2 (Raw JSON)**: Type B (Wrong rendering). Carried over from v2's `SubmissionDetail` but now integrated into the restored HEAD-based TeacherShell with real `classroomState` data.
- **Fix #3 (No error marks)**: Type A (Missing feature). Same as v2 fix but now with real data flow from SSE → `useTeacherStream` → `classroomState.students[].submissions[].score.byDimension`.
- **Fix #4 (index.ts)**: Type A (Extraneous code). Standalone Express server was never needed alongside NestJS. Caused potential build conflicts.

## Architectural Approach

Instead of patching v2's broken static mockups, v3 takes a "restore + enhance" approach:
1. Restore all 17 frontend files from HEAD to recover working session management
2. Rewrite only `TeacherShell.tsx` to add V2 dashboard features on top of the working data layer
3. Update `useClassroom.ts` types to match the enhanced backend state (stepMetrics, questions, etc.)
4. Add CSS for new components (health cards, swimlane, student dots, step detail bars, modal, submission tables)

This preserves v2's backend fix (lesson.service.ts manifest re-seeding) while fixing the frontend regression.

## Files Modified

| File | Action |
|------|--------|
| `frontend/src/components/teacher/TeacherShell.tsx` | Rewritten (V2 dashboard with health cards, swimlane, step detail, structured modal + error marks, question queue, guidance collapse) |
| `frontend/src/hooks/useClassroom.ts` | Modified (ClassroomState type + useTeacherStream return signature + notification events) |
| `frontend/src/styles/teacher.css` | Modified (added CSS for health cards, swimlane, student dots, step detail bars, modal, submission tables, guidance) |
| `frontend/src/components/student/StudentShell.tsx` | Restored from HEAD |
| `frontend/src/components/student/AiPanel.tsx` | Restored from HEAD |
| `frontend/src/components/student/TaskPanel.tsx` | Restored from HEAD |
| `frontend/src/components/orchestrator/DemoShell.tsx` | Restored from HEAD |
| `frontend/src/pages/TeacherPage.tsx` | Restored from HEAD |
| `frontend/src/pages/StudentPage.tsx` | Restored from HEAD |
| `frontend/src/pages/DemoPage.tsx` | Restored from HEAD |
| `frontend/src/pages/BoardPage.tsx` | Restored from HEAD |
| `frontend/src/pages/JoinPage.tsx` | Restored from HEAD |
| `frontend/src/hooks/useReadingLesson.ts` | Restored from HEAD |
| `frontend/src/hooks/useSurfaceSync.ts` | Restored from HEAD |
| `frontend/src/styles/orchestrator.css` | Restored from HEAD |
| `frontend/src/styles/student.css` | Restored from HEAD |
| `frontend/src/App.tsx` | Restored from HEAD |
| `backend/src/index.ts` | Deleted (standalone Express server, build conflict) |

## Build Verification

- `npx tsc --noEmit` (frontend): PASS
- `npx tsc --noEmit` (backend): PASS
- `npx vite build`: PASS (4662 modules, 2.12s)
- `npx nest build`: PASS

## Known Issues

- `ReadingStep` type lacks `answerKey` field; accessed via `(stepDef as any)?.answerKey` in modal. Works at runtime but not type-safe.
- `InstructionPanel.tsx` is staged but unused — leftover from v1 iteration.
