/**
 * `ObserverEventRepository` — TypeORM-backed wrapper for `ObserverEventRecord`.
 *
 * Two callers in Phase 5 M1:
 *   1. Event ingest controller's dedup path — `hasEvent(eventId)` is
 *      the FIRST gate so a duplicate POST never re-enters the trigger
 *      fan-out.
 *   2. Engine's audit append — every event ingested gets a row,
 *      regardless of whether any trigger fires.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ObserverEvent } from '@kedge-agentic/observer-engine';
import { ObserverEventRecord } from '../entities';

@Injectable()
export class ObserverEventRepository {
  constructor(
    @InjectRepository(ObserverEventRecord)
    private readonly repo: Repository<ObserverEventRecord>,
  ) {}

  async hasEvent(eventId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { id: eventId } });
    return count > 0;
  }

  async save(event: ObserverEvent): Promise<void> {
    const record = this.repo.create({
      id: event.id,
      type: event.type,
      sessionId: event.sessionId,
      entityId: event.entityId,
      solutionId: event.solutionId,
      timestamp: event.timestamp,
      payload: event.payload,
      metadata: event.metadata ? { ...event.metadata } : null,
    });
    await this.repo.save(record);
  }

  async getBySession(
    sessionId: string,
    opts?: { limit?: number; after?: number },
  ): Promise<ObserverEvent[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.sessionId = :sessionId', { sessionId })
      .orderBy('e.timestamp', 'ASC');
    if (opts?.after != null) {
      qb.andWhere('e.timestamp > :after', { after: opts.after });
    }
    if (opts?.limit != null) {
      qb.take(opts.limit);
    }
    const rows = await qb.getMany();
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      sessionId: r.sessionId,
      entityId: r.entityId,
      solutionId: r.solutionId,
      timestamp: Number(r.timestamp),
      payload: r.payload,
      metadata: r.metadata as ObserverEvent['metadata'],
    }));
  }
}
