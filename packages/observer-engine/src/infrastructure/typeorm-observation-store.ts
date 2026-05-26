import { Repository } from 'typeorm';
import type { Observation, ObservationStore } from '../core/interfaces.js';
import { ObservationRecord } from './entities/observation.entity.js';

export class TypeormObservationStore implements ObservationStore {
  constructor(private readonly repo: Repository<ObservationRecord>) {}

  async append(obs: Observation): Promise<void> {
    const record = new ObservationRecord();
    record.id = obs.id;
    record.sessionId = obs.sessionId;
    record.entityId = obs.entityId;
    record.solutionId = obs.solutionId;
    record.type = obs.type;
    record.data = obs.data;
    record.triggerEventId = obs.triggerEventId;
    record.createdAtEpoch = obs.createdAt;
    record.updatedAtEpoch = obs.updatedAt;
    await this.repo.save(record);
  }

  async update(
    obsId: string,
    patch: Partial<Pick<Observation, 'type' | 'data'>>,
  ): Promise<void> {
    const updateFields: Partial<Pick<ObservationRecord, 'type' | 'data' | 'updatedAtEpoch'>> = {
      updatedAtEpoch: Date.now(),
    };
    if (patch.type !== undefined) updateFields.type = patch.type;
    if (patch.data !== undefined) updateFields.data = patch.data;
    await this.repo.update(obsId, updateFields as any);
  }

  async getByEntity(
    sessionId: string,
    entityId: string,
  ): Promise<Observation[]> {
    const records = await this.repo.find({
      where: { sessionId, entityId },
      order: { createdAtEpoch: 'ASC' },
    });
    return records.map(toObservation);
  }

  async getBySession(sessionId: string): Promise<Observation[]> {
    const records = await this.repo.find({
      where: { sessionId },
      order: { createdAtEpoch: 'ASC' },
    });
    return records.map(toObservation);
  }
}

function toObservation(record: ObservationRecord): Observation {
  return {
    id: record.id,
    sessionId: record.sessionId,
    entityId: record.entityId,
    solutionId: record.solutionId,
    type: record.type,
    data: record.data,
    triggerEventId: record.triggerEventId,
    createdAt: Number(record.createdAtEpoch),
    updatedAt: Number(record.updatedAtEpoch),
  };
}
