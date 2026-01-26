/**
 * LessonPlansModule
 *
 * NestJS module for lesson plan management.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonPlanEntity } from './entities/lesson-plan.entity';
import { LessonPlansService } from './lesson-plans.service';
import { LessonPlansController } from './lesson-plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LessonPlanEntity])],
  controllers: [LessonPlansController],
  providers: [LessonPlansService],
  exports: [LessonPlansService],
})
export class LessonPlansModule {}
