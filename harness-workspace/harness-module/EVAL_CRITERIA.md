# Eval Criteria: @kedge-agentic/harness Module

## Scoring Dimensions

| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| D1 | TypeScript 编译正确性 | 15/100 | `tsc --noEmit` 零错误 |
| D2 | 架构模式对齐 | 15/100 | grep 检查结构 + 约定 |
| D3 | 核心编排逻辑 | 25/100 | 代码审查 + 单元测试 |
| D4 | REST API 完整性 | 15/100 | curl 逐端点测试 |
| D5 | Mock Demo 生命周期 | 20/100 | 3 个场景端到端验证 |
| D6 | 测试覆盖 | 10/100 | jest 通过率 |

## D1: TypeScript 编译正确性 (15/100)

**5/5 (15 pts)**: packages/harness + harness-demo 均零 tsc 错误
**4/5 (12 pts)**: 1-3 个 minor 类型错误
**3/5 (9 pts)**: 4-10 个类型错误
**2/5 (6 pts)**: 11-20 个类型错误
**1/5 (3 pts)**: > 20 个类型错误或 tsconfig 缺失

**Detection**:
```bash
cd packages/harness && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
cd solutions/mock/harness-demo && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

## D2: 架构模式对齐 (15/100)

检查清单（每项 1 分，共 5 分）：

1. **三层目录**: core/ + nestjs/ + client/ 目录结构存在
2. **forRoot 模式**: `HarnessModule.forRoot(options)` 返回 `DynamicModule`
3. **exports map**: package.json 有 `.`, `./core`, `./nestjs`, `./client` 四个入口
4. **core 隔离**: core/ 不导入 @nestjs、不导入 @kedge-agentic/backend
5. **ESM 约定**: 所有相对 import 使用 `.js` 后缀；barrel exports 齐全

**Detection**:
```bash
# 1. 目录结构
ls packages/harness/src/core/ packages/harness/src/nestjs/ packages/harness/src/client/

# 2. forRoot
grep -c "static forRoot" packages/harness/src/nestjs/harness.module.ts

# 3. exports map
node -e "const p=JSON.parse(require('fs').readFileSync('packages/harness/package.json','utf8')); console.log(JSON.stringify(Object.keys(p.exports)))"

# 4. core 隔离
grep -r "from '@nestjs" packages/harness/src/core/ | wc -l
grep -r "@kedge-agentic/backend" packages/harness/ | wc -l

# 5. .js 后缀
grep -rn "from '\.\." packages/harness/src/ | grep -v "\.js'" | wc -l
```

## D3: 核心编排逻辑 (25/100)

按子项打分（每项 1 分，共 5 分）：

1. **Orchestrator 迭代循环**: startRun → for loop → checkExitConditions → summary
2. **AgentStep 执行**: assembleContext → createSession → sendMessage → waitForCompletion → extract output
3. **AsyncMcpStep 执行**: callTool(start) → poll loop(setTimeout) → completion detection → extract result
4. **Exit conditions**: maxIterations + scoreThreshold + minImprovement + maxConsecutiveFailures (opt-in) 四个条件均正确判断
5. **Context assembly**: 所有 6 种 ContextSource 类型正确组装为 prompt 字符串
6. **Session event forwarding**: `orchestrator.ts:executeAgentStep` 传递 `onEvent` 给 `waitForCompletion()`，将 session 事件包装为 `HarnessEvent { type: 'session_event' }` 发射

**Detection**: 代码审查 orchestrator.ts + context-assembler.ts + exit-evaluator.ts + async-poller.ts

## D4: REST API 完整性 (15/100)

15 个端点，按覆盖率打分：

- **5/5 (15 pts)**: 15/15 端点均实现且返回正确结构
- **4/5 (12 pts)**: 12-14 个端点
- **3/5 (9 pts)**: 9-11 个端点
- **2/5 (6 pts)**: 5-8 个端点
- **1/5 (3 pts)**: < 5 个端点

端点清单：
1. `POST /harness/tasks`
2. `GET /harness/tasks`
3. `GET /harness/tasks/:id`
4. `POST /harness/runs`
5. `GET /harness/runs`
6. `GET /harness/runs/:id`
7. `GET /harness/runs/:id/progress`
8. `POST /harness/runs/:id/stop`
9. `POST /harness/runs/:id/resume`
10. `GET /harness/runs/:id/iterations/:n`
11. `GET /harness/runs/:id/iterations/:n/outputs`
12. `POST /harness/callback/output`
13. `POST /harness/output-schemas`
14. `GET /harness/output-schemas`
15. `GET /harness/runs/:runId/events` — SSE event stream (Content-Type: text/event-stream)

## D5: Mock Demo 生命周期 (20/100)

3 个场景（5 分制）：

1. **迭代任务 (2 pts)**: demo-doc-optimization 启动 → 分数递增 → 自动退出
2. **单次任务 (1 pt)**: demo-single-analysis 启动 → 1 轮完成
3. **AsyncMcpStep (2 pts)**: demo-simulation-iteration 启动 → agent + async_mcp + agent pipeline 完成

**额外加分项**：
- MockSessionProvider 调用 callback/output 端点写入数据 (+0.5)
- Stop/Resume 工作 (+0.5)

## D6: 测试覆盖 (10/100)

- **5/5 (10 pts)**: TaskRegistry + ExitEvaluator + OutputExtractor + AsyncPoller + Orchestrator + EventStream 测试均存在且通过
- **4/5 (8 pts)**: 5 个组件有测试
- **3/5 (6 pts)**: 3-4 个组件有测试
- **2/5 (4 pts)**: 1-2 个组件有测试
- **1/5 (2 pts)**: 测试存在但不通过

## Penalty Rules

| ID | Severity | Trigger | Deduction |
|----|----------|---------|-----------|
| P1 | Fatal | core/ 导入 @nestjs | -100 |
| P2 | Fatal | harness 导入 @kedge-agentic/backend | -100 |
| P3 | Blocker | tsc 错误 > 20 | 先修复再评 |
| P4 | Major | moduleResolution != NodeNext | -5/D2 |
| P5 | Minor | import 缺 .js 后缀 | -3 |
| P6 | Minor | Controller 无 @ApiTags | -5 |
| P7 | Minor | `SessionEvent.type` union 不含实际发射的事件类型 | -3 |
| P8 | Major | RunEventStreamRegistry 完成的 run 不清理（内存泄漏） | -5 |
| P9 | Major | RunStore `mapIterationRow` 不还原 steps/status（DB 重载后数据丢失） | -5 |
| P10 | Major | `maxConsecutiveFailures` 有隐式默认值（应为 opt-in） | -3 |
| P11 | Major | RunStore 读取 iterations 时 N+1 查询 step_outputs | -3 |
| P12 | Minor | Orchestrator catch handler 不发射 `run_failed` 事件或不清理 activeRuns | -3 |

## Score Formula

```
总分 = Σ(dimension_score × weight) - penalties
```

每个 dimension 按 1-5 分打分，乘以权重得到分数。

例：D1=5/5 → 15pts, D2=4/5 → 12pts, D3=3/5 → 15pts, D4=4/5 → 12pts, D5=3/5 → 12pts, D6=3/5 → 6pts = 72 - penalties

## Threshold
- **Pass**: 75/100
- **Target**: 90/100
