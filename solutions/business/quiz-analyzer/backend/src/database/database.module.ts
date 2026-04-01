import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import {
  Subject,
  Quiz,
  QuizAnalysis,
  Message,
  ConversationContext,
  Turn,
} from './entities';
import { AnalysisJob } from '../jobs/entities/analysis-job.entity';
import { JobStep } from '../jobs/entities/job-step.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(__dirname, '../../data/quiz-analyzer.db'),
      entities: [
        Subject,
        Quiz,
        QuizAnalysis,
        Message,
        ConversationContext,
        Turn,
        AnalysisJob,
        JobStep,
      ],
      synchronize: false, // Use existing database schema
      logging: process.env.NODE_ENV === 'development',
    }),
  ],
})
export class DatabaseModule {}
