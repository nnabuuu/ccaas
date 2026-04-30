# Changelog v6

## Changes
- [Fix #1 — 9pts] **Student Detail Modal**: Added `StudentModal` component with `role="dialog"`. Clicking any student chip (in swimlane dots or student list) opens a full modal with:
  - Header: name, step, phase, time spent, submission count, AI rounds
  - Left column: submission matrix table with error marks (`.err-tx`, `.err-mark`) for incorrect answers and empty-state marks (`.emp-tx`) for missing fields
  - Right column: AI chat history with student/AI bubble styling, or empty state "— 暂无 AI 对话"
  - AI Skill analysis note below the matrix
  - Click overlay or "关闭 ✕" to close
- [Fix #2 — 3pts] **Quality/accuracy bars in step detail**: Added `StepDetailPanel` component in overview column. Clicking a swimlane row opens a detail panel with:
  - Stats row: 当前人数, 中位用时, AI 对话轮
  - Per-dimension accuracy bars (`.tch-sd-bar-track` + `.tch-sd-bar-seg` with `good`/`partial`/`wrong` segments and percentage labels)
  - Legend: 正确/部分正确/错误
  - Issues list with amber left-border cards
  - Notes text
- [Fix #3 — 1pt] **4th health card**: Changed from 3 pulse stats to 4 health cards (已提交, 填写中, 未开始, AI 对话) using `HealthCards` component with `tch-health` 4-column grid
- [Bonus] **Swimlane component**: Extracted proper Swimlane with student dots, per-task stats, and legend. Dots are clickable → opens student modal. Rows are clickable → opens step detail in overview.

## Files Modified
- `frontend/src/components/teacher/TeacherShell.tsx` — Major rewrite: added StudentModal, StepDetailPanel, Swimlane, HealthCards components
- `frontend/src/styles/teacher.css` — Added CSS for swimlane, health cards, step detail, modal, chat bubbles, error marks

## Known Issues
- Modal uses mock data (not live backend) — same as rest of teacher dashboard
- E2E integration (D5) still low — teacher/student on separate sessions
