import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseProject } from '../entities/course-project.entity';
import { ProjectFile } from '../entities/project-file.entity';
import { Lesson } from '../entities/lesson.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CourseProject, ProjectFile, Lesson])],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
