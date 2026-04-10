# Evaluation Report: v2

## Per-Dimension Scores

### D1: TypeScript 编译正确性 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**harness errors**: 0
**demo errors**: 0
**Justification**: Both `packages/harness` and `solutions/mock/harness-demo` compile cleanly with `tsc --noEmit`. Zero type errors.
**Suggestion**: None — clean compilation across both packages.

### D2: 架构模式对齐 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**Checklist**:
- ✅ Three-layer directories: `core/`, `nestjs/`, `client/` all exist with proper contents
- ✅ forRoot pattern: `HarnessModule.forRoot(options: HarnessModuleOptions): DynamicModule` present at `harness.module.ts:19`
- ✅ exports map: `[".","./core","./nestjs","./client"]` — all 4 required entries
- ✅ core isolation: 0 `@nestjs` imports in `core/`, 0 `@kedge-agentic/backend` imports anywhere
- ✅ ESM convention: 0 missing `.js` suffix violations; all 4 barrel `index.ts` files present (`src/`, `src/core/`, `src/nestjs/`, `src/client/`)
**Justification**: Full compliance with all 5 architecture checks. `tsconfig.json` uses `moduleResolution: "NodeNext"` and `module: "NodeNext"` correctly.
**Suggestion**: None — architecture is clean.

### D3: 核心编排逻辑 (Weight: 25/100)
**Score: 5/5** → 25/25 points
**Sub-checks**:
- ✅ **Orchestrator iteration loop**: `startRun()` creates run → `runLoop()` iterates `for (i = start; i <= maxIterations; i++)` → checks `shouldExit()` after each iteration → `finalizeRun()` with summary (score trajectory, best iteration, exit reason). Error in loop caught by `.catch()` on the async call, updates run to `failed`.
- ✅ **AgentStep execution**: `executeAgentStep()` at `orchestrator.ts:251` — finds agent config by role → `sessionProvider.createSession()` → `assembleContext()` → `sendMessage()` → `waitForCompletion()` → checks runStore for callback data first (lines 292-298) → falls back to `extractOutput()` from session text (lines 301-302). Correct priority chain.
- ✅ **AsyncMcpStep execution**: `executeAsyncMcpStep()` at `orchestrator.ts:329` — `assembleContext()` → `mcpClient.callTool(step.mcpTool, {context})` → derives pollTool from `step.scheduling.pollMcpTool ?? step.mcpTool + ':status'` → `pollUntilComplete()` with configurable interval, timeout, and completion condition → saves result to runStore.
- ✅ **Exit conditions**: `exit-evaluator.ts` checks in order: (1) `maxIterations` reached (line 10), (2) `scoreThreshold` met (line 23), (3) `minImprovement` insufficient for 2 consecutive rounds requiring 3+ scored iterations (line 28-39). All 3 conditions implemented correctly.
- ✅ **Context assembly**: `context-assembler.ts` handles all 6 `ContextSource` types: `spec` (line 23-29), `prev_output` (line 32-47), `progress` (line 50-59), `latest_artifact` (line 62-69), `entity_ref` (line 72-75), `step_output` (line 78-92). Correctly distinguishes `step.contextSources` (agent) vs `step.inputSources` (async_mcp) at line 17.

**Justification**: All 5 sub-components implemented correctly. The orchestrator properly separates AgentStep and AsyncMcpStep execution paths. Step failure is caught and breaks the current iteration without crashing the run (lines 163-176). The `extractScore()` helper (line 389) searches step outputs for `score` or `totalScore` fields to feed exit evaluation.
**Suggestion**: Consider logging the exit reason when `shouldExit` returns true — useful for debugging in production.

