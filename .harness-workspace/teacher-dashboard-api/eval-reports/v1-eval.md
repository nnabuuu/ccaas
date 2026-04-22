## Evaluation Report: v1 (re-evaluation after iteration)

### Test & Build Results

- **Tests**: 72 passed, 0 failed (1 suite)
- **Build**: `npx nest build` — success, no errors
- **Entity check**: `git diff HEAD -- *.entity.ts` — empty (no changes)

---

### Per-Dimension Scores

#### D1: 字段完整性 (Weight: 25/100)
**Score: 5/5**
**Justification**:

All 7 gaps are addressed:

| Gap | Status | Evidence |
|-----|--------|----------|
| G1: byDimension human-readable keys | PASS | `getDimensionNameMap()` at line 1066 maps `q0→Q1`, `p0→P1`, `place→Where`, etc. `buildStepMetrics()` at line 872 re-keys dimension aggregates using this map. |
| G2: per-student duration + aiRoundsCount | PASS | `computeStudentDurations()` at line 764 implements task1=submitted-joined, taskN=submitted[N]-submitted[N-1]. Enriched subs at line 290 include `duration` and `aiRoundsCount`. |
| G3: student status field | PASS | `computeStudentStatus()` at line 948 returns `done/reading/stuck/prog`. Status assigned at line 283 and returned in student object at line 338. |
| G4: alertTag | PASS | `computeAlertTag()` at line 1208 implements priority: stuck≥5 > dimension wrong≥30% > issue count≥5. Assigned at line 259. |
| G5: questionAggregates isHigh≥4 | PASS | Line 912: `questionAggregates[cat].isHigh = questionAggregates[cat].count >= 4`. Threshold is 4, matching spec. |
| G6: healthCards | PASS | `computeHealthCards()` at line 976 returns `{ furthest, median, stuck, aiTotal }`. Included in getState return at line 349. |
| G7: issues array | PASS | `detectIssues()` at line 1098 handles quiz/match/matrix/stance/order. Issues filtered at ≥2 occurrences, sorted descending (line 1201-1204). |

Additionally provides bonus fields beyond spec: `quality.cols` array format, `stepHistory` per-student, `name/desc` per step, formatted time strings.

**Suggestion**: None — all fields present and correctly structured.

---

#### D2: 计算正确性 (Weight: 25/100)
**Score: 5/5**
**Justification**:

- **Dimension name extraction** (line 1066-1095): Correctly reads `answerKey` structure — `quiz` uses `a.label || Q{idx+1}`, `match` uses `a.left→a.correct` or `P{idx+1}`, `matrix` hard-maps `place→Where/practice→What/reason→Why`, `stance→Position/Evidence`, `order→Correct`. Logic matches spec.

- **Duration calculation** (line 764-807): task1 uses `submittedAt - joinedAt`, subsequent tasks use `submittedAt[N] - submittedAt[N-1]`. Correctly iterates `taskSteps = [1,3,5,7,9]`. Guards against negative durations (`if (dur >= 0)`).

- **Stuck detection** (line 948-973): Checks `currentPhase === 'completed'` first, then `all 5 steps submitted`, then `listen→reading`, then `elapsed > median × 1.5`. Correct priority order.

- **AlertTag priority** (line 1208-1234): stuck≥5 checked first, then dimension wrong≥30%, then issue count≥5. Matches spec exactly.

- **HealthCards** (line 976-1035): `furthest` finds max task + count at that task, `median` sorts and takes middle value, `stuck` counts and finds concentration by task, `aiTotal` sums all questions. Division-by-zero safe (checks `sorted.length > 0`).

- **Issues common error detection** (line 1098-1204): Groups identical wrong answers, filters ≥2 occurrences, sorts descending. Correct for all 5 types.

Minor note: `byDimension` aggregation for matrix uses percentages (0-100) not booleans, and the `good/partial/wrong` bucketing at line 846-852 correctly handles both types. The `wrong >= 30` comparison in `computeAlertTag` (line 1223) works because `byDimension[name].wrong` is already a percentage (0-100) — this is correct.

