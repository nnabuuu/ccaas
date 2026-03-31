# Evaluator Agent — Skill Feature E2E v2

You are an independent evaluator testing the Skill toggle feature across 8 dimensions:
automated tests, code review fixes, browser E2E, error handling quality, and documentation coverage.

## Setup

1. Read `harness-workspace/skill-feature-e2e/EVAL_CRITERIA.md` — scoring rubric
2. Read `harness-workspace/skill-feature-e2e/SPEC.md` — what was supposed to be fixed

---

## Evaluation Workflow

Execute phases IN ORDER. Score each dimension as you go.

### Phase 0: Pre-Scoring Gates

#### Gate 1: Backend auth
```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"dev123"}'
```
- Must return JSON with `apiKey` field
- Save the apiKey for later browser tests
- **FAIL → D5=0, D6=0, skip browser phases**

#### Gate 2: Frontend loads
- Navigate browser to http://localhost:5190
- Wait for page to render (not blank)
- **FAIL → D5=0, D6=0, D7=0**

#### Gate 3: SkillPanel accessible
- Find and click Skills entry in sidebar
- SkillPanel must open showing skills
- **FAIL → D5=0, D6=0, D7=0**

---

### Phase 1: D1 Backend Unit Tests (AUTOMATED)

Run the test suites and record results:

#### Test 1.1: skills.service.toggle (8 pts)
```bash
cd packages/backend && npx jest --no-coverage --verbose skills.service.toggle 2>&1
```
- Check exit code and test output
- Count passed/failed tests
- Score: 8 if all pass, 4 if partial, 0 if file missing or all fail

#### Test 1.2: skill-management.service (7 pts)
```bash
cd packages/backend && npx jest --no-coverage --verbose skill-management.service 2>&1
```
- Must include `loadEnabledSkills` tests
- Check for new test descriptions: "enabled", "disabled", "filter", "slug"
- Score: 7 if all pass (including new), 4 if partial, 2 if only old tests pass, 0 if broken

---

### Phase 2: D2 Frontend Unit Tests (AUTOMATED)

#### Test 2.1: useSkills hook (8 pts)
```bash
cd packages/react-sdk && npx vitest run useSkills 2>&1
```
- Check if file exists: `packages/react-sdk/__tests__/useSkills.test.ts`
- Score: 8 if all pass, 4 if partial, 0 if missing or all fail

#### Test 2.2: SkillPanel tests (7 pts)
```bash
cd packages/chat-interface && npx vitest run SkillPanel 2>&1
```
- Must include new toast tests (warning, success, error)
- Score: 7 if all pass, 4 if partial (1-2 new pass), 2 if only old pass, 0 if broken

---

### Phase 3: D3 Code Review Fixes (STATIC)

#### Test 3.1: Guard decorator order (8 pts)

Check sessions.controller.ts:
```bash
grep -n '@OptionalAuth\|@UseGuards(TenantGuard)' packages/backend/src/sessions/sessions.controller.ts
```

**CORRECT order** (UseGuards ABOVE OptionalAuth):
```
line N:   @UseGuards(TenantGuard)
line N+1: @OptionalAuth()
```

**WRONG order** (OptionalAuth ABOVE UseGuards):
```
line N:   @OptionalAuth()
line N+1: @UseGuards(TenantGuard)
```

Do the same check for conversations-alias.controller.ts.

Score: 8 if both correct, 4 if one correct, 0 if neither

#### Test 3.2: Dead code removal (4 pts)
```bash
grep -c 'isOptionalAuth' packages/backend/src/skills/guards/skill-permission.guard.ts
```
- Score: 4 if count=0, 2 if commented out, 0 if still present

#### Test 3.3: Error detail in toast (3 pts)
```bash
grep -A3 'toast.error' packages/chat-interface/src/components/SkillPanel.tsx
```
- Score: 3 if toast.error includes dynamic error (err.message or similar)
- Score: 1 if toast.error with fixed string only
- Score: 0 if no toast.error on toggle failure

---

### Phase 4: D4 Skill Impact Verification (AUTOMATED)

This dimension is scored from D1 Test 1.2 results. Specifically check:

```bash
cd packages/backend && npx jest --no-coverage --verbose skill-management.service 2>&1 | grep -i 'enabled\|disabled\|filter'
```

- Score: 10 if tests prove enabled:false are excluded
- Score: 5 if test exists but doesn't clearly verify filtering
- Score: 0 if no loadEnabledSkills test

---

### Phase 5: D5 Auth-Gated Operations (BROWSER)

#### Test 5.1: Anonymous toggle prevention (8 pts)

1. In browser, execute:
   ```javascript
   localStorage.removeItem('ck-api-key'); location.reload();
   ```
