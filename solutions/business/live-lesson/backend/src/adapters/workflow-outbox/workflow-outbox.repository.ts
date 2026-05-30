/**
 * `WorkflowOutboxRepository` — thin TypeORM wrapper for the outbox
 * entity. Two callsites:
 *   1. `WorkflowDispatchService.enqueue` — insert a new pending row.
 *   2. `WorkflowOutboxDrainService` — read pending rows + update them
 *      after each push attempt.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  OntologyEventOutbox,
  type OntologyEventOutboxState,
} from '../persistence/entities/ontology-event-outbox.entity';

export interface EnqueueRow {
  readonly eventId: string;
  readonly sessionId: string;
  readonly manifestName: string;
  readonly streamApiName: string;
  readonly entityId: string;
  readonly payload: Record<string, unknown>;
  readonly correlationId?: string;
}

@Injectable()
export class WorkflowOutboxRepository {
  constructor(
    @InjectRepository(OntologyEventOutbox)
    private readonly repo: Repository<OntologyEventOutbox>,
  ) {}

  async enqueue(row: EnqueueRow): Promise<OntologyEventOutbox> {
    const entity = this.repo.create({
      eventId: row.eventId,
      sessionId: row.sessionId,
      manifestName: row.manifestName,
      streamApiName: row.streamApiName,
      entityId: row.entityId,
      payloadJson: JSON.stringify(row.payload),
      correlationId: row.correlationId ?? null,
      state: 'pending',
      attempts: 0,
      nextAttemptAtEpoch: Date.now(),
    });
    return this.repo.save(entity);
  }

  async findPendingDue(now: number, limit: number): Promise<OntologyEventOutbox[]> {
    return this.repo.find({
      where: {
        state: 'pending',
        nextAttemptAtEpoch: LessThanOrEqual(now),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async markDelivered(id: string): Promise<void> {
    await this.repo.update(
      { id },
      { state: 'delivered', deliveredAtEpoch: Date.now(), lastError: null },
    );
  }

  async markPoisoned(id: string, error: string): Promise<void> {
    await this.repo.update(
      { id },
      { state: 'poisoned', lastError: error, deliveredAtEpoch: Date.now() },
    );
  }

  async markRetry(
    id: string,
    attempts: number,
    error: string,
    nextAttemptAtEpoch: number,
  ): Promise<void> {
    await this.repo.update(
      { id },
      { attempts, lastError: error, nextAttemptAtEpoch },
    );
  }

  async countByState(state: OntologyEventOutboxState): Promise<number> {
    return this.repo.count({ where: { state } });
  }
}
