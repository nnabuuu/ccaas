/**
 * `ObservationRepository` — TypeORM-backed wrapper for `ObservationRecord`
 * writes + reads.
 *
 * Mirrors the contract of observer-engine's `TypeormObservationStore`
 * but lives inside the platform backend's `WorkflowModule` so dependency
 * injection works through Nest's container. The `@kedge-agentic/observer-engine`
 * impl is class-only (no `@Injectable()`) — re-creating the thin wrapper
 * here avoids importing a NestJS-coupled facade from the engine package
 * (which gets trimmed in M6 anyway).
 *
 * Phase 5 M1 ships read + append + update. Bulk reads (per-session
 * scans for dashboard projection) land in M3.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Observation } from '@kedge-agentic/observer-engine';
import { ObservationRecord } from '../entities';

@Injectable()
export class ObservationRepository {
  constructor(
    @InjectRepository(ObservationRecord)
    private readonly repo: Repository<ObservationRecord>,
  ) {}

  async append(obs: Observation): Promise<void> {
    const record = this.repo.create({
      id: obs.id,
      sessionId: obs.sessionId,
      entityId: obs.entityId,
      solutionId: obs.solutionId,
      type: obs.type,
      data: obs.data,
      triggerEventId: obs.triggerEventId,
      createdAtEpoch: obs.createdAt,
      updatedAtEpoch: obs.updatedAt,
    });
    await this.repo.save(record);
  }

  async update(
    obsId: string,
    patch: Partial<Pick<Observation, 'type' | 'data'>>,
  ): Promise<void> {
    const row = await this.repo.findOne({ where: { id: obsId } });
    if (!row) return; // caller is responsible for existence checks; idempotent miss
    row.updatedAtEpoch = Date.now();
    if (patch.type !== undefined) row.type = patch.type;
    if (patch.data !== undefined) row.data = patch.data;
    await this.repo.save(row);
  }

  async getByEntity(
    sessionId: string,
    entityId: string,
  ): Promise<Observation[]> {
    const rows = await this.repo.find({
      where: { sessionId, entityId },
      order: { createdAtEpoch: 'ASC' },
    });
    return rows.map(toObservation);
  }

  async getBySession(sessionId: string): Promise<Observation[]> {
    const rows = await this.repo.find({
      where: { sessionId },
      order: { createdAtEpoch: 'ASC' },
    });
    return rows.map(toObservation);
  }

  async getBySessionAndType(
    sessionId: string,
    type: string,
  ): Promise<Observation[]> {
    const rows = await this.repo.find({
      where: { sessionId, type },
      order: { createdAtEpoch: 'ASC' },
    });
    return rows.map(toObservation);
  }
}

function toObservation(r: ObservationRecord): Observation {
  return {
    id: r.id,
    sessionId: r.sessionId,
    entityId: r.entityId,
    solutionId: r.solutionId,
    type: r.type,
    data: r.data,
    triggerEventId: r.triggerEventId,
    createdAt: Number(r.createdAtEpoch),
    updatedAt: Number(r.updatedAtEpoch),
  };
}
