import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import {
  Subject,
  Quiz,
  QuizAnalysis,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(__dirname, '../../data/quiz-analyzer.db'),
      entities: [
        Subject,
        Quiz,
        QuizAnalysis,
      ],
      synchronize: false, // Use existing database schema
      logging: process.env.NODE_ENV === 'development',
    }),
  ],
})
export class DatabaseModule {}
