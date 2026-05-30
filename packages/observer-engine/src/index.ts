// Phase 5 M6.4 — storage-layer-only. See core/interfaces.ts for the
// retirement rationale + the future trigger to delete this package
// entirely.

export type { Observation, ObserverEvent, EventMetadata } from './core/interfaces.js';
export { ObservationRecord } from './infrastructure/entities/observation.entity.js';
export { ObserverEventRecord } from './infrastructure/entities/observer-event.entity.js';
