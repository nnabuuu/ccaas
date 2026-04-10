# @kedge-agentic/harness — 完整实现计划

## 1. 模块架构（三层，复制 context-layer 模式）

```
packages/harness/
  src/
    core/                              # 纯 TS — 无框架依赖
      interfaces.ts                    # 所有类型定义（含 SessionProvider, McpClient, RunStore）
      task-registry.ts                 # HarnessTask 注册 + 查询
      orchestrator.ts                  # 编排循环核心逻辑（AgentStep + AsyncMcpStep）
      context-assembler.ts             # 上下文组装（ContextSource → prompt）
      output-extractor.ts              # MCP tool 回调为主，JSON 解析为 fallback
      exit-evaluator.ts                # 退出条件判断
      async-poller.ts                  # AsyncMcpStep 轮询逻辑
      in-memory-run-store.ts           # 默认 RunStore（Map-based，测试用）
    nestjs/                            # 薄 NestJS 壳
      harness.module.ts                # HarnessModule.forRoot(options)
      harness.controller.ts            # /harness/* REST endpoints + callback/output 端点
      harness.constants.ts             # 注入 token
    client/                            # 框架无关 SDK
      harness-client.ts                # HTTP client
      types.ts                         # Client 面向的响应类型
```

## 2. 核心类型设计

### 2.1 可插拔接口（Solution 注入）

```typescript
// ─── SessionProvider：agent 执行抽象 ───
interface SessionProvider {
  createSession(params: {
    templateId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ sessionId: string }>;

  sendMessage(sessionId: string, content: string): Promise<void>;

  waitForCompletion(sessionId: string, opts?: {
    timeoutMs?: number;
    onEvent?: (event: SessionEvent) => void;
  }): Promise<SessionResult>;

  getTokenUsage(sessionId: string): Promise<TokenUsage>;
}

interface SessionEvent {
  type: 'progress' | 'tool_call' | 'message';
  data: unknown;
}

interface SessionResult {
  text: string;
  tokensUsed: TokenUsage;
  finishReason: 'completed' | 'timeout' | 'error';
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// ─── McpClient：MCP 工具调用抽象（用于 AsyncMcpStep） ───
interface McpClient {
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

// ─── RunStore：持久化抽象 ───
interface RunStore {
  createRun(run: HarnessRun): Promise<HarnessRun>;
  updateRun(runId: string, updates: Partial<HarnessRun>): Promise<void>;
  getRun(runId: string): Promise<HarnessRun | null>;
  listRuns(filters?: RunFilters): Promise<HarnessRun[]>;
  appendIteration(runId: string, iteration: IterationRecord): Promise<void>;
  saveStepOutput(runId: string, iteration: number, stepId: string, outputKey: string, data: unknown): Promise<void>;
  getStepOutput(runId: string, iteration: number, stepId: string, outputKey: string): Promise<unknown | null>;
  saveArtifact(runId: string, iteration: number, artifact: unknown): Promise<void>;
  getLatestArtifact(runId: string): Promise<unknown | null>;
}

interface RunFilters {
  taskId?: string;
  status?: string;
}

// ─── HarnessEventEmitter：进度通知抽象 ───
interface HarnessEventEmitter {
  emit(event: HarnessEvent): void;
}

interface HarnessEvent {
  type: 'run_started' | 'iteration_started' | 'step_started' | 'step_completed' |
        'iteration_completed' | 'run_completed' | 'output_received' | 'error';
  runId: string;
  data: unknown;
}
```

### 2.2 HarnessTask（任务定义）

```typescript
interface HarnessTask {
  id: string;
  name: string;
  mode: 'iterative' | 'investigation';

  spec: {
    objective: string;
    frozenConstraints: string[];
    artifactDescription: string;
  };

  agents: {
    role: string;
    sessionTemplateId: string;
  }[];

  pipeline: PipelineStep[];
  evalCriteria?: EvalCriteria;
  exitConditions: ExitConditions;
  outputSchemas: OutputSchema[];
}

interface EvalCriteria {
  dimensions: {
    name: string;
    weight: number;
    detection: string;
  }[];
}

interface ExitConditions {
  maxIterations: number;
  scoreThreshold?: number;
  minImprovement?: number;
}

type PipelineStep = AgentStep | AsyncMcpStep;

interface AgentStep {
  id: string;
  type: 'agent';
  role: string;
  contextSources: ContextSource[];
  skills?: string[];
  requiredOutputs: { schemaId: string; outputKey: string }[];
  validation?: StepValidation;
}

interface StepValidation {
  type: 'schema_check' | 'score_extraction' | 'custom_mcp';
  config: Record<string, unknown>;
}

interface AsyncMcpStep {
  id: string;
  type: 'async_mcp';
  mcpTool: string;
  inputSources: ContextSource[];
  scheduling: SchedulingConfig;
  resultOutputKey: string;
  resultSchemaId: string;
}

interface SchedulingConfig {
  pollInterval: number;
  timeout: number;
  pollMcpTool?: string;
  completionCondition: string;
}

type ContextSource =
  | { type: 'spec' }
  | { type: 'prev_output'; stepId: string; outputKey: string }
  | { type: 'progress' }
  | { type: 'latest_artifact' }
  | { type: 'entity_ref'; entityType: string; entityId: string }
  | { type: 'step_output'; stepId: string; outputKey: string };

interface OutputSchema {
  id: string;
  name: string;
  fields: OutputField[];
  displayConfig?: {
    layout: 'table' | 'card' | 'timeline' | 'diff';
    highlightField?: string;
  };
}

interface OutputField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  extractionHint?: string;
}
```

### 2.3 HarnessRun

