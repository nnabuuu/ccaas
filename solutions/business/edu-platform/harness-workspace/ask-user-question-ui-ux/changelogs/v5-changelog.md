# Changelog — v5

## Summary

v5 fixes the critical D7 persistence failure from v4 (widget not rendering after page refresh) and hardens the `parseToolOutputAsAnswers` function against malformed backend responses like `"Answer questions?"`. Both react-sdk and chat-interface packages were rebuilt to ensure runtime code matches source changes.

## Root Cause Analysis

### D7 Persistence Failure (v4 score: 3/5 → v5 target: 5/5)

**Two root causes identified:**

1. **react-sdk package not rebuilt**: `useAgentChat.ts` had `includeToolEvents=true` in source but the built `dist/index.js` still used the old URL without it. The edu-platform frontend imports from `@kedge-agentic/react-sdk` package's `dist/` output, not the source.

2. **chat-interface package not rebuilt**: `ChatCoreContext.tsx` had the toolEvents → contentBlocks reconstruction logic in source, but the frontend consumed the old built output without it.

3. **"Answer questions?" poison**: The backend stored `toolOutput: "Answer questions?"` for AskUserQuestion (a default/placeholder response). The v4 `parseToolOutputAsAnswers` function was too aggressive — it accepted any string and mapped it to the first question, causing bogus SubmittedView rendering.

### Fix Applied

**AskUserQuestionRenderer.tsx** (+104 lines):
- Added `getKnownValues(q: Question)` — collects all known option values/labels for validation
- Added `isPlausibleAnswers(answers, questions)` — validates parsed answers contain at least one value matching known options
- Tightened `parseToolOutputAsAnswers()`:
  - Plain string fallback now **requires `·` separator** (our summary format)
  - Case 1 (answers object): validates at least one key matches a question text
  - Case 2 (text/result): validates with `isPlausibleAnswers()`
  - Case 3 (direct map): validates keys match question texts

**ChatCoreContext.tsx** (+52 lines):
- Fixed TS2352 error: `(nextMsg as unknown as Record<string, unknown>)` cast
- Look-ahead for AskUserQuestion now requires `·` in user reply (prevents false matches)
- Deduplication Map for toolEvents (prefer 'end' over 'start' events)

**Package rebuilds**:
- `cd packages/react-sdk && npm run build` — ensures `includeToolEvents=true` in runtime
- `cd packages/chat-interface && npm run build` — ensures toolEvents reconstruction in runtime

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `frontend/src/components/AskUserQuestionRenderer.tsx` | +104/-8 | Answer validation hardening |
| `packages/chat-interface/src/context/ChatCoreContext.tsx` | +52/-4 | TS fix + look-ahead tightening |

## Browser Verification Results

### Test Harness (`?test=auq`)
- **Standard mode**: 3 chips (题型/难度/题量), recommended pre-selection, "推荐" badges, "3/3 已回答"
- **Multi-select mode**: Checkbox indicators, checkboxes toggle correctly
- **Preview mode**: Left-right split, preview pane updates on option switch
- **Submit flow**: Green selected, faded unselected, summary footer "✓ 选择题 · 分层 · 5 题"
- **Chip switching**: Click chip → panel switches, no height jump

### Live AI Session
- Sent "帮我出5道关于全等三角形判定的题" → AI triggered AskUserQuestion with 2 questions (题型/难度)
- Widget rendered with chips, options, recommended badges, "0/2 已回答"
- "输入自定义内容..." placeholder (NOT "Answer questions?")

### D7 Persistence Test (NEW in v5)
- Page refresh → re-login → click session "00:48"
- **Widget renders correctly** with chips (题型/难度), all 4 options, Other input, footer
- API URL confirmed: `?limit=100&includeToolEvents=true`
- `toolOutput: "Answer questions?"` correctly rejected → shows interactive state (not bogus SubmittedView)

## Screenshots

| # | File | Description |
|---|------|-------------|
| 01 | 01-initial-widget-state.png | First render (had "Answer questions?" bug) |
| 03 | 03-fixed-initial-widget.png | After fix, clean widget render |
| 04 | 04-test-harness-standard.png | Test harness: chips, recommended, pre-selection |
| 07 | 07-after-js-click-select.png | 选择题 selected, chip updated |
| 08 | 08-chip-switch-difficulty.png | Difficulty tab after chip switch |
| 09 | 09-chip-switch-difficulty-panel.png | Difficulty panel with 分层 selected |
| 10 | 10-multiselect-dimension-tab.png | Multiselect with checkboxes |
| 11 | 11-multiselect-checkboxes.png | Two checkboxes checked |
| 13 | 13-preview-mode-switch.png | Preview mode with live preview |
| 15 | 15-submitted-state-actual.png | Submitted: green/faded/summary |
| 16 | 16-persistence-session-loaded.png | **D7 PASS**: Widget renders after refresh |
| 17 | 17-persistence-top-view.png | Persistence top view |

## Expected Score Impact

| Dimension | v4 Score | v5 Target | Change |
|-----------|----------|-----------|--------|
| D1 Chips | 5/5 | 5/5 | — |
| D2 Options | 4/5 | 4/5 | — (recommended still depends on AI Skill) |
| D3 Footer | 5/5 | 5/5 | — |
| D4 Preview | 3/5 | 3/5 | — (AI Skill still doesn't return preview:true) |
| D5 Panel | 5/5 | 5/5 | — |
| D6 Design | 5/5 | 5/5 | — |
| D7 Persistence | 3/5 | 5/5 | **+2** (widget now renders after refresh) |
| **Total** | **85** | **91** | **+6** |
