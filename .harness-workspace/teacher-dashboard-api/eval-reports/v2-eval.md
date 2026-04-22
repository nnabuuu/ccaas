## Evaluation Report: v2

**Test run**: 61 passed, 0 failed | **Build**: clean | **Entity diff**: empty

### Per-Dimension Scores

#### D1: 字段完整性 (Weight: 25/100)
**Score: 4/5**

**Justification**:

All 7 gaps addressed:
- **G1**: `quality.cols` (line 844-849) provides human-readable dimension names via `getDimensionNameMap()` (line 996-1025). However, `byDimension` (line 832-839) retains code-name keys (`q0`, `p0`, `place`) for backward compatibility. Eval criteria requires byDimension keys to be readable — not satisfied literally, though `quality.cols` compensates with the design-expected format.
- **G2**: `students[].submissions[step].duration` (line 291) and `aiRoundsCount` (line 292) present. ✓
- **G3**: `students[].status` (line 302) with done/prog/stuck/reading logic. ✓
- **G4**: `stepMetrics[n].alertTag` (line 259) present. ✓
- **G5**: `questionAggregates[].isHigh` threshold at `count >= 4` (line 874). ✓
- **G6**: `healthCards` object (line 265) with furthest/median/stuck/aiTotal. ✓
- **G7**: `stepMetrics[n].issues` (line 866-888) present as `string[]`. ✓

**Suggestion**: Either rename `byDimension` keys to use human-readable names (breaking change) or document that `quality.cols` is the canonical source for display. The current dual-structure is pragmatic but confusing — two representations of the same data.

---

#### D2: 计算正确性 (Weight: 25/100)
**Score: 3/5**

**Justification**:

Most calculations correct:
- Duration: task1 = submittedAt - joinedAt, taskN = submittedAt[N] - submittedAt[N-1] (lines 747-763). ✓
- Stuck detection: elapsed > median × 1.5 (line 926). ✓
- HealthCards: furthest/median/stuck/aiTotal all correct (lines 934-993). ✓
- Issues: count >= 2 threshold, sorted descending (lines 1131-1134). ✓
- getDimensionNameMap: correctly extracts labels from answerKey (lines 996-1025). ✓

**Bug — alertTag uses code-name dimensions**:
Line 1152-1153:
```typescript
for (const [dimName, dim] of Object.entries(byDim)) {
  if (dim.wrong >= 30) return `${dimName} 错误偏高`;
}
```
`byDim` is `metrics.byDimension` which uses code keys (`q0`, `place`, `reason`). The design prototype shows `alertTag:'Why 错误偏高'` (teacher.html STEPS[2]), but the API would return `reason 错误偏高`. For quiz, it would return `q0 错误偏高` instead of `Q1 Edem 错误偏高`.

The `getDimensionNameMap` method exists but is only used for `quality.cols`, not for alertTag generation. The fix is to apply the nameMap lookup inside `computeAlertTag`.

**Suggestion**: In `computeAlertTag`, resolve the nameMap from the step's answerKey and use `nameMap[dimName] || dimName` instead of raw `dimName`. Approximately 3 lines to fix.

---

#### D3: Issues 质量 (Weight: 20/100)
**Score: 4/5**

**Justification**:

All 5 answer types handled in `detectIssues()` (lines 1028-1135):
- **quiz**: "N 人Q1 选了 C（应为 B）" — uses label from answerKey. ✓
- **match**: "N 人¶1-2 匹配为 X（应为 Phenomenon）" — uses left field. ✓
- **matrix**: "N 人Where 写 X 而非 Y" — per-column comparison. ✓
- **stance**: "立场为 X（有效立场：agree/disagree）" + "论据不足" — both patterns. ✓
- **order**: "位置 N 放了 X（应为 Y）" — per-position. ✓

Sorted by count descending (line 1133). Threshold >= 2 (line 1132). Human-readable descriptions. ✓

**Gap**: Tests only verify quiz-type issue generation (describe at line 1161). No test for match/matrix/stance/order issues. Rubric requires "测试验证至少 2 种题型的 issue 生成" for 5/5.

**Suggestion**: Add at least one test for match or matrix issue detection with precisely constructed wrong answers.

---

#### D4: 测试覆盖 (Weight: 15/100)
**Score: 4/5**

**Justification**:

New test cases covering teacher dashboard (lines 918-1420):

