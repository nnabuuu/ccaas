# Harness Specification: @kedge-agentic/harness Module

## Task
- **Artifact**: `packages/harness/` — 新 npm 模块 `@kedge-agentic/harness`，含 core/nestjs/client 三层 + `solutions/mock/harness-demo/` 演示方案
- **Current state**: 从零开始。有完整的参考设计文档和 context-layer 作为结构模板
- **Target audience**: Solution 开发者（接入 HarnessModule.forRoot()）和平台维护者
- **Goal**: 构建可运行的 harness 编排框架，通过 mock demo 验证完整的 Task 注册 → Run 启动 → 迭代循环 → 退出 → 归档生命周期

## Frozen Constraints
- `packages/context-layer/` — 不可修改，仅作为结构参考
- `packages/backend/` — 不可修改，harness 不依赖 core backend
- 所有非 `packages/harness/` 和 `solutions/mock/harness-demo/` 的文件 — 不可修改
- `packages/harness/src/core/` 不得导入 `@nestjs/*`
- `packages/harness/` 不得导入 `@kedge-agentic/backend`
- tsconfig 使用 `moduleResolution: "NodeNext"` + `module: "NodeNext"`（同 context-layer）
- package.json exports map 使用三入口：`.`、`./core`、`./nestjs`、`./client`

## Code Locations

```
packages/harness/
  package.json
  tsconfig.json
  src/
    index.ts                           # Barrel export
    core/
      index.ts                         # Core barrel
      interfaces.ts                    # 全部类型定义
      task-registry.ts                 # HarnessTask 注册 + 查询
      orchestrator.ts                  # 编排循环核心逻辑
      context-assembler.ts             # ContextSource → prompt 字符串
      output-extractor.ts              # MCP tool callback 为主 + JSON fallback
      exit-evaluator.ts                # 退出条件判断（纯函数）
      async-poller.ts                  # AsyncMcpStep 轮询逻辑
      in-memory-run-store.ts           # 默认 RunStore（Map-based）
    nestjs/
      index.ts                         # NestJS barrel
      harness.module.ts                # HarnessModule.forRoot(options)
      harness.controller.ts            # REST endpoints + callback/output
      harness.constants.ts             # 注入 token
    client/
      index.ts                         # Client barrel
      harness-client.ts                # HTTP client
      types.ts                         # Client-facing response types

solutions/mock/harness-demo/
  package.json
  tsconfig.json
  nest-cli.json
  src/
    adapters/
      mock-session-provider.ts         # 模拟 agent session 执行
      mock-mcp-client.ts              # 模拟 MCP tool 调用
      mock-setup.service.ts            # 注册 demo 任务 + 初始化
    seed/
      demo-tasks.ts                    # 3 个预定义 HarnessTask
    public/
      index.html                       # API 测试页面
    app.module.ts                      # HarnessModule.forRoot() 集成
    main.ts                            # NestJS 启动 port 3022
```

## Eval Rubric

### Scoring Dimensions
| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| D1 | TypeScript 编译正确性 | 15/100 | `cd packages/harness && npx tsc --noEmit` + `cd solutions/mock/harness-demo && npx tsc --noEmit` |
| D2 | 架构模式对齐 | 15/100 | grep 检查：三层目录、forRoot 模式、exports map、barrel exports、.js 后缀 |
| D3 | 核心编排逻辑 | 25/100 | 单元测试 + 代码审查：Orchestrator 循环、AgentStep、AsyncMcpStep、退出条件 |
| D4 | REST API 完整性 | 15/100 | curl 测试：所有端点存在且返回正确结构 |
| D5 | Mock Demo 生命周期 | 20/100 | 启动 demo → REST API 验证 3 个场景完整运行 |
| D6 | 测试覆盖 | 10/100 | 核心层单元测试存在且通过 |

### Dimension Details

#### D1: TypeScript 编译正确性 (15/100)
- **5/5**: packages/harness 和 harness-demo 均 `tsc --noEmit` 零错误
- **3/5**: 一个包零错误，另一个有少量类型错误（< 5 个）
- **1/5**: 类型错误 > 10 个，或缺少 tsconfig.json
- **Detection**: `cd packages/harness && npx tsc --noEmit 2>&1 | grep -c "error TS"` 和 `cd solutions/mock/harness-demo && npx tsc --noEmit 2>&1 | grep -c "error TS"`

