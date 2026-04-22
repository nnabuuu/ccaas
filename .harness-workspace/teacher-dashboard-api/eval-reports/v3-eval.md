## Evaluation Report: v3

**Test run**: 67 passed, 0 failed | **Build**: clean | **Entity diff**: empty

### Per-Dimension Scores

#### D1: 字段完整性 (Weight: 25/100)
**Score: 4/5**

**Justification**:

All 7 gaps (G1–G7) addressed — same status as v2:

- **G1**: `quality.cols` (line 844–849) provides human-readable dimension names via `getDimensionNameMap()` (line 997–1026). `byDimension` (line 832–839) retains code-name keys (`q0`, `p0`, `place`). Rubric 5/5 requires byDimension keys to be readable — not satisfied literally, though `quality.cols` compensates with the design-expected format matching `teacher.html` STEPS data model.
- **G2**: `students[].submissions[step].duration` (line 291) + `aiRoundsCount` (line 292). ✓
- **G3**: `students[].status` (line 302) with done/prog/stuck/reading logic. ✓
- **G4**: `stepMetrics[n].alertTag` (line 259). ✓
- **G5**: `questionAggregates[].isHigh` threshold `count >= 4` (line 874). ✓
- **G6**: `healthCards` (line 265) with furthest/median/stuck/aiTotal. ✓
- **G7**: `stepMetrics[n].issues` (line 866–888) as `string[]`. ✓

**Minor issue**: `_nameMap` (line 890) leaks internal implementation detail into the API response. Should be computed locally in `computeAlertTag` rather than stored in the returned payload.

**Suggestion**: Same as v2 — either rename byDimension keys to readable names or document that `quality.cols` is canonical. Remove `_nameMap` from the response; pass it as a local parameter instead.

---

#### D2: 计算正确性 (Weight: 25/100)
**Score: 5/5**

**Justification**:

All calculations correct. The v2 alertTag code-name bug is **fixed**:

- **getDimensionNameMap** (line 997–1026): Correctly extracts labels from answerKey — quiz `a.label || Q{idx+1}`, match `a.left→a.correct || P{idx+1}`, matrix Where/What/Why, stance Position/Evidence, order Correct. ✓
- **Duration** (lines 747–763): task1 = submittedAt − joinedAt; taskN = submittedAt[N] − submittedAt[N−1]. Negative durations filtered. ✓
- **Stuck detection** (line 926): elapsed > median × 1.5. ✓
- **AlertTag priority** (lines 1139–1166): stuck ≥ 5 → wrong_dimension ≥ 30% → issue count ≥ 5. ✓
- **AlertTag now uses readable names** (line 1153–1155): `nameMap[dimName] || dimName` resolves code keys to `Q1`, `Where`, etc. Test at line 1531 verifies `'Q1 错误偏高'`. ✓ **← v2 bug fixed**
- **HealthCards** (lines 935–993): furthest (max task + count), median (sorted middle), stuck (count + concentrated location), aiTotal (rounds + unique people). ✓
- **Issues threshold** (line 1133): count ≥ 2 filter, descending sort. ✓
- **Division-by-zero guards**: `total > 0` (line 880), `completedCount > 0` (line 881), `durations.length > 0` (line 853), `totalRows > 0` (line 634). ✓

**Suggestion**: None — all calculations verified correct.

---

#### D3: Issues 质量 (Weight: 20/100)
**Score: 5/5**

**Justification**:

All 5 answer types handled in `detectIssues()` (lines 1029–1136):

| Type | Detection logic | Output format |
|------|---------------|---------------|
| quiz | Same wrong option per question | `"N 人Q1 选了 C（应为 B）"` |
| match | Same wrong pairing per pair | `"N 人P1 匹配为 wrongValue（应为 skimming）"` |
| matrix | Per-column wrong entry comparison | `"N 人Where 写 X 而非 Y"` |
| stance | Invalid position + insufficient evidence | `"N 人立场为 neutral（有效立场：agree/disagree）"` |
| order | Per-position wrong item | `"N 人位置 1 放了 X（应为 Y）"` |

- Sorted by count descending (line 1134). ✓
- Threshold ≥ 2 (line 1133). ✓
- Tests verify **2 types**: quiz (line 1184) and match (line 1488). ✓ **← v2 gap filled**

**Minor gap**: Matrix empty-answer detection skipped (`student &&` at line 1088 is falsy for empty strings). Design shows `"Why 列空缺率最高 (42%)"` — but this is arguably a dimension-level stat, not a common-error issue. Acceptable.

**Suggestion**: Consider adding empty-answer detection for matrix columns if the design requires it in the issues list.

---

#### D4: 测试覆盖 (Weight: 15/100)
**Score: 5/5**

**Justification**:

67 total tests (6 new in v3, building on 61 from v2). All G1–G7 have at least one test with precise assertions. New v3 tests fill the exact gaps flagged in v2 eval:

