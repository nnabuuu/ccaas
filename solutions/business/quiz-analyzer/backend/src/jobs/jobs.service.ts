import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type { SyncField } from '../../../mcp-server/src/common/types';
import { SYNC_FIELDS } from '../../../mcp-server/src/common/types';
import { AnalysisJob } from './entities/analysis-job.entity';
import { JobStep } from './entities/job-step.entity';
import type { JobProgressDto, StepProgress } from './dto/job-progress.dto';

/** Maximum number of retries per step before marking as failed */
export const MAX_RETRIES = 2;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(AnalysisJob)
    private readonly jobRepo: Repository<AnalysisJob>,
    @InjectRepository(JobStep)
    private readonly stepRepo: Repository<JobStep>,
  ) {}

  /**
   * Validate that a field string is a valid SyncField.
   * Provides compile-time type narrowing + runtime validation.
   */
  isValidSyncField(field: string): field is SyncField {
    return (SYNC_FIELDS as readonly string[]).includes(field);
  }

  /**
   * Create a new analysis job with steps for the given fields.
   */
  async createJob(
    sessionId: string,
    template: string,
    fields: SyncField[],
  ): Promise<AnalysisJob> {
    const now = new Date().toISOString();
    const jobId = uuid();

    const job: AnalysisJob = this.jobRepo.create({
      id: jobId,
      session_id: sessionId,
      template,
      status: 'pending',
      total_steps: fields.length,
      completed_steps: 0,
      created_at: now,
      updated_at: now,
      completed_at: null,
    });

    await this.jobRepo.save(job);

    const steps: JobStep[] = fields.map((field) => {
      return this.stepRepo.create({
        id: uuid(),
        job_id: jobId,
        field,
        status: 'pending',
        result: null,
        retry_count: 0,
        error: null,
        created_at: now,
        updated_at: now,
      });
    });

    await this.stepRepo.save(steps);

    this.logger.debug(
      `Created job ${jobId} for session ${sessionId} with ${fields.length} steps`,
    );

    return { ...job, steps };
  }

  /**
   * Start a job — transition from pending to running.
   */
  async startJob(jobId: string): Promise<AnalysisJob> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    job.status = 'running';
    job.updated_at = new Date().toISOString();
    await this.jobRepo.save(job);

    this.logger.debug(`Job ${jobId} started`);
    return job;
  }

  /**
   * Complete a step — mark it as completed with the given value.
   * If all steps are completed, mark the job as completed.
   */
  async completeStep(
    jobId: string,
    field: SyncField,
    value: unknown,
  ): Promise<JobStep | null> {
    const step = await this.stepRepo.findOne({
      where: { job_id: jobId, field },
    });

    if (!step) {
      this.logger.warn(`No step found for job ${jobId}, field ${field}`);
      return null;
    }

    // Only complete pending or failed steps (idempotent for already completed)
    if (step.status === 'completed') {
      return step;
    }

    const now = new Date().toISOString();
    step.status = 'completed';
    step.result = JSON.stringify(value);
    step.updated_at = now;
    await this.stepRepo.save(step);

    // Update job completed_steps count and check if all done
    await this.updateJobProgress(jobId);

    this.logger.debug(`Step ${field} completed for job ${jobId}`);
    return step;
  }

  /**
   * Fail a step — increment retry count or mark as permanently failed.
   * Returns true if the step can be retried, false if exhausted.
   */
  async failStep(
    jobId: string,
    field: SyncField,
    error: string,
  ): Promise<{ canRetry: boolean }> {
    const step = await this.stepRepo.findOne({
      where: { job_id: jobId, field },
    });

    if (!step) {
      this.logger.warn(`No step found for job ${jobId}, field ${field}`);
      return { canRetry: false };
    }

    const now = new Date().toISOString();
    step.retry_count += 1;
    step.error = error;
    step.updated_at = now;

    if (step.retry_count >= MAX_RETRIES) {
      step.status = 'failed';
      await this.stepRepo.save(step);

      // Check if job should be marked as failed
      await this.checkJobFailure(jobId);

      this.logger.warn(
        `Step ${field} permanently failed for job ${jobId} after ${step.retry_count} retries`,
      );
      return { canRetry: false };
    }

    // Reset to pending for retry
    step.status = 'pending';
    await this.stepRepo.save(step);

    this.logger.debug(
      `Step ${field} failed for job ${jobId}, retry ${step.retry_count}/${MAX_RETRIES}`,
    );
    return { canRetry: true };
  }

  /**
   * Get a job by ID with its steps.
   */
  async getJob(jobId: string): Promise<AnalysisJob> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['steps'],
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return job;
  }

  /**
   * Get job progress in DTO format.
   */
  async getJobProgress(jobId: string): Promise<JobProgressDto> {
    const job = await this.getJob(jobId);

    const steps: StepProgress[] = job.steps.map((step) => ({
      field: step.field,
      status: step.status as 'pending' | 'completed' | 'failed',
      retryCount: step.retry_count,
      ...(step.error ? { error: step.error } : {}),
    }));

    return {
      jobId: job.id,
      status: job.status as 'pending' | 'running' | 'completed' | 'failed',
      totalSteps: job.total_steps,
      completedSteps: job.completed_steps,
      steps,
    };
  }

  /**
   * Find the active (running) job for a session, if any.
   */
  async findActiveJobForSession(sessionId: string): Promise<AnalysisJob | null> {
    return this.jobRepo.findOne({
      where: { session_id: sessionId, status: 'running' },
      relations: ['steps'],
    });
  }

  /**
   * Update completed_steps count and check if job is complete.
   */
  private async updateJobProgress(jobId: string): Promise<void> {
    const completedCount = await this.stepRepo.count({
      where: { job_id: jobId, status: 'completed' },
    });

    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    const now = new Date().toISOString();
    job.completed_steps = completedCount;
    job.updated_at = now;

    if (completedCount >= job.total_steps) {
      job.status = 'completed';
      job.completed_at = now;
      this.logger.log(`Job ${jobId} completed (all ${job.total_steps} steps done)`);
    }

    await this.jobRepo.save(job);
  }

  /**
   * Check if any step has permanently failed and mark the job accordingly.
   */
  private async checkJobFailure(jobId: string): Promise<void> {
    const failedSteps = await this.stepRepo.count({
      where: { job_id: jobId, status: 'failed' },
    });

    if (failedSteps > 0) {
      const job = await this.jobRepo.findOne({ where: { id: jobId } });
      if (!job) return;

      job.status = 'failed';
      job.updated_at = new Date().toISOString();
      await this.jobRepo.save(job);

      this.logger.warn(`Job ${jobId} marked as failed (${failedSteps} step(s) failed)`);
    }
  }
}
