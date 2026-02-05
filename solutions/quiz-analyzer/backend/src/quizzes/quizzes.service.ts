import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Quiz, QuizKnowledgeLink, QuizAnalysis } from '../database/entities';
import { SearchQuizzesDto } from './dto/search-quizzes.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private quizzesRepository: Repository<Quiz>,
    @InjectRepository(QuizKnowledgeLink)
    private linksRepository: Repository<QuizKnowledgeLink>,
    @InjectRepository(QuizAnalysis)
    private analysisRepository: Repository<QuizAnalysis>,
  ) {}

  async search(dto: SearchQuizzesDto) {
    const { query, subjectId, gradeLevel, quizType, difficulty, knowledgePointId, limit = 10, offset = 0 } = dto;

    const queryBuilder = this.quizzesRepository
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.subject', 'subject')
      .leftJoinAndSelect('quiz.knowledge_links', 'links')
      .leftJoinAndSelect('links.knowledge_point', 'kp');

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

    if (difficulty) {
      queryBuilder.andWhere('quiz.difficulty = :difficulty', { difficulty });
    }

    if (knowledgePointId) {
      queryBuilder.andWhere('links.knowledge_point_id = :kpId', { kpId: knowledgePointId });
    }

    const [quizzes, total] = await queryBuilder
      .orderBy('quiz.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      quizzes: quizzes.map(quiz => ({
        ...quiz,
        knowledge_points: quiz.knowledge_links?.map(link => link.knowledge_point.name).join(', ') || '',
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
      relations: ['subject', 'knowledge_links', 'knowledge_links.knowledge_point', 'analysis'],
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    return {
      quiz,
      knowledgePoints: quiz.knowledge_links?.map(link => ({
        id: link.knowledge_point.id,
        name: link.knowledge_point.name,
        code: link.knowledge_point.code,
        level: link.knowledge_point.level,
        confidence_score: link.confidence_score,
        link_type: link.link_type,
        source: link.source,
        note: link.note,
      })) || [],
      analysis: quiz.analysis || null,
    };
  }

  /**
   * Save AI-generated knowledge point tags with source classification
   */
  async saveKnowledgePointTags(quizId: string, tags: Array<{
    id: string;
    confidence: number;
    source: 'question' | 'solution' | 'both';
    note?: string;
  }>) {
    // Remove existing AI-generated links
    await this.linksRepository.delete({
      quiz_id: quizId,
      link_type: 'ai-generated',
    });

    // Create new links with source and note
    const links = tags.map(tag => ({
      id: uuidv4(),
      quiz_id: quizId,
      knowledge_point_id: tag.id,
      confidence_score: tag.confidence,
      link_type: 'ai-generated',
      source: tag.source,
      note: tag.note || null,
      created_by: 'ai',
    }));

    return await this.linksRepository.save(links);
  }

  /**
   * Get knowledge points grouped by source
   */
  async getKnowledgePointsBySource(quizId: string) {
    const links = await this.linksRepository.find({
      where: { quiz_id: quizId },
      relations: ['knowledge_point'],
    });

    const grouped = {
      question: links.filter(link => link.source === 'question'),
      solution: links.filter(link => link.source === 'solution'),
      both: links.filter(link => link.source === 'both'),
    };

    return {
      question: grouped.question.map(link => ({
        ...link.knowledge_point,
        confidence_score: link.confidence_score,
        note: link.note,
      })),
      solution: grouped.solution.map(link => ({
        ...link.knowledge_point,
        confidence_score: link.confidence_score,
        note: link.note,
      })),
      both: grouped.both.map(link => ({
        ...link.knowledge_point,
        confidence_score: link.confidence_score,
        note: link.note,
      })),
    };
  }

  async create(dto: CreateQuizDto) {
    const quizId = uuidv4();

    const quiz = this.quizzesRepository.create({
      id: quizId,
      content: dto.content,
      content_html: dto.content_html,
      image_urls: dto.image_urls ? JSON.stringify(dto.image_urls) : null,
      subject_id: dto.subject_id,
      grade_level: dto.grade_level,
      quiz_type: dto.quiz_type,
      difficulty: dto.difficulty,
      source: dto.source,
      chapter_reference: dto.chapter_reference,
      correct_answer: dto.correct_answer,
      answer_options: dto.answer_options ? JSON.stringify(dto.answer_options) : null,
      tenant_id: 'default',
    });

    await this.quizzesRepository.save(quiz);

    // Create knowledge point links
    if (dto.knowledge_point_ids && dto.knowledge_point_ids.length > 0) {
      const links = dto.knowledge_point_ids.map(kpId => ({
        id: uuidv4(),
        quiz_id: quizId,
        knowledge_point_id: kpId,
        confidence_score: 1.0,
        link_type: 'manual',
        created_by: 'system',
      }));

      await this.linksRepository.save(links);
    }

    return this.findOne(quizId);
  }

  async update(id: string, dto: Partial<CreateQuizDto>) {
    const quiz = await this.quizzesRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    Object.assign(quiz, {
      ...(dto.content && { content: dto.content }),
      ...(dto.content_html !== undefined && { content_html: dto.content_html }),
      ...(dto.image_urls && { image_urls: JSON.stringify(dto.image_urls) }),
      ...(dto.subject_id && { subject_id: dto.subject_id }),
      ...(dto.grade_level !== undefined && { grade_level: dto.grade_level }),
      ...(dto.quiz_type !== undefined && { quiz_type: dto.quiz_type }),
      ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.chapter_reference !== undefined && { chapter_reference: dto.chapter_reference }),
      ...(dto.correct_answer !== undefined && { correct_answer: dto.correct_answer }),
      ...(dto.answer_options && { answer_options: JSON.stringify(dto.answer_options) }),
    });

    await this.quizzesRepository.save(quiz);

    // Update knowledge point links if provided
    if (dto.knowledge_point_ids) {
      // Remove existing links
      await this.linksRepository.delete({ quiz_id: id });

      // Add new links
      if (dto.knowledge_point_ids.length > 0) {
        const links = dto.knowledge_point_ids.map(kpId => ({
          id: uuidv4(),
          quiz_id: id,
          knowledge_point_id: kpId,
          confidence_score: 1.0,
          link_type: 'manual',
          created_by: 'system',
        }));

        await this.linksRepository.save(links);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const quiz = await this.quizzesRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    await this.quizzesRepository.remove(quiz);
    return { message: 'Quiz deleted successfully', id };
  }
}
