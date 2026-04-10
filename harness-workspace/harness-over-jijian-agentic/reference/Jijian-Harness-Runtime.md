# Jijian Harness Runtime — `@kedge-agentic/harness`

> CCaaS 平台模块。管理长期迭代任务（harness task）的定义、编排、执行和归档。
>
> 与 Context Layer 一样，是 npm 包，运行在 Solution 进程内。

---

## 1. 问题定义

有一类任务不是"一次 Chat 对话"能完成的——它需要**多轮迭代、多 agent 协作、结构化评估、自主决策是否继续**。

CLI 世界的 harness（`claude -p` + bash 脚本）只能操作文件系统。但 B2B 场景中，大量任务的"工具"不是 bash 而是业务 MCP：

| Solution | 迭代任务 | Agent 的工具 |
|----------|---------|------------|
| 教育 | 迭代改进教案质量 | 课标 MCP + 题库 MCP + 学情 MCP |
| 教育 | 调查某个班级学情异常 | 成绩 MCP + 考勤 MCP + 课堂记录 MCP |
| CRM | 迭代优化客户沟通话术 | 客户 MCP + 历史工单 MCP + 行业知识 MCP |
| 法律 | 迭代审查合同条款风险 | 法规 MCP + 案例 MCP + 合同 MCP |

这些任务有共同的模式：**定义目标 → 跑 agent → 评估 → 决定是否继续 → 归档结果**。平台应该提供这个编排框架，Solution 只需要定义"任务是什么 + 评估标准是什么 + 用什么工具"。

---

## 2. 核心概念

```
HarnessTask（任务定义）           ← Solution 定义一次，可复用
  │
  └─ HarnessRun（任务执行实例）    ← 每次执行产生一个 Run
       │
       ├─ Iteration 1             ← 每轮迭代
       │   ├─ Step: generate      ← 每步是一个 Jijian session
       │   ├─ Step: evaluate
       │   └─ StepOutput[]        ← 结构化输出（Solution 预定义 schema）
       │
       ├─ Iteration 2
       │   └─ ...
       │
       └─ RunSummary              ← 归档（分数走势、最终产物、token 消耗）
```

### 2.1 HarnessTask（任务定义）

Solution builder 定义**一次**，可以被重复执行。

```typescript
interface HarnessTask {
  id: string;
  name: string;                    // "教案质量迭代优化"
  mode: 'iterative' | 'investigation';

  // 目标（对应 SPEC.md）
  spec: {
    objective: string;             // 一句话目标
    frozenConstraints: string[];   // 不可变约束
    artifactDescription: string;   // 产物是什么
  };

  // Agent 架构（每个 agent = 一个 session template）
  agents: {
    role: string;                  // 'generator' | 'evaluator' | 'investigator' | 自定义
    sessionTemplateId: string;     // Jijian session template ID
    // session template 定义了：system prompt + MCP tools + 上下文注入规则
  }[];

  // 编排（Pipeline 顺序）
  pipeline: PipelineStep[];

  // 评估标准（对应 EVAL_CRITERIA.md）
  evalCriteria?: EvalCriteria;     // iterative 模式需要

  // 退出条件
  exitConditions: {
    maxIterations: number;
    scoreThreshold?: number;       // iterative: 分数 >= 此值则停止
    minImprovement?: number;       // iterative: 连续 2 轮改进 < 此值则停止
    maxRounds?: number;            // investigation: 最大调查轮数
  };

  // 产出物 schema（Solution 预定义的结构化输出格式）
  outputSchemas: OutputSchema[];
}
```

### 2.2 Pipeline 步骤

Pipeline 定义每轮迭代内的执行顺序。有两种步骤类型：

```typescript
type PipelineStep = AgentStep | AsyncMcpStep;

// ─── 类型 A：Agent 步骤 ───
// 创建一个 Jijian session，agent 在 session 中完成任务
interface AgentStep {
  id: string;
  type: 'agent';                   // 默认，可省略
  role: string;                    // 对应 agents 中的 role
  
  // 上下文注入（这步 agent 需要读什么）
  contextSources: ContextSource[];
  
  // Skill 加载（可选，agent 在 session 中可访问的 Skill 文件）
  skills?: string[];               // Skill ID 列表，见 §2.4

  // 输出要求（这步 agent 必须产出什么）
  requiredOutputs: {
    schemaId: string;              // 引用 outputSchemas 中的 schema
    outputKey: string;             // 存储 key（如 'draft', 'eval-report', 'changelog'）
  }[];

  // 验证（可选，步骤完成后的自动检查）
  validation?: {
    type: 'schema_check' | 'score_extraction' | 'custom_mcp';
    config: Record<string, any>;
  };
}

// ─── 类型 B：异步 MCP 步骤 ───
// 不创建 agent session，直接调外部 MCP 提交长时间任务
// 通过 CCaaS scheduler 轮询等待完成
interface AsyncMcpStep {
  id: string;
  type: 'async_mcp';
  mcpTool: string;                 // 'classroom-simulator:run-simulation'
  inputSources: ContextSource[];   // MCP 调用的输入参数从哪来
  
  // 调度配置（提交给 CCaaS scheduler）
  scheduling: {
    pollInterval: number;          // 轮询间隔（秒），如 30
    timeout: number;               // 最大等待时间（秒），如 3600
    pollMcpTool?: string;          // 轮询用的 MCP tool（默认同 mcpTool 的 status endpoint）
    completionCondition: string;   // 判断完成的条件表达式，如 "status === 'completed'"
  };

  // 结果处理
  resultOutputKey: string;         // 结果存到哪个 output key
  resultSchemaId: string;          // 用哪个 OutputSchema 解析结果
}
```

