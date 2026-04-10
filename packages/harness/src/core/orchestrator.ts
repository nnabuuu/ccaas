import type {
  SessionProvider,
  McpClient,
  RunStore,
  HarnessEventEmitter,
  HarnessRun,
  HarnessTask,
  RunTrigger,
  IterationRecord,
  StepRecord,
  PipelineStep,
  AgentStep,
  AsyncMcpStep,
  OutputSchema,
} from './interfaces.js';
import { TaskRegistry } from './task-registry.js';
import { assembleContext } from './context-assembler.js';
import { extractOutput } from './output-extractor.js';
import { shouldExit } from './exit-evaluator.js';
import { pollUntilComplete } from './async-poller.js';

export class Orchestrator {
  private activeRuns = new Set<string>();

  constructor(
    private sessionProvider: SessionProvider,
    private mcpClient: McpClient,
    private runStore: RunStore,
    private taskRegistry: TaskRegistry,
    private eventEmitter?: HarnessEventEmitter,
  ) {}

  async startRun(
    taskId: string,
    trigger?: RunTrigger,
  ): Promise<HarnessRun> {
    const task = this.taskRegistry.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const run: HarnessRun = {
      id: generateId(),
      taskId,
      status: 'running',
      trigger: trigger ?? {},
      iterations: [],
      totalTokens: 0,
      totalCostEstimate: 0,
      startedAt: new Date().toISOString(),
    };

    await this.runStore.createRun(run);
    this.activeRuns.add(run.id);
    this.eventEmitter?.emit({
      type: 'run_started',
      runId: run.id,
      data: { taskId },
    });

    // Run the iteration loop asynchronously
    this.runLoop(run.id, task).catch(async (err) => {
      await this.runStore.updateRun(run.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      });
      this.eventEmitter?.emit({
        type: 'error',
        runId: run.id,
        data: { error: String(err) },
      });
    });

