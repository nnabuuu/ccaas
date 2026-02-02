import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { SessionsModule } from './sessions/sessions.module';
import { SolutionConfigModule } from './config/config.module';
import { TextbookModule } from './textbook/textbook.module';
import { CurriculumStandardsModule } from './curriculum-standards/curriculum-standards.module';
import { ProblemsModule } from './problems/problems.module';
import { ExplanationsModule } from './explanations/explanations.module';
import { KnowledgePointsModule } from './knowledge-points/knowledge-points.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    DatabaseModule,
    // Lesson Plan Designer modules
    LessonPlansModule,
    TextbookModule,
    CurriculumStandardsModule,
    // Problem Explainer modules
    ProblemsModule,
    ExplanationsModule,
    KnowledgePointsModule,
    // Shared modules
    SessionsModule,
    SolutionConfigModule,
  ],
})
export class AppModule {}
