import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { KnowledgePointsModule } from './knowledge-points/knowledge-points.module';
import { AnalysesModule } from './analyses/analyses.module';
import { BatchModule } from './batch/batch.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    QuizzesModule,
    KnowledgePointsModule,
    AnalysesModule,
    BatchModule,
  ],
})
export class AppModule {}
