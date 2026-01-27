import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { SessionsModule } from './sessions/sessions.module';
import { SolutionConfigModule } from './config/config.module';
import { TextbookModule } from './textbook/textbook.module';
import { CurriculumStandardsModule } from './curriculum-standards/curriculum-standards.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    LessonPlansModule,
    SessionsModule,
    SolutionConfigModule,
    // Skills are now managed by CCAAS backend, not solution backend
    TextbookModule,
    CurriculumStandardsModule,
  ],
})
export class AppModule {}
