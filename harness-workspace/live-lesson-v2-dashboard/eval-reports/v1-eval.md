# Evaluation Report — v1

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## D1: Backend Data Layer (16/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | answerKey in manifest | PASS: `grep -c "answerKey"` = 5 (≥ 5) | 3/3 |
| 2 | Submit returns score | FAIL: response `{"ok":true,"score":null}` — score field exists but is null, not numeric | 0/4 |
| 3 | State has currentTask | PASS: `students[0].currentTask = 2` present and numeric | 3/3 |
| 4 | State has stepMetrics | PASS: `stepMetrics.1.completionRate = 33` present | 3/3 |
| 5 | Step time tracking | PASS: `stepStartedAt: "2026-04-21T15:28:16.157Z"` present | 3/3 |
| 6 | Question persistence | PASS: `questions[0].question = "Myanmar在哪里？"` persisted | 2/2 |
| 7 | Backend build | PASS: `npx nest build` exit code 0 | 2/2 |

## D2: Teacher Layout + Swimlane (19/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Band + Timeline | PASS: topbar shows "课堂观察台", "高一(3)班 · 3 人", code "UT7MW7", timer "课堂 00:36" | 2/2 |
| 2 | Health Cards | PASS: 4 cards visible — 最快进度=Task 2, 中位进度=Task 2, 卡点学生=—, AI对话=1 | 3/3 |
| 3 | Swimlane 5 rows | PASS: T1 图式激活, T2 结构解码, T3 矩阵构建, T4 批判质疑, T5 复盘升华 | 4/4 |
| 4 | Student dots | PASS: dots with names (张皓月, 王译文, 陈昕妍), status labels ("进行中", "?%") | 3/3 |
| 5 | Click row → StepDetail | PASS: click T3 → right panel shows "Task 3 · 矩阵构建" with metrics | 3/3 |
| 6 | Quality bars real data | PARTIAL: 完成率=33%/100% bar has non-zero width; 平均分=0% because score is null | 2/3 |
| 7 | Click dot → Student Modal | PASS: click 陈昕妍 dot → modal shows name, "Task 2 · listen · 1 提交", submissions | 2/2 |

## D3: Teacher Right Col + Modal (13/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | AI Section empty state | PASS: 观察模式 "—", 教学建议 "—" shown as empty state | 2/2 |
| 2 | Question Queue | PASS: "问题队列 · 1" with "What is kohl?" by 实时测试 (verified on BJNT88 session) | 3/3 |
| 3 | Student Modal matrix | FAIL: modal shows raw JSON `{ "answers": [ 1, 2, 0 ] }` — not a structured table/grid | 0/4 |
| 4 | Student Modal error marks | FAIL: no visual error indicators for incorrect answers in modal | 0/3 |
| 5 | Coaching toggle | PASS: "▸ 教学指引" expands to show 参考要点, 快捷推送, "同步全班到此步" button | 2/2 |
| 6 | Patterns empty state | PASS: 观察模式 section shows "—" placeholder | 2/2 |
| 7 | tsc passes | PASS: `npx tsc --noEmit` exit code 0 | 2/2 |
| 8 | vite build passes | PASS: `npx vite build` exit code 0, built in 2.19s | 2/2 |

## D4: Student V2 (17/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | 5 progress dots | PASS: 5 tabs — 1:Predict, 2:Skim, 3:Scan & Build, 4:Evaluate, 5:Wrap-up | 3/3 |
| 2 | 4 Phase unlock | PASS: Listen+Practice accessible; Discuss🔒+Takeaway🔒; "Complete Practice to unlock Discuss"; after quiz complete Discuss unlocks | 4/4 |
| 3 | Quiz feedback | PASS: ✓ marks on correct answers, "1 attempt" + 💡 hint for wrong, "Try Again" button | 3/3 |
| 4 | Matrix inputs | PARTIAL: code verified in TaskPanel.tsx:198 — `<table className="stu-matrix">` with `<input>` fields for practice/reason; couldn't reach in UI due to progression lock | 2/3 |
| 5 | TextPanel | PASS: right column shows article with ¶1-¶8 paragraph markers, "聚焦 ¶1,2" focus indicator | 3/3 |
| 6 | Submit → backend score | FAIL: backend state shows `"score": null` — no numeric score calculated | 0/2 |
| 7 | Task progression | PASS: after completing practice phases, student.currentTask advanced from 1 to 2 | 2/2 |

