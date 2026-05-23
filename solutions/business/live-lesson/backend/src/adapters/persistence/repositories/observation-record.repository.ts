import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObservationRecord } from '@kedge-agentic/observer-engine';
import type { ObservationRecordRepoPort } from '../../../domain/ports/observation-record-repo.port';
import type { ObservationRecordView } from '../../../domain/types/observation-record';

@Injectable()
export class TypeOrmObservationRecordRepository implements ObservationRecordRepoPort {
  constructor(
    @InjectRepository(ObservationRecord)
    private readonly repo: Repository<ObservationRecord>,
  ) {}

  findSessionObservations(sessionId: string): Promise<ObservationRecordView[]> {
    return this.repo.find({
      where: { sessionId },
      order: { createdAtEpoch: 'ASC' },
    });
  }

  findSessionObservationsByType(
    sessionId: string,
    type: string,
  ): Promise<ObservationRecordView[]> {
    return this.repo.find({
      where: { sessionId, type },
      order: { createdAtEpoch: 'ASC' },
    });
  }
}
