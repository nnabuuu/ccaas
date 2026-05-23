/**
 * Observation record repository port — domain-side contract for reading
 * observer-engine observations. Two query shapes today:
 *   - all observations for a session, oldest-first (student-log construction)
 *   - same but filtered by `type` (indicator-stats aggregation)
 *
 * Implemented by `TypeOrmObservationRecordRepository` in adapters/persistence;
 * bound to OBSERVATION_RECORD_REPO_PORT in infra/classroom.module.ts.
 */
import type { ObservationRecordView } from '../types/observation-record';

export const OBSERVATION_RECORD_REPO_PORT = Symbol('ObservationRecordRepoPort');

export interface ObservationRecordRepoPort {
  /** All observations for a session, ordered by `createdAtEpoch` ascending. */
  findSessionObservations(sessionId: string): Promise<ObservationRecordView[]>;

  /** All observations for a session with the given `type`, oldest first. */
  findSessionObservationsByType(
    sessionId: string,
    type: string,
  ): Promise<ObservationRecordView[]>;
}
