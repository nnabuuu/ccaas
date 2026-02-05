import { Injectable, Logger } from '@nestjs/common';
import { BatchService } from './batch.service';
import { AnalysesService } from '../analyses/analyses.service';

interface BatchJob {
  id: string;
  quiz_ids: string[];
  total_count: number;
  completed_count: number;
  failed_count: number;
}

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);
  private queue: Map<string, BatchJob> = new Map();
  private isProcessing = false;

  constructor(
    private readonly batchService: BatchService,
    private readonly analysesService: AnalysesService,
  ) {}

  async enqueue(jobId: string) {
    const job = await this.batchService.findOne(jobId);

    this.queue.set(jobId, {
      id: job.id,
      quiz_ids: job.quiz_ids,
      total_count: job.total_count,
      completed_count: job.completed_count,
      failed_count: job.failed_count,
    });

    this.logger.log(`Job ${jobId} added to queue (${this.queue.size} jobs)`);

    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  private async startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    this.logger.log('Starting batch processor...');

    while (this.queue.size > 0) {
      const [jobId, job] = Array.from(this.queue.entries())[0];
      await this.processJob(job);
      this.queue.delete(jobId);
    }

    this.isProcessing = false;
    this.logger.log('Batch processor finished');
  }

  private async processJob(job: BatchJob) {
    this.logger.log(`Processing job ${job.id} (${job.total_count} quizzes)`);

    try {
      await this.batchService.updateStatus(
        job.id,
        'running',
        new Date().toISOString(),
      );

      const startTime = Date.now();

      for (let i = 0; i < job.quiz_ids.length; i++) {
        const quizId = job.quiz_ids[i];

        // Check for cancellation
        const currentJob = await this.batchService.findOne(job.id);
        if (currentJob.status === 'cancelled') {
          this.logger.log(`Job ${job.id} was cancelled`);
          return;
        }

        try {
          this.logger.debug(`Analyzing quiz ${quizId}...`);

          // Create analysis with default/placeholder values
          // In a real implementation, this would trigger CCAAS AI analysis
          // and the results would be updated via WebSocket events
          const startTime = Date.now();

          try {
            await this.analysesService.create({
              quiz_id: quizId,
              thinking_process: '# AI Analysis Pending\n\nThis analysis will be updated by AI processing...',
              difficulty_rationale: 'Analysis in progress',
              time_estimate: 'Calculating...',
              analyzer_version: '1.0',
              analysis_duration_ms: 0,
            });
          } catch (createError) {
            // If analysis already exists, that's okay - treat as success
            if (createError.status === 409) {
              this.logger.debug(`Quiz ${quizId} analysis already exists, skipping...`);
            } else {
              throw createError;
            }
          }

          const duration = Date.now() - startTime;

          job.completed_count++;
          await this.batchService.addResult(job.id, {
            quizId,
            status: 'completed',
            duration_ms: duration,
          });

          this.logger.debug(`Quiz ${quizId} analysis initialized in ${duration}ms`);
        } catch (error) {
          job.failed_count++;
          const errorMessage = error.message || 'Unknown error';

          this.logger.error(`Failed to analyze quiz ${quizId}: ${errorMessage}`);

          await this.batchService.addResult(job.id, {
            quizId,
            status: 'failed',
            error: errorMessage,
          });
        }

        // Calculate ETA
        const elapsed = Date.now() - startTime;
        const avgTime = elapsed / (i + 1);
        const remaining = job.quiz_ids.length - i - 1;
        const eta = new Date(Date.now() + avgTime * remaining);

        // Update progress
        await this.batchService.updateProgress(
          job.id,
          job.completed_count,
          job.failed_count,
          eta.toISOString(),
        );

        // Rate limiting: 2 quizzes/second
        await this.sleep(500);
      }

      await this.batchService.updateStatus(
        job.id,
        'completed',
        undefined,
        new Date().toISOString(),
      );

      this.logger.log(
        `Job ${job.id} completed: ${job.completed_count} succeeded, ${job.failed_count} failed`,
      );
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      await this.batchService.updateStatus(job.id, 'failed');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  isJobInQueue(jobId: string): boolean {
    return this.queue.has(jobId);
  }
}
