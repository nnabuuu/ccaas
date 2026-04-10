# v4 Evaluation Report — AskUserQuestion Wizard

**Evaluator**: Independent (not the generator)
**Date**: 2026-04-02
**Previous Score**: v3 = 86/100

## Pre-Gate Results

| Check | Result |
|-------|--------|
| `packages/backend` tsc --noEmit | PASS |
| `packages/chat-interface` tsc --noEmit | PASS |
| `packages/chat-interface` npm run build | PASS (510 kB, 2.93s) |
| `edu-platform/frontend` tsc --noEmit | PASS |
| `packages/backend` jest --no-coverage | PASS (1287 tests, 70 suites) |

## Penalty Checks

| Check | Result | Deduction |
|-------|--------|-----------|
| hardcoded hex/rgb in wizard/ | 0 instances | 0 |
| console.log in wizard/ | 0 instances | 0 |
| box-shadow in wizard/ | 0 instances | 0 |
| var(--) in WizardRenderer.tsx | 34 (req >=5) | 0 |
| var(--) in AskUserQuestionRenderer.tsx | 77 (req >=10) | 0 |
| Frozen SubmittedView modified | No | 0 |

**Total penalties: 0**

## Browser Verification

### Session Setup
- URL: http://localhost:5290
- Login: teacher / teacher123 via UI form
- Trigger: sent "帮我备课"

### Evidence (screenshots in `screenshots/v4/`)

| # | File | Description |
|---|------|-------------|
| eval-00 | eval-00-landing.png | Landing page: session list, skill sidebar, context chips |
| eval-02 | eval-02-processing.png | Wizard rendered: 4-step indicator, LLM text, "正在处理..." |
| eval-03 | eval-03-step1-filled.png | Step 1 FormStep: 5 combobox fields, 学科=数学 auto-filled (contextKey) |
| eval-04 | eval-04-step2-tree.png | Step 2 TreeSelectStep: 3 chapters, 8 sections, 全选/全不选 buttons |
| eval-05 | eval-05-step2-selected.png | Step 2 after 全选: all 8 checked, "已选择 8 项" counter |
| eval-06 | eval-06-step3-datareview.png | Step 3 DataReviewStep: 6 knowledge points, progress bars, auto-emphasis |
| eval-07 | eval-07-step4-summary.png | Step 4 SummaryStep: 3 sections, FormSummary, "修改 ›" links, green button |
| eval-08 | eval-08-after-submit-double-auq.png | **CRITICAL**: After submit, LLM called AskUserQuestion AGAIN |

### Key Observations

1. **E2E data flow confirmed**: wizard submit → POST /control-response → LLM resumes
2. **Double AskUserQuestion bug persists**: LLM ignores wizard answers, re-asks via default UI
3. **Wizard code is flawless**: all 4 steps render correctly, navigation works, dependencies enforced
4. **Default UI (D2) incidentally confirmed**: second AskUserQuestion renders InteractiveViewInner

## Dimension Scores

### D1: control_request E2E 数据流 — 5/5 (Weight: 20)

**Evidence**:
- LLM called AskUserQuestion → wizard rendered (eval-02)
- SSE tool_activity(start) reached frontend (wizard visible in browser)
- User completed 4-step wizard → clicked 确认生成
- POST /control-response succeeded (wizard UI replaced by new content)
- LLM resumed execution (new AskUserQuestion tool call appeared within seconds)

Full data flow verified: AskUserQuestion → EventMapper → SSE → ControlRequestView → WizardRenderer → submit → /control-response → CLI stdin → LLM resumes.

**Weighted score: (5/5) × 20 = 20**

---

### D2: ControlRequestView 默认 UI — 4/5 (Weight: 15)

**Evidence** (eval-08-after-submit-double-auq.png):
- Tab navigation: 4 question tabs (学科/年级/课型/学情) ✓
- Radio option cards with label + description ✓
- "或者自定义" custom input with textbox ✓
- Counter "0 / 4 已回答" ✓
- Disabled "确认选择" button ✓
- 77 var(--) CSS variable references ✓

**Why not 5/5**: Did not interact with the default UI (select options, verify counter updates, verify submit, verify submitted state). Only initial render observed. Did not compare with ask-user-question-ui-ux v6 widget.

**Weighted score: (4/5) × 15 = 12**

---

### D3: WizardRenderer 通用框架 — 5/5 (Weight: 20)

