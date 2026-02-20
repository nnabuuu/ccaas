import { Controller, Get, Query } from '@nestjs/common';
import { KnowledgePointsService } from './knowledge-points.service';

@Controller()
export class KnowledgePointsController {
  constructor(private readonly knowledgePointsService: KnowledgePointsService) {}

  @Get('subjects')
  getSubjects() {
    return this.knowledgePointsService.getSubjects();
  }

  @Get('knowledge-points')
  getKnowledgePoints(
    @Query('subject') subject: string,
    @Query('grade') grade?: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.knowledgePointsService.getKnowledgePoints(subject, grade, parentId);
  }
}
