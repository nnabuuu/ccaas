/**
 * DI tokens for the agent-runtime sync layer.
 *
 * Kept in a dedicated file (not in `agent-runtime.module.ts`) so that
 * services consumed by the module can `@Inject(...)` these tokens
 * without creating a circular import (`module imports service` +
 * `service imports module-for-tokens` → token resolves to `undefined`
 * at decoration time, breaking DI).
 */

export const PROJECT_ARTIFACT_SOURCE = 'PROJECT_ARTIFACT_SOURCE';
export const SNAPSHOT_STORE = 'SNAPSHOT_STORE';
export const CHANGE_STREAM = 'CHANGE_STREAM';