**Suggestion**: None — calculations are mathematically sound and boundary cases handled.

---

#### D3: Issues 质量 (Weight: 20/100)
**Score: 5/5**
**Justification**:

`detectIssues()` (line 1098-1204) handles all 5 question types:

1. **quiz** (line 1116-1129): Compares each student answer against `a.correct`. Uses `a.label || Q{idx+1}` for human-readable description. Format: `"Q1 选了 C（应为 B）"`.

2. **match** (line 1131-1145): Handles both `pairs[]` string array and `{value}` object form. Uses `a.left || P{idx+1}`. Format: `"P1 匹配为 wrongValue（应为 skimming）"`.

3. **matrix** (line 1147-1164): Checks each column (`place/practice/reason`) per row. Uses `Where/What/Why` labels. Correctly filters `isDemo` rows. Format: `"Where 写 X 而非 Japan"`.

4. **stance** (line 1166-1181): Detects invalid positions and insufficient evidence. Format: `"立场为 neutral（有效立场：agree/disagree）"` and `"论据不足（仅 1 条，需 2 条）"`.

5. **order** (line 1183-1198): Per-position comparison. Handles both string and `{label}` object. Format: `"位置 1 放了 Body（应为 Introduction）"`.

All issues are:
- Filtered at `count >= 2` (line 1202)
- Sorted by count descending (line 1203)
- Prefixed with count: `"${count} 人${desc}"` (line 1204)
- Test coverage exists for quiz (lines 1160-1217) and match (lines 1486-1513) issue detection

**Suggestion**: Consider adding test cases for matrix/stance/order issue detection specifically, though the current coverage of 2 types meets the "at least 2" threshold.

---

#### D4: 测试覆盖 (Weight: 15/100)
**Score: 5/5**
**Justification**:

72 tests total, all passing. New test coverage by gap:

| Gap | Tests | Lines |
|-----|-------|-------|
| G1 | `quality.cols readable quiz` (1085), `readable match` (1104), `labeled manifest` (1311), `matrix Where/What/Why` (1380) | 4 tests |
| G2 | `duration and aiRoundsCount in submissions` (998) | 1 test |
| G3 | `student status field` (1012), `done status` (1024), `stuck detection` (1426), `prog within threshold` (1457) | 4 tests |
| G4 | `alertTag null` (1118), `wrong dim >= 30%` (1222), `null when no threshold` (1241), `readable names` (1517), `matrix dim names` (1533), `stuck priority` (1553) | 6 tests |
| G5 | `isHigh threshold` (1129), `isHigh=true when >=4` (1257), `isHigh=false when <4` (1282) | 3 tests |
| G6 | `healthCards structure` (1046) | 1 test |
| G7 | `issues array exists` (1145), `detect common wrong` (1183), `no count<2` (1194), `sort descending` (1203), `match issues` (1487) | 5 tests |

Boundary cases covered:
- Empty classroom (line 1404): 0 students
- Completed student: all 5 tasks done (line 1024)
- Stuck vs prog comparison (lines 1426, 1457)
- Priority ordering in alertTag (line 1553)

Tests use precisely constructed inputs and precise assertions (e.g., `expect(task1.byDimension['Q1'].good).toBe(50)` at line 960, not `toBeDefined()`).

**Suggestion**: None — excellent coverage with precise assertions.

---

#### D5: 向后兼容 (Weight: 15/100)
**Score: 5/5**
**Justification**:

- All 72 tests pass (0 failures)
- `git diff HEAD -- *.entity.ts` — no entity changes
- Controller was not modified (only `classroom.service.ts` and `classroom.service.spec.ts`)
- Existing test block `ClassroomService — persistence` (lines 128-335) passes unchanged, verifying:
  - `submissions[1].score` still has `{ total: 100, byDimension: { q0: true, q1: true } }` (line 240) — note: the *stored* score still uses code keys (`q0`), only the *aggregated* `stepMetrics.byDimension` uses human-readable keys. This is correct: storage is unchanged, display layer transforms.
