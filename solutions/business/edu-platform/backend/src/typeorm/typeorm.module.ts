import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { LessonPlan } from '../entities/lesson-plan.entity';
import { ContentBlock } from '../entities/content-block.entity';
import { LessonPlanTemplate } from '../entities/lesson-plan-template.entity';
import { TemplateBlock } from '../entities/template-block.entity';
import { TemplatePromotion } from '../entities/template-promotion.entity';
import { Activity } from '../entities/activity.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: path.resolve(__dirname, '../../data/edu-typeorm.db'),
      entities: [
        LessonPlan,
        ContentBlock,
        LessonPlanTemplate,
        TemplateBlock,
        TemplatePromotion,
        Activity,
      ],
      synchronize: true,
      logging: false,
    }),
  ],
})
export class TypeOrmConfigModule {}
