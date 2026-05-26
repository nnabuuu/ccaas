import { Repository, MoreThan } from 'typeorm';
import type { ObserverEvent, EventStore } from '../core/interfaces.js';
import { ObserverEventRecord } from './entities/observer-event.entity.js';

export class TypeormEventStore implements EventStore {
  constructor(private readonly repo: Repository<ObserverEventRecord>) {}

  async save(event: ObserverEvent): Promise<void> {
    const record = new ObserverEventRecord();
    record.id = event.id;
    record.type = event.type;
    record.sessionId = event.sessionId;
    record.entityId = event.entityId;
    record.solutionId = event.solutionId;
    record.timestamp = event.timestamp;
    record.payload = event.payload;
    record.metadata = event.metadata ? { ...event.metadata } : null;
    await this.repo.save(record);
  }

  async getBySession(
    sessionId: string,
    opts?: { limit?: number; after?: number },
  ): Promise<ObserverEvent[]> {
    const where: Record<string, unknown> = { sessionId };
    if (opts?.after != null) {
      where['timestamp'] = MoreThan(opts.after);
    }

    const records = await this.repo.find({
      where,
      order: { timestamp: 'ASC' },
      take: opts?.limit,
    });

    return records.map(toEvent);
  }
}

function toEvent(record: ObserverEventRecord): ObserverEvent {
  return {
    id: record.id,
    type: record.type,
    sessionId: record.sessionId,
    entityId: record.entityId,
    solutionId: record.solutionId,
    timestamp: Number(record.timestamp),
    payload: record.payload,
    metadata: record.metadata as ObserverEvent['metadata'],
  };
}
