# Evaluation Report: v1

## Per-Dimension Scores

### D1: TypeScript 编译正确性 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**harness errors**: 0
**demo errors**: 0
**Justification**: Both `packages/harness` and `solutions/mock/harness-demo` compile cleanly with `tsc --noEmit`. Zero type errors. Harness uses `strict: true` with `NodeNext` module resolution. Demo uses standard NestJS CommonJS config.
**Suggestion**: None — compilation is clean.

### D2: 架构模式对齐 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**Checklist**:
- ✅ Three-layer directories: `core/` (8 files), `nestjs/` (4 files), `client/` (3 files)
- ✅ `HarnessModule.forRoot(options)` returns `DynamicModule` (`harness.module.ts:18`)
- ✅ exports map: `[".","./core","./nestjs","./client"]` — all 4 entries with `types` + `default`
- ✅ core isolation: 0 `@nestjs` imports in `core/`, 0 `@kedge-agentic/backend` imports anywhere
- ✅ ESM convention: 0 relative imports missing `.js` suffix; all 4 barrel `index.ts` files present
**Justification**: Perfect alignment with the three-layer architecture. NestJS deps are optional `peerDependencies`, enabling core-only usage.
**Suggestion**: None — architecture is clean.

### D3: 核心编排逻辑 (Weight: 25/100)
**Score: 4/5** → 20/25 points
**Sub-checks**:
- ✅ **Orchestrator loop**: `startRun()` → `runLoop()` (for-loop `i=1..maxIterations`) → execute steps → `shouldExit()` → `finalizeRun()` with summary. Error handling wraps async loop, sets `status: 'failed'`.
- ✅ **AgentStep execution** (`orchestrator.ts:251-327`): `assembleContext()` → `createSession()` → `sendMessage()` → `waitForCompletion()` → check RunStore for callback data → fallback to `extractOutput()`. Complete and correct.
- ✅ **AsyncMcpStep execution** (`orchestrator.ts:329-387`): `callTool(step.mcpTool, {context})` → `pollUntilComplete(mcpClient, pollTool, pollArgs, scheduling)` → save result. Configurable `pollMcpTool` with fallback to `tool:status`.
- ❌ **Exit conditions** (`exit-evaluator.ts`): `maxIterations` ✅ and `scoreThreshold` ✅ are correct. **`minImprovement` is partially wrong**: code exits after a single round of insufficient improvement (`exit-evaluator.ts:28-36`), but should require 2 consecutive rounds below threshold before exiting. Current implementation would prematurely halt a run that had one anomalously low-improvement iteration.
- ✅ **Context assembly** (`context-assembler.ts`): All 6 `ContextSource` types handled: `spec` (L23-29), `prev_output` (L33-47), `progress` (L50-59), `latest_artifact` (L62-69), `entity_ref` (L72-76), `step_output` (L78-93).

**Justification**: Core logic is well-structured. The only gap is `exit-evaluator.ts:28-36`: checks `completedIterations.length >= 2` and compares only the last two scores. Per spec, `minImprovement` should trigger exit only when improvement is insufficient for 2 consecutive rounds (i.e., 3 scored iterations needed, last 2 deltas both below threshold).
**Suggestion**: Fix `exit-evaluator.ts` to track 2 consecutive low-improvement rounds:
```typescript
if (conditions.minImprovement != null && completedIterations.length >= 3) {
  const curr = completedIterations[completedIterations.length - 1].score!;
  const prev = completedIterations[completedIterations.length - 2].score!;
  const prevPrev = completedIterations[completedIterations.length - 3].score!;
  if ((prev - prevPrev) < conditions.minImprovement && (curr - prev) < conditions.minImprovement) {
    return { exit: true, reason: `2 consecutive improvements below ${conditions.minImprovement}` };
  }
}
```