    return run;
  }

  async stopRun(runId: string): Promise<void> {
    this.activeRuns.delete(runId);
    await this.runStore.updateRun(runId, {
      status: 'stopped',
      completedAt: new Date().toISOString(),
    });
    this.eventEmitter?.emit({
      type: 'run_completed',
      runId,
      data: { reason: 'stopped' },
    });
  }

  async resumeRun(runId: string): Promise<void> {
    const run = await this.runStore.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (run.status !== 'stopped') {
      throw new Error(`Run ${runId} is not stopped (status: ${run.status})`);
    }

    const task = this.taskRegistry.get(run.taskId);
    if (!task) throw new Error(`Task not found: ${run.taskId}`);

    await this.runStore.updateRun(runId, { status: 'running' });
    this.activeRuns.add(runId);

    this.runLoop(runId, task).catch(async (err) => {
      await this.runStore.updateRun(runId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      });
      this.eventEmitter?.emit({
        type: 'error',
        runId,
        data: { error: String(err) },
      });
    });
  }

  private async runLoop(
    runId: string,
    task: HarnessTask,
  ): Promise<void> {
    const run = await this.runStore.getRun(runId);
    if (!run) return;

    const startIteration = run.iterations.length + 1;

    for (
      let i = startIteration;
      i <= task.exitConditions.maxIterations;
      i++
    ) {
      if (!this.activeRuns.has(runId)) return;

      this.eventEmitter?.emit({
        type: 'iteration_started',
        runId,
        data: { iteration: i },
      });

      const stepRecords: StepRecord[] = [];
      let iterationFailed = false;

      for (const step of task.pipeline) {
        if (!this.activeRuns.has(runId)) return;

        this.eventEmitter?.emit({
          type: 'step_started',
          runId,
          data: { iteration: i, stepId: step.id },
        });

        const stepStart = Date.now();
        try {
          const record = await this.executeStep(
            runId,
            task,
            i,
            step,
          );
          stepRecords.push(record);

          this.eventEmitter?.emit({
            type: 'step_completed',
            runId,
            data: { iteration: i, stepId: step.id, status: record.status },
          });
        } catch (err) {
          stepRecords.push({
            stepId: step.id,
            type: step.type,
            status: 'failed',
            outputs: {},
            tokensUsed: 0,
            durationMs: Date.now() - stepStart,
            startedAt: new Date(stepStart).toISOString(),
            completedAt: new Date().toISOString(),
          });
          iterationFailed = true;
          break;
        }
      }

      // Extract score from evaluator step output if available
      const score = this.extractScore(stepRecords);
      const prevRun = await this.runStore.getRun(runId);
      const prevIterations = prevRun?.iterations ?? [];
      const prevScore =
        prevIterations.length > 0
          ? prevIterations[prevIterations.length - 1].score
          : undefined;

      const iterationRecord: IterationRecord = {
        iteration: i,
        status: iterationFailed ? 'failed' : 'completed',
        steps: stepRecords,
        score,
        scoreChange:
          score != null && prevScore != null
            ? score - prevScore
            : undefined,
        keyChanges: `Iteration ${i} completed`,
        topIssue: iterationFailed ? 'Step failure' : 'None',
        timestamp: new Date().toISOString(),
      };

      await this.runStore.appendIteration(runId, iterationRecord);

      // Update token totals
      const iterationTokens = stepRecords.reduce(
        (sum, s) => sum + s.tokensUsed,
        0,
      );
      const currentRun = await this.runStore.getRun(runId);
      if (currentRun) {
        await this.runStore.updateRun(runId, {
          totalTokens: currentRun.totalTokens + iterationTokens,
        });
      }

      this.eventEmitter?.emit({
        type: 'iteration_completed',
        runId,
        data: { iteration: i, score },
      });

      // Check exit conditions
      const latestRun = await this.runStore.getRun(runId);
      if (latestRun) {
        const exitResult = shouldExit(latestRun, task.exitConditions);
        if (exitResult.exit) {
          await this.finalizeRun(runId, exitResult.reason);
          return;
        }
      }
    }

    await this.finalizeRun(runId, 'All iterations completed');
  }

  private async executeStep(
    runId: string,
    task: HarnessTask,
    iteration: number,
    step: PipelineStep,
  ): Promise<StepRecord> {
    const startTime = Date.now();

    if (step.type === 'agent') {
      return this.executeAgentStep(runId, task, iteration, step, startTime);
    } else {
      return this.executeAsyncMcpStep(runId, task, iteration, step, startTime);
    }
  }

  private async executeAgentStep(
    runId: string,
    task: HarnessTask,
    iteration: number,
    step: AgentStep,
    startTime: number,
  ): Promise<StepRecord> {
    const run = await this.runStore.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    const agentConfig = task.agents.find((a) => a.role === step.role);
    if (!agentConfig) {
      throw new Error(`Agent role not found: ${step.role}`);
    }

    // Create session
    const { sessionId } = await this.sessionProvider.createSession({
      templateId: agentConfig.sessionTemplateId,
      metadata: { runId, iteration, stepId: step.id },
    });

    // Assemble context
    const context = await assembleContext(
      run,
      task,
      iteration,
      step,
      this.runStore,
    );

    // Send message and wait for completion
    await this.sessionProvider.sendMessage(sessionId, context);
    const result = await this.sessionProvider.waitForCompletion(sessionId);
    const usage = await this.sessionProvider.getTokenUsage(sessionId);

    // Extract outputs
    const outputs: Record<string, unknown> = {};
    for (const req of step.requiredOutputs) {
      const schema = task.outputSchemas.find((s) => s.id === req.schemaId);
      if (schema) {
        // Check if output was already submitted via callback
        const existing = await this.runStore.getStepOutput(
          runId,
          iteration,
          step.id,
          req.outputKey,
        );
        if (existing != null) {
          outputs[req.outputKey] = existing;
        } else {
          // Fallback: extract from session result
          const extracted = extractOutput(result, schema);
          outputs[req.outputKey] = extracted;
          await this.runStore.saveStepOutput(
            runId,
            iteration,
            step.id,
            req.outputKey,
            extracted,
          );
        }
      }
    }

    return {
      stepId: step.id,
      sessionId,
      type: 'agent',
      status:
        result.finishReason === 'completed' ? 'completed' : 'failed',
      outputs,
      tokensUsed: usage.inputTokens + usage.outputTokens,
      durationMs: Date.now() - startTime,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  private async executeAsyncMcpStep(
    runId: string,
    task: HarnessTask,
    iteration: number,
    step: AsyncMcpStep,
    startTime: number,
  ): Promise<StepRecord> {
    const run = await this.runStore.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    // Assemble input context
    const context = await assembleContext(
      run,
      task,
      iteration,
      step,
      this.runStore,
    );

    // Start the async MCP task
    const startResult = await this.mcpClient.callTool(step.mcpTool, {
      context,
    });

    // Poll for completion
    const pollTool =
      step.scheduling.pollMcpTool ?? step.mcpTool + ':status';
    const pollArgs =
      typeof startResult === 'object' && startResult !== null
        ? (startResult as Record<string, unknown>)
        : {};

    const result = await pollUntilComplete(
      this.mcpClient,
      pollTool,
      pollArgs,
      step.scheduling,
    );

    // Save output
    await this.runStore.saveStepOutput(
      runId,
      iteration,
      step.id,
      step.resultOutputKey,
      result,
    );

    return {
      stepId: step.id,
      type: 'async_mcp',
      status: 'completed',
      outputs: { [step.resultOutputKey]: result },
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  private extractScore(steps: StepRecord[]): number | undefined {
    // Look for score in evaluator step outputs
    for (const step of steps) {
      for (const [, value] of Object.entries(step.outputs)) {
        if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, unknown>;
          if (typeof obj['score'] === 'number') {
            return obj['score'];
          }
          if (typeof obj['totalScore'] === 'number') {
            return obj['totalScore'];
          }
        }
      }
    }
    return undefined;
  }

  private async finalizeRun(
    runId: string,
    exitReason: string,
  ): Promise<void> {
    this.activeRuns.delete(runId);
    const run = await this.runStore.getRun(runId);
    if (!run) return;

    const scoredIterations = run.iterations.filter(
      (i) => i.score != null,
    );
    const scoreTrajectory = scoredIterations.map((i) => ({
      iteration: i.iteration,
      score: i.score!,
    }));

    let bestIteration = 0;
    let bestScore = -Infinity;
    for (const entry of scoreTrajectory) {
      if (entry.score > bestScore) {
        bestScore = entry.score;
        bestIteration = entry.iteration;
      }
    }

    const summary = {
      finalScore:
        scoreTrajectory.length > 0
          ? scoreTrajectory[scoreTrajectory.length - 1].score
          : undefined,
      scoreTrajectory,
      totalIterations: run.iterations.length,
      exitReason,
      bestIteration,
    };

    await this.runStore.updateRun(runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      summary,
    });

    this.eventEmitter?.emit({
      type: 'run_completed',
      runId,
      data: { summary },
    });
  }
}

function generateId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