### D4: REST API 完整性 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**Endpoints**: 14/14 present (plus 2 bonus endpoints)
| # | Endpoint | Status |
|---|----------|--------|
| 1 | `POST /harness/tasks` | ✅ `registerTask` (line 21) |
| 2 | `GET /harness/tasks` | ✅ `listTasks` (line 27) |
| 3 | `GET /harness/tasks/:id` | ✅ `getTask` (line 32) |
| 4 | `POST /harness/runs` | ✅ `startRun` (line 48) |
| 5 | `GET /harness/runs` | ✅ `listRuns` (line 55) |
| 6 | `GET /harness/runs/:id` | ✅ `getRun` (line 63) |
| 7 | `GET /harness/runs/:id/progress` | ✅ `getProgress` (line 70) |
| 8 | `POST /harness/runs/:id/stop` | ✅ `stopRun` (line 96) |
| 9 | `POST /harness/runs/:id/resume` | ✅ `resumeRun` (line 101) |
| 10 | `GET /harness/runs/:id/iterations/:n` | ✅ `getIteration` (line 108) |
| 11 | `GET /harness/runs/:id/iterations/:n/outputs` | ✅ `getIterationOutputs` (line 123) |
| 12 | `POST /harness/callback/output` | ✅ `submitOutput` (line 147) |
| 13 | `POST /harness/output-schemas` | ✅ `registerOutputSchema` (line 179) |
| 14 | `GET /harness/output-schemas` | ✅ `listOutputSchemas` (line 185) |
| Bonus | `DELETE /harness/tasks/:id` | ✅ `deleteTask` (line 39) |
| Bonus | `GET /harness/tasks/:id/output-schemas` | ✅ `getTaskOutputSchemas` (line 170) |

**Missing**: None
**Justification**: All 14 required endpoints are implemented with proper HTTP methods, path parameters, and return types. Endpoints include appropriate 404 handling via `HttpException`. The `@ApiTags('harness')` decorator is present.
**Suggestion**: Consider adding DTO validation decorators (class-validator) for request bodies — currently accepts raw types without runtime validation.

### D5: Mock Demo 生命周期 (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Scenarios**:
- ✅ **Iterative** (`demo-doc-optimization`): Started successfully → 5 iterations → scores [60, 68, 75, 82, 88] (monotonically increasing) → auto-exited with "Reached max iterations (5)". Score 88 crossed threshold 85 on last iteration, but maxIterations check fires first in `shouldExit()`.
- ✅ **Single-shot** (`demo-single-analysis`): Started → 1 iteration → completed.
- ✅ **AsyncMcpStep** (`demo-simulation-iteration`): Started → 3 iterations with agent→async_mcp→agent pipeline → scores [60, 68, 75] → completed. MockMcpClient simulates async job (returns pending → pending → completed on poll).

**Extra credit**:
- ✅ MockSessionProvider calls `POST /harness/callback/output` (`mock-session-provider.ts:80,97`) — confirmed via `submitCallback()` method
- ✅ Stop/Resume works: stopped → status "stopped", resumed → status "running"

**Justification**: All 3 required scenarios execute correctly. The mock adapters are well-designed: `MockSessionProvider` simulates realistic score progression with callback submission; `MockMcpClient` simulates async job lifecycle with poll-based completion after 2 status checks; `MockSetupService` uses `OnModuleInit` to pre-register 3 demo tasks.
**Suggestion**: The SCORE_PROGRESSION [60, 68, 75, 82, 88] means scoreThreshold (85) and maxIterations (5) trigger simultaneously. To independently demonstrate the scoreThreshold exit path, consider a progression like [60, 75, 88, 92] with maxIterations=10.

### D6: 测试覆盖 (Weight: 10/100)
**Score: 5/5** → 10/10 points
**Components with tests**:
- ✅ `task-registry.spec.ts` — 6 tests (register, get, list, remove, overwrite)
- ✅ `exit-evaluator.spec.ts` — 7 tests (maxIterations, scoreThreshold, minImprovement with edge cases for 1/2/3 scored iterations)
- ✅ `output-extractor.spec.ts` — 7 tests (direct JSON, markdown code block, missing required fields, optional fields, non-JSON text, array rejection)
- ✅ `async-poller.spec.ts` — 4 tests (immediate completion, multi-poll, timeout, args passing)
- ✅ `orchestrator.spec.ts` — 3 tests (full run completion, unknown task error, stop)

