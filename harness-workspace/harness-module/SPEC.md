# SPEC: @kedge-agentic/harness Module

## Goal
构建 npm 模块 `@kedge-agentic/harness`，管理长期迭代/调查任务的定义、编排、执行和归档。与 `@kedge-agentic/context-layer` 同构，运行在 Solution 进程内，不依赖 CCaaS 核心后端。

## Architecture
三层分离，复制 context-layer 模式：
- `core/` — 纯 TypeScript，无框架依赖
- `nestjs/` — 薄 NestJS 壳（forRoot + controller）
- `client/` — 框架无关 HTTP client

## Core Types

### 可插拔接口（Solution 通过 forRoot 注入）
- `SessionProvider` — agent session 执行抽象（createSession / sendMessage / waitForCompletion / getTokenUsage）
- `McpClient` — MCP tool 调用抽象（callTool）
- `RunStore` — 持久化抽象（CRUD runs + iterations + step outputs + artifacts）
- `HarnessEventEmitter` — 进度通知抽象（SSE/WebSocket/内存）

### HarnessTask（任务定义）
- `id`, `name`, `mode` ('iterative' | 'investigation')
- `spec` — objective / frozenConstraints / artifactDescription
- `agents[]` — role + sessionTemplateId
- `pipeline: PipelineStep[]` — AgentStep | AsyncMcpStep
- `evalCriteria?` — dimensions[]
- `exitConditions` — maxIterations / scoreThreshold / minImprovement
- `outputSchemas: OutputSchema[]`

### PipelineStep
- **AgentStep**: role → SessionProvider 创建独立 session → 注入上下文 → 等待完成 → 提取输出
- **AsyncMcpStep**: McpClient 启动外部任务 → 轮询等待完成 → 提取结果

### ContextSource（6 种）
- `spec` / `prev_output` / `progress` / `latest_artifact` / `entity_ref` / `step_output`

### Output Strategy
Agent 调用 `submit_output` MCP tool → harness callback 端点 → RunStore。Fallback：从 session result text 解析 JSON。

## Orchestrator Loop
```
startRun(taskId) → for iteration 1..max:
  for step in pipeline:
    assembleContext → execute (agent or async_mcp) → extract output → validate
  checkExitConditions → break if met
generateRunSummary
```

## REST API
Tasks CRUD + Runs lifecycle + Iterations detail + callback/output + output-schemas

## NestJS Integration
`HarnessModule.forRoot({ sessionProvider, mcpClient, runStore, eventEmitter? })`

## Client SDK
`HarnessClient` — registerTask / startRun / getRun / getProgress / stopRun / resumeRun / getIteration

## Mock Demo
`solutions/mock/harness-demo/` — MockSessionProvider（分数递增 60→88）+ MockMcpClient（poll 模拟）+ 3 个预定义任务

## Frozen Constraints
- core/ 不导入 @nestjs
- 不导入 @kedge-agentic/backend
- moduleResolution: NodeNext
- import 路径使用 .js 后缀
- Controller 必须有 @ApiTags