> **[待确认] CCaaS Scheduler**：async_mcp step 依赖 CCaaS core 的 scheduler 服务来做轮询 + 回调。scheduler 之前有设计但实现状态未确认。需要验证：
> - scheduler 是否支持"注册一个 poll job，轮询某个 MCP endpoint，满足条件后回调"
> - scheduler 的 API 接口是什么（注册 job / 查询 job 状态 / 取消 job）
> - scheduler 宕机时 harness run 的恢复策略

```typescript
type ContextSource = 
  | { type: 'spec' }                                    // 任务 SPEC
  | { type: 'prev_output'; stepId: string; outputKey: string }  // 上一轮某步的输出
  | { type: 'progress' }                                // 历史分数走势
  | { type: 'latest_artifact' }                          // 最新版本的产物
  | { type: 'entity_ref'; entityType: string; entityId: string } // Context Layer 实体引用
  | { type: 'step_output'; stepId: string; outputKey: string };  // 本轮内前一步的输出
  // ↑ 新增：reviewer 需要读本轮 simulation 的结果（同一轮内跨步骤引用）
```

### 2.3 Skill 在 Harness 中的使用

Jijian 的 agentic engine 支持 session 内动态加载 Skill——本质上是 engine 有文件系统访问权限，Skill 文件（SKILL.md）在文件系统中，agent 可以读取并执行。

三种加载方式：

```typescript
// 方式 A：预装在 session template 中（适合"这个 agent 始终带着这个 skill"）
// reviewer agent 的 session template 的 system prompt 中内嵌 skill 指令
// → 最简单，不需要额外配置
// → 缺点：agent 不能根据运行时情况选择性加载

// 方式 B：orchestrator 在创建 session 时注入 skill prompt 到初始消息
// → 适合"这轮特定需要这个 skill"
// → harness pipeline step 中声明 skills: ['classroom-interaction-analysis']
// → orchestrator 在 session 初始消息中追加 skill 的 prompt

// 方式 C：agent 在 session 中主动读取 skill 文件（engine 有 fs 权限）
// → 最灵活——agent 根据 simulation 结果决定调哪个 skill
// → engine 访问 /skills/ 目录下的 SKILL.md 文件
// → 类似 Claude Code 中通过 / 主动 invoke skill
```

> **[待确认] Skill 文件路径**：需要确认 Jijian agentic engine 在 session 中访问 skill 文件的路径约定：
> - Skill 文件存放在哪个目录？（如 `/mnt/skills/` 或 solution 自定义路径）
> - engine 是否有 glob/list 能力来发现可用 skill？
> - session template 中是否需要显式声明 skill 目录的访问权限？

Pipeline step 中 `skills` 字段的处理：

```typescript
// orchestrator 在创建 session 时
if (step.skills?.length) {
  // 方式 B：把 skill prompt 追加到 session 初始消息
  for (const skillId of step.skills) {
    const skillContent = await this.skillStore.getSkillPrompt(skillId);
    initialMessage += `\n\n--- Skill: ${skillId} ---\n${skillContent}`;
  }
  // 或者方式 C：在初始消息中告诉 agent "你可以读 /skills/ 目录下的以下 skill 文件"
  // agent 自己决定是否加载
}
```

### 2.3 Structured Output Schema

Solution 预定义每种输出的结构。agent 按 schema 写入，平台按 schema 归档和展示。

```typescript
interface OutputSchema {
  id: string;
  name: string;                   // "评估报告" / "变更日志" / "调查证据"
  
  // 结构定义（JSON Schema 子集）
  fields: {
    key: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    description: string;          // 给 agent 看的说明
    extractionHint?: string;      // 平台自动提取时的 regex/path 提示
  }[];

  // 展示配置（前端渲染用）
  displayConfig?: {
    layout: 'table' | 'card' | 'timeline' | 'diff';
    highlightField?: string;      // 主指标字段（如 'totalScore'）
  };
}
```

**教育 Solution 的 OutputSchema 示例：**

