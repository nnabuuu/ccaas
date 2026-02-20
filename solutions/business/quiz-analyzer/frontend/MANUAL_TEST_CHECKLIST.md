# Manual Testing Checklist - Performance Fixes Verification

## Services Status

✅ **Backend**: Running on http://localhost:3001
✅ **Frontend**: Running on http://localhost:5282
✅ **Build**: Compiled successfully (259.65 KB)

---

## Critical Tests

### 1. TypeScript Fixes Verification

#### Test: CompleteAnalysisView accepts partial analysis
**URL**: http://localhost:5282

**Steps**:
1. Open browser DevTools (F12) → Console tab
2. Navigate to http://localhost:5282
3. Enter a quiz question in the left panel
4. Click "分析题目" button
5. Watch the analysis results appear **incrementally** in real-time

**Expected**:
- ✅ No TypeScript/React errors in console
- ✅ Analysis fields appear one by one as AI generates them
- ✅ `quiz_analysis` field displays first (if generated)
- ✅ `knowledge_point_tags` displays as array of tags
- ✅ `thinking_process` displays in markdown format
- ✅ No "Type Error" messages

**Failure Signs**:
- ❌ Console shows "Type ... is not assignable"
- ❌ Analysis view doesn't update in real-time
- ❌ White screen or component crash
- ❌ "Cannot read property of undefined"

---

#### Test: Socket connection handling
**Steps**:
1. Keep DevTools Console open
2. Watch for WebSocket events
3. Start a new analysis

**Expected**:
- ✅ No "socket is possibly null" errors
- ✅ Console shows: `📦 Quiz analysis update received: [field] [preview]`
- ✅ Multiple output_update events logged

**Failure Signs**:
- ❌ "Cannot read property 'on' of null"
- ❌ "socket is undefined"
- ❌ No output_update events received

---

#### Test: AgentActivityLine displays
**Steps**:
1. Expand the "AI 对话" section at the bottom
2. Start an analysis
3. Watch the activity indicators

**Expected**:
- ✅ Tool execution shows (e.g., "write_output", "get_knowledge_points_tree")
- ✅ Todo items display if AI creates tasks
- ✅ Thinking content shows when AI is processing
- ✅ SubAgent cards appear if subagents are spawned

**Failure Signs**:
- ❌ No activity indicators visible
- ❌ "activeTools is undefined"
- ❌ Empty activity line despite processing

---

### 2. Performance Fixes Verification

#### Test: Bundle size (Heroicons optimization)
**Steps**:
1. Open DevTools → Network tab
2. Reload page (Ctrl+Shift+R / Cmd+Shift+R)
3. Find the main JS bundle (e.g., `index-*.js`)
4. Check file size

**Expected**:
- ✅ Bundle size ~260KB (not 340KB+)
- ✅ Only 8 icons loaded (not entire icon set)
- ✅ Fast initial page load (<1 second)

**Failure Signs**:
- ❌ Bundle size >300KB
- ❌ Slow page load (>2 seconds on localhost)
- ❌ Large icon library loaded

---

