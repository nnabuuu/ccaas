/**
 * Session Events Service
 *
 * Persists and queries generic frontend events for historical session reconstruction.
 * Uses in-memory sequence counters per session for ordering.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionEventRecord } from './entities/session-event.entity';

@Injectable()
export class SessionEventsService {
  private readonly logger = new Logger(SessionEventsService.name);
  private readonly seqCounters = new Map<string, number>();

  constructor(
    @InjectRepository(SessionEventRecord)
    private readonly repo: Repository<SessionEventRecord>,
  ) {}

  /**
   * Record a frontend event for persistence.
   */
  async recordEvent(
    sessionId: string,
    tenantId: string | null,
    event: { type: string; messageId?: string; [key: string]: unknown },
  ): Promise<void> {
    const seq = (this.seqCounters.get(sessionId) ?? 0) + 1;
    this.seqCounters.set(sessionId, seq);

    await this.repo.save({
      sessionId,
      tenantId,
      messageId: event.messageId ?? null,
      type: event.type,
      payload: event,
      seq,
    });
  }

  /**
   * Query events for a session with optional filters.
   */
  async findBySession(
    sessionId: string,
    options?: {
      types?: string[];
      limit?: number;
      offset?: number;
    },
  ): Promise<SessionEventRecord[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.sessionId = :sessionId', { sessionId })
      .orderBy('e.seq', 'ASC');

    if (options?.types?.length) {
      qb.andWhere('e.type IN (:...types)', { types: options.types });
    }

    if (options?.offset) {
      qb.skip(options.offset);
    }

    if (options?.limit) {
      qb.take(options.limit);
    }

    return qb.getMany();
  }

  /**
   * Clear in-memory sequence counter for a session (e.g., on session cleanup).
   */
  clearSession(sessionId: string): void {
    this.seqCounters.delete(sessionId);
  }
}
