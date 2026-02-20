import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { AnalysesModule } from './analyses/analyses.module';
import { ToolsModule } from './tools/tools.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    QuizzesModule,
    AnalysesModule,
    ToolsModule,
    MessagesModule,
  ],
})
export class AppModule {}