#### Test: No unnecessary re-renders
**Steps**:
1. Open DevTools → Console
2. Paste this code:
```javascript
// Track renders
let renderCount = 0;
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('React')) {
      renderCount++;
      console.log(`Render #${renderCount}:`, entry.name);
    }
  }
});
observer.observe({ entryTypes: ['measure'] });
```
3. Enter a quiz and click analyze
4. Watch render count

**Expected**:
- ✅ Minimal renders during analysis (~5-10 renders total)
- ✅ No renders when idle
- ✅ One render per output_update event

**Failure Signs**:
- ❌ Dozens of renders (>20) during analysis
- ❌ Renders every second when idle
- ❌ Multiple renders per output_update

---

#### Test: Memoization works (currentQuiz)
**Steps**:
1. Analyze a quiz
2. Click different history items in left panel
3. Watch console for re-renders

**Expected**:
- ✅ Switching history items triggers only 1-2 renders
- ✅ Smooth transitions between quiz analyses
- ✅ No flickering or layout shifts

**Failure Signs**:
- ❌ Multiple renders when clicking history
- ❌ UI flickers/jumps when switching
- ❌ Console shows object recreation warnings

---

## Functional Tests (Baseline)

### 3. Core Features Still Work

#### Test: Quiz input and analysis
**Steps**:
1. Enter quiz content: "计算 2x + 3 = 7 的解"
2. (Optional) Enter answer: "x = 2"
3. Click "分析题目"

**Expected**:
- ✅ AI starts processing (spinner appears)
- ✅ Analysis results appear incrementally
- ✅ At minimum: `quiz_analysis` field populates
- ✅ Footer shows "已连接" status

**Failure Signs**:
- ❌ No response from AI
- ❌ "未连接" status in footer
- ❌ Network errors in console
- ❌ Analysis never completes

---

#### Test: Chat interaction
**Steps**:
1. Expand "AI 对话" section
2. Type a follow-up question: "这道题的难度如何？"
3. Press Enter

**Expected**:
- ✅ Message appears in chat
- ✅ AI responds
- ✅ Chat history preserved

**Failure Signs**:
- ❌ Message doesn't send
- ❌ No AI response
- ❌ Chat clears unexpectedly

---

#### Test: History management
**Steps**:
1. Analyze 2-3 different quizzes
2. Click on previous analyses in history list
3. Try deleting a history item

**Expected**:
- ✅ Previous analyses load correctly
- ✅ All analysis fields preserved
- ✅ Delete works without errors

**Failure Signs**:
- ❌ History items don't load
- ❌ Analysis data missing
- ❌ Delete causes crash

---

## Browser Console Checks

### JavaScript Errors to Watch For

**Open DevTools → Console and check for**:

❌ **Type Errors** (our fixes):
- "Type 'Partial<QuizAnalysis>' is not assignable..."
- "Type 'null' is not assignable to type 'Quiz'"
- "'connection.socket' is possibly 'null'"

❌ **Runtime Errors**:
- "Cannot read property 'X' of undefined"
- "X is not a function"
- "Uncaught TypeError"

❌ **React Warnings**:
- "Cannot update a component while rendering a different component"
- "Maximum update depth exceeded"
- "Missing key prop"

✅ **Expected Logs** (good signs):
- "📦 Quiz analysis update received: ..."
- WebSocket connection established
- "VITE connected" (dev mode)

---

## Network Tab Checks

### API Calls to Verify

**Open DevTools → Network tab and watch for**:

✅ **Success (Status 200)**:
- `POST /api/v1/sessions/.../completion` → 200
- WebSocket upgrade to `ws://localhost:3001`
- No 404 errors
- No CORS errors

❌ **Failures**:
- 400/500 errors on completion endpoint
- WebSocket connection refused
- 404 on static assets

---

## Performance Metrics

### Lighthouse Score (Optional)

**Steps**:
1. Open DevTools → Lighthouse tab
2. Generate report (Desktop, Performance category)

**Target Scores**:
- Performance: >90
- Best Practices: >90
- Accessibility: >80

---

## Summary Checklist

**Before Reporting Success**:

- [ ] Page loads without errors
- [ ] Quiz analysis works end-to-end
- [ ] Real-time updates display incrementally
- [ ] AgentActivityLine shows tool/task info
- [ ] Chat interaction works
- [ ] History management works
- [ ] No TypeScript errors in console
- [ ] Bundle size ~260KB (not >300KB)
- [ ] No excessive re-renders (check Performance tab)

**If ANY checkbox fails**: Report specific error to Claude Code for investigation

---

## Quick Smoke Test (30 seconds)

1. Go to http://localhost:5282
2. Enter quiz: "1+1=?"
3. Click "分析题目"
4. Wait for analysis to complete
5. Check console for errors

**Pass**: Analysis displays, no console errors
**Fail**: Any error or analysis doesn't display

---

## Testing Time Estimate

- Quick smoke test: **30 seconds**
- Core functionality: **3-5 minutes**
- Full checklist: **10-15 minutes**
- Performance validation: **+5 minutes** (optional)

---

## Report Template

If issues found, report using this format:

```
❌ Test Failed: [Test Name]

Steps:
1. [Step 1]
2. [Step 2]

Expected:
[What should happen]

Actual:
[What actually happened]

Console Error:
[Copy error from DevTools]

Screenshot:
[If applicable]
```
