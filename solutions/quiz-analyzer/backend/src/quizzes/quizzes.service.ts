import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Quiz, QuizAnalysis } from '../database/entities';
import { SearchQuizzesDto } from './dto/search-quizzes.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { QuizAnalysisDto } from './dto/quiz-analysis.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private quizzesRepository: Repository<Quiz>,
    @InjectRepository(QuizAnalysis)
    private analysisRepository: Repository<QuizAnalysis>,
  ) {}

  async search(dto: SearchQuizzesDto) {
    const { query, subjectId, gradeLevel, quizType, limit = 10, offset = 0 } = dto;

    const queryBuilder = this.quizzesRepository
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.subject', 'subject');

    if (query) {
      queryBuilder.andWhere('quiz.content LIKE :query', { query: `%${query}%` });
    }

    if (subjectId) {
      queryBuilder.andWhere('quiz.subject_id = :subjectId', { subjectId });
    }

    if (gradeLevel) {
      queryBuilder.andWhere('quiz.grade_level = :gradeLevel', { gradeLevel });
    }

    if (quizType) {
      queryBuilder.andWhere('quiz.quiz_type = :quizType', { quizType });
    }

    const [quizzes, total] = await queryBuilder
      .orderBy('quiz.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      quizzes: quizzes.map(quiz => ({
        ...quiz,
        subject_name: quiz.subject?.name || '',
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async findOne(id: string) {
    const quiz = await this.quizzesRepository.findOne({
      where: { id },
      relations: ['subject', 'analysis'],
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    // Parse JSON fields in analysis
    let analysis = null;
    if (quiz.analysis) {
      analysis = {
        ...quiz.analysis,
        // Parse JSON string fields to objects (entity uses snake_case)
        knowledge_point_tags: quiz.analysis.knowledge_point_tags
          ? JSON.parse(quiz.analysis.knowledge_point_tags)
          : [],
        solution_steps: quiz.analysis.solution_steps
          ? JSON.parse(quiz.analysis.solution_steps)
          : [],
        common_mistakes: quiz.analysis.common_mistakes
          ? JSON.parse(quiz.analysis.common_mistakes)
          : [],
        related_quizzes: quiz.analysis.related_quizzes
          ? JSON.parse(quiz.analysis.related_quizzes)
          : [],
        difficulty_analysis: quiz.analysis.difficulty_analysis
          ? JSON.parse(quiz.analysis.difficulty_analysis)
          : null,
      };
    }

    return {
      ...quiz,
      subject_name: quiz.subject?.name || '',
      analysis,
    };
  }

  async create(dto: CreateQuizDto) {
    const quiz = this.quizzesRepository.create({
      id: uuidv4(),
      tenant_id: 'default', // Fixed tenant for quiz-analyzer
      content: dto.content,
      content_html: dto.content_html,
      subject_id: dto.subject_id,
      grade_level: dto.grade_level,
      quiz_type: dto.quiz_type,
      source: dto.source,
      correct_answer: dto.correct_answer,
      answer_options: dto.answer_options ? JSON.stringify(dto.answer_options) : null,
    });

    const saved = await this.quizzesRepository.save(quiz);

    return {
      id: saved.id,
      message: 'Quiz created successfully',
    };
  }

  async update(id: string, dto: Partial<CreateQuizDto>) {
    const quiz = await this.quizzesRepository.findOne({ where: { id } });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    // Update basic fields
    if (dto.content !== undefined) quiz.content = dto.content;
    if (dto.content_html !== undefined) quiz.content_html = dto.content_html;
    if (dto.subject_id !== undefined) quiz.subject_id = dto.subject_id;
    if (dto.grade_level !== undefined) quiz.grade_level = dto.grade_level;
    if (dto.quiz_type !== undefined) quiz.quiz_type = dto.quiz_type;
    if (dto.source !== undefined) quiz.source = dto.source;
    if (dto.correct_answer !== undefined) quiz.correct_answer = dto.correct_answer;
    if (dto.answer_options !== undefined) quiz.answer_options = JSON.stringify(dto.answer_options);

    await this.quizzesRepository.save(quiz);

    return {
      id: quiz.id,
      message: 'Quiz updated successfully',
    };
  }

  async remove(id: string) {
    const quiz = await this.quizzesRepository.findOne({ where: { id } });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    await this.quizzesRepository.remove(quiz);

    return {
      id,
      message: 'Quiz deleted successfully',
    };
  }

  async saveAnalysis(quizId: string, data: QuizAnalysisDto) {
    const quiz = await this.quizzesRepository.findOne({ where: { id: quizId } });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${quizId} not found`);
    }

    // Find existing analysis or create new one
    let analysis = await this.analysisRepository.findOne({
      where: { quiz_id: quizId },
    });

    if (!analysis) {
      analysis = this.analysisRepository.create({
        id: uuidv4(),
        quiz_id: quizId,
      });
    }

    // Update analysis fields (serialize objects to JSON strings)
    // Note: DTO uses camelCase, entity uses snake_case
    if (data.quizAnalysis !== undefined) {
      analysis.quiz_analysis = data.quizAnalysis;
    }
    if (data.knowledgePointTags !== undefined) {
      analysis.knowledge_point_tags = JSON.stringify(data.knowledgePointTags);
    }
    if (data.thinkingProcess !== undefined) {
      analysis.thinking_process = data.thinkingProcess;
    }
    if (data.solutionSteps !== undefined) {
      analysis.solution_steps = JSON.stringify(data.solutionSteps);
    }
    if (data.commonMistakes !== undefined) {
      analysis.common_mistakes = JSON.stringify(data.commonMistakes);
    }
    if (data.knowledgeGapAnalysis !== undefined) {
      analysis.knowledge_gap_analysis = data.knowledgeGapAnalysis;
    }
    if (data.difficultyAnalysis !== undefined) {
      analysis.difficulty_analysis = JSON.stringify(data.difficultyAnalysis);
    }
    if (data.relatedQuizzes !== undefined) {
      analysis.related_quizzes = JSON.stringify(data.relatedQuizzes);
    }

    await this.analysisRepository.save(analysis);

    return {
      id: analysis.id,
      quiz_id: quizId,
      message: 'Analysis saved successfully',
    };
  }
}
