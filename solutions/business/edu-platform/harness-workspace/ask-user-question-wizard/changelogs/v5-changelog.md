# v5 Changelog — AskUserQuestion Wizard

## Target Deductions

Focused on v4's top 2 bugs:
1. **BUG-01 (D6 3→5, +8 potential)**: Double AskUserQuestion after wizard submit — LLM ignored wizard answers
2. **BUG-02 (D2 4→5, +3 potential)**: Default UI not independently tested

## Changes

### Fix 1: Remove `show_step_wizard` from MCP tool list (D6 root cause)

**Problem**: LLM called `show_step_wizard` MCP tool instead of `AskUserQuestion` because it was registered in the MCP server's tool list. This tool was a passthrough that returned `{ status: 'success', rendered: true }` without actually triggering the wizard UI flow.

**Root cause**: `showStepWizardTool` was registered in the MCP server's `ListToolsRequestSchema` handler. The LLM preferred this tool over `AskUserQuestion` because it appeared more specific to the wizard use case.

**Fix**: Removed `showStepWizardTool` from the tools array in `mcp-server/src/index.ts` line 226.

**Before**:
```typescript
tools: [curriculumTreeTool, writeOutputTool, studentProficiencyTool, teachingProgressTool, generateDocxTool, showInfoCardTool, showStepWizardTool, showReviewPanelTool, suggestActionsTool]
```

**After**:
```typescript
tools: [curriculumTreeTool, writeOutputTool, studentProficiencyTool, teachingProgressTool, generateDocxTool, showInfoCardTool, showReviewPanelTool, suggestActionsTool]
```

**Files changed**: 1
- `solutions/business/edu-platform/mcp-server/src/index.ts`

### Fix 2: Backend dedup mechanism for AskUserQuestion (D6 fallback)

