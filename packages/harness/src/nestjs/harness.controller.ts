import { Controller, Get, Post, Delete, Param, Body, Query, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { HarnessTask, RunTrigger, RunProgress, HarnessRun, IterationRecord, OutputSchema, RunStore } from '../core/interfaces.js';
import { TaskRegistry } from '../core/task-registry.js';
import { Orchestrator } from '../core/orchestrator.js';
import { OutputSchemaRegistry } from '../core/output-schema-registry.js';
import { HARNESS_RUN_STORE } from './harness.constants.js';

@ApiTags('harness')
@Controller('harness')
export class HarnessController {
  constructor(
    private readonly taskRegistry: TaskRegistry,
    private readonly orchestrator: Orchestrator,
    @Inject(HARNESS_RUN_STORE) private readonly runStore: RunStore,
    private readonly outputSchemaRegistry: OutputSchemaRegistry,
  ) {}

  // ─── Task CRUD ───

  @Post('tasks')
  async registerTask(@Body() task: HarnessTask): Promise<HarnessTask> {
    this.taskRegistry.register(task);
    return task;
  }

  @Get('tasks')
  async listTasks(): Promise<HarnessTask[]> {
    return this.taskRegistry.list();
  }

  @Get('tasks/:taskId')
  async getTask(@Param('taskId') taskId: string): Promise<HarnessTask> {
    const task = this.taskRegistry.get(taskId);
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    return task;
  }

  @Delete('tasks/:taskId')
  async deleteTask(@Param('taskId') taskId: string): Promise<{ ok: boolean }> {
    const existed = this.taskRegistry.remove(taskId);
    if (!existed) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    return { ok: true };
  }

  // ─── Run lifecycle ───

  @Post('runs')
  async startRun(
    @Body() body: { taskId: string; trigger?: RunTrigger },
  ): Promise<HarnessRun> {
    return this.orchestrator.startRun(body.taskId, body.trigger);
  }

  @Get('runs')
  async listRuns(
    @Query('taskId') taskId?: string,
    @Query('status') status?: string,
  ): Promise<HarnessRun[]> {
    return this.runStore.listRuns({ taskId, status });
  }

  @Get('runs/:runId')
  async getRun(@Param('runId') runId: string): Promise<HarnessRun> {
    const run = await this.runStore.getRun(runId);
    if (!run) throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
    return run;
  }

  @Get('runs/:runId/progress')
  async getProgress(@Param('runId') runId: string): Promise<RunProgress> {
    const run = await this.runStore.getRun(runId);
    if (!run) throw new HttpException('Run not found', HttpStatus.NOT_FOUND);

    const task = this.taskRegistry.get(run.taskId);
    const scoredIterations = run.iterations.filter((i) => i.score != null);
    const scoreTrajectory = scoredIterations.map((i) => ({
      iteration: i.iteration,
      score: i.score!,
    }));

    return {
      runId: run.id,
      taskName: task?.name ?? run.taskId,
      status: run.status,
      currentIteration: run.iterations.length,
      maxIterations: task?.exitConditions.maxIterations ?? 0,
      scoreTrajectory,
      latestScore: scoreTrajectory.length > 0
        ? scoreTrajectory[scoreTrajectory.length - 1].score
        : undefined,
      exitReason: run.summary?.exitReason,
    };
  }

  @Post('runs/:runId/stop')
  async stopRun(@Param('runId') runId: string): Promise<void> {
    await this.orchestrator.stopRun(runId);
  }

  @Post('runs/:runId/resume')
  async resumeRun(@Param('runId') runId: string): Promise<void> {
    await this.orchestrator.resumeRun(runId);
  }

  // ─── Iterations ───

  @Get('runs/:runId/iterations/:n')
  async getIteration(
    @Param('runId') runId: string,
    @Param('n') n: string,
  ): Promise<IterationRecord> {
    const run = await this.runStore.getRun(runId);
    if (!run) throw new HttpException('Run not found', HttpStatus.NOT_FOUND);

    const iteration = run.iterations.find((i) => i.iteration === Number(n));
    if (!iteration) {
      throw new HttpException('Iteration not found', HttpStatus.NOT_FOUND);
    }
    return iteration;
  }

  @Get('runs/:runId/iterations/:n/outputs')
  async getIterationOutputs(
    @Param('runId') runId: string,
    @Param('n') n: string,
  ): Promise<Record<string, unknown>> {
    const run = await this.runStore.getRun(runId);
    if (!run) throw new HttpException('Run not found', HttpStatus.NOT_FOUND);

    const iteration = run.iterations.find((i) => i.iteration === Number(n));
    if (!iteration) {
      throw new HttpException('Iteration not found', HttpStatus.NOT_FOUND);
    }

    const outputs: Record<string, unknown> = {};
    for (const step of iteration.steps) {
      for (const [key, value] of Object.entries(step.outputs)) {
        outputs[`${step.stepId}.${key}`] = value;
      }
    }
    return outputs;
  }

  // ─── Callback endpoint (submit_output) ───

  @Post('callback/output')
  async submitOutput(
    @Body()
    body: {
      runId: string;
      iteration: number;
      stepId: string;
      outputKey: string;
      data: unknown;
    },
  ): Promise<{ ok: boolean }> {
    await this.runStore.saveStepOutput(
      body.runId,
      body.iteration,
      body.stepId,
      body.outputKey,
      body.data,
    );
    return { ok: true };
  }

  // ─── Output Schemas (per-task) ───

  @Get('tasks/:taskId/output-schemas')
  async getTaskOutputSchemas(@Param('taskId') taskId: string): Promise<OutputSchema[]> {
    const task = this.taskRegistry.get(taskId);
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    return task.outputSchemas;
  }

  // ─── Output Schemas (global registry) ───

  @Post('output-schemas')
  async registerOutputSchema(@Body() schema: OutputSchema): Promise<OutputSchema> {
    this.outputSchemaRegistry.register(schema);
    return schema;
  }

  @Get('output-schemas')
  async listOutputSchemas(): Promise<OutputSchema[]> {
    return this.outputSchemaRegistry.list();
  }
}