### D4: REST API 完整性 (Weight: 15/100)
**Score: 4/5** → 12/15 points
**Endpoints**: 12/14 present
**Present**:
1. ✅ `POST /harness/tasks` — registerTask (`harness.controller.ts:19`)
2. ✅ `GET /harness/tasks` — listTasks (`harness.controller.ts:25`)
3. ✅ `GET /harness/tasks/:taskId` — getTask (`harness.controller.ts:30`)
4. ✅ `POST /harness/runs` — startRun (`harness.controller.ts:46`)
5. ✅ `GET /harness/runs` — listRuns (`harness.controller.ts:53`)
6. ✅ `GET /harness/runs/:runId` — getRun (`harness.controller.ts:61`)
7. ✅ `GET /harness/runs/:runId/progress` — getProgress (`harness.controller.ts:68`)
8. ✅ `POST /harness/runs/:runId/stop` — stopRun (`harness.controller.ts:94`)
9. ✅ `POST /harness/runs/:runId/resume` — resumeRun (`harness.controller.ts:99`)
10. ✅ `GET /harness/runs/:runId/iterations/:n` — getIteration (`harness.controller.ts:106`)
11. ✅ `GET /harness/runs/:runId/iterations/:n/outputs` — getIterationOutputs (`harness.controller.ts:121`)
12. ✅ `POST /harness/callback/output` — submitOutput (`harness.controller.ts:145`)

**Missing**:
13. ❌ `POST /harness/output-schemas` — registerOutputSchema (not implemented; schemas embedded in task)
14. ❌ `GET /harness/output-schemas` — listOutputSchemas (replaced with `GET /tasks/:taskId/output-schemas`)

**Extra**: `DELETE /harness/tasks/:taskId` (not in spec, bonus)

**Justification**: 12/14 = 86% coverage. Output schemas are handled as part of task registration rather than standalone resources. The per-task `GET /tasks/:taskId/output-schemas` partially covers the read use case but misses global registration/listing.
**Suggestion**: Add `POST /harness/output-schemas` (global registry) and `GET /harness/output-schemas` (list all). Create `OutputSchemaRegistry` in core.

### D5: Mock Demo 生命周期 (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Scenarios**:
- ✅ **Iterative** (`demo-doc-optimization`): 5 iterations → scores [60, 68, 75, 82, 88] → auto-exit on maxIterations. Progress endpoint shows full score trajectory.
- ✅ **Single-shot** (`demo-single-analysis`): 1 iteration → status=completed. `maxIterations: 1` forces single pass.
- ✅ **AsyncMcpStep** (`demo-simulation-iteration`): 3 iterations, each running `plan(agent)` → `simulate(async_mcp)` → `evaluate-sim(agent)`. MockMcpClient: poll 1 returns pending, poll 2 returns completed. Scores [60, 68, 75].

**Extra checks**:
- ✅ MockSessionProvider calls `POST /harness/callback/output` for both generator and evaluator outputs (+0.5)
- ⚠️ Stop/Resume: endpoints exist and logic is correct in code review, not tested in live run

**Justification**: All 3 required scenarios pass end-to-end. Demo seeds 3 tasks via `MockSetupService.onModuleInit()`. MockSessionProvider simulates realistic delay (500-1000ms), incremental score progression. MockMcpClient simulates 2-poll async completion. Callback mechanism confirmed working (`{"ok":true}`).
**Suggestion**: Add a stop/resume test scenario. Consider adding a demo task with plateauing scores to exercise minImprovement exit path.

### D6: 测试覆盖 (Weight: 10/100)
**Score: 1/5** → 2/10 points
**Components with tests**: None
**Justification**: Zero test files exist (`*.spec.ts` or `*.test.ts`). No jest configuration. `package.json` defines `"test": "jest --no-coverage"` but `jest` is not in dependencies — running `npm test` fails. No unit tests for any component: TaskRegistry, ExitEvaluator, OutputExtractor, AsyncPoller, Orchestrator.
**Suggestion**: At minimum, add:
1. `exit-evaluator.spec.ts` — test all 3 exit conditions and edge cases
2. `output-extractor.spec.ts` — test JSON parsing, markdown code block extraction, schema validation
3. `task-registry.spec.ts` — test register/get/list/remove
4. `async-poller.spec.ts` — test poll success, timeout, completion condition parsing
5. `orchestrator.spec.ts` — integration test with mock providers

