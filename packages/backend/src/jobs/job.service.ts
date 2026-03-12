/**
 * Job Service
 *
 * Manages background job lifecycle: creation, execution, resume, cancel.
 * Coordinates between liteque queue, TypeORM entity, HeadlessExecutionService,
 * and Socket.io notifications.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { JobEntity, type JobStatus } from './entities/job.entity';
import { QueueService, type JobPayload } from './queue.service';
import { HeadlessExecutionService } from '../scheduler/headless-execution.service';
import { StreamRegistryService } from '../sessions/services/stream-registry.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import type { Server } from 'socket.io';

@Injectable()
export class JobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobService.name);
  private ioServer: Server | null = null;
  private lazyLoadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    private readonly queueService: QueueService,
    private readonly headlessExecution: HeadlessExecutionService,
    private readonly moduleRef: ModuleRef,
    private readonly streamRegistry: StreamRegistryService,
  ) {}

  async onModuleInit() {
    // Register queue handlers
    this.queueService.registerHandlers(
      // run handler
      async (job) => {
        const entity = await this.jobRepo.findOneBy({ id: job.data.jobEntityId });
        if (!entity) {
          throw new Error(`Job entity not found: ${job.data.jobEntityId}`);
        }

        // Update status to running
        const bgSessionId = uuidv4();
        entity.status = 'running';
        entity.attempts += 1;
        entity.bgSessionId = bgSessionId;
        entity.startedAt = new Date();
        await this.jobRepo.save(entity);
        this.emitJobUpdate(entity);

        // Execute headlessly
        const result = await this.headlessExecution.executeJob(
          {
            sessionId: bgSessionId,
            tenantId: job.data.tenantId,
            prompt: job.data.prompt,
            mcpServers: job.data.mcpServers,
            enabledSkills: job.data.enabledSkills,
          },
          {
            resumeSessionId: job.data.resumeSessionId,
            preserveWorkspace: true,
            timeoutMs: entity.timeoutMs,
          },
        );

        if (result.exitCode !== 0 && result.exitCode !== null) {
          throw new Error(`CLI exited with code ${result.exitCode}`);
        }

        return {
          resultText: result.resultText,
          tokenUsage: result.tokenUsage,
          exitCode: result.exitCode,
          bgSessionId,
          workspacePath: result.workspacePath || '',
        };
      },
      // onComplete handler
      async (job, result) => {
        const entity = await this.jobRepo.findOneBy({ id: job.data.jobEntityId });
        if (!entity) return;

        entity.status = 'completed';
        entity.resultText = result.resultText;
        entity.completedAt = new Date();
        entity.tokenUsage = result.tokenUsage;

        // Scan workspace for result files
        if (result.workspacePath) {
          entity.resultFiles = this.scanResultFiles(result.workspacePath);
        }

        await this.jobRepo.save(entity);
        this.emitJobUpdate(entity);
        this.logger.log(`Job ${entity.id} completed (${entity.type})`);
      },
      // onError handler
      async (job) => {
        if (!job.data) return;
        const entity = await this.jobRepo.findOneBy({ id: job.data.jobEntityId });
        if (!entity) return;

        const hasRetriesLeft = job.numRetriesLeft > 0;
        entity.status = hasRetriesLeft ? 'pending' : 'failed';
        entity.errorMessage = job.error?.message || 'Unknown error';
        if (!hasRetriesLeft) {
          entity.completedAt = new Date();
        }
        await this.jobRepo.save(entity);
        this.emitJobUpdate(entity);

        this.logger.warn(
          `Job ${entity.id} error: ${entity.errorMessage} (retries left: ${job.numRetriesLeft})`,
        );
      },
    );

    // Lazy-load Socket.io server to avoid circular deps
    this.lazyLoadTimer = setTimeout(async () => {
      try {
        const { SessionsGateway } = await import('../sessions/sessions.gateway');
        const gateway = this.moduleRef.get(SessionsGateway, { strict: false });
        if (gateway?.server) {
          this.ioServer = gateway.server;
          this.logger.log('Socket.io server connected for job notifications');
        }
      } catch {
        this.logger.warn('SessionsGateway not available for job notifications');
      }
    }, 1000);
  }

  onModuleDestroy() {
    if (this.lazyLoadTimer) {
      clearTimeout(this.lazyLoadTimer);
      this.lazyLoadTimer = null;
    }
  }

  /**
   * Create a new background job and optionally enqueue it.
   * When trackingOnly=true, creates a DB record with status=running without enqueuing.
   */
  async create(dto: CreateJobDto): Promise<JobEntity> {
    const entity = this.jobRepo.create({
      tenantId: dto.tenantId,
      type: dto.type,
      name: dto.name,
      prompt: dto.prompt || '',
      sessionId: dto.sessionId,
      messageId: dto.messageId,
      mcpServers: dto.mcpServers,
      enabledSkills: dto.enabledSkills,
      maxAttempts: dto.maxAttempts ?? 3,
      timeoutMs: dto.timeoutMs ?? 600000,
      metadata: dto.metadata,
      status: dto.trackingOnly ? ('running' as JobStatus) : ('pending' as JobStatus),
      startedAt: dto.trackingOnly ? new Date() : undefined,
      attempts: 0,
    });

    const saved = await this.jobRepo.save(entity);

    if (!dto.trackingOnly) {
      // Enqueue to liteque for headless execution
      const payload: JobPayload = {
        jobEntityId: saved.id,
        type: dto.type,
        prompt: dto.prompt,
        tenantId: dto.tenantId,
        mcpServers: dto.mcpServers,
        enabledSkills: dto.enabledSkills,
      };

      await this.queueService.enqueue(payload, {
        numRetries: (dto.maxAttempts ?? 3) - 1,
      });
    }

    this.logger.log(`Created job ${saved.id}: "${saved.name}" (type: ${saved.type}${dto.trackingOnly ? ', tracking-only' : ''})`);
    this.emitJobUpdate(saved);
    return saved;
  }

  /**
   * Update a job's status and metadata (used by tracking-only jobs via MCP tools).
   */
  async update(id: string, dto: UpdateJobDto): Promise<JobEntity> {
    const entity = await this.findById(id);

    if (dto.status) entity.status = dto.status as JobStatus;
    if (dto.resultText) entity.resultText = dto.resultText;
    if (dto.resultFiles) entity.resultFiles = dto.resultFiles;
    if (dto.errorMessage) entity.errorMessage = dto.errorMessage;
    if (dto.progress) entity.progress = dto.progress;
    if (dto.metadata) entity.metadata = { ...entity.metadata, ...dto.metadata };

    // Set completedAt for terminal states
    if (dto.status === 'completed' || dto.status === 'failed' || dto.status === 'cancelled') {
      entity.completedAt = new Date();
    }

    const saved = await this.jobRepo.save(entity);
    this.emitJobUpdate(saved);
    this.logger.log(`Updated job ${saved.id}: status=${saved.status}`);
    return saved;
  }

  /**
   * Resume a failed job by re-enqueuing with --resume flag.
   */
  async resume(id: string): Promise<JobEntity> {
    const entity = await this.findById(id);
    if (entity.status !== 'failed' && entity.status !== 'cancelled') {
      throw new Error(`Cannot resume job with status: ${entity.status}`);
    }

    entity.status = 'pending';
    entity.errorMessage = undefined;
    entity.completedAt = undefined;
    await this.jobRepo.save(entity);

    const payload: JobPayload = {
      jobEntityId: entity.id,
      type: entity.type,
      prompt: entity.prompt,
      tenantId: entity.tenantId,
      mcpServers: entity.mcpServers,
      enabledSkills: entity.enabledSkills,
      resumeSessionId: entity.bgSessionId,
    };

    await this.queueService.enqueue(payload, {
      numRetries: entity.maxAttempts - entity.attempts - 1,
    });

    this.logger.log(`Resumed job ${entity.id} with session ${entity.bgSessionId}`);
    this.emitJobUpdate(entity);
    return entity;
  }

  /**
   * Cancel a job.
   */
  async cancel(id: string): Promise<JobEntity> {
    const entity = await this.findById(id);
    if (entity.status === 'completed' || entity.status === 'cancelled') {
      throw new Error(`Cannot cancel job with status: ${entity.status}`);
    }

    entity.status = 'cancelled';
    entity.completedAt = new Date();
    await this.jobRepo.save(entity);

    this.logger.log(`Cancelled job ${entity.id}`);
    this.emitJobUpdate(entity);
    return entity;
  }

  /**
   * List jobs with optional filters.
   */
  async findAll(filters?: {
    tenantId?: string;
    sessionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.jobRepo.createQueryBuilder('job');

    if (filters?.tenantId) {
      qb.andWhere('job.tenantId = :tenantId', { tenantId: filters.tenantId });
    }
    if (filters?.sessionId) {
      qb.andWhere('job.sessionId = :sessionId', { sessionId: filters.sessionId });
    }
    if (filters?.status) {
      qb.andWhere('job.status = :status', { status: filters.status });
    }

    qb.orderBy('job.createdAt', 'DESC');

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single job by ID.
   */
  async findById(id: string): Promise<JobEntity> {
    const entity = await this.jobRepo.findOneBy({ id });
    if (!entity) {
      throw new NotFoundException(`Job not found: ${id}`);
    }
    return entity;
  }

  /**
   * Get the file path for a job's result file.
   */
  getFilePath(job: JobEntity, filename: string): string | null {
    if (!job.bgSessionId) return null;

    const configService = this.moduleRef.get('ConfigService', { strict: false });
    const workspaceDir = configService?.get?.('workspace.dir', '.agent-workspace') ?? '.agent-workspace';
    const workspacePath = path.join(workspaceDir, 'jobs', job.bgSessionId);

    const filePath = path.join(workspacePath, filename);

    // Security: prevent path traversal
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(workspacePath))) {
      return null;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return filePath;
  }

  /**
   * Scan workspace directory for result files.
   */
  private scanResultFiles(
    workspacePath: string,
  ): { name: string; path: string; size: number; mimeType: string }[] {
    const files: { name: string; path: string; size: number; mimeType: string }[] = [];

    try {
      if (!fs.existsSync(workspacePath)) return files;

      const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
      for (const entry of entries) {
        // Skip hidden dirs and .claude config
        if (entry.name.startsWith('.')) continue;
        if (!entry.isFile()) continue;

        const filePath = path.join(workspacePath, entry.name);
        const stat = fs.statSync(filePath);
        files.push({
          name: entry.name,
          path: entry.name,
          size: stat.size,
          mimeType: this.guessMimeType(entry.name),
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to scan workspace ${workspacePath}: ${error}`);
    }

    return files;
  }

  private guessMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.csv': 'text/csv',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  /**
   * Emit a job_update event via Socket.io and SSE push channel.
   */
  private emitJobUpdate(entity: JobEntity): void {
    const event = {
      type: 'job_update' as const,
      jobId: entity.id,
      sessionId: entity.sessionId,
      messageId: entity.messageId,
      status: entity.status,
      name: entity.name,
      jobType: entity.type,
      progress: entity.progress,
      startedAt: entity.startedAt?.toISOString(),
      completedAt: entity.completedAt?.toISOString(),
      metadata: entity.metadata,
      resultFiles: entity.status === 'completed' ? entity.resultFiles : undefined,
      errorMessage: entity.status === 'failed' ? entity.errorMessage : undefined,
    };

    // Socket.IO push (if available)
    if (this.ioServer) {
      // Emit to tenant-specific room
      this.ioServer.to(`jobs:${entity.tenantId}`).emit('job_update', event);

      // Also emit to session room if available
      if (entity.sessionId) {
        this.ioServer.to(entity.sessionId).emit('job_update', event);
      }
    }

    // SSE push channel (for SSE-mode frontends)
    if (entity.sessionId) {
      this.streamRegistry.emit(`${entity.sessionId}:push`, event as any);
    }
  }
}
