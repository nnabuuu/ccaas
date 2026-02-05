import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BatchAnalysisJob } from '../database/entities';
import { CreateBatchJobDto } from './dto/create-batch-job.dto';

@Injectable()
export class BatchService {
  constructor(
    @InjectRepository(BatchAnalysisJob)
    private batchRepository: Repository<BatchAnalysisJob>,
  ) {}

  async create(dto: CreateBatchJobDto, tenantId: string = 'default', createdBy: string = 'system') {
    const job = this.batchRepository.create({
      id: uuidv4(),
      tenant_id: tenantId,
      name: dto.name,
      quiz_ids: JSON.stringify(dto.quiz_ids),
      total_count: dto.quiz_ids.length,
      completed_count: 0,
      failed_count: 0,
      status: 'pending',
      results: JSON.stringify([]),
      created_by: createdBy,
    });

    return this.batchRepository.save(job);
  }

  async findAll(tenantId: string = 'default', limit: number = 50, offset: number = 0) {
    const [jobs, total] = await this.batchRepository.findAndCount({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      jobs: jobs.map(job => ({
        ...job,
        quiz_ids: JSON.parse(job.quiz_ids),
        results: job.results ? JSON.parse(job.results) : [],
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async findOne(id: string) {
    const job = await this.batchRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Batch job with ID ${id} not found`);
    }

    return {
      ...job,
      quiz_ids: JSON.parse(job.quiz_ids),
      results: job.results ? JSON.parse(job.results) : [],
    };
  }

  async updateStatus(id: string, status: string, startedAt?: string, completedAt?: string) {
    const job = await this.batchRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Batch job with ID ${id} not found`);
    }

    job.status = status;
    if (startedAt) job.started_at = startedAt;
    if (completedAt) job.completed_at = completedAt;

    return this.batchRepository.save(job);
  }

  async updateProgress(
    id: string,
    completedCount: number,
    failedCount: number,
    estimatedCompletion?: string,
  ) {
    const job = await this.batchRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Batch job with ID ${id} not found`);
    }

    job.completed_count = completedCount;
    job.failed_count = failedCount;
    if (estimatedCompletion) job.estimated_completion = estimatedCompletion;

    return this.batchRepository.save(job);
  }

  async addResult(id: string, result: { quizId: string; status: string; error?: string; [key: string]: any }) {
    const job = await this.batchRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Batch job with ID ${id} not found`);
    }

    const results = job.results ? JSON.parse(job.results) : [];
    results.push(result);
    job.results = JSON.stringify(results);

    return this.batchRepository.save(job);
  }

  async cancel(id: string) {
    const job = await this.batchRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Batch job with ID ${id} not found`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return { message: 'Job already finished', job };
    }

    job.status = 'cancelled';
    await this.batchRepository.save(job);

    return { message: 'Job cancelled successfully', job };
  }
}
