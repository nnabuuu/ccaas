import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { Quiz, QuizKnowledgeLink, QuizAnalysis } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Quiz, QuizKnowledgeLink, QuizAnalysis])],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
