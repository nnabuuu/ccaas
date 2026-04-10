# v5 Evaluation Report — AskUserQuestion Wizard

**Evaluator**: Independent (no code authorship)
**Date**: 2026-04-02 20:05
**Browser**: http://localhost:5290 (Playwright headless)

---

## Pre-Scoring Gate

| Check | Result |
|-------|--------|
| `packages/backend` tsc --noEmit | PASS |
| `packages/backend` jest --no-coverage | PASS (1287 tests, 70 suites) |
| `packages/chat-interface` tsc --noEmit | PASS |
| `packages/chat-interface` npm run build | PASS |
| `edu-platform/frontend` tsc --noEmit | PASS |

**Gate**: PASSED

---

## Penalty Checks

| Rule | Count | Deduction |
|------|-------|-----------|
| Hardcoded hex/rgb in `wizard/` | 0 | 0 |
| `console.log` in `wizard/` | 0 | 0 |
| `box-shadow` in `wizard/` | 0 | 0 |
| `console.log` in `AskUserQuestionRenderer.tsx` | 0 | 0 |
| `var(--)` in `WizardRenderer.tsx` | 34 (>=5 required) | 0 |
| `var(--)` in `AskUserQuestionRenderer.tsx` | 77 (>=10 required) | 0 |
| Frozen SubmittedView modified | No | 0 |
| bypassPermissions behavior change | No | 0 |
| tsc/jest regression | No | 0 |

**Total penalty**: 0

---

## Dimension Scores

### D1: control_request E2E (Weight 20) — Score: 5/5

**Evidence**:
- Sent "帮我备课" -> LLM invoked AskUserQuestion with header "备课向导"
- Backend processed control_request -> SSE tool_activity(start) emitted
- Frontend ControlRequestView rendered -> wizard registry matched "备课向导"
- 4-step WizardRenderer rendered (screenshots eval-v5-02 through eval-v5-06)
- User completed all 4 steps -> clicked "确认生成"
- POST `/api/v1/sessions/:id/control-response` -> 200 OK
- LLM resumed execution: acknowledged wizard answers ("备课参数确认: 学科: 数学 | 年级: 八年级上 | 班级: 2班...")
- LLM called curriculum_tree tool -> retrieved 66 knowledge nodes
- LLM used 6+ tools -> generated complete lesson plan
- Full lesson plan visible: 因式分解（一）—— 提公因式法 教案

**Dedup observation**: LLM called AskUserQuestion a second time after wizard submit (non-deterministic behavior). Backend dedup mechanism (`consumeLastAskUserAnswers`) auto-responded with cached wizard answers. Default InteractiveViewInner briefly rendered then LLM continued. This is a non-blocking display artifact — data flow completed successfully.

**Browser screenshots**: eval-v5-02 through eval-v5-11

**Weighted**: 5/5 x 20 = **20**

---

### D2: ControlRequestView Default UI (Weight 15) — Score: 4/5

**Evidence**:
- Default InteractiveViewInner rendered during dedup scenario (screenshot eval-v5-07, eval-v5-11)
- Tab navigation: 学科, 年级, 课型, 学情 — 4 question tabs
- Radio option cards with label + description (数学/初中数学, 语文/初中语文, etc.)
- "或者自定义" fallback text input
- Counter: "0/4 已回答"
- "确认选择" button (disabled until selections made)
- 77 `var(--)` CSS references (well above 10 minimum)

**Gap**: Not independently triggered via a non-wizard AskUserQuestion. Default UI was only observed incidentally during the dedup auto-response flow. Selection + submit interaction in default mode was not verified. Per EVAL_CRITERIA detection method, an independent trigger (e.g., quiz-generator skill) is required for 5/5.

**Weighted**: 4/5 x 15 = **12**

---

### D3: WizardRenderer Framework (Weight 20) — Score: 5/5

