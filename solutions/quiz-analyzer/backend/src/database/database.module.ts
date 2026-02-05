import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import {
  Subject,
  KnowledgePoint,
  Quiz,
  QuizKnowledgeLink,
  QuizAnalysis,
  BatchAnalysisJob,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(__dirname, '../../data/quiz-analyzer.db'),
      entities: [
        Subject,
        KnowledgePoint,
        Quiz,
        QuizKnowledgeLink,
        QuizAnalysis,
        BatchAnalysisJob,
      ],
      synchronize: false, // Use existing database schema
      logging: process.env.NODE_ENV === 'development',
    }),
  ],
})
export class DatabaseModule {}
