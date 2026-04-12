import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonPlanTemplate } from '../entities/lesson-plan-template.entity';
import { TemplateBlock } from '../entities/template-block.entity';
import { TemplatePromotion } from '../entities/template-promotion.entity';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonPlanTemplate,
      TemplateBlock,
      TemplatePromotion,
    ]),
    ActivityModule,
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
