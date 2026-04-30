# Evaluation Report — v3

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## D1: Backend Data Layer (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | answerKey in manifest | PASS: grep count = 5 (≥5) | 3/3 |
| 2 | Submit returns score | PASS: `{"ok":true,"score":{"total":67,"byDimension":{"q0":true,"q1":true,"q2":false}}}` | 4/4 |
| 3 | State has currentTask | PASS: `students[0].currentTask = 2` after submission | 3/3 |
| 4 | State has stepMetrics | PASS: `stepMetrics.1.completionRate = 67`, `avgScore = 50` | 3/3 |
| 5 | Step time tracking | PASS: `stepStartedAt = "2026-04-21T16:13:36.381Z"` | 3/3 |
| 6 | Question persistence | PASS: `questions[0].question = "Myanmar在哪里？"` | 2/2 |
| 7 | Backend build | PASS: `npx nest build` exit 0 | 2/2 |

## D2: Teacher Layout + Swimlane (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Band + Timeline | PASS: topbar shows "高一(3)班 · Ideal Beauty — 阅读策略训练 · 3 人", code "8STF3B", timer "04:54", 5 task buttons with durations | 2/2 |
| 2 | Health Cards | PASS: 4 cards visible (最快进度 Task 2, 中位进度 Task 2, 卡点学生 —, AI 对话 1). AI card shows non-zero (1 人提问) | 3/3 |
| 3 | Swimlane 5 rows | PASS: T1 图式激活, T2 结构解码, T3 矩阵构建, T4 批判质疑, T5 复盘升华 — all with labels and completion % | 4/4 |
| 4 | Student dots | PASS: dots with name tooltips — "陈昕妍 · 67%" in T1, "陈昕妍 · 进行中" in T2, "王译文 · 33%" in T1. Status varies by completion | 3/3 |
| 5 | Click row → StepDetail | PASS: clicking T1 → detail panel shows "Task 1 · 图式激活", "2 已完成", "0 进行中", completion/score bars. Clicking T2 → "Task 2 · 结构解码" panel | 3/3 |
| 6 | Quality bars real data | PASS: `tch-sd-bar-fill` width 67% (green, 133px) for completion, 50% (blue, 99px) for avg score | 3/3 |
| 7 | Click dot → Student Modal | PASS: clicking "王译文 · 33%" dot → modal opens with "王译文", "Task 2 · listen · 1 提交" | 2/2 |

## D3: Teacher Right Col + Modal (12/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | AI Section empty state | PASS: "AI 实时教学反馈 —" shown | 2/2 |
| 2 | Question Queue | PASS: "问题队列 · 1" with row "Myanmar在哪里？ 陈昕妍" grouped under "Task 3" | 3/3 |
| 3 | Student Modal matrix | FAIL: modal shows "无答案数据" instead of structured submission table/grid. Score % shown but no answer breakdown | 0/4 |
| 4 | Student Modal error marks | FAIL: no visual error indicators — modal lacks per-question correct/incorrect markers | 0/3 |
| 5 | Coaching toggle | PARTIAL: "▸ 教学指引" toggles to [active] state on click, but no expanded content visible below | 1/2 |
| 6 | Patterns empty state | PASS: "AI 自动分析课堂模式 —" shown | 2/2 |
| 7 | tsc passes | PASS: `npx tsc --noEmit` exit 0 | 2/2 |
| 8 | vite build passes | PASS: `npx vite build` exit 0, 419 kB JS + 83 kB CSS | 2/2 |

## D4: Student V2 (7/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | 5 progress dots | PASS: 5 buttons (1-5) in top bar with "1/5" indicator | 3/3 |
| 2 | 4 Phase unlock | FAIL: no visible listen/practice/discuss phase labels or sequential unlock. All tabs (板书/课文/助教) and quiz visible from start. Steps 2-5 locked in structure map but no within-task phase gating | 0/4 |
| 3 | Quiz feedback | FAIL: quiz uses text inputs (keywords), not selectable options. After submit → "✓ 已提交" with disabled inputs, but no per-answer correct/incorrect feedback | 0/3 |
| 4 | Matrix inputs | FAIL: cannot navigate to Task 3 — steps 2-5 locked in structure map, no task progression in frontend after submission. Matrix component not reachable | 0/3 |
| 5 | TextPanel | PASS: right column shows "课文 · Ideal Beauty" with "聚焦 ¶1,2", 8 paragraphs (¶1-8) with full article text, paragraph markers | 3/3 |
| 6 | Submit → backend score | PARTIAL: submission reaches backend (teacher sees count update 0→1/3), but state shows `score=None` — frontend sends `{q1, q2}` keys instead of `{answers: [...]}` array, and step=0 instead of step=1 | 1/2 |
| 7 | Task progression | FAIL: after submitting Step 1, student stays on "1/5", structure map still shows steps 2-5 locked. Backend `currentTask=0` (no advance). Frontend submission format mismatch prevents progression | 0/2 |

