import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { BatchService } from './batch.service';
import { BatchProcessorService } from './batch-processor.service';
import { CreateBatchJobDto } from './dto/create-batch-job.dto';

@Controller('api/v1/batch')
export class BatchController {
  constructor(
    private readonly batchService: BatchService,
    private readonly batchProcessor: BatchProcessorService,
  ) {}

  @Post('analyze')
  async createAnalysisJob(@Body() dto: CreateBatchJobDto) {
    const job = await this.batchService.create(dto);

    // Enqueue for processing
    await this.batchProcessor.enqueue(job.id);

    return {
      message: 'Batch analysis job created',
      job: {
        ...job,
        quiz_ids: JSON.parse(job.quiz_ids),
      },
    };
  }

  @Get('jobs')
  async getAllJobs(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return this.batchService.findAll('default', limit, offset);
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    return this.batchService.findOne(id);
  }

  @Delete('jobs/:id')
  async cancelJob(@Param('id') id: string) {
    return this.batchService.cancel(id);
  }

  @Get('status')
  async getProcessorStatus() {
    return {
      queueSize: this.batchProcessor.getQueueSize(),
      isProcessing: this.batchProcessor.getQueueSize() > 0,
    };
  }
}
