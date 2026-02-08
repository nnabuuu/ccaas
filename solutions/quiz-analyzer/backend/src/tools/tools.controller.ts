import { Controller, Post, Body, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ToolsService } from './tools.service';

@Controller('api/v1/tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get('health')
  health() {
    return { status: 'ok', message: 'Tools API is running' };
  }

  @Post('write_output')
  async writeOutput(
    @Body() body: { field: string; value: any; preview?: string }
  ) {
    return this.toolsService.writeOutput(body);
  }

  @Post('generate_thinking_process_template')
  async generateTemplate(
    @Body() body: {
      quizContent: string;
      quizType: string;
      knowledgePoints: string[];
    }
  ) {
    return this.toolsService.generateThinkingProcessTemplate(body);
  }

  @Post('search_quizzes')
  async searchQuizzes(
    @Body() body: {
      query?: string;
      subjectId?: string;
      gradeLevel?: string;
      quizType?: string;
      difficulty?: number;
      limit?: number;
    }
  ) {
    return this.toolsService.searchQuizzes(body);
  }

  @Post('get_quiz_details')
  async getQuizDetails(@Body() body: { quizId: string }) {
    if (!body.quizId) {
      throw new HttpException('quizId is required', HttpStatus.BAD_REQUEST);
    }
    return this.toolsService.getQuizDetails(body.quizId);
  }

  @Post('analyze_student_answer')
  async analyzeStudentAnswer(
    @Body() body: {
      quizId: string;
      studentAnswer: string;
      sessionId: string;
      studentId?: string;
    }
  ) {
    return this.toolsService.analyzeStudentAnswer(body);
  }

  @Post('save_student_answer')
  async saveStudentAnswer(@Body() body: any) {
    return this.toolsService.saveStudentAnswer(body);
  }

  @Post('recommend_by_error_pattern')
  async recommendByErrorPattern(
    @Body() body: {
      studentAnswerId: string;
      limit?: number;
      minSimilarity?: number;
      scenario?: 'teacher' | 'student';
    }
  ) {
    return this.toolsService.recommendByErrorPattern(body);
  }

  @Post('get_error_statistics')
  async getErrorStatistics(
    @Body() body: { quizId: string; timeRange?: string }
  ) {
    return this.toolsService.getErrorStatistics(body);
  }

  @Post('parse_quiz')
  async parseQuiz(
    @Body() body: { content: string }
  ) {
    if (!body.content || !body.content.trim()) {
      throw new HttpException('content is required', HttpStatus.BAD_REQUEST);
    }
    return this.toolsService.parseQuiz(body.content);
  }
}
