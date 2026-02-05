import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { SearchQuizzesDto } from './dto/search-quizzes.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';

@Controller('api/v1/quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  async search(@Query() dto: SearchQuizzesDto) {
    return this.quizzesService.search(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.quizzesService.findOne(id);
  }

  @Get(':id/analysis')
  async getAnalysis(@Param('id') id: string) {
    const result = await this.quizzesService.findOne(id);
    return {
      quiz: result.quiz,
      knowledge_points: result.knowledgePoints,
      analysis: result.analysis,
    };
  }

  @Post()
  async create(@Body() dto: CreateQuizDto) {
    return this.quizzesService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateQuizDto>) {
    return this.quizzesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.quizzesService.remove(id);
  }

  @Post(':id/knowledge-points')
  async saveKnowledgePointTags(
    @Param('id') id: string,
    @Body() body: {
      tags: Array<{
        id: string;
        confidence: number;
        source: 'question' | 'solution' | 'both';
        note?: string;
      }>;
    },
  ) {
    return this.quizzesService.saveKnowledgePointTags(id, body.tags);
  }

  @Get(':id/knowledge-points/by-source')
  async getKnowledgePointsBySource(@Param('id') id: string) {
    return this.quizzesService.getKnowledgePointsBySource(id);
  }
}
