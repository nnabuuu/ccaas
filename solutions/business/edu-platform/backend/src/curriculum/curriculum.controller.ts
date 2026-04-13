import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurriculumService } from './curriculum.service';

@ApiTags('curriculum')
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @Get('subjects')
  getSubjects() {
    return this.curriculumService.getSubjects();
  }

  @Get('tree')
  getTree(@Query('subject') subject: string, @Query('grade') grade?: string) {
    const nodes = this.curriculumService.getTree(subject, grade);
    return { subject, grade: grade || 'all', total: nodes.length, nodes };
  }

  @Get('nodes/:id/children')
  getChildren(@Param('id') id: string) {
    return this.curriculumService.getChildren(id);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.curriculumService.search(q);
  }
}
