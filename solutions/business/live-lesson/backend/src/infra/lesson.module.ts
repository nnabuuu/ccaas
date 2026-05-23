import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { LessonService } from '../application/lesson/lesson.service';
import { LessonController } from '../adapters/http/lesson.controller';
import { ClassroomModule } from './classroom.module';
import { LESSON_REPO_PORT } from '../domain/ports/lesson-repo.port';
import { TypeOrmLessonRepository } from '../adapters/persistence/repositories/lesson.repository';

@Module({
  // ClassroomModule is imported for its exported ExerciseTypeRegistry —
  // LessonService needs it to sanitize manifests via per-type plugin dispatch
  // rather than the prior hardcoded sanitizers dict in manifest.utils.ts.
  imports: [TypeOrmModule.forFeature([Lesson]), ClassroomModule],
  controllers: [LessonController],
  providers: [
    LessonService,
    TypeOrmLessonRepository,
    { provide: LESSON_REPO_PORT, useExisting: TypeOrmLessonRepository },
  ],
  exports: [LessonService],
})
export class LessonModule {}