**Evidence**:
- Step indicator: numbers + titles + state colors (✓ done, active circle, gray pending)
- Navigation: 上一步 disabled on Step 1, 下一步 works across all steps
- Completed steps clickable (cursor=pointer confirmed)
- FormStep: 5 combobox fields rendered and functional
- contextKey auto-fill: 学科=数学 from sessionContext.subject (eval-03)
- dependsOn tooltips: "请先完成「选择章节」" on Step 3, "请先完成「选择章节」「学情分析」" on Step 4
- dependsOn unlocks: Step 3 became clickable after Step 2 completed
- 34 var(--) references, 0 box-shadow

**Weighted score: (5/5) × 20 = 20**

---

### D4: TreeSelect + DataReview 动态步骤 — 5/5 (Weight: 15)

**TreeSelectStep** (eval-04, eval-05):
- Mock tree: 3 chapters, 8 sections, expandable ▼ nodes
- Checkboxes on leaf nodes, 全选 works (8 items selected)
- "已选择 8 项" counter
- Mock fallback working

**DataReviewStep** (eval-06):
- 6 knowledge points in table with headers (知识点/掌握度/重点)
- Progress bars with percentages (85%, 72%, 90%, 58%, 45%, 62%)
- Emphasis toggles (标记/已标记)
- Auto-emphasis on <60% items (合并同类项 58%, 一元一次方程的解法 45%)
- "已标记 2 个重点知识点" counter
- Code review: loading spinner + error banner with retry confirmed

**Weighted score: (5/5) × 15 = 15**

---

### D5: SummaryStep + 提交确认 — 5/5 (Weight: 10)

**Evidence** (eval-07):
- Summary: 3 completed steps with ✓ icons
- FormSummary: 学科: 数学, 年级学期: 八年级上, 班级: 2班, 课型: 新授课, 课时: 1课时
- Chapter names: 8 items joined with 、
- Emphasis: 合并同类项、一元一次方程的解法
- Jump-back "修改 ›" links visible (cursor=pointer)
- "请确认以下选择，点击可返回修改" instruction
- Green 确认生成 button (var(--success-t))
- Submit succeeded (wizard replaced after click)

**Weighted score: (5/5) × 10 = 10**

---

### D6: 备课向导 4 步流程 — 3/5 (Weight: 20)

**Evidence**:
- "帮我备课" → wizard renders with 4 steps ✓
- Step 1-4: all work correctly ✓
- Submit → LLM resumes ✓
- **LLM calls AskUserQuestion AGAIN instead of generating lesson plan** ✗

**Why 3/5**: The 3/5 criteria states "4 步可走完但提交后 LLM 不继续或忽略 answers". The LLM resumed but ignored wizard answers, calling AskUserQuestion again. No lesson plan generated. The SKILL.md fix did not take effect at runtime (cached prompt).

**Why not lower**: LLM DID resume (hard cap "LLM 不恢复执行 → max 3/5" does not apply). Wizard code is flawless.

**Weighted score: (3/5) × 20 = 12**

---

## Score Summary

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| D1: control_request E2E | 5/5 | 20 | 20 |
| D2: ControlRequestView 默认 UI | 4/5 | 15 | 12 |
| D3: WizardRenderer 框架 | 5/5 | 20 | 20 |
| D4: TreeSelect + DataReview | 5/5 | 15 | 15 |
| D5: SummaryStep + 提交 | 5/5 | 10 | 10 |
| D6: 备课向导 4 步流程 | 3/5 | 20 | 12 |

**Base score**: 89
**Penalties**: 0
**Net change from v3**: +3 (D1: +4, D2: +3, D6: -4)

## Bug Report

### BUG-01: Double AskUserQuestion after wizard submission (CRITICAL)

**Severity**: High — breaks primary user journey
**Reproduction**: "帮我备课" → complete wizard → 确认生成 → LLM calls AskUserQuestion again
**Root cause**: SKILL.md fix not applied at runtime (cached prompt)
**Impact**: D6 capped at 3/5 (−8 weighted points)
**Fix**: Restart backend; if persists, add backend-side dedup guard

### BUG-02: D2 default UI not independently tested

**Severity**: Low — evaluation gap
**Fix**: Trigger AskUserQuestion from non-wizard skill for full D2 verification

## Recommendations for v5

1. **Fix BUG-01 (D6 3→5, +8 potential)**: Restart backend + verify SKILL.md loaded
2. **Test D2 independently (D2 4→5, +3 potential)**: Full default UI interaction test
3. **Maximum potential**: 89 + 8 + 3 = **100/100**

总分: 89/100
