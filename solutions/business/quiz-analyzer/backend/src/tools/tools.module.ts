import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { SimilarityService } from './similarity.service';
import { DatabaseHelperService } from './database-helper.service';
import { Quiz } from '../database/entities/quiz.entity';
import { QuizAnalysis } from '../database/entities/quiz-analysis.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      QuizAnalysis,
    ]),
  ],
  controllers: [ToolsController],
  providers: [
    ToolsService,
    SimilarityService,
    DatabaseHelperService,
  ],
  exports: [ToolsService],
})
export class ToolsModule {}