#### D2: 架构模式对齐 (15/100)
- **5/5**: 完全复制 context-layer 模式：三层目录分离、forRoot() 返回 DynamicModule、package.json exports 四入口、所有 import 使用 `.js` 后缀、barrel exports 齐全
- **3/5**: 结构基本正确，但有 1-2 处偏差（如缺少某个 barrel export、import 缺 .js 后缀）
- **1/5**: 结构不符合三层分离，或 forRoot() 缺失
- **Detection**:
  ```bash
  # exports map 检查
  node -e "const p=require('./packages/harness/package.json'); console.log(Object.keys(p.exports))"
  # 期望: ['.', './core', './nestjs', './client']

  # core 不导入 nestjs
  grep -r "from '@nestjs" packages/harness/src/core/ | wc -l
  # 期望: 0

  # .js 后缀检查
  grep -rn "from '\.\." packages/harness/src/ | grep -v "\.js'" | wc -l
  # 期望: 0

  # forRoot 检查
  grep -c "static forRoot" packages/harness/src/nestjs/harness.module.ts
  # 期望: 1
  ```

#### D3: 核心编排逻辑 (25/100)
- **5/5**: Orchestrator 正确实现：
  - AgentStep: createSession → sendMessage(assembled context) → waitForCompletion → extract output
  - AsyncMcpStep: callTool(start) → poll loop → completion detection → extract result
  - Exit conditions: maxIterations / scoreThreshold / minImprovement 三个条件均工作
  - Context assembly: 所有 6 种 ContextSource 类型正确组装
  - Output extraction: MCP callback 主路径 + JSON fallback
  - Error handling: step 失败不崩溃整个 run
- **3/5**: 基本循环工作，但部分 ContextSource 类型未实现或退出条件有 bug
- **1/5**: Orchestrator 无法完成一轮完整迭代
- **Detection**: 单元测试 + 代码审查 orchestrator.ts

#### D4: REST API 完整性 (15/100)
- **5/5**: 以下端点全部实现且返回正确结构：
  - `POST /harness/tasks` — 注册任务
  - `GET /harness/tasks` — 列表
  - `GET /harness/tasks/:id` — 详情
  - `POST /harness/runs` — 启动执行
  - `GET /harness/runs` — 列表
  - `GET /harness/runs/:id` — 详情
  - `GET /harness/runs/:id/progress` — 进度
  - `POST /harness/runs/:id/stop` — 停止
  - `POST /harness/runs/:id/resume` — 恢复
  - `GET /harness/runs/:id/iterations/:n` — 某轮详情
  - `GET /harness/runs/:id/iterations/:n/outputs` — 某轮输出
  - `POST /harness/callback/output` — submit_output 回调端点
  - `POST /harness/output-schemas` — 注册 OutputSchema
  - `GET /harness/output-schemas` — 列表
- **3/5**: 核心端点存在（tasks CRUD + runs CRUD + progress），但部分辅助端点缺失
- **1/5**: 缺少关键端点（如 runs 启动或 progress）
- **Detection**: `curl -s http://localhost:3022/harness/tasks | jq .` 逐个端点测试

#### D5: Mock Demo 生命周期 (20/100)
- **5/5**: 以下 3 个场景全部通过：
  1. **迭代任务**: POST runs {taskId: "demo-doc-optimization"} → 轮询 progress → 分数递增 → 自动退出（scoreThreshold 或 maxIterations）
  2. **单次任务**: POST runs {taskId: "demo-single-analysis"} → 1 轮完成 → status=completed
  3. **AsyncMcpStep 任务**: POST runs {taskId: "demo-simulation-iteration"} → pipeline 含 agent + async_mcp + agent → 正确完成
  - MockSessionProvider 模拟分数递增（60→68→75→82→88）
  - MockMcpClient 模拟 poll（pending → completed）
  - callback/output 端点被 mock provider 正确调用
