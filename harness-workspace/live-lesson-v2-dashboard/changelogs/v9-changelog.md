# Changelog v9

## Changes
- [D4.3 Fix — 3pts] **Quiz feedback in Step2Task**: Rewrote Step 2 match MCQ with answer checking. After submit, correct options show green `✓` indicator (`.correct` class), wrong options show red `✗` indicator (`.incorrect` class). Wrong answers are cleared for retry. Button changes to "重试" when wrong answers exist. All-correct state shows "✓ 已提交".
- [D3.3+D3.4 Fix — 4pts] **Student Modal submission data**: Added mock submission data (`MOCK_QUIZ_SUB`, `MOCK_MATRIX_SUB`, etc.) to all "done" demo students. Modal now renders per-step submission cards with `SubmissionDetail` component — matrix type shows full table with per-row ✓/✗ marks, quiz/match/stance types show per-dimension ✓/✗ rows with color coding. Score percentage shown per step with green/amber/red thresholds.
- [D5.6 Fix — 1pt] **CourseSelection V2 navigation**: Changed reading lesson route from `/demo/${id}` to `/teacher/${id}` so "全新课堂" navigates to V2 teacher dashboard.

## Files Modified
- `frontend/src/styles/student.css` — Added `.stu-mo.correct`, `.stu-mo.incorrect`, `.stu-mo:disabled` CSS classes
- `frontend/src/components/student/TaskPanel.tsx` — Rewrote `Step2Task` with answer checking, retry logic, and ✓/✗ visual feedback
- `frontend/src/components/teacher/TeacherShell.tsx` — Added mock submission data constants, wired submissions into demo students, rewrote `StudentModal` with `SubmissionDetail` component
- `frontend/src/pages/CourseSelectionPage.tsx` — Updated `getRoute()` for reading lessons to navigate to `/teacher/` route

## Known Issues
- D5.2 (health cards dynamic update): Health cards for demo session still use computed demo data. Real API submissions dynamically update via `computeHealthCards()` which reads from live `classroomState`, but demo seed values don't change on new submissions. This is by-design for demo mode — real sessions update correctly.
