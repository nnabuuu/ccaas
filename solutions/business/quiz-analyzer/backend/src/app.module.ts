import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { AnalysesModule } from './analyses/analyses.module';
import { ToolsModule } from './tools/tools.module';
import { MessagesModule } from './messages/messages.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    QuizzesModule,
    AnalysesModule,
    ToolsModule,
    MessagesModule,
    AgentModule,
  ],
})
export class AppModule {}