2. Wait for reload, open SkillPanel
3. Click "停用" on any enabled skill
4. **Check**:
   - No success toast? (good)
   - Warning/error toast visible? Note the message
   - Network: was PATCH request sent?

Score per EVAL_CRITERIA rubric.

#### Test 5.2: Authenticated toggle (7 pts)

1. Login via injecting API key:
   ```javascript
   localStorage.setItem('ck-api-key', 'THE_KEY_FROM_GATE1'); location.reload();
   ```
2. Open SkillPanel, click "停用"
3. **Check**: PATCH sent, 200 response, toast after

---

### Phase 6: D6 Toggle E2E Flow (BROWSER)

Must be logged in (from D5 Test 5.2).

#### Test 6.1: Toggle disable (5 pts)
1. Find enabled skill, click "停用"
2. Verify: badge changes, toast shows correct name

#### Test 6.2: Toggle enable (5 pts)
1. Find disabled skill, click "启用"
2. Verify: reverse

#### Test 6.3: State persistence (5 pts)
1. Toggle a skill, refresh page
2. Open SkillPanel
3. Verify: state persists

Also verify via curl:
```bash
curl -s http://localhost:3001/api/v1/skills -H 'X-Tenant-Id: default' | \
  python3 -c "import json,sys; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('items',[]); [print(f'{s[\"name\"]}: enabled={s.get(\"enabled\")}') for s in items]"
```

---

### Phase 7: D7 Error Handling + Quality (MIXED)

#### Test 7.1: Toast timing (6 pts)

Code review — grep SkillPanel.tsx:
```bash
grep -n 'onToggle\|toggleSkill\|toast\.\(success\|error\)' packages/chat-interface/src/components/SkillPanel.tsx
```

- SUCCESS toast must be inside try block after await
- ERROR toast must be in catch block
- No synchronous toast+toggle patterns

#### Test 7.2: Error feedback quality (5 pts)

From code review:
- Check toast.error message quality
- Does it include actionable info?

Cross-reference with browser behavior if possible:
- Try with invalid API key, or observe error paths

#### Test 7.3: Error propagation (4 pts)
```bash
grep -A2 'catch' packages/react-sdk/src/hooks/useSkills.ts
```
- Must have `throw err` (or `throw e`) in catch block

---

### Phase 8: D8 Documentation Coverage (STATIC)

#### Test 8.1: Toggle endpoint in gitbook REST docs (5 pts)
```bash
grep -i 'toggle\|PATCH.*skills.*toggle' docs/gitbook/en/api/rest.md
grep -i 'toggle\|PATCH.*skills.*toggle' docs/gitbook/zh/api/rest.md
```

- Score: 5 if both EN and ZH contain `PATCH /skills/:id/toggle` with description
- Score: 3 if only one language documented
- Score: 1 if toggle mentioned but no endpoint details
- Score: 0 if no toggle in gitbook docs

#### Test 8.2: SkillPanel component documentation (4 pts)
```bash
grep -A10 'SkillPanel.*[Pp]rop' packages/chat-interface/ARCHITECTURE.md
```

- Score: 4 if SkillPanel has props table or description (serverUrl, tenantId, open, onClose, apiKey)
- Score: 2 if SkillPanel mentioned with partial props
- Score: 0 if no props documentation

#### Test 8.3: loadEnabledSkills JSDoc (3 pts)
```bash
grep -B8 'async loadEnabledSkills' packages/backend/src/sessions/services/skill-management.service.ts
```

- Score: 3 if JSDoc comment exists explaining filtering behavior
- Score: 1 if simple one-line comment
- Score: 0 if no documentation on method

---

## Network Request Verification

For D5 and D6 browser tests, verify network requests:
```
browser_network_requests (filter: '/skills/')
```

Check:
- PATCH to `/api/v1/skills/{id}/toggle` exists
- `X-API-Key` header present (when logged in)
- Response status 200 (success) or 403 (anonymous)

---

## Scoring Output

Write eval report to: `harness-workspace/skill-feature-e2e/eval-reports/v{VERSION}-eval.md`

Use the exact report format from EVAL_CRITERIA.md.

**CRITICAL**: The final line of your report MUST be exactly:
```
总分: {NUMBER}/100
```

This is parsed by harness.sh to determine pass/fail.

---

## Important Notes

- Score based on **actual test results and code evidence**, not assumptions
- If a test suite fails to run, score that dimension as 0
- Record ALL test output as evidence (trimmed if very long)
- For browser tests, take screenshots as evidence
- D3 is PURELY static analysis — no browser needed
- D4 is scored from D1.2 test results — do not run separate tests
- D8 is PURELY static analysis — grep docs files, no browser needed
