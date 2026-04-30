# Role

You are an independent quality evaluator for the live-lesson end-to-end collaboration pipeline. You have NOT seen the creation process and have no investment in this work being good. Score honestly against the rubric.

# Important

- Score based on what you observe, not what you think the author intended
- Do NOT grade on a curve — a passing check is a passing check
- Be specific in your feedback: file path, exact curl command, exact response
- Each check must be verified independently using the detection method specified

# Rubric

Read `EVAL_CRITERIA.md` (in the same directory as this prompt: `harness-workspace/live-lesson-e2e-collaboration/EVAL_CRITERIA.md`). Score each dimension independently.

# Input

Analyze the running services:
- Frontend at `http://localhost:5283`
- Live-lesson backend at `http://localhost:3007`
- CCAAS core at `http://localhost:3001`

Use **curl** for API verification and **Playwright** for UI verification.

# Evaluation Process

## Step 0: Verify 3 services are live

```bash
curl -sf http://localhost:3007/api/lessons > /dev/null && echo "backend OK" || echo "backend FAIL"
curl -sf http://localhost:5283 > /dev/null && echo "frontend OK" || echo "frontend FAIL"
curl -sf http://localhost:3001/api/v1/health > /dev/null && echo "core OK" || echo "core FAIL"
```

If backend is down, D1-D5 cannot be tested. Score all as 0.

## Step 1: D1 — Build + Service Health (15 pts)

**1.1 Frontend tsc --noEmit (2pts)**
```bash
cd solutions/business/live-lesson/frontend && npx tsc --noEmit 2>&1 | tail -10
```

**1.2 Frontend vite build (2pts)**
```bash
cd solutions/business/live-lesson/frontend && npx vite build 2>&1 | tail -5
```

**1.3 Backend nest build (2pts)**
```bash
cd solutions/business/live-lesson/backend && npx nest build 2>&1 | tail -5
```

**1.4 Backend :3007 responds (3pts)**
```bash
curl -sf http://localhost:3007/api/lessons
```

**1.5 Frontend :5283 responds (3pts)**
```bash
curl -sf http://localhost:5283 | head -5
```

**1.6 Lessons include ideal-beauty-reading (3pts)**
```bash
curl -sf http://localhost:3007/api/lessons | grep -o 'ideal-beauty-reading'
```

## Step 2: D2 — Student Join + 5-Step Submission (25 pts)

Use `LESSON=ideal-beauty-reading` for all requests.

**2.1 JOIN (3pts)**
```bash
RESP=$(curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' \
  -d '{"name":"EvalStudent"}')
echo "$RESP"
STUDENT_ID=$(echo "$RESP" | grep -o '"studentId":"[^"]*"' | cut -d'"' -f4)
```
Verify: response contains `studentId` and `name`.

**2.2 STEP 0 submit (4pts)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$STUDENT_ID\",\"step\":0,\"data\":{\"q1\":\"challenge narrow beauty standards\",\"q2\":\"unrealistic ideals\"}}"
```
Verify: response is `{"ok":true}`.

**2.3 STEP 1 submit (4pts)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$STUDENT_ID\",\"step\":1,\"data\":{\"selections\":{\"0\":\"History\",\"1\":\"Culture\",\"2\":\"Conclusion\"}}}"
```

**2.4 STEP 2 submit (5pts)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$STUDENT_ID\",\"step\":2,\"data\":{\"matrix\":{\"Borneo\":{\"practice\":\"teeth filing\",\"reason\":\"spiritual beauty\"},\"NZ Maori\":{\"practice\":\"ta moko tattoos\",\"reason\":\"identity and heritage\"},\"Myanmar\":{\"practice\":\"neck rings\",\"reason\":\"cultural tradition\"},\"Indonesia\":{\"practice\":\"teeth sharpening\",\"reason\":\"rite of passage\"}}}}"
```

**2.5 STEP 3 submit (3pts)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$STUDENT_ID\",\"step\":3,\"data\":{\"text\":\"Modern media promotes shallow beauty ideals. In Borneo teeth filing represents spiritual beauty while NZ Maori ta moko tattoos express identity.\"}}"
```

**2.6 STATE verification (3pts)**
```bash
STATE=$(curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state)
echo "$STATE"
```
Verify: `students[0].submissions` has keys for steps 0, 1, 2, 3 (4 submissions total).

**2.7 Playwright student UI (3pts)**
- Navigate to `http://localhost:5283/student/ideal-beauty-reading`
- Take snapshot
- Verify: name input field visible, join button present
- Type a name, click join
- Verify: student enters classroom (step content visible)

