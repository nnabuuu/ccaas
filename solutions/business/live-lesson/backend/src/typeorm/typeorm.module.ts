import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { Lesson } from '../entities/lesson.entity';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: path.resolve(process.cwd(), 'data/live-lesson.db'),
      entities: [Lesson, Student, Submission, ClassroomSession],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: false,
    }),
  ],
})
export class TypeOrmConfigModule {}