- **3/5**: 至少 2 个场景工作，但某个场景失败或分数不递增
- **1/5**: demo 无法启动或没有预注册任务
- **Detection**: 启动 demo → 逐个场景 curl 测试

#### D6: 测试覆盖 (10/100)
- **5/5**: 核心层有单元测试且全部通过：
  - TaskRegistry: register → get → list
  - ExitEvaluator: 3 个退出条件各有测试
  - OutputExtractor: JSON parse + schema validation
  - AsyncPoller: mock poll → detect completion
  - Orchestrator: 至少 2 个 integration 测试（iterative + async_mcp pipeline）
- **3/5**: 部分组件有测试，但覆盖不全
- **1/5**: 无测试或测试不通过
- **Detection**: `cd packages/harness && npx jest --no-coverage 2>&1`

### Penalty Rules
- **P1 (fatal, -100)**: `packages/harness/src/core/` 导入 `@nestjs/*` → 违反架构分离
- **P2 (fatal, -100)**: `packages/harness/` 导入 `@kedge-agentic/backend` → 违反独立性
- **P3 (fatal, 先修复再评)**: `tsc --noEmit` 错误 > 20 个 → 代码处于不可评估状态，必须先修复
- **P4 (-5/dimension)**: 使用 `moduleResolution: "Node"` 而非 `"NodeNext"` → 与 context-layer 不一致
- **P5 (-3)**: import 路径缺少 `.js` 后缀 → 不符合 ESM 约定
- **P6 (-5)**: Controller 缺少 `@ApiTags` decorator → 违反项目约定

### Threshold
- **Pass score**: 75/100
- **Target score**: 90/100

## Agent Architecture

### Generator
- **Role**: TypeScript full-stack engineer，实现 @kedge-agentic/harness 模块
- **Perspective**: 你是一个擅长 NestJS 模块设计的工程师。你严格复制 context-layer 的结构模式，用最简代码实现功能
- **Input**:
  1. SPEC.md — 目标和约束
  2. progress.md — 迭代历史
  3. eval-reports/v{N-1}-eval.md — 上轮评估报告
  4. reference/design-plan.md — 完整实现计划
  5. reference/context-layer-patterns.md — context-layer 结构模板
  6. 当前代码文件
- **Output**: 代码修改 + changelogs/v{N}-changelog.md
- **Validation**: `cd packages/harness && npx tsc --noEmit` + `cd solutions/mock/harness-demo && npx tsc --noEmit`
- **Key constraint**:
  - core/ 绝不导入 @nestjs
  - 所有 import 使用 .js 后缀
  - 每轮聚焦最高扣分维度的 1-2 个问题

### Evaluator
- **Role**: 独立代码质量审查员
- **Perspective**: 你是一个没有参与过代码编写的审查者。你按 rubric 逐维度打分，不看意图只看实际
- **Input**:
  1. EVAL_CRITERIA.md — 评分标准
  2. 当前代码（packages/harness/ + solutions/mock/harness-demo/）
  3. tsc 编译结果
  4. 测试运行结果
  5. 如果 demo 可启动：curl 测试结果
- **Output**: eval-reports/v{N}-eval.md
- **Isolation**: 独立 context window（mandatory）
- **Key constraint**:
  - 每个 bug 标记为 [COMPONENT]（generator 可修）或 [SYSTEM]（需要基础设施）或 [DESIGN]（需要人决策）
  - 分数行格式：`总分: XX/100`
  - 必须给出 Top 3 Priority Fixes（含文件路径和具体修复建议）

## Exit Conditions
- **Target**: 总分 >= 90/100
- **Max iterations**: 10
- **Diminishing returns**: 连续 2 轮改进 < 3 分 → 退出并报告瓶颈
- **Regression gate**: 分数下降 > 5 分 → 自动 revert 上一轮 commit
- **Fatal penalty**: 连续 2 轮触发 P1/P2 → 暂停，需要人工介入

## Validation Scenarios

### S1: TypeScript 编译
```bash
cd packages/harness && npx tsc --noEmit 2>&1
# 期望: 0 errors

cd solutions/mock/harness-demo && npx tsc --noEmit 2>&1
# 期望: 0 errors
```

