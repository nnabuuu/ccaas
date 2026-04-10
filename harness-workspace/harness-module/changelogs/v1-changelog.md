# v1 Changelog

## 改动文件

### packages/harness/ (新建)
- `package.json` — 4 个 exports 入口 (`.`, `./core`, `./nestjs`, `./client`)，peerDeps 为 optional NestJS
- `tsconfig.json` — NodeNext module + moduleResolution，strict，experimentalDecorators
- `src/core/interfaces.ts` — 全部类型定义：SessionProvider, McpClient, RunStore, HarnessEventEmitter, HarnessTask, PipelineStep, ContextSource, HarnessRun, IterationRecord, StepRecord, RunSummary, RunProgress, RunTrigger 等
- `src/core/task-registry.ts` — Map<string, HarnessTask> 的 register/get/list/remove
- `src/core/exit-evaluator.ts` — shouldExit 纯函数：maxIterations + scoreThreshold + minImprovement 三种退出条件
- `src/core/output-extractor.ts` — extractOutput：JSON parse + markdown code block fallback + schema field 验证
- `src/core/context-assembler.ts` — assembleContext：6 种 ContextSource → prompt string 组装
- `src/core/async-poller.ts` — pollUntilComplete：setTimeout loop + completionCondition 匹配
- `src/core/in-memory-run-store.ts` — Map-based RunStore 默认实现
- `src/core/orchestrator.ts` — 完整编排循环：startRun/stopRun/resumeRun + AgentStep + AsyncMcpStep + exit checking + finalizeRun with summary
- `src/core/index.ts` — Core barrel export
- `src/nestjs/harness.constants.ts` — HARNESS_MODULE_OPTIONS + HARNESS_RUN_STORE injection tokens (Symbol)
- `src/nestjs/harness.module.ts` — HarnessModule.forRoot(options) → DynamicModule，复制 context-layer 模式
- `src/nestjs/harness.controller.ts` — @ApiTags('harness') @Controller('harness')，14 个 REST 端点
- `src/nestjs/index.ts` — NestJS barrel export
- `src/client/types.ts` — 重导出 core 类型
- `src/client/harness-client.ts` — HTTP client：registerTask/listTasks/getTask/deleteTask/startRun/getRun/getProgress/stopRun/resumeRun/getIteration/getIterationOutputs
- `src/client/index.ts` — Client barrel export
- `src/index.ts` — Main barrel export (NestJS + Core + Client)

### solutions/mock/harness-demo/ (新建)
- `package.json` — file:../../../packages/harness 依赖
- `tsconfig.json` — commonjs module（与 context-layer-demo 一致）
- `nest-cli.json` — NestJS CLI 配置
- `src/adapters/mock-session-provider.ts` — 分数递增 60→68→75→82→88，submit_output callback 模拟
- `src/adapters/mock-mcp-client.ts` — simulator:run + simulator:status mock，第 2 次 poll 返回 completed
- `src/adapters/mock-setup.service.ts` — OnModuleInit 注册 3 个 demo tasks
- `src/seed/demo-tasks.ts` — 3 个预定义任务（doc-optimization, single-analysis, simulation-iteration）
- `src/app.module.ts` — HarnessModule.forRoot 集成
- `src/main.ts` — NestJS bootstrap on port 3022

## 对应维度

- D1 (TypeScript 编译): **两个包均 tsc --noEmit 零错误**
- D2 (架构模式对齐): 三层分离 (core/nestjs/client)，forRoot() DynamicModule，4 个 exports 入口，所有 import 使用 .js 后缀，core/ 无 @nestjs 导入
- D3 (核心编排逻辑): Orchestrator 完整循环 + AgentStep（createSession→sendMessage→waitForCompletion→extractOutput）+ AsyncMcpStep（callTool→pollUntilComplete）+ ExitEvaluator（3 种退出条件）+ ContextAssembler（6 种 ContextSource）
- D4 (REST API 完整性): 14 个端点（Tasks: POST/GET/GET/:id/DELETE/:id; Runs: POST/GET/GET/:id/GET/:id/progress/POST/:id/stop/POST/:id/resume; Iterations: GET/:n/GET/:n/outputs; Callback: POST callback/output; Schemas: GET tasks/:id/output-schemas）
- D5 (Mock Demo 生命周期): 3 个场景（iterative doc-optimization with score progression, single analysis, simulation with async_mcp pipeline）+ MockSessionProvider with HTTP callback + MockMcpClient with poll simulation
- D6 (测试覆盖): 本轮跳过

## 本轮重点

从零创建完整的 harness 模块和 demo solution，两个包均通过 tsc --noEmit 零错误。添加了 DELETE tasks/:taskId 端点达到 14 个 REST 端点完整 CRUD。

## 本轮跳过

- D6 (测试覆盖): v1 优先确保编译和功能完整，测试在后续轮次添加
