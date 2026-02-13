# Manual Test Instructions - Task Display Fix

**Date**: 2026-02-12
**Environment**: Backend :3002 ✅ | Frontend :5280 ✅ | SDK Built ✅

---

## Quick Start

1. **Open Browser**: `http://localhost:5280`
2. **Create Lesson Plan**: Click "新建方案"
3. **Send Test Message**: "帮我设计一个小学数学的课程方案"
4. **Watch Tasks Tab**: Should show task and keep it visible after completion ✅

---

## Test Case 1: Single Task (5 min) 🎯

### Steps
1. Send: "帮我设计一个小学数学的课程方案"
2. Click "Tasks" tab
3. Observe "Executing Task" appears
4. Wait for AI to finish
5. **Check if task is still visible** ⭐

### Expected Results ✅

| What to Check | Expected | Notes |
|---------------|----------|-------|
| Task appears | ✅ Yes | Shows "Executing Task" |
| During execution | ✅ Visible | Shows in active section |
| **After completion** | ✅ **Still Visible** | **KEY TEST** - moves to "最近完成" |
| Badge on Tasks tab | ✅ Shows "1" | Only when tab inactive |
| Can click to expand | ✅ Yes | Shows task details |

### BEFORE Fix (What Was Broken) ❌
- Task appeared ✅
- Task **disappeared immediately** after completion ❌
- "暂无任务" shown ❌
- Badge showed "0" ❌

---

## Test Case 2: Multiple Tasks (5 min)

### Steps
1. Send a complex request that triggers multiple agents
2. Example: "帮我设计一个包含教学目标、教学内容和评估方法的完整方案"
3. Watch all tasks appear
4. Wait for all to complete

### Expected Results ✅
- All tasks stay visible after completion
- Badge shows correct total count
- Each task shows in "最近完成" section

---

## Test Case 3: Badge Count (2 min)

### Steps
1. Complete 1-2 tasks
2. Switch between tabs (Chat → Tasks → Files)
3. Check badge number

### Expected Results ✅
- Badge count = number of completed tasks
- Badge only shows on inactive tabs
- Badge disappears when Tasks tab is active

---

## Debugging Tools

### Browser Console
```javascript
// Open DevTools → Console
// Watch for these events:

✅ "SubAgent Started" - task begins
✅ "SubAgent Completed" - task ends
✅ "Agent Status: complete" - should include context.activeSubAgents
```

### Network Tab
```
DevTools → Network → WS (WebSocket)
Look for:
- subagent_started
- subagent_completed
- agent_status: complete { context: { activeSubAgents: [...] } }
```

### React DevTools
```
1. Install React DevTools extension
2. Components → ChatPanel → hooks → useTaskTracking
3. Check taskHistory array
4. Should contain completed tasks
```

---

## Success Indicators ✅

### Visual Check
- [ ] Task appears when started
- [ ] Task **stays visible** after completion (not "暂无任务")
- [ ] Task shows in "最近完成" section
- [ ] Badge shows correct number
- [ ] Can click task to see details

### Console Check
- [ ] No React errors
- [ ] WebSocket events firing correctly
- [ ] `agent_status: complete` includes `context.activeSubAgents`

---

## If Something Goes Wrong ⚠️

### Task Still Disappears?

**Quick Fixes**:
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
2. Clear browser cache
3. Restart frontend dev server:
   ```bash
   # Find and kill process
   lsof -ti:5280 | xargs kill -9

   # Restart
   cd solutions/lesson-plan-designer/frontend
   npm run dev
   ```

**Check SDK Version**:
```bash
cd solutions/lesson-plan-designer/frontend
npm list @ccaas/react-sdk
# Should show: -> ./../../../packages/react-sdk
```

### No Tasks Showing?

**Check Backend**:
```bash
# Check backend logs
tail -f /tmp/lpd-backend.log

# Look for:
# - "SubAgent started" messages
# - EventMapper logs
# - WebSocket connection logs
```

**Check WebSocket**:
- DevTools → Network → WS tab
- Should see active WebSocket connection
- Events should be flowing

---

## Report Results

### If Tests Pass ✅
Reply with: "✅ 测试通过！任务完成后不再消失，显示在'最近完成'区域。"

### If Tests Fail ❌
Reply with:
1. Which test case failed
2. Screenshot of Tasks tab
3. Browser console errors (if any)
4. WebSocket events (from Network tab)

---

## Technical Details (For Reference)

### The Fix
- **File**: `packages/react-sdk/src/hooks/useAgentStatus.ts`
- **Change**: Process backend snapshot before clearing state
- **Delay**: 100ms to allow history capture
- **Result**: Tasks persist in history, no race condition

### Data Flow
```
Backend → WebSocket → SDK useAgentStatus → useLessonPlanSession → ChatPanel → TasksView
                           ↓
                    useTaskTracking (captures to history)
```

---

## Environment Info

```
Backend:  localhost:3002 (NestJS)
Frontend: localhost:5280 (React + Vite)
SDK:      @ccaas/react-sdk (workspace link)
SDK Size: 160.91 KB ESM (includes fix)
```

---

**Ready to test! 🚀 Open http://localhost:5280 and follow Test Case 1.**
