# Changelog v2

## Changes
- [Fix #1 — 7pts] Backend score calculation was always null because `seedLessons()` skipped re-seeding existing lessons. The DB had the old manifest without `answerKey`. Fixed `lesson.service.ts` to always update the manifest from the file system on startup, so `answerKey` is available for grading.
- [Fix #2 — 4pts] Student modal in TeacherShell.tsx now renders structured answer tables instead of raw JSON. Each exercise type (quiz, match, matrix, stance, order) has a dedicated `SubmissionDetail` component showing answers in a readable format.
- [Fix #3 — 3pts] Student modal now shows ✓/✗ error indicators for each answer dimension. Correct answers appear in green, incorrect in red. Matrix columns show per-dimension accuracy percentages.

## Root Cause Analysis
- **Fix #1 (Score null)**: Type A (Missing behavior). `lesson.service.ts:seedLessons()` had `if (existing) continue;` which skipped updating the manifest. The answerKey existed in the JSON file but not in the DB. Changed to always update `manifestJson` from disk.
- **Fix #2 (Raw JSON)**: Type B (Wrong rendering). `StudentDetailModal` used `JSON.stringify(sub.data)` for all submission types. Replaced with type-specific table renderers using `sub.score.byDimension` for structured display.
- **Fix #3 (No error marks)**: Type A (Missing feature). No visual distinction between correct/incorrect. Added ✓/✗ marks colored green/red based on `byDimension` boolean/numeric values.

## Files Modified
- `backend/src/lesson/lesson.service.ts` — always update manifest on startup (not just seed new)
- `frontend/src/components/teacher/TeacherShell.tsx` — new `SubmissionDetail` component with 5 exercise type renderers + error marks

## Known Issues
- None identified for the fixes applied. D4.4 matrix live verification still constrained by progression lock.
