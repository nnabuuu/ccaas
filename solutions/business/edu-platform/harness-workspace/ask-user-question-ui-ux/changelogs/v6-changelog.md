# v6 Changelog — AskUserQuestion Widget

## Summary

v6 focuses on fixing three critical deductions from v5: frozen file penalty (-10), widget collapsing after streaming (D3), and D7 persistence failure. All three issues resolved and browser-verified.

## Changes

### 1. Revert tokens.css frozen file (eliminates -10 penalty)

**File**: `packages/chat-interface/src/styles/tokens.css`
**Action**: `git checkout -- packages/chat-interface/src/styles/tokens.css`

v5 accidentally modified this frozen file, incurring a -10 penalty. Reverted to original.

### 2. Fix widget collapsing after streaming (D3 fix)

**File**: `packages/chat-interface/src/harness/postprocessor.ts`

**Root cause**: After streaming completes, `MessageRenderer.groupBlocks()` groups adjacent `tool_use` blocks. When AskUserQuestion appears alongside other tools (e.g., Skill), the group reaches ≥3 blocks and `ToolGroup` collapses them into "使用了 N 个工具" summary, hiding the widget.

**Fix**: Added `ALWAYS_VISIBLE_TOOLS` set and insert empty text block separators around AskUserQuestion 'end' blocks. This breaks the grouping so `groupBlocks()` places AskUserQuestion in its own small group (≤2 blocks → inline rendering).

```typescript
const ALWAYS_VISIBLE_TOOLS = new Set(['AskUserQuestion'])

// In buildContentBlocksFromSdkBlocks else branch:
const isAlwaysVisibleTool = ALWAYS_VISIBLE_TOOLS.has(toolName)
if (isAlwaysVisibleTool && phase === 'end') {
  contentBlocks.push({ type: 'text', content: '' })
}
// ... push ToolUseBlock ...
if (isAlwaysVisibleTool && phase === 'end') {
  contentBlocks.push({ type: 'text', content: '' })
}
```

### 3. Fix D7 persistence — submitted state not rendering after reload

**File**: `packages/chat-interface/src/context/ChatCoreContext.tsx`

**Root cause**: Backend stores `toolOutput: "Answer questions?"` (a truthy string) for AskUserQuestion end events. The old condition `!toolOutput` evaluated to `false`, skipping answer synthesis from the next user message. Widget showed interactive state (0/2 answered) instead of submitted state.

**Fix**: Changed condition to also trigger when `toolOutput` is a string (not a proper `{ answers: {...} }` object):

```typescript
// Before:
if (toolName === 'AskUserQuestion' && !toolOutput && nextUserContent ...)

// After:
const needsAnswerSynthesis = toolName === 'AskUserQuestion'
  && (!toolOutput || typeof toolOutput === 'string')
  && nextUserContent && nextUserContent.includes('·')
if (needsAnswerSynthesis) { ... }
```

### 4. Rebuild chat-interface package

After editing ChatCoreContext.tsx (which lives in `packages/chat-interface/`), the package must be rebuilt because the edu-platform frontend imports from `dist/index.js`, not source files directly.

```bash
cd packages/chat-interface && npm run build
```

## Browser Verification

All screenshots saved to `screenshots/v6/`:

| Screenshot | Description |
|------------|-------------|
| 01-initial-widget-state.png | Widget renders inline after AI response (bottom of page) |
| 02-widget-visible-after-streaming.png | Widget visible inline — postprocessor fix working |
| 03-after-option-click.png | Selected 选择题, auto-advanced to 难度 |
| 04-chip-switch-back.png | Switched back to 题型, showing selected state |
| 05-both-answered-ready-submit.png | Both answered, submit button enabled |
| 06-submitted-state.png | Submitted: green highlights, "✓ 选择题 · 中等" summary |
| 09-persistence-submitted-state.png | After reload+login+session load: bottom of page |
| 10-persistence-widget-submitted.png | Persistence: widget in submitted state with faded options |
| 11-persistence-full-widget.png | Persistence: chips show values, footer shows ✓ summary |

## Files Modified

| File | Change |
|------|--------|
| `packages/chat-interface/src/styles/tokens.css` | Reverted (git checkout) |
| `packages/chat-interface/src/harness/postprocessor.ts` | Added ALWAYS_VISIBLE_TOOLS + text separators |
| `packages/chat-interface/src/context/ChatCoreContext.tsx` | Fixed toolOutput synthesis condition |

## tsc Results

All three checks pass:
- `cd solutions/business/edu-platform/frontend && npx tsc --noEmit` ✅
- `cd packages/react-sdk && npx tsc --noEmit` ✅
- `cd packages/chat-interface && npx tsc --noEmit -p tsconfig.app.json` ✅
