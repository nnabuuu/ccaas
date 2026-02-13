# AgentActivityLine Testing Guide

## Test Environment

**Frontend**: http://localhost:5281/
**Backend**: http://localhost:3002/

## Critical Test: Thinking Content Display

### Background
User reported: "帮我double check是不是thinking的内容正确展示在这里了？我只看到'思考中'"

### What Was Fixed
- **Old behavior**: Thinking content truncated to 50 chars in collapsed view
- **New behavior**: Thinking content always visible as purple card showing last 150 chars

### Test Steps

1. **Navigate to lesson-plan-designer frontend**
   ```
   Open http://localhost:5281/ in browser
   ```

2. **Send a message that triggers thinking**
   ```
   Example: "请帮我设计一个小学三年级数学的课程方案，主题是'认识分数'"
   ```

3. **Observe the status bar at the bottom**

   **Expected UI**:
   ```
   ┌──────────────────────────────────────────────────────┐
   │ [🔄 Spinner] 正在思考...                   [取消]     │
   │                                                      │
   │   💡 [Purple card with thinking content preview]     │
   │      "考虑到小学三年级学生的认知特点，分数的..."      │
   └──────────────────────────────────────────────────────┘
   ```

4. **Verify thinking content is visible**
   - [ ] Purple-styled card appears below status line
   - [ ] Shows actual thinking text (NOT just "正在思考...")
   - [ ] Shows last 150 characters of thinking
   - [ ] Has lightbulb icon (💡)
   - [ ] Updates in real-time as thinking progresses

### ❌ FAIL Indicators

