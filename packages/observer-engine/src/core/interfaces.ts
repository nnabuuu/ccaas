/**
 * `@kedge-agentic/observer-engine` is a storage-layer-only package
 * post-M6.4. The in-process engine + handlers + LLM gateway interfaces
 * were retired when the Phase 5 workflow rewrite landed (see PROGRESS.md).
 *
 * What remains:
 *   - `Observation` — the row shape persisted to `observations` table.
 *     Consumed by platform-side workflow handlers + projector and by
 *     the typeorm entities exported below.
 *   - `ObservationRecord` / `ObserverEventRecord` entity classes (in
 *     `infrastructure/entities/`)
 *
 * Future trigger to delete this package entirely: when every consumer
 * imports its own `Observation` definition + every entity reference
 * moves to a workflow-owned package, the package can be retired and
 * renamed to `@kedge-agentic/observation-store` (or removed outright).
 */

/**
 * Observation row — handler conclusion / workflow-handler write target.
 * Persisted to the `observations` table.
 */
export interface Observation {
  id: string;
  sessionId: string;
  entityId: string;
  solutionId: string;
  type: string;
  data: Record<string, unknown>;
  triggerEventId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Event audit row — every event that reaches the platform's workflow
 * ingest controller gets persisted. Used for dedup + replay.
 */
export interface ObserverEvent {
  id: string;
  type: string;
  sessionId: string;
  entityId: string;
  solutionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  source?: string;
  correlationId?: string;
  depth?: number;
}