| Gap | Test | Line | New? |
|-----|------|------|------|
| G1 | quality.cols quiz default names | 1084 | v2 |
| G1 | quality.cols match default names | 1103 | v2 |
| G1 | quality.cols with labels from manifest | 1312 | v2 |
| G1 | matrix Where/What/Why names | 1381 | v2 |
| G2 | duration + aiRoundsCount per student | 997 | v2 |
| G3 | student status = reading | 1011 | v2 |
| G3 | student status = done | 1023 | v2 |
| **G3** | **stuck status (elapsed > median×1.5)** | **1427** | **v3** |
| **G3** | **prog status (within median×1.5)** | **1458** | **v3** |
| G4 | alertTag with wrong >= 30% | 1223 | v2 |
| G4 | alertTag null when OK | 1242 | v2 |
| **G4** | **alertTag uses Q1 not q0 (readable)** | **1519** | **v3** |
| **G4** | **alertTag uses Where/What/Why for matrix** | **1534** | **v3** |
| **G4** | **alertTag stuck priority over dimension** | **1554** | **v3** |
| G5 | isHigh = true at count 4 | 1258 | v2 |
| G5 | isHigh = false at count 3 | 1283 | v2 |
| G6 | healthCards full structure | 1045 | v2 |
| G7 | quiz issue detection count >= 2 | 1184 | v2 |
| G7 | exclude count < 2 | 1195 | v2 |
| G7 | sorted descending | 1204 | v2 |
| **G7** | **match issue detection** | **1488** | **v3** |
| edge | empty classroom | 1405 | v2 |
| compat | backward-compatible fields | 1069 | v2 |

**23 teacher-dashboard tests** with precise value assertions. Boundary cases covered (empty classroom, all correct, all wrong, stuck vs prog, single student, completed student). Tests use manually constructed data (no randomness) with exact expected values.

**Suggestion**: None — coverage is thorough.

---

#### D5: 向后兼容 (Weight: 15/100)
**Score: 5/5**

**Justification**:
- All 67 tests pass (0 failures). ✓
- `git diff HEAD -- '*.entity.ts'` is empty — no entity changes. ✓
- Controller not modified. ✓
- All existing return fields preserved — `byDimension` still present with code keys alongside new `quality.cols`. ✓
- No new runtime npm dependencies. ✓

---

### Penalty Deductions

| Condition | Check | Result |
|-----------|-------|--------|
| Modified *.entity.ts | git diff empty | No penalty |
| New npm dependency | None added | No penalty |
| setTimeout/sleep in tests | None found | No penalty |
| `any` in new public interface | `any` only in pre-existing patterns and private methods | No penalty |
| console.log / debugger | None found | No penalty |

---

### Score Summary

| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 字段完整性 | 4/5 | 20/25 |
| D2 计算正确性 | 5/5 | 25/25 |
| D3 Issues 质量 | 5/5 | 20/20 |
| D4 测试覆盖 | 5/5 | 15/15 |
| D5 向后兼容 | 5/5 | 15/15 |

**Penalties**: 0
**总分: 95/100**

---

### Delta from v2

| Dimension | v2 | v3 | Delta Weighted |
|-----------|----|----|------------|
| D1 | 4/5 | 4/5 | 0 |
| D2 | 3/5 | 5/5 | **+10** |
| D3 | 4/5 | 5/5 | **+4** |
| D4 | 4/5 | 5/5 | **+3** |
| D5 | 5/5 | 5/5 | 0 |
| **Total** | **78** | **95** | **+17** |

All 3 actionable fix hints from v2 eval were addressed:
1. alertTag now uses human-readable dimension names via `_nameMap` (+10)
2. Stuck status detection tested (+3)
3. Match issue detection tested (+4)

---

### Bug Classification

1. **[DESIGN]** byDimension keys remain as code names; quality.cols used as workaround (D1, -5 weighted). Inherited from v2, unchanged. This is a conscious backward-compatibility tradeoff, not a bug per se.
2. **[DESIGN]** `_nameMap` exposed in API response (D1, minor). Internal implementation detail leaks to consumers.

---

### Actionable Fix Hints

1. **[+5 points to 100/100]** `classroom.service.ts:890` — Remove `_nameMap` from stepMetrics response. Instead, pass nameMap as a local parameter to `computeAlertTag` (already receiving it from `metrics._nameMap`). Then rename byDimension keys using the nameMap before building the response at line 832-839. This would satisfy the D1 5/5 requirement that "byDimension keys are human-readable".

   Concrete approach:
   ```typescript
   // After building byDimension with code keys, remap:
   const readableByDimension: Record<string, any> = {};
   for (const [key, val] of Object.entries(byDimension)) {
     readableByDimension[nameMap[key] || key] = val;
   }
   ```
   Then use `readableByDimension` in the response instead of `byDimension`. This also lets you remove `_nameMap` from the response.

2. **[polish]** Remove `_nameMap` from the stepMetrics response object even without the byDimension key rename. It is an internal detail that should not be in the API contract.

---

### What's Working Well

1. **Dual byDimension + quality.cols approach** — Backward-compatible architecture that provides design-expected format alongside existing code-key structure. The v3 addition of `_nameMap` for alertTag resolution is pragmatic.

2. **Comprehensive issue detection** — `detectIssues()` handles all 5 question types with type-appropriate human-readable descriptions. The threshold (>= 2), sorting (descending by count), and format (`"N 人..."` prefix) all match the design prototype exactly.

3. **Test quality** — 23 teacher-dashboard tests use manually constructed data with precise value assertions. No `toBeDefined`-only checks. Boundary cases (empty classroom, stuck detection, all-correct vs all-wrong) are well-covered. The stuck test at line 1427 uses manual time manipulation rather than sleep/setTimeout — clean.
