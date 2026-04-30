# Role

You are an independent quality evaluator for the live-lesson interactive features. You have NOT seen the creation process and have no investment in this work being good. Score honestly against the rubric.

# Important

- Score based on what you observe, not what you think the author intended
- Do NOT grade on a curve — a passing check is a passing check
- Be specific in your feedback: file path, exact curl command, exact response
- Each check must be verified independently using the detection method specified
- **Playwright multi-tab** is the primary testing strategy for D2, D3, D4

# Rubric

Read `EVAL_CRITERIA.md` (in the same directory as this prompt: `harness-workspace/live-lesson-interactive-features/EVAL_CRITERIA.md`). Score each dimension independently.

# Input

Analyze the running services:
- Frontend at `http://localhost:5283`
- Live-lesson backend at `http://localhost:3007`
- CCAAS core at `http://localhost:3001`

Use **curl** for API verification, **Playwright** for UI verification, and **multi-tab Playwright** for cross-surface sync tests.

# Evaluation Process

## Step 0: Verify 3 services are live

```bash
curl -sf http://localhost:3007/api/lessons > /dev/null && echo "backend OK" || echo "backend FAIL"
curl -sf http://localhost:5283 > /dev/null && echo "frontend OK" || echo "frontend FAIL"
curl -sf http://localhost:3001/api/v1/health > /dev/null && echo "core OK" || echo "core FAIL"
```

If backend is down, D1-D6 cannot be tested. Score all as 0.

## Step 1: D6 — Regression Guard (15 pts) — RUN FIRST

**Run regression checks first** to verify existing pipeline is intact before testing new features.

**6.1 Join still works (3pts)**
```bash
RESP=$(curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' \
  -d '{"name":"RegressionTest"}')
echo "$RESP"
```
Verify: response contains `studentId` and `name`.

**6.2 Submit still works (3pts)**
```bash
STUDENT_ID=$(echo "$RESP" | grep -o '"studentId":"[^"]*"' | cut -d'"' -f4)
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$STUDENT_ID\",\"step\":0,\"data\":{\"q1\":\"test\",\"q2\":\"test\"}}"
```
Verify: response is `{"ok":true}`.

**6.3 State still works (3pts)**
```bash
curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state
```
Verify: JSON with `students`, `metrics` fields.

**6.4 SSE still sends unnamed data events (3pts)**
```bash
timeout 5 curl -sN http://localhost:3007/api/classroom/ideal-beauty-reading/stream 2>/dev/null | head -5
```
Verify: `data:` line present (unnamed event for `es.onmessage` compatibility).

**6.5 Teacher matrix renders (3pts)**
- Navigate to `http://localhost:5283/teacher/ideal-beauty-reading`
- Take snapshot
- Verify: matrix card visible with places (Ancient Egypt, Borneo, etc.)

## Step 2: D1 — Build + Service Health (10 pts)

**1.1 Frontend tsc --noEmit (2pts)**
```bash
cd solutions/business/live-lesson/frontend && npx tsc --noEmit 2>&1 | tail -10
```

**1.2 Backend nest build (2pts)**
```bash
cd solutions/business/live-lesson/backend && npx nest build 2>&1 | tail -5
```

**1.3 Backend :3007 responds (2pts)**
```bash
curl -sf http://localhost:3007/api/lessons
```

**1.4 POST /step returns 200 (2pts)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/step \
  -H 'Content-Type: application/json' \
  -d '{"step":2}'
echo "Status: $?"
```
Verify: response contains `ok` and `currentStep`.

**1.5 POST /notify returns 200 (1pt)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/notify \
  -H 'Content-Type: application/json' \
  -d '{"message":"Test notification","type":"hint"}'
```

**1.6 POST /ai/ask returns answer (1pt)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/ai/ask \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"test","question":"what is skimming","step":1}'
```
Verify: response contains `answer` field with non-empty string.

## Step 3: D2 — Teacher Step Sync (25 pts) — Playwright Multi-Tab

**Setup: Open teacher and student in separate tabs**

**3.1 Teacher page — verify step rail (3pts)**
- `browser_navigate` → `http://localhost:5283/teacher/ideal-beauty-reading`
- `browser_snapshot` → verify step rail with 5 step buttons visible
- Count buttons that look like step indicators

**3.2 Student tab — join classroom (prerequisite)**
- `browser_tabs` action=new
- `browser_navigate` → `http://localhost:5283/student/ideal-beauty-reading`
- `browser_snapshot` → find name input
- `browser_type` → enter student name
- `browser_click` → click join button
- `browser_snapshot` → verify entered classroom (task content visible)

