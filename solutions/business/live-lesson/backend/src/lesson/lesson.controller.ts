import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LessonService } from './lesson.service';

@ApiTags('lessons')
@Controller('lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get()
  findAll() {
    return this.lessonService.findAll();
  }

  @Get(':id/manifest')
  findManifest(@Param('id') id: string) {
    return this.lessonService.findManifest(id);
  }
}
