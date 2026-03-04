import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { SessionsModule } from './sessions/sessions.module';
import { SolutionConfigModule } from './config/config.module';
import { CurriculumStandardsModule } from './curriculum-standards/curriculum-standards.module';
import { TextbookModule } from './textbook/textbook.module';
import { FilesModule } from './files/files.module';
import { HooksModule } from './hooks/hooks.module';
import { AttentionFeedModule } from './attention-feed/attention-feed.module';
import { FavoritesModule } from './favorites/favorites.module';
import { SharesModule } from './shares/shares.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AttentionFeedModule,
    LessonPlansModule,
    SessionsModule,
    SolutionConfigModule,
    // Skills are now managed by CCAAS backend, not solution backend
    CurriculumStandardsModule,
    TextbookModule,
    FilesModule,
    HooksModule,
    FavoritesModule,
    SharesModule,
  ],
})
export class AppModule {}