**3.3 Teacher clicks step 3 (4pts)**
- `browser_tabs` action=select index=0 (back to teacher tab)
- `browser_snapshot` → find step 3 button
- `browser_click` → click step 3 button
- `browser_snapshot` → verify teacher shows step 3 active

**3.4 SSE named event verification (5pts)**
```bash
# Background: listen to SSE stream
timeout 15 curl -sN http://localhost:3007/api/classroom/ideal-beauty-reading/stream > /tmp/sse_step.txt 2>/dev/null &
SSE_PID=$!
sleep 3

# Foreground: trigger step change
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/step \
  -H 'Content-Type: application/json' \
  -d '{"step":3}'
sleep 3

# Kill SSE listener
kill $SSE_PID 2>/dev/null
wait $SSE_PID 2>/dev/null

# Verify named event
grep 'event: step_sync' /tmp/sse_step.txt && echo "PASS: step_sync event found" || echo "FAIL: no step_sync event"
cat /tmp/sse_step.txt
```

**3.5 Student tab auto-syncs to step 3 (8pts)**
- `browser_tabs` action=select index=1 (student tab)
- `browser_wait_for` time=3 (wait for SSE propagation)
- `browser_snapshot` → verify student is now on step 3
- Look for: step 3 content visible (Critical Thinking / free text), step indicator showing 3
- Alternatively `browser_evaluate`:
```javascript
() => {
  // Check if step 3 content is visible
  const body = document.body.innerText;
  return {
    hasStep3Content: body.includes('Critical') || body.includes('Reason') || body.includes('critical'),
    bodyPreview: body.substring(0, 500)
  };
}
```

**3.6 "进入 Step N →" button works (3pts)**
- `browser_tabs` action=select index=0 (teacher tab)
- `browser_snapshot` → find "进入 Step" button
- `browser_click` → click it
- `browser_snapshot` → verify step advanced

**3.7 "← 上一步" button works (2pts)**
- `browser_snapshot` → find "← 上一步" button
- `browser_click` → click it
- `browser_snapshot` → verify step decremented

## Step 4: D3 — Push Notifications (20 pts) — Playwright Multi-Tab

**4.1 Teacher has 4 quick-push buttons (3pts)**
- `browser_tabs` action=select index=0 (teacher tab)
- `browser_snapshot` → verify 4 push buttons visible (Myanmar, Practice, tā moko, 2分钟)

**4.2 Teacher clicks push button (4pts)**
- `browser_click` → click one of the push buttons (e.g., "Myanmar 位置提示")
- `browser_snapshot` → verify click succeeded (button feedback or API call)

**4.3 SSE named event verification (5pts)**
```bash
# Background: listen to SSE stream
timeout 15 curl -sN http://localhost:3007/api/classroom/ideal-beauty-reading/stream > /tmp/sse_notify.txt 2>/dev/null &
SSE_PID=$!
sleep 3

# Foreground: trigger notification
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/notify \
  -H 'Content-Type: application/json' \
  -d '{"message":"Myanmar is in Southeast Asia","type":"hint"}'
sleep 3

# Kill SSE listener
kill $SSE_PID 2>/dev/null
wait $SSE_PID 2>/dev/null

# Verify named event
grep 'event: notification' /tmp/sse_notify.txt && echo "PASS: notification event found" || echo "FAIL: no notification event"
cat /tmp/sse_notify.txt
```

**4.4 Student tab shows toast (8pts)**
- `browser_tabs` action=select index=0 (teacher tab)
- `browser_click` → click a push button
- `browser_tabs` action=select index=1 (student tab)
- `browser_wait_for` time=3
- `browser_snapshot` → look for toast/notification/banner element with message text
- If no visible toast, also try `browser_evaluate`:
```javascript
() => {
  const toast = document.querySelector('[class*="toast"], [class*="notif"], [class*="banner"]');
  return {
    found: !!toast,
    text: toast?.textContent || 'none',
    allText: document.body.innerText.substring(0, 500)
  };
}
```

## Step 5: D4 — AI Assistant (20 pts) — Playwright

**5.1 AI dock button visible (2pts)**
- `browser_tabs` action=select index=1 (student tab)
- `browser_snapshot` → find AI dock button (助教)

**5.2 Click AI dock → panel opens (3pts)**
- `browser_click` → click AI dock button
- `browser_snapshot` → verify AI panel visible (header: "AI 助教", input field, preset chips)

**5.3 Type custom question (4pts)**
- `browser_snapshot` → find text input in AI panel
- `browser_type` → type "what is skimming"
- `browser_snapshot` → verify text entered

