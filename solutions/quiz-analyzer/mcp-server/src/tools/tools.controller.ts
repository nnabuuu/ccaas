import { Controller, Post, Get, Body, HttpStatus, HttpException } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { KnowledgePointsService } from '../knowledge-points/knowledge-points.service';

@Controller()
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly knowledgePointsService: KnowledgePointsService,
  ) {}

  @Get('health')
  getHealth() {
    const tree = this.knowledgePointsService.getTree();
    return {
      status: 'healthy',
      service: 'quiz-analyzer-mcp',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      knowledgePoints: Object.keys(tree).length,
    };
  }

  // ===== MCP Tools =====

  @Post('tools/write_output')
  writeOutput(@Body() body: { field: string; value: any; preview?: string }) {
    return this.toolsService.writeOutput(body);
  }

  @Post('tools/get_knowledge_points_tree')
  getKnowledgePointsTree(@Body() body: { subjectId?: string; gradeLevel?: string }) {
    const { subjectId, gradeLevel } = body;
    let tree = this.knowledgePointsService.getTree(subjectId);

    if (Array.isArray(tree) && gradeLevel) {
      tree = this.knowledgePointsService.filterTreeByGrade(tree, gradeLevel);
    }

    return {
      status: 'success',
      data: {
        tree,
        totalNodes: Array.isArray(tree)
          ? this.knowledgePointsService.countNodes(tree)
          : 0,
      },
    };
  }

  @Post('tools/verify_knowledge_point_tags')
  verifyKnowledgePointTags(
    @Body() body: { quizContent: string; proposedTags: any[] },
  ) {
    const tree = this.knowledgePointsService.getTree();
    return {
      status: 'success',
      data: {
        instructions:
          "Analyze the quiz content and verify each proposed knowledge point tag. " +
          "For each tag, determine if it's relevant (confidence 0.0-1.0) and mark as verified.",
        availableKnowledgePoints: tree,
      },
    };
  }

  @Post('tools/generate_thinking_process_template')
  generateThinkingProcessTemplate(
    @Body()
    body: {
      quizContent: string;
      quizType: string;
      knowledgePoints: string[];
    },
  ) {
    return this.toolsService.generateThinkingProcessTemplate(body);
  }

  @Post('tools/search_quizzes')
  searchQuizzes(
    @Body()
    body: {
      query?: string;
      subjectId?: string;
      gradeLevel?: string;
      quizType?: string;
      difficulty?: number;
      limit?: number;
    },
  ) {
    return this.toolsService.searchQuizzes(body);
  }

  @Post('tools/search_knowledge_points')
  searchKnowledgePoints(
    @Body()
    body: {
      query?: string;
      subjectId?: string;
      gradeLevel?: string;
      parentId?: string | null;
      limit?: number;
    },
  ) {
    try {
      const results = this.knowledgePointsService.searchKnowledgePoints(body);
      return {
        status: 'success',
        data: {
          knowledgePoints: results,
          count: results.length,
        },
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tools/get_quiz_details')
  getQuizDetails(@Body() body: { quizId: string }) {
    return this.toolsService.getQuizDetails(body.quizId);
  }

  // ===== 分层导航 API =====

  @Post('tools/get_root_categories')
  getRootCategories(@Body() body: { limit?: number }) {
    try {
      const result = this.knowledgePointsService.getRootCategories(body.limit || 50);
      return {
        status: 'success',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tools/get_children_nodes')
  getChildrenNodes(
    @Body()
    body: {
      parentId?: string | null;
      subjectId?: string;
      level?: number;
      limit?: number;
    },
  ) {
    try {
      const result = this.knowledgePointsService.getChildren(body);
      return {
        status: 'success',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tools/get_node_path')
  getNodePath(@Body() body: { nodeId: string }) {
    if (!body.nodeId) {
      throw new HttpException('nodeId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = this.knowledgePointsService.getNodePath(body.nodeId);
      return {
        status: 'success',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tools/search_in_scope')
  searchInScope(
    @Body()
    body: {
      parentId?: string;
      subjectId?: string;
      query: string;
      maxDepth?: number;
      limit?: number;
    },
  ) {
    if (!body.query) {
      throw new HttpException('query is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = this.knowledgePointsService.searchInScope(body);
      return {
        status: 'success',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ===== ERROR-BASED RECOMMENDATION SYSTEM =====

  @Post('tools/analyze_student_answer')
  analyzeStudentAnswer(
    @Body()
    body: {
      quizId: string;
      studentAnswer: string;
      sessionId: string;
      studentId?: string;
    },
  ) {
    if (!body.quizId || !body.studentAnswer || !body.sessionId) {
      throw new HttpException(
        'quizId, studentAnswer, and sessionId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return this.toolsService.analyzeStudentAnswer(body);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tools/recommend_by_error_pattern')
  recommendByErrorPattern(
    @Body()
    body: {
      studentAnswerId: string;
      limit?: number;
      minSimilarity?: number;
      scenario?: 'teacher' | 'student';
    },
  ) {
    if (!body.studentAnswerId) {
      throw new HttpException('studentAnswerId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return this.toolsService.recommendByErrorPattern(body);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tools/get_error_statistics')
  getErrorStatistics(
    @Body()
    body: {
      quizId: string;
      timeRange?: string;
    },
  ) {
    if (!body.quizId) {
      throw new HttpException('quizId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return this.toolsService.getErrorStatistics(body);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tools/save_complete_analysis')
  saveCompleteAnalysis(
    @Body()
    body: {
      quizId: string;
      analysis: {
        quizAnalysis?: string;
        knowledgePointTags?: any[];
        thinkingProcess?: string;
        solutionSteps?: any[];
        commonMistakes?: any[];
        knowledgeGapAnalysis?: string;
        difficulty?: number;
        difficultyRationale?: string;
        timeEstimate?: string;
        relatedQuizzes?: any[];
      };
    },
  ) {
    if (!body.quizId) {
      throw new HttpException('quizId is required', HttpStatus.BAD_REQUEST);
    }

    if (!body.analysis) {
      throw new HttpException('analysis data is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return this.toolsService.saveCompleteAnalysis(body);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
