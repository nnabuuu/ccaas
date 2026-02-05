/**
 * Job Module
 *
 * Provides background job infrastructure with liteque queue,
 * headless CLI execution, and REST API.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from './entities/job.entity';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { QueueService } from './queue.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity]),
    SchedulerModule, // Provides HeadlessExecutionService
  ],
  controllers: [JobController],
  providers: [JobService, QueueService],
  exports: [JobService],
})
export class JobModule {}