| Gap | Test | Line |
|-----|------|------|
| G1 | quality.cols quiz default names | 1084 |
| G1 | quality.cols match default names | 1103 |
| G1 | quality.cols with labels from manifest | 1312 |
| G1 | matrix Where/What/Why names | 1381 |
| G2 | duration + aiRoundsCount per student | 997 |
| G3 | student status = reading | 1011 |
| G3 | student status = done (completed all) | 1023 |
| G4 | alertTag with wrong >= 30% | 1223 |
| G4 | alertTag null when OK | 1242 |
| G5 | isHigh = true at count 4 | 1258 |
| G5 | isHigh = false at count 3 | 1283 |
| G6 | healthCards full structure | 1045 |
| G7 | quiz issue detection count >= 2 | 1184 |
| G7 | exclude count < 2 | 1195 |
| G7 | sorted descending | 1204 |
| edge | empty classroom | 1405 |
| compat | backward-compatible fields | 1069 |

**17 new tests**, all with precise value assertions (not just `toBeDefined`).

**Missing**:
- No test for `stuck` status (G3 only tests reading/done)
- No test for `prog` status explicitly
- No test for alertTag stuck priority (>= 5 stuck students)
- No test for match/matrix/stance/order issues (only quiz)

**Suggestion**: Add a test that manipulates `stepStartedAt` to trigger stuck detection, and at least one non-quiz issue detection test.

---

#### D5: 向后兼容 (Weight: 15/100)
**Score: 5/5**

**Justification**:
- All 61 tests pass (0 failures). ✓
- `git diff HEAD -- '*.entity.ts'` is empty — no entity changes. ✓
- Controller not modified. ✓
- All existing return fields preserved — `byDimension` still present with code keys, `quality` added alongside (not replacing). ✓
- New devDependencies added (`@nestjs/testing`, `@types/jest`, `jest`, `ts-jest`) are test infrastructure only — no runtime dependency changes. ✓

---

### Penalty Deductions

| Condition | Check | Result |
|-----------|-------|--------|
| Modified *.entity.ts | git diff empty | No penalty |
| New npm dependency | Only devDeps for test infra | No penalty |
| setTimeout/sleep in tests | Comment only, no actual usage | No penalty |
| `any` in new public interface | `any` in private methods / pre-existing only | No penalty |
| console.log / debugger | None found | No penalty |

---

### Score Summary

| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 字段完整性 | 4/5 | 20/25 |
| D2 计算正确性 | 3/5 | 15/25 |
| D3 Issues 质量 | 4/5 | 16/20 |
| D4 测试覆盖 | 4/5 | 12/15 |
| D5 向后兼容 | 5/5 | 15/15 |

**Penalties**: 0
**总分: 78/100**

---

### Bug Classification

1. **[SYSTEM]** alertTag uses code-name dimension keys instead of human-readable names (D2, -10 weighted)
2. **[DESIGN]** byDimension keys remain as code names; quality.cols used as workaround (D1, -5 weighted)
3. **[SYSTEM]** No test for stuck status detection (D4, -3 weighted)
4. **[SYSTEM]** Issues tests only cover quiz type (D3/D4, -4+3 weighted)

### Actionable Fix Hints

1. **[Most impactful — +10 points]** `classroom.service.ts:1138-1164` — In `computeAlertTag`, the `byDimension` keys are code names. Fix: pass the step's `answerKey` (or the already-computed `nameMap`) into `computeAlertTag` and use `nameMap[dimName] || dimName` at line 1153 when building the alertTag string. Also update the `buildStepMetrics` call at line 258-262 to pass the nameMap.

2. **[+4 points]** `classroom.service.spec.ts` — Add a test for stuck status: create a student, set `stepStartedAt` to a time far in the past (e.g., `new Date(Date.now() - 999999).toISOString()`), ensure the step has a medianTime, then verify `status === 'stuck'`.

3. **[+4 points]** `classroom.service.spec.ts` — Add a test for match or matrix issue detection: submit 2+ students with identical wrong answers for a match step (idx=3) and verify the issues array contains the expected description.

### What's Working Well

1. **Dual byDimension + quality.cols approach** — Preserves backward compatibility perfectly while providing the design-expected format. This was a smart architectural decision that deserves preservation.

2. **Issues detection across all 5 types** — The `detectIssues` method (lines 1028-1135) handles quiz/match/matrix/stance/order comprehensively with type-appropriate error descriptions. The sorted-by-severity output and >= 2 count threshold match the design intent well.
