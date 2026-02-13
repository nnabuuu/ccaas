/**
 * Scheduler Module
 *
 * Provides scheduled task management with cron/interval/once scheduling.
 * Uses headless CLI execution for background task processing.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { HeadlessExecutionService } from './headless-execution.service';
import { ScheduledTask } from './entities/scheduled-task.entity';
import { ScheduledTaskExecution } from './entities/scheduled-task-execution.entity';
import { SessionsModule } from '../sessions/sessions.module';
import { SkillsModule } from '../skills/skills.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ScheduledTask, ScheduledTaskExecution]),
    SessionsModule,   // Provides EventMapperService
    SkillsModule,    // Provides SkillSyncService
    MessagesModule,  // Provides MessagesService
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService, HeadlessExecutionService],
  exports: [SchedulerService, HeadlessExecutionService],
})
export class SchedulerModule {}
