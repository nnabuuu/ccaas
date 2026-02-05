import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SYNC_FIELDS } from '../common/types';
import { validateAndFixField } from '../common/schemas';

@Injectable()
export class ToolsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 写入输出字段
   */
  writeOutput(params: { field: string; value: any; preview?: string }) {
    const { field, value, preview } = params;

    if (!field || !SYNC_FIELDS.includes(field as any)) {
      throw new HttpException(
        {
          status: 'error',
          error: `Invalid field: ${field}. Must be one of: ${SYNC_FIELDS.join(', ')}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const validation = validateAndFixField(field as any, value);

    if (!validation.success) {
      throw new HttpException(
        {
          status: 'error',
          error: `Validation failed: ${validation.errors.join('; ')}`,
          field,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      status: 'success',
      data: {
        field,
        value: validation.data,
        preview: preview || `Updated ${field}`,
      },
    };
  }

  /**
   * 计算难度
   */
  calculateDifficulty(params: {
    knowledgePointCount: number;
    stepCount: number;
    quizType: string;
  }) {
    const { knowledgePointCount, stepCount, quizType } = params;

    const typeWeights: Record<string, number> = {
      选择题: 0.8,
      填空题: 1.0,
      解答题: 1.2,
      证明题: 1.5,
    };

    const weight = typeWeights[quizType] || 1.0;
    const difficulty = Math.min(
      5,
      Math.ceil((knowledgePointCount * 0.5 + stepCount * 0.3) * weight),
    );

    const labels = ['', '简单', '较易', '中等', '较难', '困难'];
    const timeEstimates = [
      '',
      '3-5分钟',
      '5-8分钟',
      '8-12分钟',
      '12-18分钟',
      '18分钟以上',
    ];

    return {
      status: 'success',
      data: {
        difficulty,
        label: labels[difficulty],
        timeEstimate: timeEstimates[difficulty],
        formula: `min(5, ceil((${knowledgePointCount} × 0.5 + ${stepCount} × 0.3) × ${weight}))`,
      },
    };
  }

  /**
   * 生成解题思路模板
   */
  generateThinkingProcessTemplate(params: {
    quizContent: string;
    quizType: string;
    knowledgePoints: string[];
  }) {
    const { quizType, knowledgePoints } = params;

    const templates: Record<string, string> = {
      选择题: `# 解题思路

## 1. 理解题意
- 仔细阅读题目，找出关键信息
- 明确问题要求

## 2. 分析选项
- 逐一分析每个选项
- 使用排除法

## 3. 知识点应用
相关知识点：${knowledgePoints.join(', ')}

## 4. 验证答案
- 检查推理过程
- 确认答案合理性`,

      解答题: `# 解题思路

## 1. 审题
- 理解题目条件
- 明确求解目标
- 识别隐含条件

## 2. 制定策略
相关知识点：${knowledgePoints.join(', ')}
- 选择合适方法
- 规划解题步骤

## 3. 详细求解
[AI将在这里生成具体步骤]

## 4. 检验
- 验证结果合理性
- 检查计算过程`,
    };

    const template = templates[quizType] || templates['解答题'];

    return {
      status: 'success',
      data: {
        template,
        instructions:
          'Use this template as a starting point. Fill in specific details based on the quiz content.',
      },
    };
  }

  /**
   * 搜索题目
   */
  searchQuizzes(params: {
    query?: string;
    subjectId?: string;
    gradeLevel?: string;
    quizType?: string;
    difficulty?: number;
    limit?: number;
  }) {
    let sql = `
      SELECT
        q.id,
        q.content,
        q.quiz_type,
        q.difficulty,
        q.grade_level,
        s.name as subject_name
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE 1=1
    `;

    const sqlParams: any[] = [];

    if (params.query) {
      sql += ` AND q.content LIKE ?`;
      sqlParams.push(`%${params.query}%`);
    }

    if (params.subjectId) {
      sql += ` AND q.subject_id = ?`;
      sqlParams.push(params.subjectId);
    }

    if (params.gradeLevel) {
      sql += ` AND q.grade_level = ?`;
      sqlParams.push(params.gradeLevel);
    }

    if (params.quizType) {
      sql += ` AND q.quiz_type = ?`;
      sqlParams.push(params.quizType);
    }

    if (params.difficulty) {
      sql += ` AND q.difficulty = ?`;
      sqlParams.push(params.difficulty);
    }

    sql += ` ORDER BY q.created_at DESC LIMIT ?`;
    sqlParams.push(params.limit || 20);

    try {
      const quizzes = this.databaseService.query(sql, sqlParams);
      return {
        status: 'success',
        data: {
          quizzes,
          count: quizzes.length,
        },
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取题目详情
   */
  getQuizDetails(quizId: string) {
    if (!quizId) {
      throw new HttpException(
        {
          status: 'error',
          error: 'quizId is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Get quiz
      const quiz = this.databaseService.queryOne(
        `
        SELECT
          q.*,
          s.name as subject_name
        FROM quizzes q
        LEFT JOIN subjects s ON q.subject_id = s.id
        WHERE q.id = ?
      `,
        [quizId],
      );

      if (!quiz) {
        throw new HttpException(
          {
            status: 'error',
            error: 'Quiz not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Get knowledge points
      const knowledgePoints = this.databaseService.query(
        `
        SELECT
          kp.id,
          kp.name,
          kp.code,
          kp.level,
          qkl.confidence_score,
          qkl.link_type
        FROM quiz_knowledge_links qkl
        JOIN knowledge_points kp ON qkl.knowledge_point_id = kp.id
        WHERE qkl.quiz_id = ?
        ORDER BY kp.level ASC
      `,
        [quizId],
      );

      // Get analysis if exists
      const analysis = this.databaseService.queryOne(
        `SELECT * FROM quiz_analyses WHERE quiz_id = ?`,
        [quizId],
      );

      return {
        status: 'success',
        data: {
          quiz,
          knowledgePoints,
          analysis,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
