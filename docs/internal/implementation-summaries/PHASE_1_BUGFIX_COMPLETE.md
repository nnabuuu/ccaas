# Phase 1: Bug Fix - Completed ✅

## Summary

Fixed the misleading "Completed: Executing Task ✅" message that appeared immediately when NotebookLM starts generating PDFs, even though the actual generation takes 5-45 minutes.

## Root Cause

The `tool_activity: end` event was emitted immediately when the Task tool returned (spawning background process), not when the background PDF generation actually completed.

## Solution

Suppress `tool_activity: end` events for persistent background tasks (Task tool with `run_in_background=true`). Only `subagent_started`/`subagent_completed` WebSocket events correctly reflect the actual background operation lifecycle.

## Changes Made

### 1. EventMapperService - Bug Fix

**File**: `packages/backend/src/chat/event-mapper.service.ts`

**Changes**:

1. **Lines 342-368** (tool_result handler in user message):
   - Added check for `isPersistent` flag before emitting `tool_activity: end`
   - Only non-persistent tasks emit immediate completion events

2. **Lines 1281-1310** (trackSubAgentStart method):
   - Added `toolName` parameter
   - Set `isPersistent` only for Task tool with `run_in_background=true`
   - Other tools (Bash, Read, etc.) complete immediately even with background flag

3. **Lines 574-609** (content_block_start handler):
   - Added subagent tracking logic (was missing)
   - Ensures consistent behavior across both code paths

### 2. Unit Tests - Full Coverage

**File**: `packages/backend/src/chat/event-mapper.service.spec.ts`

**Added 4 test cases** (lines 354-455):

1. ✅ Should NOT emit `tool_activity:end` for persistent background tasks
2. ✅ Should emit `tool_activity:end` for non-persistent Task tools
3. ✅ Should emit `tool_activity:end` for persistent tasks that error
4. ✅ Should emit `tool_activity:end` for regular tools regardless of background flag

**Test Results**: All 24 tests passing ✅

## Behavior Changes

### Before Fix ❌

```
User sends: "用notebooklm做教案的pdf"
→ Task tool spawns background process
→ Immediately shows: "Completed: Executing Task ✅"
   (Misleading! PDF still generating)
→ 15 minutes later: PDF actually completes
→ SubAgentCard disappears
```

### After Fix ✅

```
User sends: "用notebooklm做教案的pdf"
→ Task tool spawns background process
→ SubAgentCard shows: "🔄 Task Agent" with elapsed time
   (No confusing "Completed" message)
→ 15 minutes later: PDF completes
→ SubAgentCard shows: "✅ 已完成" (3 seconds)
→ SubAgentCard disappears
```

## Testing

### Unit Tests
```bash
npm test -- event-mapper.service.spec.ts
# 24/24 tests passing ✅
```

### Manual Testing Required

1. Start lesson-plan-designer frontend/backend
2. Send message: "用notebooklm做教案的pdf"
3. Verify:
   - ✅ No "Completed: Executing Task" message appears
   - ✅ SubAgentCard shows "🔄 Task Agent" with elapsed time
   - ✅ When PDF generation finishes → SubAgentCard shows "✅ 已完成"
   - ✅ 3 seconds later → SubAgentCard disappears

## Impact

- **Zero Breaking Changes**: Non-persistent tasks behave identically
- **Clear User Communication**: Only background tasks suppress immediate completion
- **Semantic Correctness**: tool_activity reflects tool execution, subagent lifecycle reflects actual background work

## Next Steps

Proceed to **Phase 2: UI Redesign** (glassmorphism styling for SubAgentCard)

---

**Completed**: 2026-02-12
**Estimated Time**: 2 hours
**Actual Time**: 1.5 hours