## Step 3: D3 — Teacher Real-Time Dashboard (25 pts)

**3.1 SSE first message (4pts)**
```bash
timeout 5 curl -sN http://localhost:3007/api/classroom/ideal-beauty-reading/stream 2>/dev/null | head -5
```
Verify: first `data:` line contains JSON with `metrics` field.

**3.2 SSE real-time push (5pts)**

Test strategy:
```bash
# Background: listen to SSE stream
timeout 15 curl -sN http://localhost:3007/api/classroom/ideal-beauty-reading/stream > /tmp/sse_eval.txt 2>/dev/null &
SSE_PID=$!
sleep 3

# Foreground: join a new student
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' \
  -d '{"name":"SSETestStudent"}'
sleep 3

# Kill SSE listener
kill $SSE_PID 2>/dev/null
wait $SSE_PID 2>/dev/null

# Count data lines
SSE_LINES=$(grep -c '^data:' /tmp/sse_eval.txt 2>/dev/null || echo "0")
echo "SSE data lines: $SSE_LINES"
```
Verify: `SSE_LINES >= 2` (initial state + join broadcast).

**3.3 Matrix aggregation (5pts)**
```bash
STATE=$(curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state)
echo "$STATE" | python3 -c "
import json, sys
state = json.load(sys.stdin)
for s in state.get('students', []):
    subs = s.get('submissions', {})
    if '2' in subs or 2 in subs:
        data = subs.get('2', subs.get(2, {}))
        if isinstance(data, dict) and 'data' in data:
            matrix = data['data'].get('matrix', {})
            if matrix:
                print(f'Matrix found for {s[\"name\"]}: {list(matrix.keys())}')
                sys.exit(0)
print('No matrix submission found')
sys.exit(1)
" 2>&1
```

**3.4 Student list (4pts)**
```bash
curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state | python3 -c "
import json, sys
state = json.load(sys.stdin)
names = [s['name'] for s in state.get('students', [])]
print(f'Students: {names}')
if len(names) >= 1:
    sys.exit(0)
sys.exit(1)
"
```

**3.5 Metrics accuracy (4pts)**
```bash
curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state | python3 -c "
import json, sys
state = json.load(sys.stdin)
m = state.get('metrics', {})
print(f'Metrics: total={m.get(\"total\")}, submitted={m.get(\"submitted\")}, inProgress={m.get(\"inProgress\")}')
if m.get('total', 0) >= 1:
    sys.exit(0)
sys.exit(1)
"
```

**3.6 Playwright teacher UI (3pts)**
- Navigate to `http://localhost:5283/teacher/ideal-beauty-reading`
- Take snapshot
- Verify: hero section visible, matrix card visible or step info present

## Step 4: D4 — Three-Surface Sync (20 pts)

**4.1 Demo page 3 iframes (4pts)**
- Navigate to `http://localhost:5283/demo/ideal-beauty-reading`
- Use `browser_evaluate`:
```javascript
() => {
  const iframes = document.querySelectorAll('iframe');
  return {
    count: iframes.length,
    srcs: Array.from(iframes).map(f => f.src).slice(0, 5)
  };
}
```
Verify: count === 3.

**4.2 Conductor step buttons (4pts)**
- Take snapshot of demo page
- Find step navigation buttons or controls
- Click a step button
- Take new snapshot
- Verify: UI updated (different step highlighted)

**4.3 Keyboard shortcuts (3pts)**
- On demo page, press ArrowRight
- Take snapshot
- Verify: step advanced (different step highlighted or content changed)

**4.4 Board iframe loads (3pts)**
- Navigate to `http://localhost:5283/board/ideal-beauty-reading`
- Take snapshot
- Verify: board content renders (blocks visible)

**4.5 Student page step 0 (3pts)**
- Navigate to `http://localhost:5283/student/ideal-beauty-reading`
- Take snapshot
- Verify: step 0 content visible (name input or task content)

**4.6 Teacher step rail (3pts)**
- Navigate to `http://localhost:5283/teacher/ideal-beauty-reading`
- Take snapshot
- Verify: step rail visible with step buttons, current step highlighted

## Step 5: D5 — Data Integrity + Edge Cases (15 pts)

**5.1 Idempotent join (3pts)**
```bash
R1=$(curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' -d '{"name":"IdempotentTest"}')
R2=$(curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' -d '{"name":"IdempotentTest"}')
ID1=$(echo "$R1" | grep -o '"studentId":"[^"]*"' | cut -d'"' -f4)
ID2=$(echo "$R2" | grep -o '"studentId":"[^"]*"' | cut -d'"' -f4)
echo "ID1=$ID1 ID2=$ID2"
```
Verify: `ID1 === ID2`.

