/**
 * Queue Service
 *
 * Wraps liteque SqliteQueue + Runner to provide background job execution.
 * Uses a separate SQLite database for liteque's internal state.
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildDBClient, SqliteQueue, Runner } from 'liteque';
import type { DequeuedJob, DequeuedJobError } from 'liteque';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface JobPayload {
  jobEntityId: string;
  type: string;
  prompt: string;
  tenantId: string;
  mcpServers?: Record<string, unknown>;
  enabledSkills?: string[];
  resumeSessionId?: string;
}

export interface JobRunResult {
  resultText: string;
  tokenUsage: { input: number; output: number; cached: number };
  exitCode: number | null;
  bgSessionId: string;
  workspacePath: string;
}

export type JobHandler = (job: DequeuedJob<JobPayload>) => Promise<JobRunResult>;
export type JobCompleteHandler = (job: DequeuedJob<JobPayload>, result: JobRunResult) => Promise<void>;
export type JobErrorHandler = (job: DequeuedJobError<JobPayload>) => Promise<void>;

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queue: SqliteQueue<JobPayload>;
  private runner: Runner<JobPayload, JobRunResult>;

  private jobHandler: JobHandler | null = null;
  private completeHandler: JobCompleteHandler | null = null;
  private errorHandler: JobErrorHandler | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
    const dbDir = path.join(workspaceDir, 'data');
    fs.mkdirSync(dbDir, { recursive: true });

    const dbPath = path.join(dbDir, 'jobs-queue.db');
    this.logger.log(`Initializing liteque queue at ${dbPath}`);

    const db = buildDBClient(dbPath, { runMigrations: true, walEnabled: true });

    this.queue = new SqliteQueue<JobPayload>('background_jobs', db, {
      defaultJobArgs: { numRetries: 2 },
      keepFailedJobs: true,
    });

    this.runner = new Runner<JobPayload, JobRunResult>(
      this.queue,
      {
        run: async (job) => {
          if (!this.jobHandler) {
            throw new Error('No job handler registered');
          }
          return this.jobHandler(job);
        },
        onComplete: async (job, result) => {
          if (this.completeHandler) {
            await this.completeHandler(job, result);
          }
        },
        onError: async (job) => {
          if (this.errorHandler) {
            await this.errorHandler(job);
          }
        },
      },
      {
        concurrency: 2,
        pollIntervalMs: 3000,
        timeoutSecs: 600,
      },
    );

    // Start the runner
    this.runner.run().catch((err) => {
      this.logger.error(`Queue runner error: ${err.message}`);
    });
    this.logger.log('Queue runner started');
  }

  onModuleDestroy() {
    this.logger.log('Stopping queue runner...');
    this.runner?.stop();
  }

  /**
   * Register handlers for job execution lifecycle.
   * Called by JobService during its initialization.
   */
  registerHandlers(
    handler: JobHandler,
    onComplete: JobCompleteHandler,
    onError: JobErrorHandler,
  ) {
    this.jobHandler = handler;
    this.completeHandler = onComplete;
    this.errorHandler = onError;
    this.logger.log('Job handlers registered');
  }

  /**
   * Enqueue a new job payload.
   */
  async enqueue(payload: JobPayload, options?: { numRetries?: number }) {
    const result = await this.queue.enqueue(payload, {
      numRetries: options?.numRetries ?? 2,
    });
    this.logger.log(`Enqueued job ${payload.jobEntityId} (type: ${payload.type})`);
    return result;
  }

  /**
   * Get queue stats.
   */
  async stats() {
    return this.queue.stats();
  }
}