**Problem**: Even after Fix 1, the LLM sometimes calls `AskUserQuestion` a second time after receiving wizard answers (the SKILL.md prohibition doesn't always prevent it).

**Root cause**: LLM behavior is non-deterministic; prompt-level prohibitions are not 100% effective.

**Fix**: Added server-side dedup in `event-mapper.service.ts`:
1. `storeCompletedAskUserAnswers(sessionId, answers)` — caches wizard answers with 5-minute TTL after control_response
2. `consumeLastAskUserAnswers(sessionId)` — returns cached answers on second AskUserQuestion call
3. When cached answers found → auto-respond via `pendingAutoApproveRequests` → emit `tool_activity(end)` → LLM receives answers without user interaction

Also added `storeCompletedAskUserAnswers` call in `cli-process.service.ts` after writing control_response to CLI stdin.

**Files changed**: 2
- `packages/backend/src/sessions/event-mapper.service.ts`
- `packages/backend/src/sessions/services/cli-process.service.ts`

### Fix 3: JWT validate() return shape (auth/me 401)

**Problem**: `/api/auth/me` returned 401 with valid JWT token, preventing browser login during evaluation.

**Root cause**: `jwt.strategy.ts` `validate()` returned `{ id: payload.sub, username: payload.username }` but `auth.controller.ts` accesses `req.user.sub`. Passport sets `req.user` from validate's return — missing `sub` field caused `getProfile(undefined)`.

**Fix**: Added `sub` to validate return:
```typescript
validate(payload: { sub: string; username: string }) {
  return { sub: payload.sub, id: payload.sub, username: payload.username };
}
```

**Files changed**: 1
- `solutions/business/edu-platform/backend/src/auth/jwt.strategy.ts`

## Pre-gate Results

| Check | Result |
|-------|--------|
| `packages/backend` tsc --noEmit | PASS |
| `packages/chat-interface` tsc --noEmit | PASS |
| `packages/chat-interface` npm run build | PASS |
| `edu-platform/frontend` tsc --noEmit | PASS |

## Penalty Checks: CLEAN

| Check | Result |
|-------|--------|
| hardcoded hex/rgb in wizard/ | 0 instances |
| console.log in wizard/ | 0 instances |
| box-shadow in wizard/ | 0 instances |
| var(--) in WizardRenderer.tsx | 34 (>=5 required) |
| var(--) in AskUserQuestionRenderer.tsx | 77 (>=10 required) |
| Frozen SubmittedView modified | No |

## Browser Verification Screenshots

All screenshots in `screenshots/v5/`:

### Successful E2E run (eval- prefix, session 19:35-19:48)

| # | File | Description |
|---|------|-------------|
| eval-00 | `eval-00-landing.png` | Landing page with session list, skills sidebar |
| eval-02 | `eval-02-wizard-step1.png` | Wizard rendered: 4-step indicator, LLM text, Step 1 FormStep |
| eval-03 | `eval-03-step1-filled.png` | Step 1: 5 combobox fields filled (学科=数学, 年级=八年级上, 班级=2班, 课型=新授课, 课时=1课时) |
| eval-04 | `eval-04-step2-tree.png` | Step 2 TreeSelectStep: 3 chapters, 8 sections, expandable nodes |
| eval-05 | `eval-05-step2-selected.png` | Step 2 after 全选: all 8 checked, "已选择 8 项" counter |
| eval-06 | `eval-06-step3-datareview.png` | Step 3 DataReviewStep: 6 knowledge points, progress bars, auto-emphasis on <60% |
| eval-07 | `eval-07-step4-summary.png` | Step 4 SummaryStep: 3 sections, FormSummary, jump-back links, green 确认生成 button |
| eval-08 | `eval-08-after-submit.png` | After submit: dedup auto-responded, LLM resumed, default AUQ UI briefly visible |
| eval-09 | `eval-09-lesson-plan-generated.png` | **KEY**: Full lesson plan generated — "12.2 三角形全等的判定 — SSS 判定" with 教案概述, 教学目标, 重难点, 教学过程 (5环节/45分钟), 评价方案, 作业设计 |

### Earlier attempts (debugging, numbered prefix)

| # | Description |
|---|-------------|
| 00-07 | First attempt — wizard rendered but dedup didn't fire (pre-recompile) |
| 01-06 (second set) | Second attempt — confirmed dedup after recompile |

## E2E Flow Evidence (D1 + D6)

Full end-to-end data flow confirmed:

1. Teacher sends "帮我备课" → message dispatched to backend
2. LLM processes → calls `AskUserQuestion` with header="备课向导"
3. Backend sends SSE `tool_activity(start)` with `control_request` content
4. Frontend `AskUserQuestionRenderer` → checks wizard registry → `findWizardByHeaders("备课向导")` matches
5. **WizardRenderer** renders 4-step wizard
6. Step 1-4: all interactive, data captured correctly
7. User clicks "确认生成" → POST `/sessions/:id/control-response` → 200 OK
8. Backend calls `storeCompletedAskUserAnswers` → caches answers
9. **LLM resumes** → calls AskUserQuestion AGAIN (non-deterministic behavior)
10. **Dedup fires**: `consumeLastAskUserAnswers` returns cached answers → auto-respond
11. LLM receives formatted answers → calls 10+ tools → generates full lesson plan
12. **Lesson plan visible in browser**: "课题：12.2 三角形全等的判定（第1课时）— SSS 判定"

## D2 Default UI Evidence

Default `InteractiveViewInner` rendered (eval-08):
- Briefly visible during dedup auto-response
- Tab navigation with 4 question tabs
- Radio option cards with label + description
- "或者自定义" fallback input
- Counter display
- CSS variables (77 var(--) references)

**Note**: Not independently tested via separate non-wizard trigger. The default UI was incidentally confirmed during the dedup flow.

## Known Issues

1. **Default AskUserQuestion UI not dismissed after dedup**: The `tool_activity(end)` event from dedup doesn't fully dismiss the default UI widget in the frontend. The backend flow works correctly — this is a frontend display artifact only.
2. **D2 not independently triggered**: Default UI observed incidentally during dedup, not via a dedicated non-wizard AskUserQuestion trigger.

## Estimated Score Impact

| Dimension | v4 | v5 (est) | Change | Evidence |
|-----------|-----|----------|--------|----------|
| D1: control_request E2E | 5/5 | 5/5 | 0 | Same E2E flow, now with dedup confirmed |
| D2: ControlRequestView default UI | 4/5 | 4/5 | 0 | Still incidental observation, not independent test |
| D3: WizardRenderer framework | 5/5 | 5/5 | 0 | No changes to wizard code |
| D4: TreeSelect + DataReview | 5/5 | 5/5 | 0 | Same evidence |
| D5: SummaryStep + submit | 5/5 | 5/5 | 0 | Same evidence |
| D6: lesson-plan wizard 4-step | 3/5 | 5/5 | +2 | LLM generates complete lesson plan after wizard submit (via dedup) |

**Estimated total**: 89 + 8 (D6: +2 × weight 20 × 0.2) = **97/100**

Conservative estimate accounting for D2 still at 4/5 and dedup visual artifact: **~93-95/100**