```typescript
const evalReportSchema: OutputSchema = {
  id: 'edu-eval-report',
  name: '教案质量评估报告',
  fields: [
    { key: 'totalScore', type: 'number', required: true, description: '总分（0-100）', extractionHint: '(总分|Total)[：:]\\s*(\\d+)' },
    { key: 'dimensions', type: 'array', required: true, description: '各维度分数', },
    { key: 'topIssue', type: 'string', required: true, description: '最高优先级修复建议' },
    { key: 'whatWorksWell', type: 'string', required: false, description: '不应该改动的部分' },
  ],
  displayConfig: { layout: 'card', highlightField: 'totalScore' },
};

const changelogSchema: OutputSchema = {
  id: 'edu-changelog',
  name: '教案修改记录',
  fields: [
    { key: 'changes', type: 'array', required: true, description: '修改项列表' },
    { key: 'focusDimension', type: 'string', required: true, description: '本轮聚焦的维度' },
    { key: 'skipped', type: 'array', required: false, description: '本轮跳过的维度' },
  ],
  displayConfig: { layout: 'timeline' },
};

const investigationEvidenceSchema: OutputSchema = {
  id: 'edu-investigation-evidence',
  name: '学情异常调查证据',
  fields: [
    { key: 'hypothesis', type: 'string', required: true, description: '被验证的假设' },
    { key: 'verdict', type: 'string', required: true, description: 'CONFIRMED / ELIMINATED / INCONCLUSIVE' },
    { key: 'evidence', type: 'array', required: true, description: '收集到的证据（数据点、对比、截图）' },
    { key: 'reasoning', type: 'string', required: true, description: '判断理由' },
    { key: 'rootCause', type: 'string', required: false, description: '根因描述（仅 CONFIRMED 时）' },
    { key: 'fixDirection', type: 'string', required: false, description: '修复方向建议（仅 CONFIRMED 时）' },
  ],
  displayConfig: { layout: 'card', highlightField: 'verdict' },
};
```

---

## 3. 编排引擎

### 3.1 Orchestrator 核心流程

```
Orchestrator.startRun(taskId, triggerContext)
  │
  ├─ 创建 HarnessRun 记录
  ├─ 初始化 progress（v0）
  │
  └─ for iteration = 1..maxIterations:
       │
       ├─ for step in pipeline:
       │   │
       │   ├─ 1. 组装上下文
       │   │     读 step.contextSources → 从 Run 历史 / Context Layer / 产物存储中拉取
       │   │     注入 iteration-specific 信息（"这是第 N 轮，你的起点是..."）
       │   │
       │   ├─ 2. 创建 Jijian session
       │   │     使用 step.role 对应的 sessionTemplateId
       │   │     session 的 MCP tools 由 template 定义（不是平台硬编码）
       │   │     上下文注入到 session 的 system prompt / 初始消息
       │   │
       │   ├─ 3. 等待 session 完成
       │   │     agent 在 session 中执行（可能调 Solution MCP、读写数据、生成文档）
       │   │     agent 按 OutputSchema 写入结构化输出
       │   │
       │   ├─ 4. 提取 + 验证输出
       │   │     从 session 产物中按 schema 提取结构化数据
       │   │     如果有 validation → 运行验证（schema 校验 / 分数提取 / 自定义 MCP 检查）
       │   │     验证失败 → 标记 step 为 FAILED，根据策略重试或跳过
       │   │
       │   └─ 5. 归档
       │         结构化输出 → 存入 StepOutput
       │         产物文件 → 存入 Artifact Storage
       │
       ├─ 更新 progress（追加本轮记录）
       │
       └─ 检查退出条件
             scoreThreshold / minImprovement / maxIterations / rootCauseConfirmed
             满足 → break，生成 RunSummary
```

### 3.2 Session 创建与上下文注入

每个 Pipeline step 创建一个 Jijian session。Orchestrator 负责将上下文注入到 session 中：

```typescript
// Orchestrator 内部
async executeStep(run: HarnessRun, iteration: number, step: PipelineStep) {
  
  // 1. 组装上下文
  const context = await this.assembleContext(run, iteration, step);
  
  // 2. 创建 session（使用 Solution 定义的 session template）
  const session = await this.jijian.createSession({
    templateId: step.sessionTemplateId,
    metadata: {
      harness_run_id: run.id,
      iteration,
      step_id: step.id,
    },
  });

  // 3. 注入上下文到 session 的初始消息
  //    关键：和 CLI 的 "prompt injection" 一样的模式
  //    但通过 Jijian session API 而不是 bash 字符串拼接
  await this.jijian.sendMessage(session.id, {
    role: 'user',
    content: this.buildPrompt(step, context, iteration),
  });

  // 4. 等待 agent 完成
  const result = await this.jijian.waitForCompletion(session.id);
  
  // 5. 提取结构化输出
  return this.extractOutputs(result, step.requiredOutputs);
}
```

