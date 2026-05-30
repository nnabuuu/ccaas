/**
 * Re-exports of observer-engine's TypeORM entities so the platform
 * backend's `app.module.ts` can register them under its own DataSource.
 *
 * Phase 5 M1: both backends — live-lesson (port 3007) and platform
 * (port 3001) — register these entities under their own SQLite. Each
 * process has its own `observations` + `observer_events` tables.
 * Cross-process events flow as: live-lesson writes its own table for
 * legacy handlers (M2 onwards drops this) + pushes events to platform
 * via the workflow-client; platform writes its own tables for the new
 * Workflow-layer-driven observations.
 *
 * Phase 5 M6 deletes live-lesson's writes + trims the observer-engine
 * package to storage-only + renames it to `@kedge-agentic/observation-store`.
 */

export {
  ObservationRecord,
  ObserverEventRecord,
} from '@kedge-agentic/observer-engine';
