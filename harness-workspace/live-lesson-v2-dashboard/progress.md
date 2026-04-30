# Progress — live-lesson-v2-dashboard

| Version | Timestamp | Score | Changes | Top Issue |
|---------|-----------|-------|---------|-----------|
| v1 | 2026-04-21 23:43:58 | 85/100 | - Added `answerKey` field to all 5 task steps (s1–s5);- Answer key types: quiz (MCQ correct indices | [SYSTEM] classroom.service.ts — `score` field is always `null` in submit respons |
| v2 | 2026-04-21 23:53:29 | 9/100 | - [Fix #1 — 7pts] Backend score calculation was always null because `seedLessons()` skipped re-seedi | [SYSTEM] **Services not running** — all 3 services (core :3001, lesson :3007, fr |
| v3 | 2026-04-22 00:30:13 | 79/100 | - [Fix #1 — 91pts] **Undo v2 frontend regression**: v2 replaced all frontend files with static mocku | [SYSTEM] StudentShell submit handler — Frontend sends `{q1: "text", q2: "text"}` |
| v4 | 2026-04-22 00:53:51 | FAIL/100 | Validation failed | typecheck/build error |
| v5 | 2026-04-22 01:27:11 | 63/100 | - Added `"src/index.ts"` to `exclude` array;- `src/index.ts` is a standalone Express server using ` | [COMPONENT] TeacherShell.tsx — Student chip click does NOT open a modal. Expecte |
| v6 | 2026-04-22 01:46:16 | 79/100 | - [Fix #1 — 9pts] **Student Detail Modal**: Added `StudentModal` component with `role="dialog"`. Cli |  |
| v7 | 2026-04-22 02:11:47 | 74/100 | - [D4 Fix] Replaced Step 1 keyword text inputs with proper MCQ quiz component (3 questions, 4 option | [DESIGN] teacher.css — Health cards should be 4-card grid (最快进度/中位进度/卡点学生/AI对话)  |
| v8 | 2026-04-22 02:32:51 | 91/100 | - D2.2 (1/3): Health cards showed 3 stat blocks (已提交/填写中/未开始) instead of 4 cards (最快进度/中位进度/卡点学生/AI对 | [COMPONENT] StudentPage TaskPanel — Quiz feedback missing. After selecting MCQ o |
| v9 | 2026-04-22 02:51:06 | 96/100 | - [D4.3 Fix — 3pts] **Quiz feedback in Step2Task**: Rewrote Step 2 match MCQ with answer checking. A | [COMPONENT] StudentShell.tsx — Phase gating not visible: student sees all conten |
| v10 | 2026-04-22 03:12:30 | 99/100 | - [D4.2 Fix — 4pts] **Phase gating**: Rewrote TaskPanel with 4-phase system (Listen → Practice → Dis | [COMPONENT] student/TaskPanel.tsx — Quiz feedback is shown only after clicking " |