### 3.3 上下文组装

```typescript
async assembleContext(run: HarnessRun, iteration: number, step: PipelineStep): Promise<StepContext> {
  const context: StepContext = {};
  
  for (const source of step.contextSources) {
    switch (source.type) {
      case 'spec':
        context.spec = run.task.spec;
        break;
        
      case 'prev_output':
        // 读上一轮某步的结构化输出
        context.prevOutput = await this.storage.getStepOutput(
          run.id, iteration - 1, source.stepId, source.outputKey
        );
        break;
        
      case 'progress':
        // 读历史分数走势
        context.progress = await this.storage.getRunProgress(run.id);
        break;
        
      case 'latest_artifact':
        // 读最新版本的产物
        context.latestArtifact = await this.storage.getLatestArtifact(run.id);
        break;

      case 'entity_ref':
        // 从 Context Layer 读取业务实体
        context.entityRef = await this.contextLayer.resolve(source.entityType, source.entityId);
        break;
    }
  }
  return context;
}
```

### 3.4 Fresh Context 保证

每个 step 是一个**独立的 Jijian session**——天然满足 fresh context 要求。agent 在 session 中没有前几轮的记忆，只有 Orchestrator 注入的文件/数据。

这和 CLI 模式的 `claude -p`（每次调用是独立进程）在语义上完全等价。

---

## 4. HarnessRun 记录

### 4.1 Run 数据结构

```typescript
interface HarnessRun {
  id: string;
  taskId: string;                  // 关联的 HarnessTask
  status: 'running' | 'completed' | 'failed' | 'stopped';
  
  // 触发上下文（谁触发的、从哪里触发的）
  trigger: {
    userId: string;
    tenantId: string;
    entityContext?: { entityType: string; entityId: string };  // 如"从教案 lp_1 触发"
  };

  // 评估标准版本历史（支持运行中动态调整）
  criteriaHistory: {
    version: number;
    criteria: EvalCriteria;
    effectiveFromIteration: number;  // 从哪轮开始生效
    changedAt: string;
    changedBy: string;
    changeReason?: string;           // "互动密度权重从 20 调到 35，因为 simulation 显示互动是瓶颈"
  }[];
  // 初始化时 criteriaHistory = [{ version: 1, criteria: task.evalCriteria, effectiveFromIteration: 1 }]
  // 运行中修改 → append new version

  // 迭代历史
  iterations: IterationRecord[];
  
  // 汇总
  summary?: RunSummary;
  
  // 资源消耗
  totalTokens: number;
  totalCostEstimate: number;
  
  startedAt: string;
  completedAt?: string;
}

interface IterationRecord {
  iteration: number;
  criteriaVersion: number;         // 本轮使用的 criteria 版本
  status: 'completed' | 'failed' | 'reverted';
  
  steps: {
    stepId: string;
    sessionId?: string;            // Jijian session ID（agent step 有，async_mcp step 没有）
    schedulerJobId?: string;       // CCaaS scheduler job ID（async_mcp step 有）
    type: 'agent' | 'async_mcp';
    status: 'completed' | 'failed' | 'skipped' | 'timeout';
    outputs: Record<string, any>;  // 按 OutputSchema 结构化的输出
    tokensUsed: number;            // agent step 才有 token 消耗
    durationMs: number;            // 执行耗时
    startedAt: string;
    completedAt: string;
  }[];
  
  // Iterative 模式的分数
  score?: number;
  scoreChange?: number;            // 相对上一轮的变化（跨 criteria 版本时标注 *）
  
  // Investigation 模式的假设状态
  hypothesisVerdict?: 'CONFIRMED' | 'ELIMINATED' | 'INCONCLUSIVE';
  
  keyChanges: string;
  topIssue: string;
  timestamp: string;
}

interface RunSummary {
  finalScore?: number;
  scoreTrajectory: { iteration: number; score: number; criteriaVersion: number }[];
  totalIterations: number;
  exitReason: string;
  bestIteration: number;
  confirmedHypotheses?: string[];
  criteriaChanges: number;         // criteria 被修改了几次
}
```

### 4.2 Progress 展示

Solution 可以用 `RunSummary` 和 `IterationRecord` 渲染进度视图：

```
┌──────────────────────────────────────────────────┐
│ 教案质量迭代优化 · Run #3                         │
│ 触发：从教案 "SSS/SAS 新授课教案" 启动             │
│ 状态：运行中 · 第 4 轮 / 最多 10 轮                │
├──────────────────────────────────────────────────┤
│ 分数走势：65 → 72 → 78 → 82                      │
│ ████████████████████████████░░░░░  82/100         │
│                                                  │
│ v1: 65  内容覆盖不足，缺少即时练习                  │
│ v2: 72  增加了练习设计，但课标对齐度差              │
│ v3: 78  修复了课标对齐，但教学策略单一              │
│ v4: 82  增加了差异化教学建议（运行中...）           │
│                                                  │
│ Token 消耗：12,400 · 预估费用：$0.37               │
│ [暂停] [停止] [查看详情]                           │
└──────────────────────────────────────────────────┘
```

