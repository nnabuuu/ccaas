# Evaluation Report — v5

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK (went down mid-eval; all D1 curl tests completed before crash)
- Frontend (:5283): OK (auto-incremented to :5284 due to port conflict; confirmed via `lsof`)

## D1: Backend Data Layer (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | answerKey in manifest | PASS: `grep -c` returned 5 (≥5) | 3/3 |
| 2 | Submit returns score | PASS: `{"ok":true,"score":{"total":67,"byDimension":{"q0":true,"q1":true,"q2":false}}}` | 4/4 |
| 3 | State has currentTask | PASS: `students[0].currentTask = 2` present in state response | 3/3 |
| 4 | State has stepMetrics | PASS: `stepMetrics.1.completionRate = 33`, `avgScore = 67` | 3/3 |
| 5 | Step time tracking | PASS: `stepStartedAt: "2026-04-21T17:11:07.024Z"` present | 3/3 |
| 6 | Question persistence | PASS: `questions[0].question = "Myanmar在哪里？"` with studentName and step | 2/2 |
| 7 | Backend build | PASS: `npx nest build` exit code 0 | 2/2 |

## D2: Teacher Layout + Swimlane (14/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Band + Timeline | PASS: Topbar shows "课堂控制台", "高一(3)班 · Ideal Beauty", Step 3/5, Time 12:48/45:00 | 2/2 |
| 2 | Health Cards | PARTIAL: 3 stat boxes visible (已提交 12, 填写中 26, 未开始 4) — all non-zero but only 3, not 4 cards | 2/3 |
| 3 | Swimlane 5 rows | PASS: 5 step buttons with Chinese labels and time allocations (图式激活 5', 结构解码 8', 矩阵构建 15', 批判质疑 12', 复盘升华 5') | 4/4 |
| 4 | Student dots | PASS: `tch-sl-dot` elements with `done`/`prog`/`idle` classes; different bg colors (rgb(138,138,128) for done, transparent+border for prog, rgb(188,186,178) for idle). 班级视图 shows 12 student chips with names | 3/3 |
| 5 | Click row → StepDetail | PASS: Clicking "1 图式激活" changes detail to Step 1 content, coaching, and "进入 Step 2 →" button | 3/3 |
| 6 | Quality bars real data | FAIL: No `[class*="bar"]`, `[class*="progress"]`, or inline-width elements found. No accuracy visualization in step detail | 0/3 |
| 7 | Click dot → Student Modal | FAIL: Clicking "陈昕妍" chip — no modal/dialog/overlay found in DOM (`querySelectorAll('[role=dialog]')` returns 0) | 0/2 |

## D3: Teacher Right Col + Modal (11/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | AI Section empty state | PARTIAL: Question queue area exists with tab bar (待处理 14 / 全部对话 38 / 已解决 6). No separately labeled "AI" section; cannot verify empty state since data is populated | 1/2 |
| 2 | Question Queue | PASS: Rich clustered queue with 3 priority tiers (高优先级 ≥4人: 2 items, 中优先级 2-3人: 3 items, 低优先级 单人: 2 items). Shows student names, counts, timestamps. Search bar + filter chips (按影响, 按时间, 仅高频) | 3/3 |
| 3 | Student Modal matrix | FAIL: No modal opens on student chip click. Zero `[role=dialog]` or `[class*=modal]` elements in DOM | 0/4 |
| 4 | Student Modal error marks | FAIL: No modal → cannot check error marks | 0/3 |
| 5 | Coaching toggle | PASS: "参考要点 3 cards" section with 3 expandable cards: 示范一行, 易错点, 过渡到 Step 4. Content renders with markdown formatting | 2/2 |
| 6 | Patterns empty state | PARTIAL: Question clustering shows pattern detection (priority grouping by impact count). No separate "Patterns" section with explicit empty state | 1/2 |
| 7 | tsc passes | PASS: `npx tsc --noEmit` exit code 0 | 2/2 |
| 8 | vite build passes | PASS: `npx vite build` → "✓ built in 2.22s", 434.57 kB JS bundle | 2/2 |

## D4: Student V2 (14/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | 5 progress dots | PASS: 5 numbered buttons ("1"–"5") in top bar. Active button gets [active] attribute. Shows "X/5" counter | 3/3 |
| 2 | 4 Phase unlock | PARTIAL: Structure Map shows task-level progression (completed tasks show keyword labels like "现象", "信号词"; locked tasks show "· · ·"). No explicit Listen/Practice/Discuss/Produce phase labels within each task | 1/4 |
| 3 | Quiz feedback | PARTIAL: After submit → ✓ marks on correct answers + "得分: 100%". Selection highlights (blue bg rgb(228,239,248)) on click. But no immediate per-click correct/incorrect indicator — feedback only after submit | 2/3 |
| 4 | Matrix inputs | PASS: Task 3 shows full matrix table — Place×Practice×Reason. Row 1 pre-filled as model (Ancient Egypt). Rows 2-6 have textbox inputs ("What?", "Why?"). Shows "0/5 行已填" counter and sentence template | 3/3 |
| 5 | TextPanel | PASS: Center column shows article with ¶1-¶8 paragraph markers. Focus indicator adapts per task ("聚焦 ¶1,2" for Task 1, "聚焦 ¶3,4,5,6,7" for Task 3). Closeable with ✕ button | 3/3 |
| 6 | Submit → backend score | PARTIAL: Student page at `/student/:lessonId` shows local score ("得分: 100%") after submit. Backend scoring confirmed via curl in D1. But standalone student view lacks session binding for backend submission | 1/2 |
| 7 | Task progression | PARTIAL: Clicking step buttons (1→3) navigates between tasks successfully (content, text focus, and task panel all update). But "下一任务 →" button did not advance from Task 1 to Task 2 | 1/2 |

## D5: E2E Integration (4/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Realtime sync | FAIL: Teacher and student views are on separate auto-created sessions. No shared session mechanism verified. Backend went down mid-eval preventing further testing | 0/5 |
| 2 | Health cards update | FAIL: Cannot verify realtime update — sessions are isolated; backend unavailable for submission testing | 0/3 |
| 3 | StepDetail update | FAIL: Cannot verify — same session isolation issue | 0/3 |
| 4 | Question queue update | FAIL: curl ai/ask was submitted before teacher page load; teacher uses its own session with simulated data. Cannot confirm realtime push | 0/3 |
| 5 | Legacy route | PASS: `/lesson/math-linear-eq-intro` renders lesson page with title, "准备开始课程", and "开始课程" button. 7 console errors but no crash | 3/3 |
| 6 | CourseSelection nav | PARTIAL: Route `/` renders page structure (heading "动态教学", subtitle). But `fetch` to lesson API fails ("Failed to fetch") — likely browser cannot reach :3007 | 1/3 |

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS: `git diff --name-only -- packages/` returned no output |
| P2 | mcp-server/src/ modified | PASS: `git diff --name-only -- solutions/business/live-lesson/mcp-server/src/` returned no output |
| P3 | /lesson route broken | PASS: `/lesson/math-linear-eq-intro` rendered successfully |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Backend Data Layer | 20/20 |
| D2: Teacher Layout + Swimlane | 14/20 |
| D3: Teacher Right Col + Modal | 11/20 |
| D4: Student V2 | 14/20 |
| D5: E2E Integration | 4/20 |
| Penalties | -0 |
| **Total** | **63/100** |

总分: 63/100

## What's Working Well
- **D1 is perfect (20/20)** — backend data layer is solid: answerKey, scoring with byDimension, stepMetrics, stepStartedAt, question persistence. Tell the generator: "These are solid — do NOT touch them"
- **Teacher dashboard layout** — 5-step timeline with Chinese labels and time budgets, step-switching, coaching cards, and the rich clustered question queue are impressive
- **Student quiz + matrix** — quiz selection with visual highlight, post-submit checkmarks, and the full Place×Practice×Reason matrix with input fields are well-built
- **TextPanel with focus** — paragraph markers (¶1-¶8) with adaptive focus per task is excellent UX
- **Build toolchain** — both `tsc --noEmit` and `vite build` pass cleanly

## Priority Fixes
1. [COMPONENT] TeacherShell.tsx — Student chip click does NOT open a modal. Expected: click student name → dialog with submission matrix and error marks. Add a `StudentModal` component with `[role="dialog"]` that shows per-student submission data and marks incorrect answers
2. [COMPONENT] TeacherShell.tsx — No quality/accuracy bars in step detail view. Expected: per-step horizontal bars showing accuracy %. Add `<div class="bar-fill" style="width: ${pct}%">` elements for each step's `avgScore` from `stepMetrics`
3. [COMPONENT] TeacherShell.tsx — Only 3 health cards (已提交, 填写中, 未开始). Expected 4. Add a 4th card (e.g., 平均分/avg score or 提问数/question count)
4. [SYSTEM] StudentShell.tsx — "下一任务 →" button does not advance task. The click handler likely fails because the standalone `/student/:lessonId` view has no session context. Fix: either advance local task state without session, or require session binding
5. [SYSTEM] StudentShell.tsx — No explicit Listen/Practice/Discuss/Produce phase labels or phase gating within each task. The Structure Map shows task-level locks but no sub-task phase progression. Add phase indicators per task
6. [SYSTEM] JoinPage.tsx + useClassroom.ts — Student join flow fails with "网络错误" in browser. The backend API uses absolute URLs (`http://localhost:3007`) which work for curl but fail in the browser (likely CORS or proxy). Consider adding vite proxy config for `/api` routes
7. [DESIGN] CourseSelectionPage.tsx — Data fetch fails in browser ("Failed to fetch"). Same root cause as #6. Add vite proxy or handle fetch error gracefully with retry + fallback data
8. [COMPONENT] TeacherShell.tsx — No "AI" section with empty state, and no separate "Patterns" section with placeholder text. Add labeled sections with `— 暂无数据` empty states

Classification:
- [COMPONENT]: single file fix, generator can do it → #1, #2, #3, #8
- [SYSTEM]: cross-file or API change, may affect multiple dimensions → #4, #5, #6, #7
- [DESIGN]: CSS/layout issue, visual only → (none — all issues are structural)
