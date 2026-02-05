import { Controller, Get, Query, Param } from '@nestjs/common';
import { KnowledgePointsService } from './knowledge-points.service';
import { SearchKnowledgePointsDto } from './dto/search-knowledge-points.dto';

@Controller('api/v1/knowledge-points')
export class KnowledgePointsController {
  constructor(private readonly knowledgePointsService: KnowledgePointsService) {}

  @Get()
  async search(@Query() dto: SearchKnowledgePointsDto) {
    return this.knowledgePointsService.search(dto);
  }

  @Get('tree')
  async getTree(
    @Query('subjectId') subjectId: string,
    @Query('gradeLevel') gradeLevel?: string,
  ) {
    return this.knowledgePointsService.getTree(subjectId, gradeLevel);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.knowledgePointsService.findOne(id);
  }
}
