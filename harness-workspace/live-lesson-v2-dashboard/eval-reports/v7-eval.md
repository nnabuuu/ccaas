# Evaluation Report — v7

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK (crashed mid-eval after `nest build`; all D1 data captured before crash)
- Frontend (:5283): OK (restarted after `vite build`)

## D1: Backend Data Layer (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | answerKey in manifest | PASS: `grep -c` returns 5 (≥ 5) | 3/3 |
| 2 | Submit returns score | PASS: `{"ok":true,"score":{"total":67,"byDimension":{"q0":true,"q1":true,"q2":false}}}` | 4/4 |
| 3 | State has currentTask | PASS: `students[0].currentTask = 2` (numeric) | 3/3 |
| 4 | State has stepMetrics | PASS: `stepMetrics.1.completionRate = 33`, `avgScore = 67` | 3/3 |
| 5 | Step time tracking | PASS: `students[0].stepStartedAt = "2026-04-21T17:57:53.031Z"` | 3/3 |
| 6 | Question persistence | PASS: `questions[0].question = "Myanmar在哪里？"`, `studentName = "陈昕妍"` | 2/2 |
| 7 | Backend build | PASS: `npx nest build` exit 0 | 2/2 |

## D2: Teacher Layout + Swimlane (11/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Band + Timeline | PASS: Header band with "课堂控制台", class info, Step 3/5 counter, Timer 12:48/45:00 | 2/2 |
| 2 | Health Cards 4-grid | PARTIAL: 3 stat blocks visible (12 已提交, 26 填写中, 4 未开始) — not 4 cards with 最快进度/中位进度/卡点学生/AI对话 labels | 1/3 |
| 3 | Swimlane 5 rows | PARTIAL: 5 `tch-rstep` task buttons with Chinese labels (图式激活 through 复盘升华) visible as horizontal tabs. No `swim-row` elements or vertical lane layout | 2/4 |
| 4 | Student dots + color | PARTIAL: 班级视图 shows 12+ clickable student names (`tch-sl-row`). Pulse-dot legend has `done`/`prog`/`idle` classes with different bg colors, but individual student rows share identical computed styles | 1/3 |
| 5 | Click row → StepDetail | PASS: Clicking task button changes main content to that step's detail (instruction, matrix, teacher script). Step counter updates. Active button gains `act` class | 3/3 |
| 6 | Quality bars real data | FAIL: No `[class*="bar"]`, `[class*="progress"]`, `[class*="quality"]`, or `[class*="accuracy"]` elements found in DOM | 0/3 |
| 7 | Click dot → Student Modal | PASS: Clicking "陈昕妍" opens `<dialog>` with title "陈昕妍 详情", submission matrix table, score "83%", ✓/~/✗ error marks | 2/2 |

## D3: Teacher Right Col + Modal (18/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | AI Section empty state | PASS: Student modal's AI 对话 section shows "—" | 2/2 |
| 2 | Question Queue | PASS: Queue visible with priority groups (高/中/低优先级). Myanmar question with "8" student count and "陈昕 · 赵雪 · 王译 · 李奕 +4" attribution. 7 total question rows | 3/3 |
| 3 | Student Modal matrix | PASS: Table with Place/Practice/Reason columns + score column. 6 data rows (Ancient Egypt through Indonesia). MODEL row prefilled, others show student answers | 4/4 |
| 4 | Student Modal error marks | PASS: ✓ (correct), ~ (partial correct), ✗ (wrong) with per-row percentages (25%, 75%, 100%). Legend at bottom: "✓ 正确 ~ 部分正确 ✗ 错误" | 3/3 |
| 5 | Coaching toggle | PASS: `tch-cue-toggle` button "▶ 参考要点 3 cards" collapses/expands 3 coaching cards (示范一行, 易错点, 过渡到 Step 4) | 2/2 |
| 6 | Patterns empty state | FAIL: No patterns section found in DOM. No element with "pattern" or "模式" class/text | 0/2 |
| 7 | tsc passes | PASS: `npx tsc --noEmit` exit 0 | 2/2 |
| 8 | vite build passes | PASS: `npx vite build` exit 0, 402.52 kB JS + 82.22 kB CSS | 2/2 |

## D4: Student V2 (18/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | 5 progress dots | PASS: 5 numbered buttons (1–5) in header bar, "1/5" counter label | 3/3 |
| 2 | 4 Phase unlock | PARTIAL: Task-level progressive unlock works — Structure Map shows "现象" (Step 1), "信号词" (Step 2), "矩阵" (Step 3), "· · ·" (locked Steps 4-5). But not explicit Listen→Practice→Discuss→Takeaway phases within each task | 2/4 |
| 3 | Quiz feedback | PASS: After submit, correct answers gain ✓ prefix, all options become [disabled], score line "得分: 3/3 — 全部正确!", button changes to "✓ 已提交" | 3/3 |
| 4 | Matrix inputs | PASS: Step 3 shows table with Place/Practice/Reason headers. Ancient Egypt is MODEL row (prefilled). Borneo through Indonesia each have two `textbox` inputs ("What?"/"Why?"). "提交矩阵表" submit button | 3/3 |
| 5 | TextPanel + focus dimming | PASS: All 8 paragraphs (¶1–¶8) rendered. Step 3 focus: ¶3-7 at opacity 1.0 (`stu-tp`), ¶1-2 and ¶8 at opacity 0.3 (`stu-tp dim`). Header shows "聚焦 ¶3,4,5,6,7" | 3/3 |
| 6 | Submit → backend score | PASS: Quiz submit displays score in UI. Earlier D1 curl confirmed `{"ok":true,"score":{"total":67,...}}` in API response | 2/2 |
| 7 | Task progression | PASS: After Step 1 quiz, clicking button "2" loads Step 2 content. Clicking button "3" loads Step 3 matrix. Structure Map labels unlock progressively | 2/2 |