**Evidence**:
- **Step indicator bar**: 4 chips with number badges + titles (选择范围, 选择章节, 学情分析, 确认生成)
- **State colors**: Active = blue (`var(--info-t)`), Done = green (`var(--success-t)` + checkmark), Disabled = 40% opacity
- **Navigation**: "上一步" / "下一步" buttons functional; tested forward and back
- **Jump-back**: Completed steps clickable in step indicator bar
- **FormStep**: 5 select fields rendered correctly; `contextKey: 'subject'` auto-filled 学科=数学 from `sessionContext.subject`
- **dependsOn**: Step 2-4 disabled until Step 1 completed; tooltip shows "请先完成「选择范围」"
- **Submit**: "确认生成" button on last step; `handleSubmit` flattens answers to `Record<string, string>` -> calls `onSubmit`
- **CSS**: 34 `var(--)` references, 0 `box-shadow`, 0 hardcoded colors
- **Code quality**: `useMemo` for completedSteps, `useCallback` for all handlers, proper TypeScript typing

**Browser verification**: All above confirmed in screenshots eval-v5-02 through eval-v5-06.

**Weighted**: 5/5 x 20 = **20**

---

### D4: TreeSelect + DataReview (Weight 15) — Score: 5/5

**Evidence**:

**TreeSelectStep** (screenshot eval-v5-04, eval-v5-05):
- Fetches from `dataEndpoint` with `MOCK_TREE` fallback
- 3 chapters rendered as expandable parent nodes
- 8 leaf nodes with checkboxes
- Expand/collapse via chevron icon
- "全选" / "取消全选" toggle button
- After 全选: "已选择 8 项" counter
- Value format: `{ ids: string[], labels: Record<string, string> }`
- Error banner with retry button in code (`TreeSelectStep.tsx:45-55`)

**DataReviewStep** (screenshot eval-v5-06):
- Fetches from `dataEndpoint` with `MOCK_DATA` fallback
- 6 knowledge points with progress bars
- Color-coded: green (>=80%), yellow (60-79%), red (<60%)
- `autoEmphasize` for items <60%: "合并同类项" (58%) and "一元一次方程的解法" (45%) auto-marked
- "已标记 2 个重点知识点" counter
- Emphasis toggle buttons ("取消标记" / "标记重点")
- Error banner with retry in code (`DataReviewStep.tsx:52-62`)

**Weighted**: 5/5 x 15 = **15**

---

### D5: SummaryStep + Submit (Weight 10) — Score: 5/5

**Evidence** (screenshot eval-v5-06):
- All 3 non-summary steps displayed with green checkmark badges
- **FormSummary**: key-value pairs (学科: 数学, 年级: 八年级上, 班级: 2班, 课型: 新授课, 课时: 1课时)
- **TreeSelect summary**: "已选择 8 项" with named labels via `formatAnswer`
- **DataReview summary**: emphasis items listed
- Jump-back links: "修改 >" on each step card -> `onJumpTo(stepIndex)`
- Submit button: green "确认生成" (`var(--success-t)` background)
- Post-submit: Button shows "提交中..." -> transitions to "参数已提交，正在生成..." -> "向导已完成"
- POST `/control-response` confirmed successful

**Weighted**: 5/5 x 10 = **10**

---

### D6: Lesson Plan Wizard 4-Step Flow (Weight 20) — Score: 5/5

**Evidence**:

Full end-to-end flow verified in browser:

