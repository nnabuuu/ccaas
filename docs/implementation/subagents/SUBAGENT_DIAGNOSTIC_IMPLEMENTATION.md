# SubAgent Display Issue - Diagnostic Implementation

## Issue Summary

**User Report:** "我这里没有看到有后台的SubAgent执行被显示" (I don't see background SubAgent execution being displayed here)

**Expected Behavior:** When using `Task` tool with `run_in_background: true`, the frontend should display the background agent's execution progress in the UI (similar to SubAgentCard).

**Actual Behavior:**
- ✅ Task tool execution is shown (269ms, completed)
- ❌ Background agent's actual execution progress is NOT shown
- Output shows: `agentId: a332185` and `output_file` path

## Diagnostic Logging Implementation

I've added comprehensive diagnostic logging to the EventMapper service to track SubAgent event flow and identify where the issue occurs.

### Changes Made

**File:** `packages/backend/src/chat/event-mapper.service.ts`

#### 1. Tool Use Detection Logging (lines 269-279)

Added logging when ANY tool is detected to see if background tasks are being recognized:

```typescript
this.logger.log(
  `[SubAgent] Tool use detected: toolName=${toolName}, toolUseId=${toolId}, isBackgroundTask=${isBackgroundTask}, nestingLevel=${nestingLevel}, agentType=${agentType}, run_in_background=${block.input?.run_in_background}`,
);
```

**Purpose:** Verify that:
- Task tool calls are being detected
- `isBackgroundTask` flag is set correctly
- `run_in_background` parameter is present
- `nestingLevel` and `agentType` are correct

#### 2. SubAgent Start Tracking Logging (lines 1206-1209)

Added logging when a SubAgent tracker is created:

```typescript
this.logger.log(
  `[SubAgent] Tracking start: sessionId=${sessionId}, subAgentId=${toolUseId}, agentType=${agentType}, description="${description}", nestingLevel=${nestingLevel}`,
);
```

**Purpose:** Confirm that:
- SubAgent trackers are being created
- Tracker metadata is correct
- sessionId matches what frontend expects

#### 3. SubAgent Completion Logging (lines 1233-1261)

Added logging for completion events with additional warnings:

```typescript
this.logger.log(
  `[SubAgent] Tracking completion: sessionId=${sessionId}, toolUseId=${toolUseId}, status=${status}, error="${error || 'none'}"`,
);

// Also added warnings if:
// - No active agents found for session
// - No tracker found for toolUseId
```

**Purpose:** Track completion flow and identify missing trackers.

## How to Test

### Step 1: Restart Backend

```bash
# Backend is already built, just restart it
cd packages/backend
npm run start:dev
```

### Step 2: Trigger Background Task

In the Lesson Plan Designer frontend, trigger a background task (e.g., NotebookLM):

```
使用 /notebooklm 生成播客，等待完成并下载
```

Or manually use Task tool:

```typescript
Task({
  subagent_type: "general-purpose",
  description: "Wait for report generation",
  run_in_background: true,
  prompt: "Wait 30 seconds then return 'Done'"
})
```

### Step 3: Monitor Backend Logs

Watch for these log entries:

```
[SubAgent] Tool use detected: toolName=Task, toolUseId=toolu_xxx, isBackgroundTask=true, ...
[SubAgent] Tracking start: sessionId=lpd_xxx, subAgentId=toolu_xxx, agentType=Task, ...
[SubAgent] Tracking completion: sessionId=lpd_xxx, toolUseId=toolu_xxx, status=completed, ...
```

### Step 4: Check Frontend

Open browser DevTools and check:

1. **WebSocket Tab** (Network → WS):
   - Look for `subagent_started` event
   - Verify payload contains correct subAgentId and description

2. **REST API** (Network → XHR):
   - Check if `/api/v1/sessions/:sessionId/sub-agents` is being called
   - Verify response includes the background agent

3. **Console**:
   - Check React state updates for `activeSubAgents`

## Expected Log Output

### Scenario: Background Task Detected

```log
[EventMapperService] [SubAgent] Tool use detected: toolName=Task, toolUseId=toolu_abc123, isBackgroundTask=true, nestingLevel=0, agentType=main, run_in_background=true
[EventMapperService] [SubAgent] Tracking start: sessionId=lpd_12345, subAgentId=toolu_abc123, agentType=Task, description="Wait for report generation", nestingLevel=0
```

### Scenario: Background Task NOT Detected

If logs show:

```log
[EventMapperService] [SubAgent] Tool use detected: toolName=Task, toolUseId=toolu_abc123, isBackgroundTask=false, ...
```

**Problem:** Detection condition is not matching. Check if:
- `block.input?.run_in_background` is actually set
- `agentType` or `nestingLevel` logic is incorrect

### Scenario: No Logs at All

**Problem:** Background agent's events are NOT reaching EventMapper. This means:
- Sub-process events are isolated and don't flow through main session
- Need to implement **Solution B: File Polling** (see plan)

## Diagnosis Decision Tree

```
1. Are there ANY [SubAgent] logs when background task runs?

   NO → Problem: Sub-process events don't reach EventMapper
        → Implement Solution B (file polling)

   YES → Continue to 2

2. Do logs show "isBackgroundTask=true"?

   NO → Problem: Detection condition is wrong
        → Fix detection logic in event-mapper.service.ts

   YES → Continue to 3

3. Do logs show "Tracking start"?

   NO → Problem: trackSubAgentStart() is not being called
        → Check if condition or event emission failed

   YES → Continue to 4

4. Is "subagent_started" event emitted to WebSocket?

   NO → Problem: Event not sent to Socket.io
        → Check ChatGateway broadcast logic

   YES → Continue to 5

5. Does frontend receive the WebSocket event?

   NO → Problem: WebSocket connection issue
        → Check frontend WebSocket listener

   YES → Continue to 6

6. Does frontend update activeSubAgents state?

   NO → Problem: Frontend state management
        → Check useLessonPlanSession hook

   YES → Continue to 7

7. Does AgentActivityLine render SubAgentCard?

   NO → Problem: Component rendering logic
        → Check AgentActivityLine component

   YES → Success! Issue is elsewhere
```

## Next Steps Based on Diagnosis

### If Events Reach EventMapper (Logs Show Tool Detection)

**Action:** Fix detection conditions or frontend integration
- File: `packages/backend/src/chat/event-mapper.service.ts` (detection logic)
- File: `solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts` (WebSocket handler)
- File: `solutions/lesson-plan-designer/frontend/src/components/AgentActivityLine.tsx` (rendering)

### If Events DON'T Reach EventMapper (No Logs)

**Action:** Implement Solution B from the plan - File Output Polling

This involves:

1. **Frontend: Parse Task tool output** to extract `agentId` and `output_file`
2. **Frontend: Create polling hook** to read output file periodically
3. **Backend: Add file tail endpoint** to read last N lines of output file
4. **Frontend: Display background task status** based on file content

**Estimated Time:** ~2 hours

### If Events Reach But Frontend Doesn't Display

**Action:** Fix frontend integration
- Check WebSocket event subscription
- Verify state updates in useLessonPlanSession
- Check AgentActivityLine props flow
- Verify SubAgentCard rendering conditions

## Rollback Plan

If diagnostic logging causes issues, revert these changes:

```bash
git checkout packages/backend/src/chat/event-mapper.service.ts
npm run build:backend
```

The diagnostic logs are non-invasive and only add logging, so they should be safe to keep for monitoring.

## Permanent Solution Options

Once diagnosis is complete, choose one of these solutions:

### Option A: Fix EventMapper (Preferred)
- If events reach EventMapper but detection fails
- Modify detection conditions
- Update event emission logic
- Time: 30-60 minutes

### Option B: Implement File Polling (Fallback)
- If events don't reach EventMapper
- Poll output_file for status updates
- Display progress based on file content
- Time: 2-3 hours

### Option C: Virtual Placeholder (Quick Fix)
- If neither A nor B is feasible
- Show "Background task running" placeholder
- Auto-remove after timeout or user dismissal
- Time: 30 minutes

## Files Modified

1. `packages/backend/src/chat/event-mapper.service.ts`
   - Added 3 diagnostic log statements
   - No functional changes
   - Built successfully

## Testing Status

- ✅ Backend builds successfully with diagnostic logging
- ⏳ Waiting for runtime testing
- ⏳ Waiting for log analysis
- ⏳ Waiting for diagnosis decision

## Contact Points

- **Backend logs:** Terminal running `npm run start:dev` in `packages/backend`
- **Frontend console:** Browser DevTools Console tab
- **WebSocket events:** Browser DevTools Network → WS tab
- **REST API calls:** Browser DevTools Network → XHR tab

---

**Ready for Testing:** Backend is built and ready. Start the backend and trigger a background task to see diagnostic logs.
