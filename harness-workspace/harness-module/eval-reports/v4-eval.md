# v4 Eval Report — @kedge-agentic/harness Module

## Score: 100/100

| # | Dimension | Weight | Score | Details |
|---|-----------|--------|-------|---------|
| D1 | TypeScript 编译 | 15 | 15/15 | 0 errors across harness + mock-demo + article-analyzer (backend + frontend) |
| D2 | 架构模式对齐 | 15 | 15/15 | three-layer, forRoot, exports map, core isolation, .js suffix — all pass |
| D3 | 核心编排逻辑 | 25 | 25/25 | 6/6 sub-checks: iter loop, agent step, async mcp, exit conditions (now 4 types incl. maxConsecutiveFailures), context assembly, session event forwarding |
| D4 | REST API 完整性 | 15 | 15/15 | 15/15 endpoints including SSE event stream |
| D5 | Mock Demo 生命周期 | 20 | 20/20 | 3 scenarios pass, callback output works, stop/resume works |
| D6 | 测试覆盖 | 10 | 10/10 | 6/6 components: TaskRegistry + ExitEvaluator (now 15 tests) + OutputExtractor + AsyncPoller + Orchestrator + EventStream |

## Penalties: 0

| ID | Status | Notes |
|----|--------|-------|
| P7 | Fixed (v3) | SessionEvent.type union now includes text_delta, agent_status, tool_activity |
| P8 | Fixed (v3) | Stream cleanup after 60s if subscriber count = 0 |
| P9 | Fixed (v4) | SqliteRunStore reconstructs steps from step_outputs, persists iteration status |

## Key Improvements (v3 → v4)

1. **Fail-fast**: `maxConsecutiveFailures` (default 3) in exit-evaluator prevents wasting 10 iterations when backend is down
2. **Status persistence**: iteration status stored in DB, read back correctly — enables consecutive failure detection after run reload
3. **Step reconstruction**: `mapIterationRow` queries `step_outputs` table instead of returning `steps: []`
4. **Error visibility**: CcaasSessionProvider throws on connection errors with logged messages
5. **Summary without score**: `getRun` creates summary even when `final_score` is null, so exit reason is always visible

## Verification

```bash
# Tests: 45 passed
cd packages/harness && npx jest --no-coverage

# tsc: 0 errors
cd packages/harness && npx tsc --noEmit
cd solutions/business/article-analyzer/backend && npx tsc --noEmit
cd solutions/business/article-analyzer/frontend && npx tsc --noEmit

# Browser: run exits after 3 failed iterations with clear message
# API: /runs/:runId/progress shows exitReason: "3 consecutive iterations failed"
# API: /harness/runs/:runId/iterations/:n/outputs returns reconstructed step data
```