1. Teacher sent "帮我备课" -> message dispatched
2. LLM invoked AskUserQuestion with header "备课向导" -> `findWizardByHeaders` matched
3. WizardRenderer rendered 4-step wizard (eval-v5-02)
4. **Step 1** (FormStep): 5 fields, `contextKey` auto-filled 学科=数学. Filled: 八年级上, 2班, 新授课, 1课时 (eval-v5-03)
5. **Step 2** (TreeSelectStep): 3 chapters, 8 nodes. Clicked "全选" -> 8 items checked (eval-v5-04, eval-v5-05)
6. **Step 3** (DataReviewStep): 6 knowledge points, auto-emphasis on 2 weak items <60% (eval-v5-06)
7. **Step 4** (SummaryStep): All 3 steps summarized, jump-back links present (eval-v5-06)
8. Clicked "确认生成" -> POST /control-response 200 OK
9. LLM resumed with dedup mechanism handling second AskUserQuestion call
10. LLM acknowledged parameters: "备课参数确认: 学科: 数学 | 年级: 八年级上 | 班级: 2班" (eval-v5-08)
11. LLM referenced weak points from Step 3: "薄弱知识点：合并同类项、一元一次方程的解法"
12. LLM fetched curriculum_tree (66 nodes), selected topic: "因式分解 — 提公因式法"
13. LLM generated complete lesson plan (eval-v5-09):
    - **Title**: 因式分解（一）—— 提公因式法 教案
    - **教案概述**: 八年级上 2班 新授课 45分钟
    - **教学目标**: 3个维度目标 + 4项核心素养对应
    - **重难点**: 重点2条 + 难点2条 + 3项突破策略
    - **教学过程**: 5个环节：导入(5')->探究(18')->练习(12')->总结(5')->作业(5')
    - **评价方案**: 即时评价 + 出门条 + 自评互评
    - **作业设计**: 基础5题(必做) + 提升3题 + 探究2题(选做)
    - **针对薄弱点设计亮点**: 3 specific strategies for 合并同类项 and 一元一次方程

**Lesson plan correctly references wizard selections**: subject, grade, class, weak points, teaching style.

**Weighted**: 5/5 x 20 = **20**

---

## Known Issues

1. **Default AskUserQuestion UI not dismissed after dedup**: When LLM calls AskUserQuestion a second time, the dedup auto-responds but the default InteractiveViewInner UI is briefly rendered and not dismissed. This is a frontend display artifact — the data flow works correctly.

2. **D2 default UI not independently tested**: Default InteractiveViewInner only observed during dedup scenario, not via a dedicated non-wizard AskUserQuestion trigger. Full interactive testing (select + submit in default mode) not performed.

---

## Bug Report

| # | Severity | Description | Impact |
|---|----------|-------------|--------|
| BUG-01 | Low | Default AskUserQuestion UI briefly appears after wizard submit due to dedup second-call rendering, then remains visible (not auto-dismissed) | Visual artifact only — LLM continues correctly |
| BUG-02 | Info | D2 default UI not independently testable without a non-wizard skill trigger in the current session setup | Evaluation gap, not a code bug |

---

## Screenshots

| # | File | Description |
|---|------|-------------|
| eval-v5-02 | `eval-v5-02-wizard-step1.png` | Wizard Step 1: FormStep with 5 fields, 学科 auto-filled |
| eval-v5-03 | `eval-v5-03-step1-filled.png` | Step 1 filled: 数学, 八年级上, 2班, 新授课, 1课时 |
| eval-v5-04 | `eval-v5-04-step2-tree.png` | Step 2: TreeSelectStep with 3 chapters, 8 leaf nodes |
| eval-v5-05 | `eval-v5-05-step2-selected.png` | Step 2 after 全选: all 8 checked |
| eval-v5-06 | `eval-v5-06-step3-data.png` | Step 3: DataReviewStep with 6 knowledge points + auto-emphasis |
| eval-v5-07 | `eval-v5-07-after-submit.png` | After submit: default AskUserQuestion UI visible (dedup scenario) |
| eval-v5-08 | `eval-v5-08-llm-processing.png` | LLM processing: acknowledged wizard params, fetching curriculum |
| eval-v5-09 | `eval-v5-09-after-wait.png` | Complete lesson plan generated |
| eval-v5-10 | `eval-v5-10-full-page.png` | Full page with lesson plan |
| eval-v5-11 | `eval-v5-11-flow-top.png` | Scrolled to top: default UI + "备课参数确认" |

---

## Score Summary

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| D1: control_request E2E | 5/5 | 20 | 20 |
| D2: ControlRequestView default UI | 4/5 | 15 | 12 |
| D3: WizardRenderer framework | 5/5 | 20 | 20 |
| D4: TreeSelect + DataReview | 5/5 | 15 | 15 |
| D5: SummaryStep + submit | 5/5 | 10 | 10 |
| D6: lesson-plan wizard 4-step | 5/5 | 20 | 20 |

| | |
|---|---|
| Base score | 97 |
| Penalties | 0 |
| **Final** | **97** |

---

## Score Progression

| Version | Score | Delta | Top Change |
|---------|-------|-------|------------|
| v1 | 69 | -- | Initial implementation |
| v2 | 75 | +6 | WizardRenderer + SummaryStep improvements |
| v3 | 86 | +11 | TreeSelect + DataReview polish, browser verification |
| v4 | 89 | +3 | SKILL.md fix for double AskUserQuestion |
| **v5** | **97** | **+8** | **Dedup mechanism fixes D6 (LLM resumes), MCP tool cleanup** |

---

总分: 97/100
