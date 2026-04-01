import { Controller, Get, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';
import type { JobProgressDto } from './dto/job-progress.dto';
import type { AnalysisJob } from './entities/analysis-job.entity';

@Controller('api/v1/jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** GET /api/v1/jobs/:id — get a job by ID with steps */
  @Get(':id')
  async getJob(@Param('id') id: string): Promise<AnalysisJob> {
    return this.jobsService.getJob(id);
  }

  /** GET /api/v1/jobs/:id/progress — get job progress summary */
  @Get(':id/progress')
  async getJobProgress(@Param('id') id: string): Promise<JobProgressDto> {
    return this.jobsService.getJobProgress(id);
  }
}
