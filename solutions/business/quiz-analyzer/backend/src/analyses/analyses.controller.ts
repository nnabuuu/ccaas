import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';

@Controller('api/v1/analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  async create(@Body() dto: CreateAnalysisDto) {
    return this.analysesService.create(dto);
  }

  @Get(':quizId')
  async findByQuizId(@Param('quizId') quizId: string) {
    return this.analysesService.findByQuizId(quizId);
  }

  @Put(':quizId')
  async update(
    @Param('quizId') quizId: string,
    @Body() dto: Partial<CreateAnalysisDto>,
  ) {
    return this.analysesService.update(quizId, dto);
  }

  @Delete(':quizId')
  async remove(@Param('quizId') quizId: string) {
    return this.analysesService.remove(quizId);
  }
}
