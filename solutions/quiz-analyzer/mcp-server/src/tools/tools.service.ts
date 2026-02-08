import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SYNC_FIELDS } from '../common/types';
import { validateAndFixField } from '../common/schemas';
import { ErrorStep, ErrorPattern, StudentAnswer, EnhancedRelatedQuiz, ErrorType } from '../types';
import { StudentAnswerSchema } from '../schemas';
import {
  calculateErrorTypeSimilarity,
  calculateStepSimilarity,
  calculateKnowledgePointSimilarity,
  calculateOverallSimilarity,
  generateRecommendationReason,
} from '../similarity';
import { v4 as uuidv4 } from 'uuid';

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

  // ============ ERROR-BASED RECOMMENDATION SYSTEM ============

  /**
   * Analyze student answer and identify error patterns
   * This is a placeholder - actual AI analysis should be done by Agent Skill
   * This method saves the analysis result to database
   */
  analyzeStudentAnswer(params: {
    quizId: string;
    studentAnswer: string;
    sessionId: string;
    studentId?: string;
  }) {
    const { quizId, studentAnswer, sessionId, studentId } = params;

    // Get quiz details
    const quiz = this.databaseService.queryOne(
      `SELECT q.*, qa.solution_steps
       FROM quizzes q
       LEFT JOIN quiz_analyses qa ON q.id = qa.quiz_id
       WHERE q.id = ?`,
      [quizId],
    );

    if (!quiz) {
      throw new HttpException('Quiz not found', HttpStatus.NOT_FOUND);
    }

    // Return instructions for AI agent to analyze the answer
    return {
      status: 'success',
      data: {
        instructions: `Analyze the student's answer and identify error patterns.

**Quiz Content**: ${quiz.content}
**Correct Answer**: ${quiz.correct_answer || 'Not available'}
**Standard Solution Steps**: ${quiz.solution_steps || 'Not available'}
**Student Answer**: ${studentAnswer}

Please analyze:
1. Is the answer correct? (true/false)
2. If incorrect, identify each error step:
   - stepNumber: Which step in the solution (1-indexed)
   - errorType: Choose from: ${Object.values(ErrorType).join(', ')}
   - errorDescription: Natural language description (Chinese)
   - affectedKnowledgePoints: Knowledge point IDs (empty array if unknown)
   - severity: 'critical' | 'major' | 'minor'
   - correctApproach: What should have been done

Return the analysis in StudentAnswer format with all required fields.

To save the analysis, call this endpoint again with the complete StudentAnswer object.`,
        quiz: {
          id: quiz.id,
          content: quiz.content,
          correctAnswer: quiz.correct_answer,
          solutionSteps: quiz.solution_steps,
        },
        sessionId,
        studentId,
      },
    };
  }

  /**
   * Save analyzed student answer to database
   */
  saveStudentAnswer(studentAnswer: StudentAnswer) {
    try {
      // Validate schema
      const validation = StudentAnswerSchema.safeParse(studentAnswer);
      if (!validation.success) {
        throw new HttpException(
          `Validation failed: ${validation.error.errors.map(e => e.message).join('; ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Insert student answer
      this.databaseService.execute(
        `INSERT INTO student_answers (
          id, quiz_id, student_id, session_id, answer_content,
          steps_attempted, submitted_at, is_correct, error_steps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentAnswer.id,
          studentAnswer.quizId,
          studentAnswer.studentId || null,
          studentAnswer.sessionId,
          studentAnswer.answerContent,
          JSON.stringify(studentAnswer.stepsAttempted || []),
          studentAnswer.submittedAt,
          studentAnswer.isCorrect ? 1 : 0,
          JSON.stringify(studentAnswer.errorSteps),
        ],
      );

      // Insert individual error steps for efficient querying
      for (const errorStep of studentAnswer.errorSteps) {
        const errorStepId = uuidv4();
        this.databaseService.execute(
          `INSERT INTO error_steps (
            id, student_answer_id, step_number, error_type,
            error_description, affected_knowledge_points,
            severity, correct_approach
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            errorStepId,
            studentAnswer.id,
            errorStep.stepNumber,
            errorStep.errorType,
            errorStep.errorDescription,
            JSON.stringify(errorStep.affectedKnowledgePoints),
            errorStep.severity,
            errorStep.correctApproach,
          ],
        );

        // Update error patterns (aggregation)
        this.updateErrorPattern(studentAnswer.quizId, errorStep, studentAnswer.studentId);
      }

      return {
        status: 'success',
        data: {
          studentAnswerId: studentAnswer.id,
          message: 'Student answer saved successfully',
        },
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Update aggregated error pattern statistics
   */
  private updateErrorPattern(quizId: string, errorStep: ErrorStep, studentId?: string) {
    // Check if pattern exists
    const existingPattern = this.databaseService.queryOne(
      `SELECT * FROM error_patterns
       WHERE quiz_id = ? AND error_type = ? AND step_number = ?`,
      [quizId, errorStep.errorType, errorStep.stepNumber],
    );

    const now = new Date().toISOString();

    if (existingPattern) {
      // Update existing pattern
      const descriptions = JSON.parse(existingPattern.descriptions || '[]');
      descriptions.push(errorStep.errorDescription);

      // Keep only last 20 descriptions
      const updatedDescriptions = descriptions.slice(-20);

      // Count unique students
      const uniqueStudents = this.countUniqueStudentsForPattern(
        existingPattern.id,
        studentId,
      );

      this.databaseService.execute(
        `UPDATE error_patterns
         SET total_occurrences = total_occurrences + 1,
             unique_students = ?,
             descriptions = ?,
             last_seen_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [uniqueStudents, JSON.stringify(updatedDescriptions), now, now, existingPattern.id],
      );
    } else {
      // Create new pattern
      const patternId = uuidv4();
      this.databaseService.execute(
        `INSERT INTO error_patterns (
          id, quiz_id, error_type, step_number,
          total_occurrences, unique_students, descriptions,
          related_knowledge_points, first_seen_at, last_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patternId,
          quizId,
          errorStep.errorType,
          errorStep.stepNumber,
          1,
          1,
          JSON.stringify([errorStep.errorDescription]),
          JSON.stringify(errorStep.affectedKnowledgePoints),
          now,
          now,
          now,
        ],
      );
    }
  }

  /**
   * Count unique students who made this error
   */
  private countUniqueStudentsForPattern(patternId: string, newStudentId?: string): number {
    const pattern = this.databaseService.queryOne(
      `SELECT quiz_id, error_type, step_number FROM error_patterns WHERE id = ?`,
      [patternId],
    );

    if (!pattern) return 1;

    const result = this.databaseService.queryOne(
      `SELECT COUNT(DISTINCT CASE WHEN student_id IS NULL THEN id ELSE student_id END) as count
       FROM student_answers sa
       JOIN error_steps es ON sa.id = es.student_answer_id
       WHERE sa.quiz_id = ? AND es.error_type = ? AND es.step_number = ?`,
      [pattern.quiz_id, pattern.error_type, pattern.step_number],
    );

    return result?.count || 1;
  }

  /**
   * Get quiz recommendations based on error patterns
   */
  recommendByErrorPattern(params: {
    studentAnswerId: string;
    limit?: number;
    minSimilarity?: number;
    scenario?: 'teacher' | 'student';
  }) {
    const { studentAnswerId, limit = 5, minSimilarity = 0.5 } = params;

    // Get student answer with error steps
    const studentAnswer = this.databaseService.queryOne(
      `SELECT * FROM student_answers WHERE id = ?`,
      [studentAnswerId],
    );

    if (!studentAnswer) {
      throw new HttpException('Student answer not found', HttpStatus.NOT_FOUND);
    }

    const errorSteps: ErrorStep[] = JSON.parse(studentAnswer.error_steps || '[]');

    if (errorSteps.length === 0) {
      return {
        status: 'success',
        data: {
          recommendations: [],
          message: 'No errors found in student answer',
        },
      };
    }

    // Extract error types for querying
    const errorTypes = errorSteps.map(e => e.errorType);

    // Find quizzes with similar error patterns
    const candidates = this.databaseService.query(
      `SELECT DISTINCT
         q.id,
         q.content,
         q.quiz_type,
         q.difficulty,
         q.grade_level,
         ep.id as pattern_id,
         ep.error_type,
         ep.step_number,
         ep.total_occurrences,
         ep.unique_students,
         ep.descriptions
       FROM error_patterns ep
       JOIN quizzes q ON ep.quiz_id = q.id
       WHERE ep.error_type IN (${errorTypes.map(() => '?').join(',')})
         AND q.id != ?
       ORDER BY ep.total_occurrences DESC`,
      [...errorTypes, studentAnswer.quiz_id],
    );

    // Group by quiz and calculate similarity
    const quizMap = new Map<string, any>();

    for (const row of candidates) {
      if (!quizMap.has(row.id)) {
        quizMap.set(row.id, {
          id: row.id,
          content: row.content,
          quizType: row.quiz_type,
          difficulty: row.difficulty,
          gradeLevel: row.grade_level,
          errorPatterns: [],
          knowledgePoints: [],
        });
      }

      const quiz = quizMap.get(row.id);
      quiz.errorPatterns.push({
        id: row.pattern_id,
        quizId: row.id,
        errorType: row.error_type,
        stepNumber: row.step_number,
        totalOccurrences: row.total_occurrences,
        uniqueStudents: row.unique_students,
        descriptions: JSON.parse(row.descriptions || '[]'),
      });
    }

    // Calculate similarity for each candidate
    const scored: EnhancedRelatedQuiz[] = [];

    for (const [quizId, quiz] of quizMap.entries()) {
      // Get knowledge points for this quiz
      const kpRows = this.databaseService.query(
        `SELECT knowledge_point_id FROM quiz_knowledge_links WHERE quiz_id = ?`,
        [quizId],
      );
      quiz.knowledgePoints = kpRows.map((r: any) => r.knowledge_point_id);

      // Get knowledge points from student's answer
      const affectedKPs = Array.from(
        new Set(errorSteps.flatMap(e => e.affectedKnowledgePoints)),
      );

      // Calculate similarity scores
      const errorTypeSim = calculateErrorTypeSimilarity(errorSteps, quiz.errorPatterns);
      const stepSim = calculateStepSimilarity(errorSteps, quiz.errorPatterns);
      const kpSim = calculateKnowledgePointSimilarity(affectedKPs, quiz.knowledgePoints);
      const overall = calculateOverallSimilarity(errorTypeSim, stepSim, kpSim);

      if (overall >= minSimilarity) {
        // Extract matched error types
        const matchedTypes = new Map<ErrorType, { count: number; example: string }>();

        for (const pattern of quiz.errorPatterns) {
          if (errorSteps.some(e => e.errorType === pattern.errorType)) {
            const existing = matchedTypes.get(pattern.errorType);
            if (!existing || pattern.totalOccurrences > existing.count) {
              matchedTypes.set(pattern.errorType, {
                count: pattern.totalOccurrences,
                example: pattern.descriptions[0] || '',
              });
            }
          }
        }

        // Extract matched step numbers
        const matchedSteps: number[] = Array.from(
          new Set(
            quiz.errorPatterns
              .filter((p: any) => errorSteps.some(e => e.errorType === p.errorType))
              .map((p: any) => p.stepNumber)
              .filter((s: any) => s !== null && typeof s === 'number'),
          ),
        ) as number[];

        // Generate recommendation reason
        const errorTypeList = Array.from(matchedTypes.keys());
        const totalOccurrences = Array.from(matchedTypes.values()).reduce(
          (sum, v) => sum + v.count,
          0,
        );
        const reason = generateRecommendationReason(errorTypeList, totalOccurrences, matchedSteps);

        scored.push({
          id: quiz.id,
          content: quiz.content,
          similarity: overall,
          sharedKnowledgePoints: quiz.knowledgePoints.filter((kp: string) =>
            affectedKPs.includes(kp),
          ),
          matchedErrorTypes: Array.from(matchedTypes.entries()).map(([type, data]) => ({
            errorType: type,
            frequency: data.count,
            exampleDescription: data.example,
          })),
          matchedErrorSteps: matchedSteps,
          errorSimilarityScore: errorTypeSim,
          knowledgePointSimilarityScore: kpSim,
          overallSimilarityScore: overall,
          recommendationReason: reason,
        });
      }
    }

    // Sort by overall similarity and limit
    const recommendations = scored
      .sort((a, b) => b.overallSimilarityScore - a.overallSimilarityScore)
      .slice(0, limit);

    return {
      status: 'success',
      data: {
        recommendations,
        count: recommendations.length,
      },
    };
  }

  /**
   * Get error statistics for a quiz
   */
  getErrorStatistics(params: { quizId: string; timeRange?: string }) {
    const { quizId, timeRange } = params;

    // Calculate time range filter
    let timeFilter = '';
    if (timeRange === 'last_7_days') {
      timeFilter = `AND sa.submitted_at >= datetime('now', '-7 days')`;
    } else if (timeRange === 'last_30_days') {
      timeFilter = `AND sa.submitted_at >= datetime('now', '-30 days')`;
    } else if (timeRange === 'last_90_days') {
      timeFilter = `AND sa.submitted_at >= datetime('now', '-90 days')`;
    }

    // Get total attempts
    const totalResult = this.databaseService.queryOne(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM student_answers
       WHERE quiz_id = ? ${timeFilter}`,
      [quizId],
    );

    const totalAttempts = totalResult?.total || 0;
    const correctCount = totalResult?.correct || 0;
    const correctRate = totalAttempts > 0 ? correctCount / totalAttempts : 0;

    // Get error patterns
    const patterns = this.databaseService.query(
      `SELECT * FROM error_patterns
       WHERE quiz_id = ?
       ORDER BY total_occurrences DESC`,
      [quizId],
    );

    const errorPatterns = patterns.map((p: any) => {
      const descriptions = JSON.parse(p.descriptions || '[]');

      // Count occurrences for each unique description
      const descMap = new Map<string, number>();
      for (const desc of descriptions) {
        descMap.set(desc, (descMap.get(desc) || 0) + 1);
      }

      // Get top descriptions
      const topDescriptions = Array.from(descMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([desc, count]) => `${desc} (${count}次)`);

      return {
        errorType: p.error_type,
        stepNumber: p.step_number,
        occurrences: p.total_occurrences,
        percentage: totalAttempts > 0 ? p.total_occurrences / totalAttempts : 0,
        topDescriptions,
        relatedKnowledgePoints: JSON.parse(p.related_knowledge_points || '[]'),
      };
    });

    return {
      status: 'success',
      data: {
        totalAttempts,
        correctRate,
        errorPatterns,
      },
    };
  }

  /**
   * Save complete quiz analysis to database
   * This calls the backend's save-analysis API
   */
  async saveCompleteAnalysis(params: {
    quizId: string;
    analysis: {
      quizAnalysis?: string;
      knowledgePointTags?: any[];
      thinkingProcess?: string;
      solutionSteps?: any[];
      commonMistakes?: any[];
      knowledgeGapAnalysis?: string;
      difficultyAnalysis?: any;
      relatedQuizzes?: any[];
    };
  }) {
    const { quizId, analysis } = params;

    try {
      // Call the backend save-analysis API
      // Note: In production, this should use an HTTP client to call the backend
      // For now, we'll directly save to the database using the same logic

      // Check if quiz exists
      const quiz = this.databaseService.queryOne(
        'SELECT * FROM quizzes WHERE id = ?',
        [quizId]
      );

      if (!quiz) {
        throw new HttpException(
          `Quiz with ID ${quizId} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      // Check if analysis already exists
      const existingAnalysis = this.databaseService.queryOne(
        'SELECT * FROM quiz_analyses WHERE quiz_id = ?',
        [quizId]
      );

      const now = new Date().toISOString();

      if (existingAnalysis) {
        // Update existing analysis
        this.databaseService.execute(
          `UPDATE quiz_analyses SET
            quiz_analysis = ?,
            knowledge_point_tags = ?,
            thinking_process = ?,
            solution_steps = ?,
            common_mistakes = ?,
            knowledge_gap_analysis = ?,
            difficulty_analysis = ?,
            related_quizzes = ?,
            analyzed_at = ?,
            analyzer_version = '2.0'
          WHERE quiz_id = ?`,
          [
            analysis.quizAnalysis || existingAnalysis.quiz_analysis,
            analysis.knowledgePointTags ? JSON.stringify(analysis.knowledgePointTags) : existingAnalysis.knowledge_point_tags,
            analysis.thinkingProcess || existingAnalysis.thinking_process,
            analysis.solutionSteps ? JSON.stringify(analysis.solutionSteps) : existingAnalysis.solution_steps,
            analysis.commonMistakes ? JSON.stringify(analysis.commonMistakes) : existingAnalysis.common_mistakes,
            analysis.knowledgeGapAnalysis || existingAnalysis.knowledge_gap_analysis,
            analysis.difficultyAnalysis ? JSON.stringify(analysis.difficultyAnalysis) : existingAnalysis.difficulty_analysis,
            analysis.relatedQuizzes ? JSON.stringify(analysis.relatedQuizzes) : existingAnalysis.related_quizzes,
            now,
            quizId,
          ]
        );
      } else {
        // Create new analysis
        const analysisId = uuidv4();
        this.databaseService.execute(
          `INSERT INTO quiz_analyses (
            id, quiz_id, quiz_analysis, knowledge_point_tags,
            thinking_process, solution_steps, common_mistakes,
            knowledge_gap_analysis, difficulty_analysis,
            related_quizzes, analyzed_at, analyzer_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            analysisId,
            quizId,
            analysis.quizAnalysis || null,
            analysis.knowledgePointTags ? JSON.stringify(analysis.knowledgePointTags) : null,
            analysis.thinkingProcess || null,
            analysis.solutionSteps ? JSON.stringify(analysis.solutionSteps) : null,
            analysis.commonMistakes ? JSON.stringify(analysis.commonMistakes) : null,
            analysis.knowledgeGapAnalysis || null,
            analysis.difficultyAnalysis ? JSON.stringify(analysis.difficultyAnalysis) : null,
            analysis.relatedQuizzes ? JSON.stringify(analysis.relatedQuizzes) : null,
            now,
            '2.0',
          ]
        );
      }

      // Save knowledge point tags if provided
      if (analysis.knowledgePointTags && analysis.knowledgePointTags.length > 0) {
        // Remove existing AI-generated links
        this.databaseService.execute(
          `DELETE FROM quiz_knowledge_links WHERE quiz_id = ? AND link_type = 'ai-generated'`,
          [quizId]
        );

        // Create new links with source
        for (const tag of analysis.knowledgePointTags) {
          const linkId = uuidv4();
          this.databaseService.execute(
            `INSERT INTO quiz_knowledge_links (
              id, quiz_id, knowledge_point_id, confidence_score,
              link_type, source, note, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              linkId,
              quizId,
              tag.id,
              tag.confidence || 1.0,
              'ai-generated',
              tag.source || 'both',
              tag.note || null,
              'ai',
              now,
            ]
          );
        }
      }

      return {
        status: 'success',
        data: {
          message: '分析已成功保存到数据库！',
          quizId,
          savedFields: Object.keys(analysis).filter(key => analysis[key as keyof typeof analysis] !== undefined),
          analyzedAt: now,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        `Failed to save analysis: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