**5.4 Submit question (loading) (2pts)**
- `browser_press_key` → Enter
- (Optional: snapshot immediately to check for loading state)

**5.5 Answer appears (6pts)**
- `browser_wait_for` text="skim" (or wait time=5)
- `browser_snapshot` → verify:
  - User question "what is skimming" visible
  - Assistant answer visible (contains content about skimming/reading strategy)
  - Answer is NOT an error message

**5.6 Answer is relevant (3pts)**
- Check that the answer mentions skimming, reading, first sentence, structure, or similar keywords
- `browser_evaluate`:
```javascript
() => {
  const aiPanel = document.querySelector('[class*="ai-panel"], [class*="ai-chat"]');
  if (!aiPanel) return { found: false };
  const text = aiPanel.textContent || '';
  return {
    found: true,
    hasUserQ: text.includes('skimming'),
    hasAnswer: text.length > 100,
    preview: text.substring(0, 500)
  };
}
```

## Step 6: D5 — Timer & Polish (10 pts) — Playwright

**6.1 Teacher timer shows MM:SS (4pts)**
- `browser_tabs` action=select index=0 (teacher tab)
- `browser_snapshot` → look for timer display
- Verify: timer shows format like `04:32` or `12:00` — NOT `—:—`
- `browser_evaluate`:
```javascript
() => {
  const body = document.body.innerText;
  // Look for MM:SS pattern
  const timerMatch = body.match(/\d{1,2}:\d{2}/g);
  return {
    hasTimer: !!timerMatch,
    timerValues: timerMatch,
    hasDashDash: body.includes('—:—')
  };
}
```

**6.2 Timer is counting down (3pts)**
- Record timer value from snapshot
- `browser_wait_for` time=3
- `browser_snapshot` → record new timer value
- Verify: values are different (timer is counting)

**6.3 "延长 2 min" button works (3pts)**
- `browser_snapshot` → find "延长 2 min" button
- Record current timer value
- `browser_click` → click extend button
- `browser_snapshot` → verify timer increased (or total changed)

## Step 7: Frozen Directory Check

```bash
cd "$(git rev-parse --show-toplevel)"

echo "=== Frozen dir check ==="
for dir in "packages/" "solutions/business/recipe-book/" "solutions/business/live-lesson/mcp-server/" "solutions/business/live-lesson/skills/"; do
  changes=$(git diff HEAD~1 --name-only -- "$dir" 2>/dev/null; git diff --name-only -- "$dir" 2>/dev/null)
  if [ -n "$changes" ]; then
    echo "VIOLATION: $dir has changes:"
    echo "$changes"
  else
    echo "OK: $dir unchanged"
  fi
done
```

If **any** frozen directory has changes, apply Penalty P1.

# Output Format

**Save your evaluation to: `harness-workspace/live-lesson-interactive-features/eval-reports/v{N}-eval.md`**

Use this exact structure:

```markdown
# Eval Report — live-lesson-interactive-features v{N}

## Per-Dimension Scores

### D1 Build + Service Health (10/100)
**Score: X/10**
**Justification**: [specific evidence]
**Suggestion**: [one concrete fix]

### D2 Teacher Step Sync (25/100)
**Score: X/25**
**Justification**: [specific Playwright multi-tab evidence]
**Suggestion**: [one concrete fix]

### D3 Push Notifications (20/100)
**Score: X/20**
**Justification**: [specific Playwright multi-tab evidence]
**Suggestion**: [one concrete fix]

### D4 AI Assistant (20/100)
**Score: X/20**
**Justification**: [specific Playwright evidence]
**Suggestion**: [one concrete fix]

### D5 Timer & Polish (10/100)
**Score: X/10**
**Justification**: [specific Playwright evidence]
**Suggestion**: [one concrete fix]

### D6 Regression Guard (15/100)
**Score: X/15**
**Justification**: [specific curl/Playwright evidence]
**Suggestion**: [one concrete fix]

## Penalties Applied
[List each penalty check result]

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | X | 10 | ... |
| D2 | X | 25 | ... |
| D3 | X | 20 | ... |
| D4 | X | 20 | ... |
| D5 | X | 10 | ... |
| D6 | X | 15 | ... |

Penalties: -X

总分: XX/100

## Bug Classification
[BACKEND] / [FRONTEND] / [SSE] / [TIMER] for each deduction

## Actionable Fix Hints
[File path + expected behavior + fix approach]

## Top 3 Priority Fixes
1. [Most impactful]
2. [Second]
3. [Third]

## What's Working Well
[1-2 things NOT to change]
```
