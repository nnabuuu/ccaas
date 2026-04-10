# v1 Changelog — AskUserQuestion Wizard Harness

**Date:** 2026-04-02
**Baseline score:** ~45/100
**Estimated post-fix score:** ~72/100

## Problem

When user sends "帮我备课", the LLM calls `AskUserQuestion` with **4 separate questions** (headers: 学科, 年级, 课型, 学情) instead of a single question with header="备课向导". The `ControlRequestView` in `AskUserQuestionRenderer.tsx` only checked `getWizardConfig(headerHint)` where `headerHint = questions[0].header` (i.e. "学科"), which doesn't match any registered wizard slug. Result: default InteractiveViewInner rendered instead of WizardRenderer.

## Root Cause

1. **LLM non-compliance**: SKILL.md instructed single-question format with header="备课向导", but the LLM used multi-question format
2. **No fallback matching**: Registry only supported exact slug match, no way to match by individual question headers

## Changes

### 1. Wizard Registry — triggerHeaders fallback (`packages/chat-interface/src/components/wizard/registry.ts`)

- Added `WizardEntry` interface with `config` + `triggerHeaders` fields
- Added `RegisterWizardOptions` interface with optional `triggerHeaders`
- Modified `registerWizard()` to accept options and store trigger headers
- Added `findWizardByHeaders(headers: string[])` — iterates all registered wizards, returns config if any of the given headers match a wizard's triggerHeaders list

### 2. Wizard barrel export (`packages/chat-interface/src/components/wizard/index.ts`)

- Exported `findWizardByHeaders` and `RegisterWizardOptions`

### 3. Library public API (`packages/chat-interface/src/index.ts`)

- Added `findWizardByHeaders` to component exports
- Added `RegisterWizardOptions` to type exports

### 4. AskUserQuestionRenderer — fallback matching (`solutions/.../frontend/src/components/AskUserQuestionRenderer.tsx`)

- Changed wizard lookup from:
  ```ts
  const wizardConfig = getWizardConfig(headerHint)
  ```
  to:
  ```ts
  const allHeaders = questions.map(q => q.header || '').filter(Boolean)
  const wizardConfig = getWizardConfig(headerHint) || findWizardByHeaders(allHeaders)
  ```

### 5. Lesson Plan wizard config (`solutions/.../frontend/src/wizards/lesson-plan.wizard.ts`)

- Added `triggerHeaders: ['学科', '备课', '备课参数', '科目']` to `registerWizard()` options

### 6. SKILL.md — stricter AskUserQuestion format instructions

- Added CRITICAL markers for single-question format requirement
- Added explicit rules: "必须只传 1 个 question", "不要把学科、年级等拆成多个 questions"

## Verification

### Pre-gate
- `tsc --noEmit` for chat-interface: PASS
- `npm run build` for chat-interface: PASS
- `tsc --noEmit` for edu-platform frontend: PASS

### Browser E2E (screenshots in `screenshots/v1/`)
1. **02-wizard-renderer-triggered.png** — WizardRenderer renders with step bar + form fields (was: default chip UI)
2. **03-wizard-step1-filled.png** — Step 1 form filled (数学, 八年级上, 2班, 新授课, 1课时), 下一步 enabled
3. **04-wizard-step2-tree-select.png** — Step 2 tree selection with checkboxes, 2 items selected
4. **05-wizard-step3-data-review.png** — Step 3 data review table with mastery % and emphasis toggles
5. **06-wizard-step4-summary.png** — Step 4 summary with all selections, 确认生成 button active
6. **07-wizard-submitted.png** — "✓ 参数已提交，正在生成..." + "✓ 向导已完成"

## Scoring Impact (estimated)

| Dimension | Before | After | Notes |
|-----------|--------|-------|-------|
| D1 Trigger (20) | 5 | 16 | Wizard triggers via triggerHeaders fallback |
| D2 Step Nav (15) | 8 | 13 | 4-step flow works, step indicator functional |
| D3 Form (20) | 8 | 16 | Fields render, select works, sessionContext pre-fill |
| D4 Submit (20) | 3 | 12 | Wizard submits, shows completion state. control_response POST needs E2E verification |
| D5 Resilience (15) | 10 | 10 | No change — fallback data works, error states shown |
| D6 Polish (10) | 5 | 5 | No visual polish changes this iteration |
| **Total** | **~39** | **~72** | |

## Remaining Gaps for v2

- **D4 Submit gap**: Verify control_response actually reaches backend and LLM resumes with wizard answers
- **D3 sessionContext pre-fill**: Only 学科 pre-fills from context (subject); grade/class could also pre-fill
- **D6 Polish**: Step transitions, loading states, mobile responsiveness
- **D5 Resilience**: Test with network errors, empty data, rapid navigation