### S2: Architecture Checks
```bash
# core 不导入 nestjs
grep -r "from '@nestjs" packages/harness/src/core/
# 期望: 无输出

# 不导入 backend
grep -r "@kedge-agentic/backend" packages/harness/
# 期望: 无输出

# exports map 正确
node -e "const p=JSON.parse(require('fs').readFileSync('packages/harness/package.json','utf8')); console.log(JSON.stringify(Object.keys(p.exports)))"
# 期望: [".",  "./core", "./nestjs", "./client"]

# forRoot 存在
grep "static forRoot" packages/harness/src/nestjs/harness.module.ts
# 期望: 有输出

# ApiTags 存在
grep "@ApiTags" packages/harness/src/nestjs/harness.controller.ts
# 期望: 有输出
```

### S3: Unit Tests
```bash
cd packages/harness && npx jest --no-coverage 2>&1
# 期望: All tests passed
```

### S4: Demo 启动
```bash
cd solutions/mock/harness-demo && npm run build && node dist/main.js &
sleep 3

# 预注册任务
curl -s http://localhost:3022/harness/tasks | jq '. | length'
# 期望: 3

# 任务详情
curl -s http://localhost:3022/harness/tasks/demo-doc-optimization | jq '.name'
# 期望: "Demo: 文档质量迭代优化"
```

### S5: 迭代任务生命周期
```bash
# 启动
RUN_ID=$(curl -s -X POST http://localhost:3022/harness/runs \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"demo-doc-optimization"}' | jq -r '.id')

# 等待几秒让 mock 跑完
sleep 10

# 检查进度（分数应递增）
curl -s http://localhost:3022/harness/runs/$RUN_ID/progress | jq '.scoreTrajectory'
# 期望: 数组，分数递增

# 检查状态
curl -s http://localhost:3022/harness/runs/$RUN_ID | jq '.status'
# 期望: "completed" 或 "running"
```

### S6: 单次任务
```bash
RUN_ID=$(curl -s -X POST http://localhost:3022/harness/runs \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"demo-single-analysis"}' | jq -r '.id')

sleep 5

curl -s http://localhost:3022/harness/runs/$RUN_ID | jq '.status'
# 期望: "completed"

curl -s http://localhost:3022/harness/runs/$RUN_ID | jq '.iterations | length'
# 期望: 1
```

### S7: AsyncMcpStep 任务
```bash
RUN_ID=$(curl -s -X POST http://localhost:3022/harness/runs \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"demo-simulation-iteration"}' | jq -r '.id')

sleep 15

curl -s http://localhost:3022/harness/runs/$RUN_ID | jq '.status'
# 期望: "completed" 或 "running"

# 检查 pipeline 包含 async_mcp step
curl -s http://localhost:3022/harness/runs/$RUN_ID/iterations/1 | jq '.steps[] | select(.type=="async_mcp") | .status'
# 期望: "completed"
```

### S8: Callback/Output 端点
```bash
# 直接测试 callback 端点
curl -s -X POST http://localhost:3022/harness/callback/output \
  -H 'Content-Type: application/json' \
  -d '{"runId":"test","stepId":"test-step","schemaId":"test-schema","outputKey":"test","data":{"score":85}}' \
  | jq '.ok'
# 期望: true
```

### S9: Stop/Resume
```bash
# 启动一个迭代任务
RUN_ID=$(curl -s -X POST http://localhost:3022/harness/runs \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"demo-doc-optimization"}' | jq -r '.id')

sleep 3

# 停止
curl -s -X POST http://localhost:3022/harness/runs/$RUN_ID/stop | jq '.status'
# 期望: "stopped"

# 恢复
curl -s -X POST http://localhost:3022/harness/runs/$RUN_ID/resume | jq '.status'
# 期望: "running"
```

## Progress Tracking
- **Log file**: progress.md
- **Per-iteration record**: version number, timestamp, total score, per-dimension scores (D1-D6), key changes summary, evaluator's top unresolved issue

## Estimated Resource Usage
- **Iterations**: ~6-8 expected (module is well-defined, structure is templated)
- **Tokens per iteration**: ~50K (generator) + ~30K (evaluator)
- **Total estimated cost**: ~$15-25
