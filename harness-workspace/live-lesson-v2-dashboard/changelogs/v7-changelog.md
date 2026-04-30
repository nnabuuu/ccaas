# Changelog v7

## Changes
- [D4 Fix] Replaced Step 1 keyword text inputs with proper MCQ quiz component (3 questions, 4 options each, correct answers from design reference). After submit: green highlight for correct answers, red for incorrect, score feedback bar.
- [D3 Fix] Added StudentModal with real submission data: clicking student name in class view opens dialog with matrix table showing student's Step 3 answers. Error marks (✗ red, ~ amber, ✓ green) compare against answer key. Score bar with legend.
- [D3 Fix] Added expand/collapse toggle (▶ arrow) to coaching "参考要点" section. Cards collapse/expand on click.
- [D3 Fix] Enriched MOCK_STUDENTS with submission data (currentTask, phase, timeSpent, submissionCount, matrix answers) so modal shows real content instead of "暂无提交数据".

## Files Modified
- `frontend/src/components/student/TaskPanel.tsx` — Quiz MCQ for Step 1
- `frontend/src/components/teacher/TeacherShell.tsx` — StudentModal + coaching toggle + enriched mock data
- `frontend/src/styles/student.css` — Quiz option styles (correct/incorrect/selected)
- `frontend/src/styles/teacher.css` — Modal overlay, matrix table, error marks, coaching toggle

## Known Issues
- Student V2 page and Teacher page still use separate sessions (D5 sync not addressed this iteration)
- Student phase unlock tabs (D4 #2) not addressed this iteration
- PulseStats shows 3 cells not 4 (missing "AI 对话" stat)
