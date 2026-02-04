import { Module } from '@nestjs/common';
import { LessonPlansController } from './lesson-plans.controller';
import { FilesController } from './files.controller';
import { LessonPlansService } from './lesson-plans.service';

@Module({
  controllers: [LessonPlansController, FilesController],
  providers: [LessonPlansService],
  exports: [LessonPlansService],
})
export class LessonPlansModule {}