---

## 5. 与 Session Template 的关系

每个 agent role 对应一个 Jijian session template。Session template 定义了 agent 的全部能力：

```typescript
// 教育 Solution 注册的 session templates（用于 harness）

const generatorTemplate = {
  id: 'edu-harness-generator',
  name: '教案生成/改进 Agent',
  systemPrompt: `
    你是一个教案设计专家。你的任务是基于评估反馈改进教案。
    ## 关键前提
    你运行在 fresh context 中，没有前几轮的记忆。
    你唯一的上下文来源是 Orchestrator 注入给你的数据。
    ...
  `,
  // MCP tools = 这个 agent 能使用的 Solution 工具
  mcpTools: [
    'edu-curriculum-standard',    // 课标查询
    'edu-question-bank',          // 题库搜索
    'edu-learning-analytics',     // 学情数据查询
  ],
  // 这个 agent 的输出格式要求
  outputInstruction: '将改进后的教案写入指定的输出位置，并按 changelog schema 写变更记录。',
};

const evaluatorTemplate = {
  id: 'edu-harness-evaluator',
  name: '教案质量评估 Agent',
  systemPrompt: `
    你是一个独立的教案质量评估者。你没有看过创建过程，也没有投入感情。
    按照评估标准严格打分。
    ...
  `,
  mcpTools: [
    'edu-curriculum-standard',    // 对照课标检查
    // 注意：evaluator 有的 tools 比 generator 少
  ],
};

const investigatorTemplate = {
  id: 'edu-harness-investigator',
  name: '学情异常调查 Agent',
  systemPrompt: `
    你是一个系统化的调查者。你通过验证假设来寻找根因。
    你不修复问题——你找到原因。
    ...
  `,
  mcpTools: [
    'edu-learning-analytics',
    'edu-attendance',
    'edu-classroom-records',
    'edu-grade-book',
  ],
};
```

**关键设计：Session template 是 Solution 定义的，不是平台硬编码的。** 平台只知道"这步用哪个 template"，不知道 template 里有什么 MCP tools 或 system prompt。这让同一个 Orchestrator 可以编排教育的教案迭代、CRM 的话术优化、法律的条款审查——差别全在 session template 和 output schema 里。

---

## 6. Solution Builder 的接入

### 6.1 定义 HarnessTask

```typescript
// 教育 Solution 定义一个迭代任务
const lessonPlanOptimization: HarnessTask = {
  id: 'edu-lesson-plan-optimization',
  name: '教案质量迭代优化',
  mode: 'iterative',
  
  spec: {
    objective: '迭代改进教案，使其在教学内容覆盖、课标对齐、教学策略多样性、练习设计质量四个维度达到 85 分以上',
    frozenConstraints: ['不得改变教案的学科和年级', '不得删除已有的教学活动，只能改进或新增'],
    artifactDescription: '一份完整的教案文档（含教学目标、内容块、练习设计、教学策略）',
  },
  
  agents: [
    { role: 'generator', sessionTemplateId: 'edu-harness-generator' },
    { role: 'evaluator', sessionTemplateId: 'edu-harness-evaluator' },
  ],
  
  pipeline: [
    {
      id: 'generate',
      role: 'generator',
      contextSources: [
        { type: 'spec' },
        { type: 'latest_artifact' },
        { type: 'prev_output', stepId: 'evaluate', outputKey: 'eval-report' },
        { type: 'progress' },
      ],
      requiredOutputs: [
        { schemaId: 'edu-changelog', outputKey: 'changelog' },
      ],
    },
    {
      id: 'evaluate',
      role: 'evaluator',
      contextSources: [
        { type: 'latest_artifact' },
      ],
      requiredOutputs: [
        { schemaId: 'edu-eval-report', outputKey: 'eval-report' },
      ],
      validation: {
        type: 'score_extraction',
        config: { field: 'totalScore', min: 0, max: 100 },
      },
    },
  ],
  
  evalCriteria: {
    dimensions: [
      { name: '教学内容覆盖', weight: 25, detection: '检查教案是否覆盖了课标要求的所有知识点' },
      { name: '课标对齐度', weight: 25, detection: '教学目标是否与课标学业要求一致' },
      { name: '教学策略多样性', weight: 25, detection: '是否使用了多种教学方法（讲授、讨论、实验、练习）' },
      { name: '练习设计质量', weight: 25, detection: '练习是否覆盖多认知层次，是否有梯度' },
    ],
  },
  
  exitConditions: {
    maxIterations: 10,
    scoreThreshold: 85,
    minImprovement: 3,
  },
  
  outputSchemas: [evalReportSchema, changelogSchema],
};
```

