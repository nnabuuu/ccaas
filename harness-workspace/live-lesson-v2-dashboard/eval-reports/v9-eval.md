# Evaluation Report — v9

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## D1: Backend Data Layer (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | answerKey in manifest | PASS: grep -c returns 5 (≥5) | 3/3 |
| 2 | Submit returns score | PASS: `{"ok":true,"score":{"total":67,"byDimension":{"q0":true,"q1":true,"q2":false}}}` | 4/4 |
| 3 | State has currentTask | PASS: students[0].currentTask = 2 after submission | 3/3 |
| 4 | State has stepMetrics | PASS: stepMetrics.1.completionRate = 33, avgScore = 67 | 3/3 |
| 5 | Step time tracking | PASS: students[0].stepStartedAt = "2026-04-21T18:44:49.510Z" | 3/3 |
| 6 | Question persistence | PASS: questions[0].question = "Myanmar在哪里？" | 2/2 |
| 7 | Backend build | PASS: `npx nest build` exit 0 | 2/2 |

## D2: Teacher Layout + Swimlane (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Band + Timeline | PASS: Topbar shows "课堂控制台", session code, Step 3/5, Time 12:48/45:00 | 2/2 |
| 2 | Health Cards | PASS: 4 cards — 最快进度 T2 1人, 中位进度 T2 100%, 卡点学生 0, AI对话 1轮 1人 | 3/3 |
| 3 | Swimlane 5 rows | PASS: 5 rows — 图式激活, 结构解码, 矩阵构建, 批判质疑, 复盘升华 | 4/4 |
| 4 | Student dots | PASS: Dots with names ("测试同学 · reading"), status colors (done/prog/stuck/reading) | 3/3 |
| 5 | Click row → StepDetail | PASS: Click row 3 → detail panel with "矩阵构建 Task", 15人当前, 15:00预设, student list | 3/3 |
| 6 | Quality bars real data | PASS: Step 1 shows "67% 正确率" after real submission with scored answers | 3/3 |
| 7 | Click dot → Student Modal | PASS: Click 陈昕妍 → modal with name, "平均 93%", step scores, matrix table | 2/2 |

## D3: Teacher Right Col + Modal (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | AI Section empty state | PASS: "AI 助教活动" shows "—" | 2/2 |
| 2 | Question Queue | PASS: 问题聚类 with priority tiers (高/中/低), 7 clustered questions with student names and counts | 3/3 |
| 3 | Student Modal matrix | PASS: Table with Place/Practice/Reason columns, 6 rows (Ancient Egypt, 1600s Europe, Borneo, NZ Maori, Myanmar, Indonesia) | 4/4 |
| 4 | Student Modal error marks | PASS: ✓ for correct (q0, q1), ✗ for Myanmar row, ~ for Indonesia partial | 3/3 |
| 5 | Coaching toggle | PASS: ▶/▼ toggle expands "参考要点 3 cards" with coaching content (示範行, 易错点, 过渡到Step4) | 2/2 |
| 6 | Patterns empty state | PASS: "暂无模式识别" + "需要更多数据来生成教学洞察" and "数据收集中" | 2/2 |
| 7 | tsc passes | PASS: `npx tsc --noEmit` exit 0 | 2/2 |
| 8 | vite build passes | PASS: `npx vite build` exit 0 (406.98 kB JS, 80.19 kB CSS) | 2/2 |