## D5: E2E Integration (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Realtime sync | PASS: student (张皓月) joins + submits in tab 2 → teacher tab 1 updates: "2 人" → "3 人", submitted "0/2" → "1/3", new student dot appears in 班级视图 | 5/5 |
| 2 | Health cards update | PASS: after submissions, 最快进度 → "Task 2", 中位进度 → "Task 1", AI 对话 → "1 人提问". Values change dynamically with each submission | 3/3 |
| 3 | StepDetail update | PASS: T1 completion rate changed from 50% → 33% after new student submitted. Quality bars reflect real-time data (verified via DOM: `tch-sd-bar-fill` width updates) | 3/3 |
| 4 | Question queue update | PASS: `curl ai/ask` → teacher queue gains row: "Myanmar在哪里？" under "Task 3" with "陈昕妍" attribution, count badge "1" | 3/3 |
| 5 | Legacy route | PASS: `/lesson/math-linear-eq-intro` → renders math lesson with 4 steps (问题导入, 算术分析, 方程建立, 求解验证), "开始课程" button, no render errors | 3/3 |
| 6 | CourseSelection nav | PASS: root `/` shows 2 lesson cards. "Ideal Beauty — 阅读策略训练" (英语/高中一年级) with "开始学习" button. Math lesson card also present | 3/3 |

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS — no output from `git diff --name-only -- packages/` |
| P2 | mcp-server/src/ modified | PASS — no output from `git diff --name-only -- solutions/business/live-lesson/mcp-server/src/` |
| P3 | /lesson route broken | PASS — `/lesson/math-linear-eq-intro` renders correctly |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Backend Data Layer | 20/20 |
| D2: Teacher Layout + Swimlane | 20/20 |
| D3: Teacher Right Col + Modal | 12/20 |
| D4: Student V2 | 7/20 |
| D5: E2E Integration | 20/20 |
| Penalties | -0 |
| **Total** | **79/100** |

总分: 79/100

## What's Working Well
- **D1 Backend is bulletproof** — answerKey, scoring, stepMetrics, time tracking, question persistence all working perfectly. Do NOT touch backend.
- **D2 Teacher Layout is complete** — swimlane, health cards, student dots, StepDetail, quality bars all render with live data. Do NOT touch teacher layout.
- **D5 E2E Integration is solid** — SSE real-time sync, legacy route, course selection all work. Do NOT touch integration plumbing.
- **Teacher right column** mostly works — AI section, question queue, patterns empty state, class view all functional.

## Priority Fixes
1. [SYSTEM] StudentShell submit handler — Frontend sends `{q1: "text", q2: "text"}` at step=0 instead of `{answers: [idx, idx, idx]}` at step=1. Fix the submit payload in the task panel component to match backend's expected format (numeric answer indices in `answers` array, correct step number). This alone would fix D4 #3 quiz feedback, #6 scoring, and #7 task progression.
2. [COMPONENT] StudentModal answer matrix — `StudentModal.tsx` shows "无答案数据" when `submission.data.answers` exists. Render a table: rows = questions from manifest `answerKey`, columns = student's answer vs correct answer. Mark incorrect with red highlight. Fixes D3 #3 (4 pts) and D3 #4 (3 pts).
3. [COMPONENT] Student task progression — After successful submission with score, unlock next step in Structure Map. Update `currentTask` display from backend SSE state. Student should see step 2 unlock after step 1 submit.
4. [COMPONENT] Phase unlock within task — Add phase gating: "listen" shows text only, "practice" reveals quiz, "discuss" reveals AI assistant. Gate visibility by `currentPhase` from backend state.
5. [COMPONENT] Quiz as selectable options — Convert Step 1 quiz from text inputs to radio/select options matching manifest `answerKey` choices. Show immediate correct/incorrect feedback per question after selection.
6. [DESIGN] Coaching toggle content — "▸ 教学指引" toggles active state but shows no expanded content. Add teaching tips/coaching content in the expandable section.

Classification:
- [COMPONENT]: single file fix, generator can do it
- [SYSTEM]: cross-file or API change, may affect multiple dimensions
- [DESIGN]: CSS/layout issue, visual only