## D5: E2E Integration (7/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Realtime sync | PARTIAL: Teacher 班级视图 includes real students (陈昕妍, 王译文, 张皓月) from API session. However, teacher page blends 42 simulated students with real data. Backend crashed before dual-tab submit→update could be verified | 2/5 |
| 2 | Health cards update | FAIL: Health card values (12/26/4) appear static demo data — did not change after additional API submissions. Count doesn't match our 3-student session | 0/3 |
| 3 | StepDetail update | FAIL: Backend crashed before testing. No evidence of real-time bar/detail updates | 0/3 |
| 4 | Question queue update | PARTIAL: Our curl `ai/ask` "Myanmar在哪里？" appeared in the teacher's question queue grouped with other questions. Confirms question integration works, but real-time addition untested | 2/3 |
| 5 | Legacy route | PASS: `/lesson/math-linear-eq-intro` renders: header, AI 补充 panel, "开始课程" button. 7 console errors but no crash | 3/3 |
| 6 | CourseSelection nav | FAIL: Page renders with proper error handling ("Failed to fetch", "重试" button) but backend was down — could not load courses or test reading card navigation | 0/3 |

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS — no output from `git diff --name-only -- packages/` |
| P2 | mcp-server/src/ modified | PASS — no output from `git diff --name-only -- solutions/business/live-lesson/mcp-server/src/` |
| P3 | /lesson route broken | PASS — `/lesson/math-linear-eq-intro` renders successfully |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Backend Data Layer | 20/20 |
| D2: Teacher Layout + Swimlane | 11/20 |
| D3: Teacher Right Col + Modal | 18/20 |
| D4: Student V2 | 18/20 |
| D5: E2E Integration | 7/20 |
| Penalties | -0 |
| **Total** | **74/100** |

总分: 74/100

## What's Working Well
- **D1 (20/20)**: Backend data layer is rock solid — answerKey, scoring, stepMetrics, time tracking, question persistence all work perfectly. Do NOT touch backend API or entities.
- **D3.2-D3.5**: Question queue with priority clustering (高/中/低 + student attribution) is excellent. Student modal with ✓/~/✗ error marks and percentage scoring is polished. Coaching toggle works.
- **D4.3-D4.5**: Student quiz feedback (✓ marks + score line), matrix inputs, and TextPanel focus dimming are all fully functional and well-implemented.
- **D4.1 + D4.7**: 5 progress dots and task progression through Structure Map with progressive label unlock is solid.

> These dimensions are solid — do NOT touch them unless absolutely necessary.

## Priority Fixes
1. [DESIGN] teacher.css — Health cards should be 4-card grid (最快进度/中位进度/卡点学生/AI对话) with data from `stepMetrics`. Currently only 3 stat blocks (已提交/填写中/未开始). → Add 4th card, bind to real `stepMetrics` data
2. [COMPONENT] TeacherShell.tsx — Need swimlane rows (not tab buttons) with student dot/chip elements inside each row. Each dot should show student name tooltip and color-coded status (green=done, blue=in-progress, amber=idle). Current `tch-rstep` buttons work as nav but miss the visual swimlane pattern
3. [COMPONENT] TeacherShell.tsx — Add quality/accuracy bar elements to StepDetail panel. Should show per-step accuracy from `stepMetrics[step].avgScore` as a visual bar width
4. [COMPONENT] TeacherShell.tsx — Add "Patterns" section with empty state placeholder text (e.g., "暂无模式识别") in the right column
5. [SYSTEM] StudentPage.tsx ��� Implement 4-phase progressive unlock (Listen→Practice→Discuss→Takeaway) within each task, matching the `currentPhase` field from backend state. Currently only task-level progression exists
6. [SYSTEM] TeacherShell.tsx — Real-time health card updates: bind card values to SSE stream data instead of static/demo values. The "12/26/4" numbers should reflect actual classroom state
7. [DESIGN] CourseSelectionPage.tsx — Reading lesson card needs proper fallback when backend is unreachable (currently shows generic "Failed to fetch"). When backend IS available, should link to `/teacher/ideal-beauty-reading` and `/student/ideal-beauty-reading`

Classification:
- [COMPONENT]: single file fix, generator can do it
- [SYSTEM]: cross-file or API change, may affect multiple dimensions
- [DESIGN]: CSS/layout issue, visual only
