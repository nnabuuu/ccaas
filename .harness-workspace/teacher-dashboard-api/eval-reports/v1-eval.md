## Evaluation Report: v1

### Test Results
- **Tests**: 46 passed, 0 failed, 1 suite
- **Build**: Compiles successfully (`npx nest build`)
- **Entity diff**: Clean — no `*.entity.ts` changes

---

### Per-Dimension Scores

#### D1: 字段完整性 (Weight: 25/100)
**Score: 2/5**
**Justification**:
- **G1 MISSING**: `byDimension` keys remain as code names (`q0`, `p0`, `place`, `position`, `correct`) — see `gradeQuiz()` line 574 (`q${a.questionIdx}`), `gradeMatch()` line 592 (`p${a.pairIdx}`), `gradeMatrix()` line 618-620 (`place`/`practice`/`reason`). Design expects human-readable names like `Q1 Edem`, `¶1-2→Phenomenon`, `Where`/`What`/`Why`.
- **G2 PRESENT**: `students[].submissions[step].duration` (line 275) and `aiRoundsCount` (line 276) correctly added.
- **G3 PRESENT**: `students[].status` field added (line 286) with `done/prog/stuck/reading` logic (lines 863-888).
- **G4 MISSING**: `stepMetrics[n].alertTag` is completely absent. Not declared in `buildStepMetrics()` return (lines 837-848). No `alertTag` string anywhere in the service file.
- **G5 MISSING**: `questionAggregates` does not exist anywhere in the service. The `isHigh` threshold change (from `>=3` to `>=4`) was not applied because the entire `questionAggregates` field is absent from v1.
- **G6 PRESENT**: `healthCards` object exists (lines 891-950) with `furthest`, `median`, `stuck`, `aiTotal` — correct structure.
- **G7 MISSING**: `stepMetrics[n].issues` array is completely absent. No issues generation logic exists in the service.

**Summary**: 3 of 7 gaps addressed (G2, G3, G6). 4 gaps missing (G1, G4, G5, G7).

**Suggestion**: Implement `alertTag` and `issues` in `buildStepMetrics()`. Add dimension name extraction from manifest `answerKey` labels. Add `questionAggregates` with `isHigh >= 4`.

---

#### D2: 计算正确性 (Weight: 25/100)
**Score: 3/5**
**Justification**:
- **Duration calculation** (lines 724-748): Correct — task1 uses `submittedAt - joinedAt`, taskN uses `submittedAt[N] - submittedAt[N-1]`. Negative durations filtered out (`if (dur >= 0)`). Good.
- **Stuck detection** (lines 878-885): Correct logic — `elapsed > median * 1.5` with null/zero median guard. However, threshold is only time-based; SPEC also says "没有新提交" but this is effectively covered since stuck only applies when no submission for current step exists.
- **HealthCards** (lines 891-950): `furthest` correctly finds max task + count; `median` correctly sorts and picks middle; `stuck` counts and finds concentration location. AI totals correct.
- **byDimension aggregation** (lines 784-821): Mathematically correct aggregation of good/partial/wrong percentages per dimension across students. Rounding via `Math.round()`.
- **Missing calculations**: No `alertTag` priority logic (stuck > wrong_dimension > issue). No issues common-error detection. No dimension name extraction from manifest.

**Suggestion**: The existing calculations are correct. The score is limited by the missing alertTag/issues computations rather than bugs in what's implemented.

---