If you see any of these, the fix didn't work:
- ❌ Only see "正在思考..." without content preview
- ❌ Need to click "详情" button to see thinking (button shouldn't exist)
- ❌ Thinking content truncated to ~50 characters
- ❌ No purple card visible

### ✅ SUCCESS Indicators

- ✅ Purple card automatically appears when thinking starts
- ✅ Shows meaningful thinking content (e.g., "考虑到学生特点...")
- ✅ Content is readable (not truncated too short)
- ✅ No "详情" button exists (removed in simplification)
- ✅ Content updates as more thinking happens

## Test 2: SubAgent Background Tasks

### Test Steps

1. **Send message triggering multiple agents**
   ```
   Example: "帮我搜索最新的教学大纲并生成一份数学课程设计"
   ```

2. **Observe status bar**

   **Expected UI**:
   ```
   ┌──────────────────────────────────────────────────────┐
   │ [🔄 Spinner] 2个后台任务运行中              [取消]    │
   │             Explore agent, Task agent                │
   └──────────────────────────────────────────────────────┘
   ```

3. **Verify behavior**
   - [ ] Status shows "N个后台任务运行中"
   - [ ] NO expandable panel (removed)
   - [ ] NO SubAgentCard list in status bar (removed)
   - [ ] Cancel button present and functional

4. **Click Tasks tab**
   - [ ] All SubAgent tasks visible in TasksView
   - [ ] Each task shows type, description, elapsed time
   - [ ] No information lost from AgentActivityLine simplification

## Test 3: Active Todo Display

### Test Steps

1. **Wait for agent to create todo items**
   ```
   Agent will create tasks like:
   - "分析教学目标"
   - "设计课堂活动"
   - "准备教学资源"
   ```

2. **Observe status bar**

   **Expected UI**:
   ```
   ┌──────────────────────────────────────────────────────┐
   │ [🔄 Spinner] 正在设计课堂活动    [2/5]       [取消]  │
   └──────────────────────────────────────────────────────┘
   ```

3. **Verify behavior**
   - [ ] Shows active todo's `activeForm` text
   - [ ] Shows progress badge [completed/total]
   - [ ] NO todo list expansion (removed)
   - [ ] Cancel button present

## Test 4: Cancel Functionality

### Test Steps

1. **Start a long-running task**
   ```
   Example: "请生成一个完整的学期教学计划，包含20个课时"
   ```

2. **Click the [取消] button**

3. **Verify behavior**
   - [ ] Task stops immediately
   - [ ] Status bar disappears
   - [ ] No errors in browser console
   - [ ] Agent stops processing

## Test 5: Visual Comparison

### Before Simplification
```
┌──────────────────────────────────────────────────────────┐
│ [🔄] 正在处理...                    [详情 ▼] [取消]      │
│                                                          │
│ [Expanded Panel - only when clicking "详情"]             │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 后台任务 (2)                                        │  │
│ │  • SubAgentCard 1 (Explore, 00:05, expanding...)   │  │
│ │  • SubAgentCard 2 (Task, 00:12, analyzing...)      │  │
│ │                                                     │  │
│ │ 任务工具 (1)                                        │  │
│ │  • Task tool with nested children                  │  │
│ │                                                     │  │
│ │ 思考内容                                            │  │
│ │  [Purple box with last 200 chars]                  │  │
│ │                                                     │  │
│ │ 任务进度 (3/5)                                      │  │
│ │  ✓ Task 1                                          │  │
│ │  🔄 Task 2                                         │  │
│ │  ⏱ Task 3                                          │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### After Simplification
```
┌──────────────────────────────────────────────────────────┐
│ [🔄] 正在思考...                               [取消]     │
│                                                          │
│  💡 考虑到小学三年级学生的认知发展特点，在教学分数概念... │
│     (Purple card, always visible, no clicking needed)    │
└──────────────────────────────────────────────────────────┘

OR

┌──────────────────────────────────────────────────────────┐
│ [🔄] 2个后台任务运行中                          [取消]    │
│     Explore agent, Task agent                            │
└──────────────────────────────────────────────────────────┘
```

**Key Differences**:
- ❌ No "详情" button (removed)
- ❌ No expandable panel (removed)
- ❌ No SubAgentCard list (moved to Tasks tab)
- ❌ No nested tool trees (moved to Tasks tab)
- ❌ No todo list (progress shown in badge only)
- ✅ Thinking content ALWAYS visible (enhanced)
- ✅ Cancel button retained
- ✅ Clean, single-row layout

## Test 6: Integration with TasksView

### Test Steps

1. **While agent is processing, click "Tasks" tab**

2. **Verify TasksView shows all information**
   - [ ] Active tasks section
   - [ ] Each task shows:
     - [ ] Type (Explore, Task, etc.)
     - [ ] Description
     - [ ] Elapsed time
     - [ ] Status (running/completed/failed)
   - [ ] Recently completed tasks (retained for 30 minutes)
   - [ ] Failed tasks with error messages

3. **Verify no information loss**
   - [ ] All SubAgent details visible in Tasks tab
   - [ ] Hierarchical task relationships preserved
   - [ ] Task history available

## Browser Console Checks

### WebSocket Events
```javascript
// Open browser console and monitor:
socket.on('agent_thinking', (data) => {
  console.log('Thinking event:', data)
  // Should show: { event: 'agent_thinking', payload: { content: "..." } }
})

socket.on('subagent_started', (data) => {
  console.log('SubAgent started:', data)
})

socket.on('subagent_completed', (data) => {
  console.log('SubAgent completed:', data)
})
```

### React DevTools
1. Open React DevTools
2. Find `AgentActivityLine` component
3. Check props:
   - `isThinking`: should be `true` when thinking
   - `thinkingContent`: should have actual content (not empty)
   - `activeSubAgents`: should be array of active agents

## Performance Comparison

### Metrics to Check

**Render Performance**:
- Open React DevTools → Profiler
- Record a session with agent processing
- Compare render times before/after

**Expected Improvements**:
- Fewer component renders (no SubAgentCard, no nested trees)
- Smaller DOM tree
- Faster updates

**Bundle Size**:
- Before: 505 lines in AgentActivityLine.tsx
- After: 185 lines (63% reduction)

## Failure Recovery

### If Tests Fail

1. **Check build**:
   ```bash
   cd packages/react-sdk && npm run build
   ```

2. **Check browser console for errors**

3. **Verify WebSocket connection**:
   ```javascript
   // Browser console
   socket.connected  // Should be true
   ```

4. **Rollback if needed**:
   ```bash
   cd /Users/niex/Documents/GitHub/kedge-ccaas
   git checkout HEAD~1 packages/react-sdk/src/components/AgentActivityLine.tsx
   cd packages/react-sdk && npm run build
   ```

## Success Criteria

All tests must pass:
- ✅ Thinking content visible without clicking (Test 1)
- ✅ SubAgent tasks shown in status bar (Test 2)
- ✅ Active todos display correctly (Test 3)
- ✅ Cancel button works (Test 4)
- ✅ No visual regressions (Test 5)
- ✅ TasksView has all details (Test 6)
- ✅ No errors in console
- ✅ WebSocket events flowing correctly

## User Acceptance

Final verification with user:
1. Show thinking content is now visible
2. Confirm status bar is cleaner
3. Verify all needed information in Tasks tab
4. Get approval to commit changes

## Next Steps After Testing

1. ✅ All tests pass → Commit changes
2. ⚠️ Some tests fail → Debug and fix
3. ❌ Major issues → Rollback and reassess

## Additional Notes

### Thinking Content Debug

If thinking content still not showing:

**Check 1: Backend Events**
```bash
# Backend logs should show:
[EventMapper] agent_thinking: start
[EventMapper] agent_thinking: delta (content: "...")
[EventMapper] agent_thinking: end
```

**Check 2: Frontend State**
```javascript
// React DevTools → ChatPanel hooks
// Find useLessonPlanSession hook
// Check: thinkingContent state value
```

**Check 3: WebSocket Data**
```javascript
// Browser DevTools → Network → WS
// Click on websocket connection
// Watch for agent_thinking messages
```

**Check 4: Component Rendering**
```javascript
// Add temporary console.log in AgentActivityLine.tsx
console.log('Thinking state:', { isThinking, thinkingContent })
```
