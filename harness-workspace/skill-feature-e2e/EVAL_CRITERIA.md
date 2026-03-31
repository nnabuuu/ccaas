# Evaluation Criteria — Skill Feature E2E v2

**Total: 100 points** (8 dimensions)
**Target: 85/100**

---

## Pre-Scoring Gate (MANDATORY)

Before any scoring, run these checks. If ANY gate fails, apply the listed penalty.

### Gate 1: Backend alive + auth works
```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"dev123"}'
```
- Must return 200 with `apiKey` field
- **Fail → D5=0, D6=0** (can't test browser E2E)

### Gate 2: Frontend loads
- Navigate to http://localhost:5190
- Page must render without blank screen or JS crash
- **Fail → D5=0, D6=0, D7=0**

### Gate 3: SkillPanel accessible
- Skills entry must be clickable in sidebar
- SkillPanel must open and show skills list
- **Fail → D5=0, D6=0, D7=0**

---

## D1: Backend Unit Tests (13 points)

Automated — run tests and score by pass/fail.

### Test 1.1: `skills.service.toggle.spec.ts` (7 pts)

Run: `cd packages/backend && npx jest --no-coverage skills.service.toggle`

| Score | Criteria |
|-------|----------|
| 7 | File exists AND all tests pass |
| 4 | File exists, some tests pass (partial) |
| 0 | File missing OR all tests fail |

Expected tests:
- toggle flips `enabled: true → false`
- toggle flips `enabled: false → true`
- toggle on non-existent skill → NotFoundException

### Test 1.2: `skill-management.service.spec.ts` — loadEnabledSkills (6 pts)

Run: `cd packages/backend && npx jest --no-coverage skill-management.service`

| Score | Criteria |
|-------|----------|
| 6 | All tests pass (including new loadEnabledSkills tests) |
| 3 | Existing tests pass, new tests partially pass |
| 1 | Existing tests pass, new tests fail |
| 0 | Test file broken or all fail |

Expected new tests:
- Mixed-enabled → only `enabled:true` returned
- All disabled → empty array
- Slug filter respected

---

## D2: Frontend Unit Tests (13 points)

Automated — run tests and score by pass/fail.

### Test 2.1: `useSkills.test.ts` (7 pts)

Run: `cd packages/react-sdk && npx vitest run useSkills`

| Score | Criteria |
|-------|----------|
| 7 | File exists AND all tests pass |
| 4 | File exists, some tests pass |
| 0 | File missing OR all tests fail |

Expected tests:
- fetchSkills populates skills on mount
- toggleSkill sends PATCH and updates local state
- toggleSkill re-throws on error
- searchQuery filters skills

### Test 2.2: `SkillPanel.test.tsx` — new tests (6 pts)

Run: `cd packages/chat-interface && npx vitest run SkillPanel`

| Score | Criteria |
|-------|----------|
| 6 | All tests pass (including 3 new toast tests) |
| 3 | Existing tests pass, 1-2 new tests pass |
| 1 | Existing tests pass, new tests fail |
| 0 | Test file broken |

Expected new tests:
- `toast.warning` when apiKey undefined
- `toast.success` after successful toggle
- `toast.error` when toggle rejects

---

## D3: Code Review Fixes (13 points)

Static analysis — grep and code inspection.

### Test 3.1: Guard decorator order fix (6 pts)

```bash
grep -B1 '@UseGuards(TenantGuard)' packages/backend/src/sessions/sessions.controller.ts
grep -B1 '@UseGuards(TenantGuard)' packages/backend/src/sessions/conversations-alias.controller.ts
```

| Score | Criteria |
|-------|----------|
| 6 | Both files: `@UseGuards(TenantGuard)` ABOVE `@OptionalAuth()` (correct) |
| 3 | One file fixed, one still wrong |
| 0 | Neither fixed |

### Test 3.2: Dead code removal (4 pts)

```bash
grep 'isOptionalAuth' packages/backend/src/skills/guards/skill-permission.guard.ts
```

| Score | Criteria |
|-------|----------|
| 4 | No matches — completely removed |
| 2 | Variable still exists but commented out |
| 0 | Dead variable still present |

### Test 3.3: Error detail in toast (3 pts)

```bash
grep -A2 'toast.error' packages/chat-interface/src/components/SkillPanel.tsx
```

| Score | Criteria |
|-------|----------|
| 3 | toast.error includes error detail (e.g., `err.message`) |
| 1 | toast.error exists but with fixed string only |
| 0 | No toast.error on toggle failure |

---

## D4: Skill Impact Verification (8 points)

Automated test proving `loadEnabledSkills()` filters correctly.

### Test 4.1: Filter logic test (8 pts)

Measured by `loadEnabledSkills` tests in D1 Test 1.2:

```bash
cd packages/backend && npx jest --no-coverage --verbose skill-management.service 2>&1 | grep -E 'loadEnabledSkills|enabled.*filter|disabled.*empty'
```

| Score | Criteria |
|-------|----------|
| 8 | Test proves `enabled:false` skills are excluded from result |
| 4 | Test exists but doesn't specifically verify filtering |
| 0 | No loadEnabledSkills test or test fails |

---

## D5: Auth-Gated Operations (13 points)

Browser E2E — requires frontend and backend running.

### Test 5.1: Anonymous toggle prevention (7 pts)
1. Clear `localStorage` → `localStorage.removeItem('ck-api-key')` → reload
2. Open SkillPanel
3. Click "停用" on any enabled skill
4. **Expected**: Warning/error feedback, no success toast, no API call

| Score | Criteria |
|-------|----------|
| 7 | "请先登录" message, no false success, no API call |
| 4 | Error shown but message generic |
| 2 | API 403 shown as raw error, no success toast |
| 0 | Success toast shown despite failure |

### Test 5.2: Authenticated toggle allowed (6 pts)
1. Login (admin/dev123), inject API key
2. Open SkillPanel, click "停用"
3. **Expected**: PATCH sent, 200 response, success toast after response

| Score | Criteria |
|-------|----------|
| 6 | PATCH with auth header, 200, toast after success |
| 3 | Toggle works but toast before response |
| 0 | Toggle fails with auth error |

---

## D6: Toggle E2E Flow (13 points)

Browser E2E — requires auth (from D5 Test 5.2).

### Test 6.1: Toggle disable (5 pts)
1. Find enabled skill, click "停用"
2. **Verify**: badge changes, toast correct

| Score | Criteria |
|-------|----------|
| 5 | Badge changes, toast shows correct skill name |
| 3 | Toggle works but toast wrong/missing |
| 0 | No visible change |

### Test 6.2: Toggle enable (4 pts)
1. Find disabled skill, click "启用"
2. **Verify**: reverse of 6.1

| Score | Criteria |
|-------|----------|
| 4 | Badge changes, toast correct |
| 2 | Toggle works but issues |
| 0 | No visible change |

### Test 6.3: State persistence (4 pts)
1. Toggle a skill, refresh page
2. Open SkillPanel again
3. **Verify**: toggle state persists

| Score | Criteria |
|-------|----------|
| 4 | After refresh, state persists |
| 2 | State persists but requires re-login |
| 0 | State resets |

---

## D7: Error Handling + Quality (15 points)

Mixed — code review + browser behavior.

### Test 7.1: Toast timing — no premature success (6 pts)

**Code verification** in SkillPanel.tsx:
- `toast.success` MUST appear inside try block after `await`
- NOT alongside async call without await

| Score | Criteria |
|-------|----------|
| 6 | All success toasts after await, inside try |
| 3 | Some fixed, some not |
| 0 | Any synchronous toast pattern remains |

### Test 7.2: Error feedback quality (5 pts)

1. Code review: toggleSkill errors → toast.error
2. Verify toast.error includes useful info

| Score | Criteria |
|-------|----------|
| 5 | toast.error with meaningful message |
| 3 | toast.error but raw HTTP error |
| 0 | No error feedback |

### Test 7.3: toggleSkill error propagation (4 pts)

```bash
grep -A2 'catch' packages/react-sdk/src/hooks/useSkills.ts
```

| Score | Criteria |
|-------|----------|
| 4 | toggleSkill re-throws (has `throw err` in catch) |
| 2 | Returns error state but doesn't re-throw |
| 0 | Errors silently swallowed |

---

## D8: Documentation Coverage (12 points)

Static analysis — verify documentation exists for new/changed features.

### Test 8.1: Toggle endpoint in gitbook REST docs (5 pts)

```bash
grep -i 'toggle\|PATCH.*skills.*toggle' docs/gitbook/en/api/rest.md
grep -i 'toggle\|PATCH.*skills.*toggle' docs/gitbook/zh/api/rest.md
```

| Score | Criteria |
|-------|----------|
| 5 | Both EN and ZH docs contain `PATCH /skills/:id/toggle` with description |
| 3 | Only one language documented |
| 1 | Toggle mentioned but no endpoint details |
| 0 | No toggle endpoint in gitbook docs |

### Test 8.2: SkillPanel component documentation (4 pts)

```bash
grep -A5 'SkillPanel.*[Pp]rop' packages/chat-interface/ARCHITECTURE.md
```

| Score | Criteria |
|-------|----------|
| 4 | SkillPanel has props table or description (serverUrl, tenantId, open, onClose, apiKey) |
| 2 | SkillPanel mentioned with partial props |
| 0 | No props documentation for SkillPanel |

### Test 8.3: loadEnabledSkills JSDoc (3 pts)

```bash
grep -B5 'async loadEnabledSkills' packages/backend/src/sessions/services/skill-management.service.ts
```

| Score | Criteria |
|-------|----------|
| 3 | JSDoc comment exists above method explaining filtering behavior |
| 1 | Simple one-line comment exists |
| 0 | No documentation on the method |

---

## Scoring Summary

| Dimension | Max | Category |
|-----------|-----|----------|
| D1: Backend Unit Tests | 13 | Automated |
| D2: Frontend Unit Tests | 13 | Automated |
| D3: Code Review Fixes | 13 | Static |
| D4: Skill Impact Verification | 8 | Automated |
| D5: Auth-Gated Operations | 13 | Browser E2E |
| D6: Toggle E2E Flow | 13 | Browser E2E |
| D7: Error Handling + Quality | 15 | Mixed |
| D8: Documentation Coverage | 12 | Static |
| **Total** | **100** | |

---

## Report Format

```
## Eval Report v{VERSION}

### Pre-Scoring Gates
- [ ] Gate 1: Backend auth — {PASS/FAIL}
- [ ] Gate 2: Frontend loads — {PASS/FAIL}
- [ ] Gate 3: SkillPanel accessible — {PASS/FAIL}

### D1: Backend Unit Tests ({score}/13)
- Test 1.1 skills.service.toggle: {score}/7 — {evidence}
- Test 1.2 skill-management.service: {score}/6 — {evidence}

### D2: Frontend Unit Tests ({score}/13)
- Test 2.1 useSkills: {score}/7 — {evidence}
- Test 2.2 SkillPanel: {score}/6 — {evidence}

### D3: Code Review Fixes ({score}/13)
- Test 3.1 Guard order: {score}/6 — {evidence}
- Test 3.2 Dead code: {score}/4 — {evidence}
- Test 3.3 Error detail: {score}/3 — {evidence}

### D4: Skill Impact Verification ({score}/8)
- Test 4.1 Filter logic: {score}/8 — {evidence}

### D5: Auth-Gated Operations ({score}/13)
- Test 5.1 Anonymous toggle: {score}/7 — {evidence}
- Test 5.2 Authenticated toggle: {score}/6 — {evidence}

### D6: Toggle E2E Flow ({score}/13)
- Test 6.1 Toggle disable: {score}/5 — {evidence}
- Test 6.2 Toggle enable: {score}/4 — {evidence}
- Test 6.3 State persistence: {score}/4 — {evidence}

### D7: Error Handling + Quality ({score}/15)
- Test 7.1 Toast timing: {score}/6 — {evidence}
- Test 7.2 Error feedback: {score}/5 — {evidence}
- Test 7.3 Error propagation: {score}/4 — {evidence}

### D8: Documentation Coverage ({score}/12)
- Test 8.1 Toggle in gitbook: {score}/5 — {evidence}
- Test 8.2 SkillPanel props: {score}/4 — {evidence}
- Test 8.3 loadEnabledSkills JSDoc: {score}/3 — {evidence}

### 总分: {TOTAL}/100
```