- `test('should preserve existing stepMetrics fields unchanged')` at line 1070 explicitly verifies backward compatibility of `completedCount`, `currentCount`, `completionRate`, `avgScore`.
- No deleted or renamed fields in getState return.

**Suggestion**: None — clean backward compatibility.

---

### Penalty Deductions

| Rule | Check | Result |
|------|-------|--------|
| Modified *.entity.ts | `git diff` | PASS — no changes |
| New npm dependency | package.json diff | PASS — not modified in this iteration |
| setTimeout/sleep in tests | grep test file | PASS — uses promise-based waits only |
| `any` type in public interface | getState return type | Minor: `Record<number, Record<string, any>>` for stepMetrics, but this is internal service code, not a public API interface. No penalty — follows existing patterns. |
| console.log/debugger | grep service file | PASS — only `this.logger` used |

**Penalties: 0**

---

### D6: 前端渲染质量 (Penalty: max -10)

**Visual QA report**: File `tests/visual-qa-report.txt` does not exist. Only `tests/visual-qa.sh` exists (script not executed). **Result: SKIP — no penalty.**

**Manual CSS verification**:

1. **`.stu-root` color**: Line 4 of `student.css` — `.stu-root{...color:var(--t1)...}` — explicitly sets color. PASS.
2. **`.stu-join-card` color**: Line 156 of `student.css` — `.stu-join-card{...color:var(--t1)}` — explicitly sets color. PASS.
3. **`body` color**: Line 14 of `index.css` — `body { color: #ececef }` — this is a light color on dark background (`#0a0a0b`). But `.stu-root` and `.stu-join-card` override with `var(--t1)`, so no leakage into student surface.
4. **Teacher root**: Would need to check `.teacher-root` — not in these CSS files. Cannot fully verify without teacher CSS file.

**D6 penalty: 0** (visual QA SKIP, CSS manually verified clean for student surfaces)

---

### Score Summary

| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 字段完整性 | 5/5 | 25/25 |
| D2 计算正确性 | 5/5 | 25/25 |
| D3 Issues 质量 | 5/5 | 20/20 |
| D4 测试覆盖 | 5/5 | 15/15 |
| D5 向后兼容 | 5/5 | 15/15 |
| D6 渲染质量 | penalty | -0 |

**Penalties**: -0
**总分: 100/100**

---

### Bug Classification

No bugs found. All dimensions score 5/5.

---

### Actionable Fix Hints

1. **Matrix/stance/order issue tests** (low priority): While quiz and match issue detection have dedicated tests, matrix/stance/order types are only tested via the generic `issues` array check at line 1145. Consider adding dedicated test blocks for these types to catch regressions. Not a scoring deduction.

2. **Visual QA execution**: The `visual-qa.sh` script exists but was never run. In future iterations, execute it to generate `visual-qa-report.txt` and catch any CSS regressions. Infrastructure improvement, not a code issue.

3. **Type safety**: The `stepMetrics` return type is `Record<number, Record<string, any>>`. Consider defining an interface for the step metrics shape to catch field name typos at compile time. Nice-to-have, no scoring impact.

---

### What's Working Well

1. **Clean separation of concerns**: Each gap (G1-G7) has its own private helper method (`getDimensionNameMap`, `computeStudentDurations`, `computeStudentStatus`, `computeAlertTag`, `computeHealthCards`, `detectIssues`). This makes the code reviewable and testable.

2. **Backward-compatible enrichment pattern**: New fields (`status`, `duration`, `aiRoundsCount`, `stepHistory`, `healthCards`) are additive — existing `submissions[step].score` remains unchanged in storage, and existing `stepMetrics` fields (`completedCount`, `currentCount`, etc.) are preserved. The explicit backward-compat test at line 1070 is a strong practice.