**Test results**: 5 suites, 31 tests, 31 passing, 0 failing (2.6s)
**Justification**: All 5 required components have tests. Tests cover happy paths, edge cases, and error conditions. The exit-evaluator tests are particularly thorough, covering the 2-consecutive-low-improvement edge case with multiple input configurations.
**Suggestion**: Add orchestrator tests for: (a) resumeRun flow, (b) AsyncMcpStep pipeline execution, (c) step failure mid-pipeline behavior.

## Penalty Deductions
- **P1**: core imports @nestjs → **0 violations** → No penalty
- **P2**: harness imports @kedge-agentic/backend → **0 violations** → No penalty
- **P3**: tsc errors > 20 → **0 errors** → No penalty
- **P4**: moduleResolution → **"NodeNext"** ✅ → No penalty
- **P5**: missing .js suffix → **0 violations** → No penalty
- **P6**: Controller missing @ApiTags → **`@ApiTags('harness')` present** ✅ → No penalty

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 | 5/5 | 15/15 |
| D2 | 5/5 | 15/15 |
| D3 | 5/5 | 25/25 |
| D4 | 5/5 | 15/15 |
| D5 | 5/5 | 20/20 |
| D6 | 5/5 | 10/10 |

**Penalties**: -0
**总分: 100/100**

## Bug Classification

No bugs found. All rubric items pass.

Minor observations (not bugs — no point deductions):

- **[DESIGN]** — Exit condition priority: `shouldExit()` checks maxIterations before scoreThreshold. When both trigger on the same iteration (as in demo-doc-optimization), the exit reason reports "max iterations" instead of "score threshold reached". This is a valid design choice, not a bug.
- **[DESIGN]** — No runtime request body validation via class-validator DTOs. The controller accepts raw TypeScript types. For a library module this is acceptable (validation is the consumer's responsibility), but production endpoints should validate inputs.

## Actionable Fix Hints

No required fixes. Improvement suggestions only:

1. File: `solutions/mock/harness-demo/src/adapters/mock-session-provider.ts:7` — Improvement: Adjust `SCORE_PROGRESSION` to `[60, 75, 88, 92]` with `maxIterations: 10` on the demo task to independently exercise the `scoreThreshold` exit path.
2. File: `packages/harness/src/nestjs/harness.controller.ts` — Improvement: Add `class-validator` DTOs for `@Body()` parameters to enable runtime validation when consumers enable `ValidationPipe`.
3. File: `packages/harness/src/core/orchestrator.spec.ts` — Improvement: Add tests for `resumeRun()` and multi-step pipelines with `AsyncMcpStep`.

## Top 3 Priority Fixes

No fixes required — all criteria met. Listed below are the highest-value improvements:

1. **[D6 — hardening]** Add orchestrator tests for `resumeRun()` and `AsyncMcpStep` pipeline execution (`packages/harness/src/core/orchestrator.spec.ts`). Currently only AgentStep-only pipelines are tested in integration.
2. **[D5 — demo quality]** Adjust mock score progression to independently demonstrate `scoreThreshold` exit path. Currently both `maxIterations` and `scoreThreshold` trigger simultaneously at iteration 5.
3. **[D4 — robustness]** Add DTO validation classes for controller `@Body()` parameters to enable `ValidationPipe` integration.

## What's Working Well

1. **Clean architecture separation**: `core/` has zero framework dependencies. The interface-based design (`SessionProvider`, `McpClient`, `RunStore`) makes the module genuinely pluggable. The NestJS layer is a thin wrapper that composes core classes via `forRoot()`. This is textbook module architecture.

2. **Comprehensive test coverage**: 31 tests across all 5 core components with thoughtful edge case coverage. The `exit-evaluator.spec.ts` is particularly well-written — it tests the "2 consecutive low improvements" condition with 5 different input configurations including the subtle cases where only one of two consecutive deltas is below threshold.