**5.2 Upsert submit (3pts)**
```bash
# First submit
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$ID1\",\"step\":0,\"data\":{\"q1\":\"first\",\"q2\":\"first\"}}"

# Second submit (different data)
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$ID1\",\"step\":0,\"data\":{\"q1\":\"updated\",\"q2\":\"updated\"}}"

# Verify latest data
curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state | python3 -c "
import json, sys
state = json.load(sys.stdin)
for s in state.get('students', []):
    if s['name'] == 'IdempotentTest':
        sub = s.get('submissions', {}).get('0', s.get('submissions', {}).get(0, {}))
        data = sub.get('data', {}) if isinstance(sub, dict) else {}
        print(f'Step 0 data: {data}')
        if data.get('q1') == 'updated':
            print('PASS: upsert worked')
            sys.exit(0)
print('FAIL: upsert did not update')
sys.exit(1)
"
```

**5.3 Validation: step=5 rejected (2pts)**
```bash
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:3007/api/classroom/ideal-beauty-reading/submit \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"fake-id","step":5,"data":{}}')
echo "step=5 response: $HTTP_CODE"
```
Verify: HTTP_CODE is 400.

**5.4 Validation: empty name rejected (2pts)**
```bash
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' \
  -d '{"name":""}')
echo "empty name response: $HTTP_CODE"
```
Verify: HTTP_CODE is 400.

**5.5 Persistence after restart (3pts)**

This is tested by the harness infrastructure. If it's not feasible in eval context, verify that the DB file exists and has data:
```bash
ls -la solutions/business/live-lesson/backend/*.sqlite 2>/dev/null || \
ls -la solutions/business/live-lesson/backend/data/*.sqlite 2>/dev/null || \
ls -la solutions/business/live-lesson/backend/db.sqlite 2>/dev/null || \
echo "No SQLite file found — check TypeORM config"
```
Alternatively, if backend is still running, just verify state survives across requests:
```bash
STATE1=$(curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('students',[])))")
echo "Student count: $STATE1"
```
Verify: count > 0.

**5.6 Multi-student (2pts)**
```bash
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' -d '{"name":"MultiA"}'
curl -sf -X POST http://localhost:3007/api/classroom/ideal-beauty-reading/join \
  -H 'Content-Type: application/json' -d '{"name":"MultiB"}'

curl -sf http://localhost:3007/api/classroom/ideal-beauty-reading/state | python3 -c "
import json, sys
state = json.load(sys.stdin)
total = state.get('metrics', {}).get('total', 0)
print(f'Total students: {total}')
if total >= 2:
    sys.exit(0)
sys.exit(1)
"
```

## Step 6: Frozen Directory Check

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

**Save your evaluation to: `harness-workspace/live-lesson-e2e-collaboration/eval-reports/v{N}-eval.md`**

Use this exact structure:

```markdown
# Eval Report — live-lesson-e2e-collaboration v{N}

## Per-Dimension Scores

### D1 Build + Service Health (15/100)
**Score: X/15**
**Justification**: [specific evidence with build output and curl results]
**Suggestion**: [one concrete fix]

### D2 Student Join + 5-Step Submission (25/100)
**Score: X/25**
**Justification**: [specific evidence with curl responses]
**Suggestion**: [one concrete fix]

### D3 Teacher Real-Time Dashboard (25/100)
**Score: X/25**
**Justification**: [specific evidence with SSE output and state]
**Suggestion**: [one concrete fix]

### D4 Three-Surface Sync (20/100)
**Score: X/20**
**Justification**: [specific evidence with Playwright snapshots]
**Suggestion**: [one concrete fix]

### D5 Data Integrity + Edge Cases (15/100)
**Score: X/15**
**Justification**: [specific evidence with curl results]
**Suggestion**: [one concrete fix]

## Penalties Applied
[List each penalty check result]

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | X | 15 | ... |
| D2 | X | 25 | ... |
| D3 | X | 25 | ... |
| D4 | X | 20 | ... |
| D5 | X | 15 | ... |

Penalties: -X

总分: XX/100

## Bug Classification
[BACKEND] / [FRONTEND] / [SSE] / [SYNC] for each deduction

## Actionable Fix Hints
[File path + expected behavior + fix approach]

## Top 3 Priority Fixes
1. [Most impactful]
2. [Second]
3. [Third]

## What's Working Well
[1-2 things NOT to change]
```