### 6.2 触发执行

```typescript
// 教师从教案页面点击"AI 迭代优化"
const run = await harnessRuntime.startRun({
  taskId: 'edu-lesson-plan-optimization',
  userId: teacher.id,
  tenantId: school.id,
  entityContext: { entityType: 'lesson_plan', entityId: 'lp_1' },
  // 初始产物：当前教案内容
  initialArtifact: await lessonPlanService.findOne('lp_1'),
});

// 前端可以轮询或 SSE 监听进度
const progress = await harnessRuntime.getRunProgress(run.id);
```

---

## 7. 与 Context Layer 的集成

Harness Runtime 是 Context Layer 的消费者：

- Pipeline step 的 `contextSources` 可以引用 Context Layer 实体（`type: 'entity_ref'`）
- 每个 step 创建的 session 继承 Context Layer 的 @ 引用能力
- HarnessRun 本身可以标记 `@Referenceable`——教师可以在 Chat 中 @ 引用某次优化记录
- Harness 执行中的 Activity 事件流入 Context Layer（"教师触发了教案优化"出现在 recents 中）

---

## 8. 内部架构

同样遵循 core / nestjs 分层：

```
@kedge-agentic/harness/
  src/
    core/                              ← 纯 TS
      task-registry.ts                 ← 存储 HarnessTask 定义
      orchestrator.ts                  ← 编排循环核心逻辑
      output-extractor.ts             ← 按 OutputSchema 从 session 结果提取数据
      exit-evaluator.ts               ← 退出条件判断
      run-store.ts                     ← Run/Iteration 历史存储
      interfaces.ts

    nestjs/                            ← NestJS 接入层
      harness.module.ts                ← forRoot()
      harness.controller.ts            ← /harness/* API
      harness.constants.ts
```

---

## 9. API

```typescript
// Task 管理
POST   /harness/tasks                 ← 注册 HarnessTask
GET    /harness/tasks                 ← 列出所有任务定义
GET    /harness/tasks/:id             ← 获取任务详情

// Run 管理
POST   /harness/runs                  ← 启动执行（传 taskId + triggerContext + initialArtifact）
GET    /harness/runs                  ← 列出执行历史
GET    /harness/runs/:id              ← 获取执行详情（含所有 iteration）
GET    /harness/runs/:id/progress     ← 获取进度（分数走势 + criteria 版本分割线）
POST   /harness/runs/:id/stop        ← 手动停止
POST   /harness/runs/:id/resume      ← 从中断处恢复

// Criteria 动态调整（运行中）
GET    /harness/runs/:id/criteria     ← 获取当前 criteria + 版本历史
PATCH  /harness/runs/:id/criteria     ← 修改 criteria（自动 version++，下一轮生效）
  { criteria: EvalCriteria, reason: string }

// Iteration 详情
GET    /harness/runs/:id/iterations/:n           ← 获取某轮详情（含 criteriaVersion）
GET    /harness/runs/:id/iterations/:n/steps/:s  ← 获取某步详情（含 sessionId 或 schedulerJobId）
GET    /harness/runs/:id/iterations/:n/outputs   ← 获取结构化输出

// OutputSchema 管理
POST   /harness/output-schemas        ← 注册 OutputSchema
GET    /harness/output-schemas        ← 列出所有 schema
```

---

## 10. 关键设计决策

| 问题 | 决策 | 理由 |
|------|------|------|
| Agent 执行方式 | **每步 = 一个 Jijian session** | 天然 fresh context，复用 Jijian 的 session 管理 |
| Agent 工具 | **Session template 的 MCP 配置** | Solution 定义，平台不硬编码 |
| 外部长时间任务 | **AsyncMcpStep → CCaaS scheduler 轮询** | Orchestrator 不自己轮询，委托给 scheduler |
| Skill 加载 | **engine 有 fs 权限，Skill 文件在文件系统中** | 和 Claude Code 的 / 命令同一模式 |
| 输出格式 | **Solution 预定义 OutputSchema** | 平台按 schema 提取、验证、归档，前端按 schema 渲染 |
| 上下文注入 | **Orchestrator 组装 → 注入 session 初始消息** | 和 CLI 的 prompt injection 同一模式 |
| 同轮跨步骤引用 | **ContextSource 新增 `step_output` 类型** | reviewer 需要读本轮 simulation 的结果 |
| 执行记录 | **平台级 RunStore**，每步关联 session ID 或 scheduler job ID | 可回溯到完整对话历史 |
| Criteria 动态调整 | **版本化 + PATCH API，下一轮生效** | 前端分数走势图在版本变更处画分割线 |
| 退出条件 | **Orchestrator 在每轮结束后检查** | 分数/轮次/改进幅度/根因确认 |
| 与 Context Layer | **消费者关系** | Pipeline 可引用 Context Layer 实体；HarnessRun 可标记 @Referenceable |
| 部署 | **npm 包，Solution 进程内** | 和 Context Layer 一致 |
| 单次 vs 多次 | **HarnessTask 是模板（定义一次），HarnessRun 是实例（每次执行）** | 同一个任务可以对不同实体重复执行 |

