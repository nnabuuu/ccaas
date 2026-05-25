import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { LESSON_REPO_PORT } from '../domain/ports/lesson-repo.port';
import { TypeOrmLessonRepository } from '../adapters/persistence/repositories/lesson.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CourseProject, ProjectFile, Lesson])],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    // Port → adapter wiring missed when ProjectService was migrated to the
    // LessonRepoPort interface (commit 71a7df95). Without this the module
    // can't construct ProjectService, blocking backend boot.
    TypeOrmLessonRepository,
    { provide: LESSON_REPO_PORT, useExisting: TypeOrmLessonRepository },
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
