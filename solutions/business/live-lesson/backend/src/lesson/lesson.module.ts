import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { ClassroomModule } from '../classroom/classroom.module';

@Module({
  // ClassroomModule is imported for its exported ExerciseTypeRegistry —
  // LessonService needs it to sanitize manifests via per-type plugin dispatch
  // rather than the prior hardcoded sanitizers dict in manifest.utils.ts.
  imports: [TypeOrmModule.forFeature([Lesson]), ClassroomModule],
  controllers: [LessonController],
  providers: [LessonService],
  exports: [LessonService],
})
export class LessonModule {}
