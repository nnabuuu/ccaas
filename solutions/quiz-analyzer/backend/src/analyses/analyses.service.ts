import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { QuizAnalysis, Quiz } from '../database/entities';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { MessagesService } from '../messages/messages.service';
import { TurnsService } from '../messages/turns.service';

@Injectable()
export class AnalysesService {
  private readonly logger = new Logger(AnalysesService.name);

  constructor(
    @InjectRepository(QuizAnalysis)
    private analysisRepository: Repository<QuizAnalysis>,
    @InjectRepository(Quiz)
    private quizRepository: Repository<Quiz>,
    private readonly messagesService: MessagesService,
    private readonly turnsService: TurnsService,
  ) {}

  async create(dto: CreateAnalysisDto & { sessionId?: string }) {
    // Check if quiz exists
    const quiz = await this.quizRepository.findOne({ where: { id: dto.quiz_id } });
    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${dto.quiz_id} not found`);
    }

    // Check if analysis already exists
    const existing = await this.analysisRepository.findOne({ where: { quiz_id: dto.quiz_id } });
    if (existing) {
      throw new ConflictException(`Analysis for quiz ${dto.quiz_id} already exists`);
    }

    const analysis = this.analysisRepository.create({
      id: uuidv4(),
      quiz_id: dto.quiz_id,
      thinking_process: dto.thinking_process,
      solution_steps: dto.solution_steps ? JSON.stringify(dto.solution_steps) : null,
      common_mistakes: dto.common_mistakes ? JSON.stringify(dto.common_mistakes) : null,
      knowledge_gap_analysis: dto.knowledge_gap_analysis,
      difficulty_analysis: dto.difficulty_analysis ? JSON.stringify(dto.difficulty_analysis) : null,
      analyzer_version: dto.analyzer_version || '1.0',
      analysis_duration_ms: dto.analysis_duration_ms,
    });

    const savedAnalysis = await this.analysisRepository.save(analysis);

    // Create message record if sessionId is provided
    if (dto.sessionId) {
      await this.persistAnalysisMessage(dto.sessionId, savedAnalysis, dto.analysis_duration_ms);
    }

    return savedAnalysis;
  }

  private async persistAnalysisMessage(
    sessionId: string,
    analysis: QuizAnalysis,
    durationMs?: number,
  ): Promise<void> {
    try {
      const contentSummary = [
        analysis.thinking_process ? '## Thinking Process\n' + analysis.thinking_process : '',
        analysis.knowledge_gap_analysis ? '## Knowledge Gap Analysis\n' + analysis.knowledge_gap_analysis : '',
      ].filter(Boolean).join('\n\n');

      const message = await this.messagesService.createMessage({
        sessionId,
        role: 'assistant',
        content: contentSummary || `Analysis completed for quiz ${analysis.quiz_id}`,
        metadata: {
          analysisId: analysis.id,
          quizId: analysis.quiz_id,
          analyzerVersion: analysis.analyzer_version,
        },
      });

      // Complete the latest open turn
      const latestTurn = await this.turnsService.getLatestTurn(sessionId);
      if (latestTurn && !latestTurn.completed_at) {
        const turnCreatedAt = new Date(latestTurn.created_at).getTime();
        const calculatedDuration = durationMs ?? (Date.now() - turnCreatedAt);

        await this.turnsService.completeTurn(latestTurn.id, {
          assistantMessageId: message.id,
          durationMs: calculatedDuration,
        });
      }
    } catch (error) {
      // Message persistence is non-critical - log and continue
      this.logger.warn(`Failed to persist message for analysis ${analysis.id}: ${error.message}`);
    }
  }

  async findByQuizId(quizId: string) {
    const analysis = await this.analysisRepository.findOne({
      where: { quiz_id: quizId },
      relations: ['quiz'],
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis for quiz ${quizId} not found`);
    }

    return {
      ...analysis,
      solution_steps: analysis.solution_steps ? JSON.parse(analysis.solution_steps) : null,
      common_mistakes: analysis.common_mistakes ? JSON.parse(analysis.common_mistakes) : null,
    };
  }

  async update(quizId: string, dto: Partial<CreateAnalysisDto>) {
    const analysis = await this.analysisRepository.findOne({ where: { quiz_id: quizId } });
    if (!analysis) {
      throw new NotFoundException(`Analysis for quiz ${quizId} not found`);
    }

    Object.assign(analysis, {
      ...(dto.thinking_process !== undefined && { thinking_process: dto.thinking_process }),
      ...(dto.solution_steps && { solution_steps: JSON.stringify(dto.solution_steps) }),
      ...(dto.common_mistakes && { common_mistakes: JSON.stringify(dto.common_mistakes) }),
      ...(dto.knowledge_gap_analysis !== undefined && { knowledge_gap_analysis: dto.knowledge_gap_analysis }),
      ...(dto.difficulty_analysis && { difficulty_analysis: JSON.stringify(dto.difficulty_analysis) }),
      ...(dto.analyzer_version !== undefined && { analyzer_version: dto.analyzer_version }),
      ...(dto.analysis_duration_ms !== undefined && { analysis_duration_ms: dto.analysis_duration_ms }),
    });

    await this.analysisRepository.save(analysis);
    return this.findByQuizId(quizId);
  }

  async remove(quizId: string) {
    const analysis = await this.analysisRepository.findOne({ where: { quiz_id: quizId } });
    if (!analysis) {
      throw new NotFoundException(`Analysis for quiz ${quizId} not found`);
    }

    await this.analysisRepository.remove(analysis);
    return { message: 'Analysis deleted successfully', quiz_id: quizId };
  }
}
