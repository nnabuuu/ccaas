import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonPlan } from '../entities/lesson-plan.entity';
import { ContentBlock } from '../entities/content-block.entity';
import { LessonPlanTemplate } from '../entities/lesson-plan-template.entity';
import { TemplateBlock } from '../entities/template-block.entity';
import { LessonPlanService } from './lesson-plan.service';
import { LessonPlanController } from './lesson-plan.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonPlan,
      ContentBlock,
      LessonPlanTemplate,
      TemplateBlock,
    ]),
    ActivityModule,
  ],
  controllers: [LessonPlanController],
  providers: [LessonPlanService],
  exports: [LessonPlanService],
})
export class LessonPlanModule {}
