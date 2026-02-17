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
   *
   * @deprecated Use createNextTurn() instead for atomic turn number assignment
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
   * Create a new turn with atomically assigned turn number
   * Prevents race conditions when multiple messages arrive concurrently
   */
  async createNextTurn(params: {
    sessionId: string;
    userMessageId: string;
  }): Promise<Turn> {
    return this.turnRepository.manager.transaction(async (manager) => {
      // Query max turn number within transaction (serialized for SQLite)
      const result = await manager
        .createQueryBuilder(Turn, 'turn')
        .select('MAX(turn.turnNumber)', 'maxTurnNumber')
        .where('turn.sessionId = :sessionId', { sessionId: params.sessionId })
        .getRawOne();

      const nextTurnNumber = (result?.maxTurnNumber ?? -1) + 1;

      // Create and save turn within same transaction
      const turn = manager.create(Turn, {
        sessionId: params.sessionId,
        turnNumber: nextTurnNumber,
        userMessageId: params.userMessageId,
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
      });

      return manager.save(Turn, turn);
    });
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
    // Note: inputTokens already includes cachedInputTokens (those are a subset)
    // and cacheCreationTokens are a one-time cost, not context window tokens
    const totalTokens = tokenEvents.reduce((sum, event) => {
      return (
        sum +
        event.inputTokens +
        event.outputTokens +
        (event.reasoningTokens || 0)
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

  /**
   * Complete a turn with retry logic to handle token event timing
   *
   * Token usage events may not be persisted immediately, so we retry
   * with exponential backoff to ensure accurate token counts.
   */
  async completeTurnWithRetry(params: {
    turnId: string;
    assistantMessageId: string;
    maxRetries?: number;
  }): Promise<Turn> {
    const maxRetries = params.maxRetries ?? 2;
    let lastResult: Turn | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Wait before retry (0ms on first attempt, 500ms, 1000ms)
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * attempt),
        );
      }

      lastResult = await this.completeTurn({
        turnId: params.turnId,
        assistantMessageId: params.assistantMessageId,
      });

      // If we got token data, return immediately
      if (lastResult.totalTokens > 0) {
        return lastResult;
      }

      // On last retry, return even if tokens are 0
      if (attempt === maxRetries) {
        return lastResult;
      }
    }

    return lastResult!;
  }
}
