/**
 * Scheduler Service
 *
 * Manages scheduled tasks: CRUD operations, cron/interval/timeout registration,
 * execution orchestration with concurrency control and retry logic.
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { ScheduledTask } from './entities/scheduled-task.entity';
import {
  ScheduledTaskExecution,
  ExecutionStatus,
} from './entities/scheduled-task-execution.entity';
import { CreateScheduledTaskDto } from './dto/create-scheduled-task.dto';
import { UpdateScheduledTaskDto } from './dto/update-scheduled-task.dto';
import { HeadlessExecutionService } from './headless-execution.service';
import { MessagesService } from '../messages/messages.service';
import type { Server } from 'socket.io';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private ioServer: Server | null = null;

  constructor(
    @InjectRepository(ScheduledTask)
    private readonly taskRepo: Repository<ScheduledTask>,
    @InjectRepository(ScheduledTaskExecution)
    private readonly executionRepo: Repository<ScheduledTaskExecution>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly headlessExecution: HeadlessExecutionService,
    private readonly messagesService: MessagesService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing scheduler...');

    // Lazily resolve Socket.io server from SessionsGateway to avoid circular deps
    try {
      // Dynamic import to avoid circular module dependency
      const { SessionsGateway } = await import('../sessions/sessions.gateway');
      const gateway = this.moduleRef.get(SessionsGateway, { strict: false });
      if (gateway?.server) {
        this.ioServer = gateway.server;
        this.logger.log('Socket.io server connected for scheduler notifications');
      }
    } catch {
      this.logger.warn('SessionsGateway not available - scheduler will run without real-time notifications');
    }

    await this.restoreActiveSchedules();
    await this.checkMissedRuns();
    this.logger.log('Scheduler initialized');
  }

  onModuleDestroy(): void {
    this.logger.log('Shutting down scheduler...');
    // CronJobs and intervals are automatically cleaned up by SchedulerRegistry
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  async create(dto: CreateScheduledTaskDto): Promise<ScheduledTask> {
    const task = this.taskRepo.create({
      tenantId: dto.tenantId,
      name: dto.name,
      description: dto.description,
      message: dto.message,
      scheduleType: dto.scheduleType,
      scheduleValue: dto.scheduleValue,
      status: 'active',
      mcpServers: dto.mcpServers,
      enabledSkills: dto.enabledSkills,
      maxConcurrent: dto.maxConcurrent ?? 1,
      maxRetries: dto.maxRetries ?? 0,
      retryDelayMs: dto.retryDelayMs ?? 60000,
      timeoutMs: dto.timeoutMs ?? 600000,
      nextRunAt: this.calculateNextRun(dto.scheduleType, dto.scheduleValue),
    });

    const saved = await this.taskRepo.save(task);
    this.registerSchedule(saved);
    this.logger.log(`Created scheduled task ${saved.id}: "${saved.name}" (${saved.scheduleType})`);
    return saved;
  }

  async findAll(query: {
    tenantId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ScheduledTask[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.taskRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total };
  }

  async findOne(id: string): Promise<ScheduledTask> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['executions'],
    });
    if (!task) throw new NotFoundException(`Scheduled task ${id} not found`);

    // Limit executions to last 5 (sorted by startedAt desc)
    if (task.executions?.length > 5) {
      task.executions = task.executions
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 5);
    }

    return task;
  }

  async update(id: string, dto: UpdateScheduledTaskDto): Promise<ScheduledTask> {
    const task = await this.findOne(id);

    // If schedule changed, re-register
    const scheduleChanged =
      (dto.scheduleType && dto.scheduleType !== task.scheduleType) ||
      (dto.scheduleValue && dto.scheduleValue !== task.scheduleValue);

    Object.assign(task, dto);

    if (scheduleChanged) {
      task.nextRunAt = this.calculateNextRun(task.scheduleType, task.scheduleValue);
      this.unregisterSchedule(task.id);
      if (task.status === 'active') {
        this.registerSchedule(task);
      }
    }

    const saved = await this.taskRepo.save(task);
    this.logger.log(`Updated scheduled task ${id}`);
    return saved;
  }

  async softDelete(id: string): Promise<ScheduledTask> {
    const task = await this.findOne(id);
    task.status = 'deleted';
    this.unregisterSchedule(id);
    const saved = await this.taskRepo.save(task);
    this.logger.log(`Soft-deleted scheduled task ${id}`);
    return saved;
  }

  async pause(id: string): Promise<ScheduledTask> {
    const task = await this.findOne(id);
    task.status = 'paused';
    this.unregisterSchedule(id);
    const saved = await this.taskRepo.save(task);
    this.logger.log(`Paused scheduled task ${id}`);
    return saved;
  }

  async resume(id: string): Promise<ScheduledTask> {
    const task = await this.findOne(id);
    task.status = 'active';
    task.nextRunAt = this.calculateNextRun(task.scheduleType, task.scheduleValue);
    this.registerSchedule(task);
    const saved = await this.taskRepo.save(task);
    this.logger.log(`Resumed scheduled task ${id}`);
    return saved;
  }

  async trigger(id: string): Promise<ScheduledTaskExecution> {
    const task = await this.findOne(id);
    return this.triggerExecution(task);
  }

  async findExecutions(
    taskId: string,
    query: { page?: number; limit?: number; status?: string },
  ): Promise<{ data: ScheduledTaskExecution[]; total: number }> {
    const where: Record<string, unknown> = { taskId };
    if (query.status) where.status = query.status;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.executionRepo.findAndCount({
      where,
      order: { startedAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total };
  }

  async findExecution(
    taskId: string,
    execId: string,
  ): Promise<ScheduledTaskExecution> {
    const exec = await this.executionRepo.findOne({
      where: { id: execId, taskId },
    });
    if (!exec) {
      throw new NotFoundException(`Execution ${execId} not found for task ${taskId}`);
    }
    return exec;
  }

  // =========================================================================
  // Schedule Registration
  // =========================================================================

  private registerSchedule(task: ScheduledTask): void {
    const jobName = `scheduled_task_${task.id}`;

    try {
      switch (task.scheduleType) {
        case 'cron': {
          const job = new CronJob(task.scheduleValue, () => {
            this.onScheduledTrigger(task.id);
          });
          this.schedulerRegistry.addCronJob(jobName, job);
          job.start();
          this.logger.log(`Registered cron job for task ${task.id}: ${task.scheduleValue}`);
          break;
        }

        case 'interval': {
          const ms = parseInt(task.scheduleValue, 10);
          if (isNaN(ms) || ms < 1000) {
            this.logger.error(`Invalid interval value for task ${task.id}: ${task.scheduleValue}`);
            return;
          }
          const interval = setInterval(() => {
            this.onScheduledTrigger(task.id);
          }, ms);
          this.schedulerRegistry.addInterval(jobName, interval);
          this.logger.log(`Registered interval for task ${task.id}: ${ms}ms`);
          break;
        }

        case 'once': {
          const targetDate = new Date(task.scheduleValue);
          const delayMs = targetDate.getTime() - Date.now();
          if (delayMs <= 0) {
            this.logger.log(`Once task ${task.id} is in the past, triggering immediately`);
            this.onScheduledTrigger(task.id);
            return;
          }
          const timeout = setTimeout(() => {
            this.onScheduledTrigger(task.id);
          }, delayMs);
          this.schedulerRegistry.addTimeout(jobName, timeout);
          this.logger.log(`Registered one-time task ${task.id}: ${task.scheduleValue}`);
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to register schedule for task ${task.id}: ${error}`,
      );
    }
  }

  private unregisterSchedule(taskId: string): void {
    const jobName = `scheduled_task_${taskId}`;

    try {
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.debug(`Removed cron job: ${jobName}`);
      }
    } catch { /* not found */ }

    try {
      if (this.schedulerRegistry.doesExist('interval', jobName)) {
        this.schedulerRegistry.deleteInterval(jobName);
        this.logger.debug(`Removed interval: ${jobName}`);
      }
    } catch { /* not found */ }

    try {
      if (this.schedulerRegistry.doesExist('timeout', jobName)) {
        this.schedulerRegistry.deleteTimeout(jobName);
        this.logger.debug(`Removed timeout: ${jobName}`);
      }
    } catch { /* not found */ }
  }

  // =========================================================================
  // Execution Orchestration
  // =========================================================================

  private async onScheduledTrigger(taskId: string): Promise<void> {
    try {
      const task = await this.taskRepo.findOne({ where: { id: taskId } });
      if (!task || task.status !== 'active') {
        this.logger.warn(`Task ${taskId} is no longer active, skipping trigger`);
        return;
      }

      await this.triggerExecution(task);

      // Mark 'once' tasks as completed
      if (task.scheduleType === 'once') {
        task.status = 'completed';
        await this.taskRepo.save(task);
        this.unregisterSchedule(taskId);
      }
    } catch (error) {
      this.logger.error(`Scheduled trigger failed for task ${taskId}: ${error}`);
    }
  }

  async triggerExecution(task: ScheduledTask): Promise<ScheduledTaskExecution> {
    // Check concurrency
    const runningCount = await this.executionRepo.count({
      where: { taskId: task.id, status: 'running' },
    });

    if (runningCount >= task.maxConcurrent) {
      this.logger.warn(
        `Task ${task.id} at max concurrency (${runningCount}/${task.maxConcurrent}), skipping`,
      );
      throw new Error(
        `Max concurrency reached (${runningCount}/${task.maxConcurrent})`,
      );
    }

    // Create execution record
    const sessionId = `scheduled_${task.id}_${uuidv4().slice(0, 8)}`;
    const execution = this.executionRepo.create({
      taskId: task.id,
      tenantId: task.tenantId,
      sessionId,
      status: 'running',
      startedAt: new Date(),
      attemptNumber: 1,
    });
    const savedExec = await this.executionRepo.save(execution);

    // Update task timestamps
    task.lastRunAt = new Date();
    task.nextRunAt = this.calculateNextRun(task.scheduleType, task.scheduleValue);
    await this.taskRepo.save(task);

    // Emit start event
    this.emitToRoom(task.tenantId, 'scheduled_task_started', {
      taskId: task.id,
      executionId: savedExec.id,
      sessionId,
    });

    // Run with retry (non-blocking)
    this.runWithRetry(task, savedExec).catch((error) => {
      this.logger.error(`RunWithRetry failed for task ${task.id}: ${error}`);
    });

    return savedExec;
  }

  private async runWithRetry(
    task: ScheduledTask,
    execution: ScheduledTaskExecution,
  ): Promise<void> {
    let attempt = execution.attemptNumber;
    let lastError: string | undefined;

    while (attempt <= task.maxRetries + 1) {
      execution.attemptNumber = attempt;
      await this.executionRepo.save(execution);

      try {
        // Create user message record for persistence
        await this.messagesService.create({
          sessionId: execution.sessionId,
          tenantId: task.tenantId,
          role: 'user',
          content: task.message,
        });

        const onEvent = (event: any) => {
          this.emitToRoom(task.tenantId, event.type, event);
        };

        const result = await this.headlessExecution.execute(task, execution, onEvent);

        // Persist assistant message
        await this.messagesService.create({
          sessionId: execution.sessionId,
          tenantId: task.tenantId,
          role: 'assistant',
          content: result.resultText,
        });

        // Determine status
        const status: ExecutionStatus =
          result.exitCode === 0 || result.exitCode === null
            ? 'success'
            : result.exitCode === -1
              ? 'timeout'
              : 'failed';

        // Update execution
        execution.status = status;
        execution.completedAt = new Date();
        execution.durationMs = Date.now() - execution.startedAt.getTime();
        execution.resultText = result.resultText;
        execution.tokenUsage = result.tokenUsage;

        if (status !== 'success') {
          execution.errorMessage = `CLI exited with code ${result.exitCode}`;
        }

        await this.executionRepo.save(execution);

        // Emit completion event
        this.emitToRoom(task.tenantId, 'scheduled_task_complete', {
          taskId: task.id,
          executionId: execution.id,
          status,
          resultText: result.resultText?.slice(0, 500),
          durationMs: execution.durationMs,
        });

        // If success or timeout, don't retry
        if (status === 'success' || status === 'timeout') {
          return;
        }

        // If failed and retries remaining, fall through to retry
        lastError = execution.errorMessage;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Execution attempt ${attempt} failed for task ${task.id}: ${lastError}`,
        );
      }

      // Check if more retries available
      attempt++;
      if (attempt <= task.maxRetries + 1) {
        this.logger.log(
          `Retrying task ${task.id} in ${task.retryDelayMs}ms (attempt ${attempt}/${task.maxRetries + 1})`,
        );
        await this.delay(task.retryDelayMs);
      }
    }

    // All retries exhausted
    execution.status = 'failed';
    execution.completedAt = new Date();
    execution.durationMs = Date.now() - execution.startedAt.getTime();
    execution.errorMessage = lastError || 'All retry attempts exhausted';
    await this.executionRepo.save(execution);

    this.emitToRoom(task.tenantId, 'scheduled_task_complete', {
      taskId: task.id,
      executionId: execution.id,
      status: 'failed',
      errorMessage: execution.errorMessage,
    });
  }

  // =========================================================================
  // Startup Recovery
  // =========================================================================

  private async restoreActiveSchedules(): Promise<void> {
    const activeTasks = await this.taskRepo.find({
      where: { status: 'active' },
    });

    this.logger.log(`Restoring ${activeTasks.length} active scheduled tasks`);

    for (const task of activeTasks) {
      this.registerSchedule(task);
    }
  }

  private async checkMissedRuns(): Promise<void> {
    const now = new Date();
    const missedTasks = await this.taskRepo.find({
      where: {
        status: 'active',
        nextRunAt: LessThan(now),
      },
    });

    if (missedTasks.length === 0) return;

    this.logger.warn(
      `Found ${missedTasks.length} tasks with missed runs, triggering them now`,
    );

    for (const task of missedTasks) {
      // Skip 'once' tasks that already completed (they should be status=completed)
      try {
        await this.triggerExecution(task);
        this.logger.log(`Triggered missed run for task ${task.id}: "${task.name}"`);
      } catch (error) {
        this.logger.error(`Failed to trigger missed run for task ${task.id}: ${error}`);
      }
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private calculateNextRun(
    scheduleType: string,
    scheduleValue: string,
  ): Date | undefined {
    switch (scheduleType) {
      case 'cron': {
        try {
          const job = new CronJob(scheduleValue, () => {});
          const next = job.nextDate();
          return next.toJSDate();
        } catch {
          return undefined;
        }
      }
      case 'interval': {
        const ms = parseInt(scheduleValue, 10);
        if (isNaN(ms)) return undefined;
        return new Date(Date.now() + ms);
      }
      case 'once': {
        return new Date(scheduleValue);
      }
      default:
        return undefined;
    }
  }

  private emitToRoom(tenantId: string, event: string, data: unknown): void {
    if (!this.ioServer) return;
    this.ioServer.to(`scheduler:${tenantId}`).emit(event, data);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