---

## 11. 待确认事项（需本地 agent 验证）

### [P1] CCaaS Scheduler 实现状态

AsyncMcpStep 依赖 CCaaS core 的 scheduler。需要确认：

- [ ] scheduler 服务是否已实现？当前状态？
- [ ] 是否支持"注册 poll job"模式：提交 MCP endpoint + 轮询间隔 + 完成条件 → scheduler 自动轮询 → 满足条件后回调
- [ ] scheduler API 的接口规格（注册 job / 查询状态 / 取消）
- [ ] 如果 scheduler 未实现：harness 的 async_mcp step 是否需要内置一个简化版轮询（降级方案）
- [ ] scheduler 宕机时的恢复策略：harness run 是否能从中断的 async step 处恢复

### [P2] Jijian Agentic Engine 的 Skill 文件访问

agent 在 session 中动态加载 Skill 依赖 engine 的 fs 权限。需要确认：

- [ ] engine 在 session 中访问文件系统的权限范围（哪些目录可读？可写？）
- [ ] Skill 文件（SKILL.md）的标准存放路径（`/mnt/skills/`？Solution 自定义？）
- [ ] engine 是否支持 glob/list 操作（agent 能"发现"有哪些 skill 可用）
- [ ] 如果 session template 限定了 fs 访问范围，Skill 目录是否需要显式加入白名单
- [ ] 方式 C（agent 主动读 skill 文件）的实际可行性——agent 是否能识别 SKILL.md 格式并正确执行

### [P3] Session 生命周期与 Orchestrator 的交互

Orchestrator 通过 Jijian API 创建 session → 注入消息 → 等待完成。需要确认：

- [ ] Jijian session API 是否支持"创建 session + 发送初始消息 + 等待 agent 完成"的完整生命周期
- [ ] "agent 完成"的判定方式：agent 主动标记完成？超时？产出特定格式的结尾？
- [ ] 如果 agent 在 session 中卡住（无限循环/等待用户输入），Orchestrator 如何超时终止
- [ ] session 的 token 消耗是否可以通过 API 查询（用于 RunStore 记录 tokensUsed）
- [ ] 单个 session 的最大 context window 限制——如果 reviewer 需要 go through 一份很长的 simulation 结果，是否会超限

### [P4] OutputSchema 的提取方式

agent 在 session 中产出结构化输出。Orchestrator 需要按 OutputSchema 提取。需要确认：

- [ ] agent 的输出存在哪里？session 的最后一条消息？写入 Jijian Storage 的文件？
- [ ] 如果 agent 输出不符合 schema（字段缺失/类型错误），Orchestrator 的降级策略
- [ ] 是否考虑让 agent 通过 structured output（如 JSON mode）直接产出符合 schema 的数据，而不是从自然语言中 regex 提取
- [ ] OutputSchema 的 extractionHint（regex）在什么场景下使用——是作为 fallback 还是主要手段

### [P5] Criteria 动态调整的 UI 层

- [ ] 前端分数走势图跨 criteria 版本时的展示：分割线够了还是需要更明显的提示
- [ ] 修改 criteria 的权限控制：只有 run 的创建者能改？管理员能改？
- [ ] criteria 修改是否需要 human-in-the-loop 确认（弹窗确认"修改后前后分数不可直接比较"）

---

## 12. 场景验证：课堂设计 + Simulation 迭代

用 §11 的待确认事项解决后，以下场景应该可以完整运行：

