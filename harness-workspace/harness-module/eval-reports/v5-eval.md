# v5 Eval Report — @kedge-agentic/harness Module

## Score: 100/100

| # | Dimension | Weight | Score | Details |
|---|-----------|--------|-------|---------|
| D1 | TypeScript 编译 | 15 | 15/15 | packages/harness + harness-demo zero tsc errors |
| D2 | 架构模式对齐 | 15 | 15/15 | 5/5: three-layer, forRoot, exports, core isolation, .js suffix |
| D3 | 核心编排逻辑 | 25 | 25/25 | 6/6: orchestrator loop, agent step, async mcp, exit conditions (opt-in maxConsecutiveFailures), context assembly, session event forwarding |
| D4 | REST API 完整性 | 15 | 15/15 | 15/15 endpoints |
| D5 | Mock Demo 生命周期 | 20 | 20/20 | 3/3 scenarios + callback + stop/resume |
| D6 | 测试覆盖 | 10 | 10/10 | 6/6: TaskRegistry + ExitEvaluator + OutputExtractor + AsyncPoller + Orchestrator + EventStream |

## Penalties: 0

| ID | Status | Notes |
|----|--------|-------|
| P10 | Fixed (v5) | maxConsecutiveFailures is opt-in only, no implicit default |
| P11 | Fixed (v5) | Batch step_outputs query in getRun, no N+1 |
| P12 | Fixed (v5) | Orchestrator catch handler emits `run_failed` + cleans activeRuns |

## Key Improvements (v4 → v5)

1. **opt-in maxConsecutiveFailures**: no behavior change for existing tasks that don't set it
2. **Batch loading**: single query for all step_outputs per run instead of 1 per iteration
3. **run_failed event**: terminal event type now properly emitted, triggers stream cleanup in harness.module.ts
4. **activeRuns cleanup**: catch handler removes runId from activeRuns set (was leaking)