```typescript
interface HarnessRun {
  id: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  trigger: {
    userId?: string;
    tenantId?: string;
    entityContext?: { entityType: string; entityId: string };
  };
  iterations: IterationRecord[];
  summary?: RunSummary;
  totalTokens: number;
  totalCostEstimate: number;
  startedAt: string;
  completedAt?: string;
}

interface IterationRecord {
  iteration: number;
  status: 'completed' | 'failed' | 'reverted';
  steps: StepRecord[];
  score?: number;
  scoreChange?: number;
  keyChanges: string;
  topIssue: string;
  timestamp: string;
}

interface StepRecord {
  stepId: string;
  sessionId?: string;
  type: 'agent' | 'async_mcp';
  status: 'completed' | 'failed' | 'skipped' | 'timeout';
  outputs: Record<string, unknown>;
  tokensUsed: number;
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

interface RunSummary {
  finalScore?: number;
  scoreTrajectory: { iteration: number; score: number }[];
  totalIterations: number;
  exitReason: string;
  bestIteration: number;
}

interface RunProgress {
  runId: string;
  taskName: string;
  status: string;
  currentIteration: number;
  maxIterations: number;
  scoreTrajectory: { iteration: number; score: number }[];
  latestScore?: number;
  exitReason?: string;
}
```

## 3. 核心组件实现要点

### TaskRegistry
- Map<string, HarnessTask>
- register(task) / get(id) / list() / remove(id)

### ExitEvaluator（纯函数）
```typescript
function shouldExit(run: HarnessRun, conditions: ExitConditions): { exit: boolean; reason: string }
```
检查：maxIterations / scoreThreshold / minImprovement（连续 2 轮 < threshold）

### ContextAssembler
```typescript
function assembleContext(run: HarnessRun, iteration: number, step: PipelineStep, store: RunStore): Promise<string>
```
遍历 contextSources，从 RunStore 拉取数据，拼接为 prompt 字符串。

### OutputExtractor
```typescript
function extractOutput(sessionResult: SessionResult, schema: OutputSchema): Record<string, unknown>
```
优先从 RunStore 中已有的 callback 数据读取（agent 通过 submit_output MCP tool 写入的）。
Fallback：从 sessionResult.text 中尝试 JSON 解析。

### AsyncPoller
```typescript
async function pollUntilComplete(
  mcpClient: McpClient,
  pollTool: string,
  args: Record<string, unknown>,
  config: SchedulingConfig
): Promise<unknown>
```
setTimeout loop，每 pollInterval 秒调用一次，检查 completionCondition。

### InMemoryRunStore
Map-based 默认实现，满足 RunStore 接口。测试和 demo 用。

### Orchestrator
整合以上组件：
```typescript
class Orchestrator {
  constructor(
    private sessionProvider: SessionProvider,
    private mcpClient: McpClient,
    private runStore: RunStore,
    private taskRegistry: TaskRegistry,
    private eventEmitter?: HarnessEventEmitter
  )

  async startRun(taskId: string, trigger?: RunTrigger): Promise<HarnessRun>
  async stopRun(runId: string): Promise<void>
  async resumeRun(runId: string): Promise<void>
}
```

## 4. NestJS Shell

### HarnessModule.forRoot(options)
```typescript
interface HarnessModuleOptions {
  sessionProvider: SessionProvider;
  mcpClient: McpClient;
  runStore?: RunStore;        // 默认 InMemoryRunStore
  eventEmitter?: HarnessEventEmitter;
}
```

### HarnessController
- @ApiTags('harness')
- @Controller('harness')
- 所有 REST 端点 (见 API 列表)
- POST /harness/callback/output — submit_output 回调

### Constants
- HARNESS_MODULE_OPTIONS injection token

## 5. Client SDK

```typescript
class HarnessClient {
  constructor(baseUrl: string, authProvider?: () => string)

  // Task CRUD
  registerTask(task: HarnessTask): Promise<HarnessTask>
  listTasks(): Promise<HarnessTask[]>
  getTask(taskId: string): Promise<HarnessTask>

  // Run lifecycle
  startRun(params: { taskId: string; trigger?: RunTrigger }): Promise<HarnessRun>
  getRun(runId: string): Promise<HarnessRun>
  getProgress(runId: string): Promise<RunProgress>
  stopRun(runId: string): Promise<void>
  resumeRun(runId: string): Promise<void>

  // Iterations
  getIteration(runId: string, n: number): Promise<IterationRecord>
  getIterationOutputs(runId: string, n: number): Promise<Record<string, unknown>>
}
```

## 6. Mock Demo Solution

### MockSessionProvider
- createSession → 返回 fake sessionId
- sendMessage → no-op
- waitForCompletion → 延迟 1-2 秒后返回模拟结果
  - generator role → 返回 "改进了 X 维度" 的文本
  - evaluator role → 返回带分数的评估报告
  - 分数随 iteration 递增（60 → 68 → 75 → 82 → 88）
- getTokenUsage → 返回 mock 数据
- 在 waitForCompletion 期间，通过 HTTP 调用 harness callback endpoint 模拟 agent 调 submit_output

### MockMcpClient
- 'simulator:run' → 返回 { jobId: 'sim_xxx', status: 'pending' }
- 'simulator:status' → 第一次 pending, 第二次 completed + mock result

### Demo Tasks（3 个）
1. demo-doc-optimization — 迭代优化（5 轮，scoreThreshold 85）
2. demo-single-analysis — 单次分析（maxIterations 1）
3. demo-simulation-iteration — 含 AsyncMcpStep（3 轮，agent + async_mcp + agent pipeline）

### 启动
port 3022, NestJS bootstrap
