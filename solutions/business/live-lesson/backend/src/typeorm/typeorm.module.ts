import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { Lesson } from '../entities/lesson.entity';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ClassroomSnapshot } from '../entities/classroom-snapshot.entity';
import { ObservationRecord, ObserverEventRecord } from '@kedge-agentic/observer-engine';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: path.resolve(process.cwd(), 'data/live-lesson.db'),
      entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ClassroomSnapshot, ObservationRecord, ObserverEventRecord],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: false,
    }),
  ],
})
export class TypeOrmConfigModule {}