```typescript
const classroomDesignOptimization: HarnessTask = {
  id: 'edu-classroom-design-iteration',
  name: '课堂设计 + Simulation 迭代优化',
  mode: 'iterative',

  spec: {
    objective: '通过迭代设计和模拟验证，优化课堂教学设计，使互动密度、知识覆盖率、学生参与度达到目标水平',
    frozenConstraints: ['不改变学科/年级/课时', '不删除已有教学环节'],
    artifactDescription: '课堂教学设计文档（含环节、互动、评估节点）',
  },

  agents: [
    { role: 'designer', sessionTemplateId: 'edu-classroom-designer' },
    { role: 'reviewer', sessionTemplateId: 'edu-classroom-reviewer' },
  ],

  pipeline: [
    // Step 1: Designer 调整课堂设计
    {
      id: 'design',
      type: 'agent',
      role: 'designer',
      contextSources: [
        { type: 'spec' },
        { type: 'latest_artifact' },
        { type: 'prev_output', stepId: 'review', outputKey: 'proposal' },
        { type: 'progress' },
      ],
      skills: ['lesson-plan-design-patterns'],   // 教学设计模式 Skill
      requiredOutputs: [
        { schemaId: 'design-changelog', outputKey: 'changelog' },
      ],
    },

    // Step 2: 提交外部 Simulation（异步，可能跑几分钟）
    {
      id: 'simulate',
      type: 'async_mcp',
      mcpTool: 'classroom-simulator:run-simulation',
      inputSources: [
        { type: 'latest_artifact' },              // 最新版课堂设计
      ],
      scheduling: {
        pollInterval: 30,                          // 每 30 秒轮询
        timeout: 1800,                             // 最多等 30 分钟
        completionCondition: "status === 'completed'",
      },
      resultOutputKey: 'simulation-result',
      resultSchemaId: 'simulation-output',
    },

    // Step 3: Reviewer 分析 simulation 结果 + 提出 proposal
    {
      id: 'review',
      type: 'agent',
      role: 'reviewer',
      contextSources: [
        { type: 'spec' },
        { type: 'latest_artifact' },               // 当前课堂设计
        { type: 'step_output', stepId: 'simulate', outputKey: 'simulation-result' },
        { type: 'progress' },
      ],
      skills: [
        'classroom-interaction-analysis',           // 互动密度分析 Skill
        'knowledge-coverage-check',                 // 知识点覆盖率 Skill
      ],
      requiredOutputs: [
        { schemaId: 'review-eval-report', outputKey: 'eval-report' },
        { schemaId: 'review-proposal', outputKey: 'proposal' },
      ],
      validation: {
        type: 'score_extraction',
        config: { field: 'totalScore', min: 0, max: 100 },
      },
    },
  ],

  evalCriteria: {
    dimensions: [
      { name: '互动密度', weight: 30, detection: 'Skill: classroom-interaction-analysis 的输出' },
      { name: '知识覆盖率', weight: 25, detection: 'Skill: knowledge-coverage-check 的输出' },
      { name: '学生参与度', weight: 25, detection: 'Simulation 输出的 engagement_score' },
      { name: '教学节奏', weight: 20, detection: '环节时长分配是否合理' },
    ],
  },

  exitConditions: {
    maxIterations: 8,
    scoreThreshold: 85,
    minImprovement: 3,
  },

  outputSchemas: [
    // designer 的 changelog
    { id: 'design-changelog', name: '设计变更记录', fields: [...] },
    // simulation 的结果
    { id: 'simulation-output', name: 'Simulation 结果', fields: [
      { key: 'engagement_score', type: 'number', required: true, description: '学生参与度评分' },
      { key: 'interaction_events', type: 'array', required: true, description: '互动事件列表' },
      { key: 'knowledge_coverage', type: 'object', required: true, description: '知识点覆盖情况' },
      { key: 'pacing_analysis', type: 'object', required: false, description: '教学节奏分析' },
    ], displayConfig: { layout: 'card', highlightField: 'engagement_score' } },
    // reviewer 的评估报告
    { id: 'review-eval-report', name: '课堂设计评估报告', fields: [
      { key: 'totalScore', type: 'number', required: true, description: '总分' },
      { key: 'dimensions', type: 'array', required: true, description: '各维度分数' },
      { key: 'topIssue', type: 'string', required: true, description: '最大问题' },
    ], displayConfig: { layout: 'card', highlightField: 'totalScore' } },
    // reviewer 的 proposal
    { id: 'review-proposal', name: '改进建议', fields: [
      { key: 'proposals', type: 'array', required: true, description: '具体改进建议列表' },
      { key: 'focusArea', type: 'string', required: true, description: '下一轮应聚焦的维度' },
      { key: 'preserveAreas', type: 'array', required: false, description: '不应改动的部分' },
    ], displayConfig: { layout: 'timeline' } },
  ],
};
```

**执行流程（每轮 3 步）：**

```
Iteration 1:
  [agent]     designer → 基于 SPEC 创建初始课堂设计
  [async_mcp] simulate → 提交 simulation → scheduler 轮询 → 拿到结果
  [agent]     reviewer → 加载分析 Skills → go through simulation 结果 → 打分 72 + 提出 proposal
  → progress: v1 score=72

Iteration 2:
  [agent]     designer → 读 reviewer 的 proposal → 调整设计（聚焦互动密度）
  [async_mcp] simulate → 重新 simulation
  [agent]     reviewer → 分析 → 打分 79 + 新 proposal
  → progress: v2 score=79

（运行中：教研组长 PATCH criteria，互动密度权重 30→40）

Iteration 3:
  [agent]     designer → 读 proposal → 继续优化
  [async_mcp] simulate → ...
  [agent]     reviewer → 按新 criteria 打分 → 76（因为互动权重变了）
  → progress: v3 score=76 criteriaVersion=2 ⚠ 评估标准已调整
  
  ...继续直到 >= 85 或 8 轮用完
```
