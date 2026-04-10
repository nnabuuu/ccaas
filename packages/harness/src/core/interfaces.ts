// ─── SessionProvider：agent 执行抽象 ───

export interface SessionProvider {
  createSession(params: {
    templateId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ sessionId: string }>;

  sendMessage(sessionId: string, content: string): Promise<void>;

  waitForCompletion(
    sessionId: string,
    opts?: {
      timeoutMs?: number;
      onEvent?: (event: SessionEvent) => void;
    },
  ): Promise<SessionResult>;

  getTokenUsage(sessionId: string): Promise<TokenUsage>;
}

export interface SessionEvent {
  type: 'progress' | 'tool_call' | 'message';
  data: unknown;
}

export interface SessionResult {
  text: string;
  tokensUsed: TokenUsage;
  finishReason: 'completed' | 'timeout' | 'error';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// ─── McpClient：MCP 工具调用抽象 ───

export interface McpClient {
  callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
}

// ─── RunStore：持久化抽象 ───

export interface RunStore {
  createRun(run: HarnessRun): Promise<HarnessRun>;
  updateRun(runId: string, updates: Partial<HarnessRun>): Promise<void>;
  getRun(runId: string): Promise<HarnessRun | null>;
  listRuns(filters?: RunFilters): Promise<HarnessRun[]>;
  appendIteration(
    runId: string,
    iteration: IterationRecord,
  ): Promise<void>;
  saveStepOutput(
    runId: string,
    iteration: number,
    stepId: string,
    outputKey: string,
    data: unknown,
  ): Promise<void>;
  getStepOutput(
    runId: string,
    iteration: number,
    stepId: string,
    outputKey: string,
  ): Promise<unknown | null>;
  saveArtifact(
    runId: string,
    iteration: number,
    artifact: unknown,
  ): Promise<void>;
  getLatestArtifact(runId: string): Promise<unknown | null>;
}

export interface RunFilters {
  taskId?: string;
  status?: string;
}

// ─── HarnessEventEmitter：进度通知抽象 ───

export interface HarnessEventEmitter {
  emit(event: HarnessEvent): void;
}

export interface HarnessEvent {
  type:
    | 'run_started'
    | 'iteration_started'
    | 'step_started'
    | 'step_completed'
    | 'iteration_completed'
    | 'run_completed'
    | 'output_received'
    | 'error';
  runId: string;
  data: unknown;
}

// ─── HarnessTask（任务定义） ───

export interface HarnessTask {
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

export interface EvalCriteria {
  dimensions: {
    name: string;
    weight: number;
    detection: string;
  }[];
}

export interface ExitConditions {
  maxIterations: number;
  scoreThreshold?: number;
  minImprovement?: number;
}

export type PipelineStep = AgentStep | AsyncMcpStep;

export interface AgentStep {
  id: string;
  type: 'agent';
  role: string;
  contextSources: ContextSource[];
  skills?: string[];
  requiredOutputs: { schemaId: string; outputKey: string }[];
  validation?: StepValidation;
}

export interface StepValidation {
  type: 'schema_check' | 'score_extraction' | 'custom_mcp';
  config: Record<string, unknown>;
}

export interface AsyncMcpStep {
  id: string;
  type: 'async_mcp';
  mcpTool: string;
  inputSources: ContextSource[];
  scheduling: SchedulingConfig;
  resultOutputKey: string;
  resultSchemaId: string;
}

export interface SchedulingConfig {
  pollInterval: number;
  timeout: number;
  pollMcpTool?: string;
  completionCondition: string;
}

export type ContextSource =
  | { type: 'spec' }
  | { type: 'prev_output'; stepId: string; outputKey: string }
  | { type: 'progress' }
  | { type: 'latest_artifact' }
  | { type: 'entity_ref'; entityType: string; entityId: string }
  | { type: 'step_output'; stepId: string; outputKey: string };

export interface OutputSchema {
  id: string;
  name: string;
  fields: OutputField[];
  displayConfig?: {
    layout: 'table' | 'card' | 'timeline' | 'diff';
    highlightField?: string;
  };
}

export interface OutputField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  extractionHint?: string;
}

// ─── HarnessRun ───

export interface HarnessRun {
  id: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  trigger: RunTrigger;
  iterations: IterationRecord[];
  summary?: RunSummary;
  totalTokens: number;
  totalCostEstimate: number;
  startedAt: string;
  completedAt?: string;
}

export interface RunTrigger {
  userId?: string;
  tenantId?: string;
  entityContext?: { entityType: string; entityId: string };
}

export interface IterationRecord {
  iteration: number;
  status: 'completed' | 'failed' | 'reverted';
  steps: StepRecord[];
  score?: number;
  scoreChange?: number;
  keyChanges: string;
  topIssue: string;
  timestamp: string;
}

export interface StepRecord {
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

export interface RunSummary {
  finalScore?: number;
  scoreTrajectory: { iteration: number; score: number }[];
  totalIterations: number;
  exitReason: string;
  bestIteration: number;
}

export interface RunProgress {
  runId: string;
  taskName: string;
  status: string;
  currentIteration: number;
  maxIterations: number;
  scoreTrajectory: { iteration: number; score: number }[];
  latestScore?: number;
  exitReason?: string;
}