## Penalty Deductions
- **P1**: core/ imports @nestjs → 0 matches → No penalty
- **P2**: harness imports @kedge-agentic/backend → 0 matches → No penalty
- **P3**: tsc errors > 20 → 0 errors → No penalty
- **P4**: moduleResolution = `NodeNext` ✅ → No penalty
- **P5**: missing .js suffix → 0 occurrences → No penalty
- **P6**: Controller has `@ApiTags('harness')` at `harness.controller.ts:8` ✅ → No penalty

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 | 5/5 | 15/15 |
| D2 | 5/5 | 15/15 |
| D3 | 4/5 | 20/25 |
| D4 | 4/5 | 12/15 |
| D5 | 5/5 | 20/20 |
| D6 | 1/5 | 2/10 |

**Penalties**: -0
**总分: 84/100**

## Bug Classification
For each deduction:
- **[COMPONENT]** — Generator 可修: `packages/harness/src/core/exit-evaluator.ts:28` — 期望: minImprovement 连续 2 轮低于阈值才退出 — 修复: 检查最近 2 轮 delta 均低于 minImprovement（需 ≥3 个已评分迭代）
- **[COMPONENT]** — Generator 可修: `packages/harness/src/nestjs/harness.controller.ts` — 期望: 有独立的 `POST /harness/output-schemas` 和 `GET /harness/output-schemas` 端点 — 修复: 添加 OutputSchemaRegistry + 两个新端点
- **[COMPONENT]** — Generator 可修: `packages/harness/` — 期望: 至少 5 个核心组件有单元测试 — 修复: 安装 jest + ts-jest，创建 5 个测试文件
- **[DESIGN]** — 需要人工决策: Output schema 架构 — 当前 schema 嵌入 HarnessTask，spec 期望独立注册。决策：保留嵌入式（更简单）还是添加全局注册表（支持跨任务复用）？

## Actionable Fix Hints
For each [COMPONENT] bug:
1. File: `packages/harness/src/core/exit-evaluator.ts:28` — Problem: exits after 1 round of insufficient improvement — Fix: change `completedIterations.length >= 2` to `>= 3`, compare last 2 deltas, only exit if both below threshold
2. File: `packages/harness/src/nestjs/harness.controller.ts` — Problem: missing `POST /harness/output-schemas` and `GET /harness/output-schemas` — Fix: add `OutputSchemaRegistry` to core, add 2 controller methods
3. File: `packages/harness/package.json` — Problem: no test infrastructure — Fix: add `jest`, `ts-jest`, `@types/jest` to devDependencies, create `jest.config.ts` with `moduleNameMapper` for `.js` → `.ts`

## Top 3 Priority Fixes
1. **[D6 — +8 pts]** Add unit tests for all 5 core components. Install jest + ts-jest. Write `exit-evaluator.spec.ts`, `output-extractor.spec.ts`, `task-registry.spec.ts`, `async-poller.spec.ts`, `orchestrator.spec.ts`. This is the single largest point gain (2→10).
2. **[D3 — +5 pts]** Fix `packages/harness/src/core/exit-evaluator.ts:28` minImprovement to require 2 consecutive rounds of low improvement. Currently exits prematurely after 1 round. Change threshold from `>= 2` to `>= 3` scored iterations and check both deltas.
3. **[D4 — +3 pts]** Add `POST /harness/output-schemas` and `GET /harness/output-schemas` to `harness.controller.ts`. Create `OutputSchemaRegistry` in `packages/harness/src/core/` to store schemas independently from tasks.

## What's Working Well
1. **Clean three-layer architecture with perfect core isolation** — The `core/` layer has zero framework imports, making it testable and portable. The `forRoot()` pattern with provider injection is textbook NestJS module design. Package exports map is correctly configured. Do NOT change this.
2. **Complete mock demo with realistic lifecycle simulation** — All 3 task types (iterative, single-shot, async_mcp) work end-to-end. MockSessionProvider correctly uses callback endpoints, score progression is realistic, and MockMcpClient simulates real poll behavior with 2-poll completion. This is a high-quality demo.