## D5: E2E Integration (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Realtime sync | PASS: curl join+submit → teacher SSE updates within 3s: "1 人", dot appears with status, health cards update | 5/5 |
| 2 | Health cards update | PASS: 最快进度=Task 2, 中位进度=Task 2, AI对话=1 — all updated after API calls | 3/3 |
| 3 | StepDetail update | PASS: Task 1 detail shows "1 已完成", "完成率 100%" after submission | 3/3 |
| 4 | Question queue update | PASS: curl ai/ask → "问题队列 · 1" with "What is kohl?" by 实时测试 | 3/3 |
| 5 | Legacy route | PASS: `/lesson/math-linear-eq-intro` renders with step indicators, "开始课程" button, interactive elements | 3/3 |
| 6 | CourseSelection nav | PASS: course selection shows "Ideal Beauty — 阅读策略训练" reading card with 英语 tag; "全新课堂" navigates to lesson | 3/3 |

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS: no changes detected |
| P2 | mcp-server/src/ modified | PASS: no changes detected |
| P3 | /lesson route broken | PASS: legacy route renders correctly |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Backend Data Layer | 16/20 |
| D2: Teacher Layout + Swimlane | 19/20 |
| D3: Teacher Right Col + Modal | 13/20 |
| D4: Student V2 | 17/20 |
| D5: E2E Integration | 20/20 |
| Penalties | -0 |
| **Total** | **85/100** |

总分: 85/100

## What's Working Well
- **D5 E2E Integration (20/20)**: Real-time SSE sync is rock solid — student actions push to teacher within seconds. Health cards, swimlane dots, step detail, and question queue all update live. Legacy route and course selection routing work perfectly. These are solid — do NOT touch them.
- **D2 Teacher Layout (19/20)**: The 5-row swimlane with task labels, student dots with status tooltips, health cards with live data, and click-to-detail interaction are all well-implemented. The coaching toggle with 参考要点/快捷推送 is excellent.
- **D4 Student Quiz Flow**: The 4-phase unlock mechanism (Listen→Practice→Discuss→Takeaway) with ✓/hint feedback and "Try Again" retry is pedagogically sound and well-coded.
- **D1 State Model**: currentTask, stepMetrics, stepStartedAt, questions[] are all present and correct.

## Priority Fixes
1. [SYSTEM] classroom.service.ts — `score` field is always `null` in submit response and state → implement score calculation by comparing `data.answers` against `answerKey` in manifest. This affects D1.2 (4pts), D2.6 (1pt), D4.6 (2pts) = **7 pts recoverable**
2. [COMPONENT] TeacherShell.tsx — Student modal shows raw JSON `{ "answers": [ 1, 2, 0 ] }` instead of a structured answer grid → render answers as a table with question text and selected option labels. Affects D3.3 (4pts) = **4 pts recoverable**
3. [COMPONENT] TeacherShell.tsx — Student modal has no error indicators for incorrect answers → cross-reference answers against answerKey and show ✗/✓ marks with red/green styling. Affects D3.4 (3pts) = **3 pts recoverable**
4. [COMPONENT] TaskPanel.tsx — Matrix inputs couldn't be verified live due to progression lock → consider allowing direct task tab navigation (or confirm matrix renders correctly in integration test). Affects D4.4 (1pt) = **1 pt recoverable**

Classification:
- [SYSTEM]: #1 — cross-file: backend score calculation + frontend display (affects D1, D2, D4)
- [COMPONENT]: #2 — single file: student modal answer rendering in TeacherShell.tsx
- [COMPONENT]: #3 — single file: student modal error marks in TeacherShell.tsx
- [COMPONENT]: #4 — single file: verify matrix input live rendering in TaskPanel.tsx
