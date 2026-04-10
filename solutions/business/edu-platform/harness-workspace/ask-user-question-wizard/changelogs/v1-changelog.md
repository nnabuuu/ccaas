# v1 Changelog — AskUserQuestion Wizard

## Focus Areas

**Primary**: D3/D4 (WizardRenderer + DataReviewStep) — fixed navigation blocking bug
**Secondary**: D1/D2 (E2E data flow + default UI) — browser verification confirms working

## Changes

### 1. DataReviewStep — Auto-emphasize weak items on load (D4, D6)

**File**: `packages/chat-interface/src/components/wizard/steps/DataReviewStep.tsx`

- Added `autoEmphasize` callback that auto-selects items with score < 60 on data load
- Called in 3 places: after mock data load, after API success, after API fallback
- Without this fix, users had to manually toggle emphasis on items before they could proceed to the next step — blocking the wizard flow
- Preserves user's existing selections (only auto-fills when `emphasized.length === 0`)

### 2. WizardRenderer — Lenient navigation for data-review steps (D3, D6)

**File**: `packages/chat-interface/src/components/wizard/WizardRenderer.tsx`

Two changes to treat data-review emphasis as optional:

1. `canProceed` (line ~112): Added `currentStep.type === 'data-review'` so users can always advance past data-review steps (emphasis is optional)
2. `isStepReady` dependency check: When a step depends on a data-review step, an empty array is now treated as a valid (satisfied) dependency

Without these fixes, users were stuck on step 3 (data-review) because:
- `completedSteps` required `val.length > 0` for arrays
- `canProceed` required the step to be in `completedSteps`
- Summary step (step 4) had `dependsOn: ['gaps']` which also blocked

## Browser E2E Verification

### What worked
- Login flow: teacher/teacher123 → dashboard ✅
- Landing page: Empty state with skill starters renders correctly ✅
- Message send: "帮我备课" → backend creates session → LLM responds ✅
- AskUserQuestion rendering: LLM sends tool_activity(start) → ControlRequestView renders InteractiveViewInner ✅
- Default UI (D2): 4-tab layout (学科/年级/课型/学情) with radio options, counter ("0/4 已回答"), disabled submit button ✅
- Tab navigation: Selecting option auto-advances to next tab, counter updates ✅
- Session sidebar: New session appears, clickable ✅

### What was observed
- LLM currently uses **default AskUserQuestion format** (4 separate `questions`), not the wizard-triggering `header: "备课向导"` format
- This means the **default UI (InteractiveViewInner)** renders, not WizardRenderer
- The WizardRenderer path requires SKILL.md to instruct the LLM to use a single question with `header: "备课向导"` — this is a SKILL.md prompt engineering issue, not a code bug
- Wizard submit → POST /control-response → LLM resume path could not be tested because Playwright had intermittent issues with React controlled component state management

### Screenshots
- `screenshots/v1/01-landing-page.png` — Dashboard after login
- `screenshots/v1/02-session-loaded-default-ui.png` — Existing session with default AskUserQuestion
- `screenshots/v1/03-ask-user-question-default-ui.png` — Fresh AskUserQuestion after "帮我备课"
- `screenshots/v1/04-selected-math-option.png` — After selecting 数学, auto-advanced to 年级 tab
- `screenshots/v1/06-session-with-ask-user-question.png` — Session sidebar

## Pre-gate Results

```
packages/backend          tsc --noEmit  ✅
packages/chat-interface   tsc --noEmit  ✅
packages/chat-interface   npm run build ✅
edu-platform/frontend     tsc --noEmit  ✅
```

## Key Findings for Next Iteration

1. **Wizard path not triggered**: The LLM sends standard 4-question AskUserQuestion, not the single-question `header: "备课向导"` format. SKILL.md needs explicit instruction to use `header: "备课向导"` for the wizard to activate. This is a v2 priority.
2. **Submit → LLM resume**: Full control_response round-trip not verified end-to-end yet. Need to complete all 4 questions and click "确认选择" to test POST /control-response.
3. **WizardRenderer visual**: Cannot be verified until wizard path is triggered (depends on finding #1).

## Expected Impact

| Dimension | Baseline (est) | v1 Target | Rationale |
|-----------|----------------|-----------|-----------|
| D1 | 2/5 | 3/5 | Browser verified: message send → AskUserQuestion render → tab interaction |
| D2 | 2/5 | 3/5 | Default UI confirmed working: tabs, selection, counter, auto-advance |
| D3 | 2/5 | 3/5 | canProceed fix prevents step blocking; not visually verified yet |
| D4 | 2/5 | 3/5 | Auto-emphasis fix; not visually verified (wizard not triggered) |
| D5 | 2/5 | 2/5 | No changes to SummaryStep |
| D6 | 2/5 | 2/5 | Wizard not triggered → lesson-plan flow not tested |
| Penalties | 0 | 0 | No new violations |

**Estimated score**: ~45/100 (up from ~20 baseline)