#### D3: Issues 质量 (Weight: 20/100)
**Score: 1/5**
**Justification**:
- No `issues` field exists in `stepMetrics` output.
- No common wrong answer detection logic anywhere in the service.
- No comparison of student answers against `answerKey` to find repeated error patterns.
- Design expects strings like `"7 人将 Myanmar 与 Indonesia 合并"`, `"4 人 Practice 写 tattoos 而非 tā moko"`. None of this is implemented.
- No test coverage for issue generation (because the feature doesn't exist).

**Suggestion**: Add a `detectIssues(stepIdx, subsByStudent, manifest)` method that:
1. Collects all student `dataJson` for the step
2. Compares each answer against `answerKey` correct values
3. Groups identical wrong answers, filters for count >= 2
4. Generates human-readable descriptions per question type
5. Returns `string[]` sorted by occurrence count descending

---

#### D4: 测试覆盖 (Weight: 15/100)
**Score: 3/5**
**Justification**:
- **G2 tests**: Present — `should include duration and aiRoundsCount in student submissions (G2)` (line 997) checks `duration` type and `aiRoundsCount` value.
- **G3 tests**: Present — `should include student status field (G3)` (line 1011) and `should return done status for completed student` (line 1023).
- **G6 tests**: Present — `should include healthCards with correct structure (G6)` (line 1045) with precise assertions on `furthest.step=3`, `median.step=2`, `stuck.count=0`, `aiTotal`.
- **Missing**: No tests for G1 (byDimension human-readable keys), G4 (alertTag), G5 (questionAggregates isHigh), G7 (issues).
- **Boundary tests**: Empty classroom not explicitly tested. All-completed boundary tested (line 1023).
- **Assertion quality**: Mix of precise (`expect(x).toBe(2)`) and structural (`expect(typeof x).toBe('number')`) — the timing assertions are necessarily imprecise due to test execution timing. Acceptable.

**Suggestion**: Add tests for each missing gap. Also add an empty classroom test (0 students -> healthCards.furthest.step = 0, median.step = 0).

---

#### D5: 向后兼容 (Weight: 15/100)
**Score: 5/5**
**Justification**:
- All 46 tests pass (0 failures).
- No entity file changes (`git diff` clean on `*.entity.ts`).
- No controller changes detected.
- Existing fields (`metrics.total`, `metrics.submitted`, `students[].currentTask`, `students[].currentPhase`, `stepMetrics[n].completedCount`, etc.) preserved.
- New fields (`status`, `duration`, `aiRoundsCount`, `healthCards`) are purely additive.
- No new npm dependencies introduced.
- No `console.log` or `debugger` residuals.

---

### Penalty Deductions
| Trigger | Applies? | Deduction |
|---------|----------|-----------|
| Modified `*.entity.ts` | No | 0 |
| New npm dependency | No | 0 |
| `setTimeout`/`sleep` in tests | No | 0 |
| `any` type in new public interfaces | Yes — `Record<number, any>` return type for `buildStepMetrics` (line 763), `Record<number, any>` for stepMetrics in getState | -2 |
| `console.log`/`debugger` | No | 0 |

**Total penalties**: -2

---

### Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 字段完整性 | 2/5 | 10/25 |
| D2 计算正确性 | 3/5 | 15/25 |
| D3 Issues 质量 | 1/5 | 4/20 |
| D4 测试覆盖 | 3/5 | 9/15 |
| D5 向后兼容 | 5/5 | 15/15 |

**Penalties**: -2
**总分: 51/100**

---

### Bug Classification

| Issue | Classification | Impact |
|-------|---------------|--------|
| G1: byDimension keys are code names not human-readable | DESIGN | byDimension useless for teacher UI rendering |
| G4: alertTag missing entirely | COMPONENT | Step cards cannot show alerts |
| G5: questionAggregates missing entirely | COMPONENT | No high-frequency question detection |
| G7: issues array missing entirely | SYSTEM | Teacher cannot see common wrong answer patterns |
| `any` types in public aggregation methods | DESIGN | Type safety gap in new code |

---

### Actionable Fix Hints

1. **[Highest impact] Add `issues` to `buildStepMetrics()`** — `classroom.service.ts`: After line 847, add `issues: this.detectIssues(stepIdx, subsByStudent, manifest)`. Create `detectIssues()` that iterates student submissions for the step, compares `dataJson` answers against `answerKey`, groups identical wrong answers with count >= 2, and generates strings like `"N 人选了 X（应为 Y）"`. This unlocks both D3 (20 pts) and partial D1.

2. **[Second impact] Add `alertTag` to `buildStepMetrics()`** — `classroom.service.ts`: After computing `issues`, add `alertTag` with priority logic: (a) count students with `stuck` status at this step, if >= 5 -> `"${count} 人卡住"`; (b) check `byDimension` for any dimension with `wrong >= 30` -> `"${dimName} 错误偏高"`; (c) check issues for count >= 5 -> use that issue text. Return the first matching rule (priority order).

3. **[Third impact] Fix byDimension keys to human-readable names** — In `gradeQuiz()` (line 574), change `q${a.questionIdx}` to extract the label from `answerKey.answers[].label` or fall back to `Q${a.questionIdx + 1}`. Similarly for `gradeMatch()` (use pair labels), `gradeMatrix()` (use column headers from manifest), `gradeStance()`, `gradeOrder()`. This requires passing the manifest `readingSteps[].answerKey` into each grade method.

---

### What's Working Well

1. **Duration calculation logic** (`computeStudentDurations`, lines 711-754) — correctly handles task1 vs taskN timing, negative duration guards, and per-student per-step granularity. Do not change this.

2. **HealthCards structure** (`computeHealthCards`, lines 891-950) — clean implementation with correct furthest/median/stuck/aiTotal calculations. The stuck concentration detection (`stuckByTask` -> find max entry) is well-designed. Do not change this.