## D4: Student V2 (16/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | 5 progress dots | PASS: 5 buttons (1-5) in top bar, active dot highlighted, shows "3/5" | 3/3 |
| 2 | 4 Phase unlock | PARTIAL: Task-level progression works (Structure Map shows unlocked/locked steps). But within-task phases (Listen→Practice→Discuss) all display simultaneously — no visible phase gating | 2/4 |
| 3 | Quiz feedback | PARTIAL: Button changes to "✓ 已提交" after submit. But no per-answer ✓/✗ feedback shown to student (only visible in teacher modal) | 1/3 |
| 4 | Matrix inputs | PASS: Task 3 shows full table — Place/Practice/Reason columns, model row (Ancient Egypt), 4 input rows with "What?" / "Why?" textboxes, "提交矩阵表" button | 3/3 |
| 5 | TextPanel | PASS: Article with ¶1-¶8 paragraphs, paragraph numbers highlighted, "聚焦 ¶3,4,5,6,7" scope indicator | 3/3 |
| 6 | Submit → backend score | PASS: State API shows submission with score {total:67, byDimension} after frontend submit | 2/2 |
| 7 | Task progression | PASS: Clicking progress dots navigates between tasks; currentTask advances in backend after submission | 2/2 |

## D5: E2E Integration (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Realtime sync | PASS: curl POST join+submit → teacher tab updates: student dot appears at T2, health cards reflect 1 student, 67% accuracy | 5/5 |
| 2 | Health cards update | PASS: After submission, all 4 cards update — 最快进度 T2, 中位进度 T2 100%, 卡点 0, AI对话 1轮 | 3/3 |
| 3 | StepDetail update | PASS: Step 1 row shows "67% 正确率" after scored submission | 3/3 |
| 4 | Question queue update | PASS: curl ai/ask "What is kohl?" → teacher queue shows new row under "低优先级 · 单人提问" with student name | 3/3 |
| 5 | Legacy route | PASS: /lesson/math-linear-eq-intro renders with header, image, "开始课程" button, chat area | 3/3 |
| 6 | CourseSelection nav | PASS: Root "/" shows 2 cards — "Ideal Beauty — 阅读策略训练" (英语) and "一元一次方程引言" (数学) with 继续/全新 buttons | 3/3 |

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS: no output from `git diff --name-only -- packages/` |
| P2 | mcp-server/src/ modified | PASS: no output from `git diff --name-only -- solutions/business/live-lesson/mcp-server/src/` |
| P3 | /lesson route broken | PASS: legacy route renders successfully |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Backend Data Layer | 20/20 |
| D2: Teacher Layout + Swimlane | 20/20 |
| D3: Teacher Right Col + Modal | 20/20 |
| D4: Student V2 | 16/20 |
| D5: E2E Integration | 20/20 |
| Penalties | -0 |
| **Total** | **96/100** |

总分: 96/100

## What's Working Well
- D1 is flawless — answerKey, scoring, stepMetrics, time tracking, question persistence all solid. Do NOT touch the backend.
- D2 teacher swimlane is excellent — 5-row layout, student dots with status colors, health cards with real data, click-to-detail, click-to-modal all working perfectly. Do NOT touch TeacherShell or swimlane components.
- D3 right column is polished — question clustering by priority with student counts, student modal with matrix table and ✓/✗/~ marks, coaching toggle, patterns empty state. Do NOT touch.
- D5 E2E integration is rock-solid — SSE realtime sync works for both student updates and question queue, legacy route preserved, course selection functional. Do NOT touch SSE or routing.
- Build toolchain clean: both `tsc --noEmit` and `vite build` pass with zero errors.

## Priority Fixes
1. [COMPONENT] StudentShell.tsx — Phase gating not visible: student sees all content (Listen+Practice+Discuss) simultaneously instead of unlocking sequentially. Add a phase indicator and gate Task content behind currentPhase. Expected: show "Listen" (article only) first, then unlock "Practice" (quiz/matrix) on click/timer, then "Discuss" (AI tutor) after Practice submit. (-4 pts)
2. [COMPONENT] TaskPanel.tsx — No per-answer quiz feedback after submit: the "✓ 已提交" button appears but individual answers don't show correct/incorrect indicators. The data exists in the score.byDimension response — wire it to show ✓/✗ next to each answer field after submission. (-2 pts)

Classification:
- [COMPONENT]: single file fix, generator can do it
- [SYSTEM]: cross-file or API change, may affect multiple dimensions
- [DESIGN]: CSS/layout issue, visual only
