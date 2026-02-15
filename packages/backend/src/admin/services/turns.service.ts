import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Turn } from '../entities/turn.entity';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';

/**
 * Service for managing Turn entities
 * A Turn represents one user-assistant message exchange
 */
@Injectable()
export class TurnsService {
  constructor(
    @InjectRepository(Turn)
    private readonly turnRepository: Repository<Turn>,
    @InjectRepository(TokenUsageEvent)
    private readonly tokenUsageRepository: Repository<TokenUsageEvent>,
  ) {}

  /**
   * Create a new turn at the start of message processing
   */
  async createTurn(params: {
    sessionId: string;
    userMessageId: string;
    turnNumber: number;
  }): Promise<Turn> {
    const turn = this.turnRepository.create({
      sessionId: params.sessionId,
      turnNumber: params.turnNumber,
      userMessageId: params.userMessageId,
      assistantMessageId: null, // Set on completion
      totalTokens: 0, // Updated on completion
      durationMs: 0, // Updated on completion
    });

    return this.turnRepository.save(turn);
  }

  /**
   * Complete a turn with assistant message, tokens, and duration
   */
  async completeTurn(params: {
    turnId: string;
    assistantMessageId: string;
  }): Promise<Turn> {
    const turn = await this.turnRepository.findOne({
      where: { id: params.turnId },
    });
    if (!turn) throw new NotFoundException('Turn not found');

    // Calculate duration
    const durationMs = Date.now() - turn.createdAt.getTime();

    // Query token usage for this turn's assistant message
    const tokenEvents = await this.tokenUsageRepository.find({
      where: { messageId: params.assistantMessageId },
    });

    // Sum all token types
    const totalTokens = tokenEvents.reduce((sum, event) => {
      return (
        sum +
        event.inputTokens +
        event.outputTokens +
        (event.reasoningTokens || 0) +
        (event.cachedInputTokens || 0) +
        (event.cacheCreationTokens || 0)
      );
    }, 0);

    // Update turn
    turn.assistantMessageId = params.assistantMessageId;
    turn.completedAt = new Date();
    turn.durationMs = durationMs;
    turn.totalTokens = totalTokens;

    return this.turnRepository.save(turn);
  }

  /**
   * Get all turns for a session, ordered by turnNumber
   */
  async getTurnsBySession(sessionId: string): Promise<Turn[]> {
    return this.turnRepository.find({
      where: { sessionId },
      order: { turnNumber: 'ASC' },
    });
  }

  /**
   * Calculate next turn number for a session
   */
  async getNextTurnNumber(sessionId: string): Promise<number> {
    const result = await this.turnRepository
      .createQueryBuilder('turn')
      .select('MAX(turn.turnNumber)', 'maxTurnNumber')
      .where('turn.sessionId = :sessionId', { sessionId })
      .getRawOne();

    return (result?.maxTurnNumber ?? -1) + 1;
  }
}
