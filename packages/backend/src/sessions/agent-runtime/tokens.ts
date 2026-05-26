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
/**
 * DI token for the solution-provided `ProjectTenantResolver` (Phase 2b-2).
 * `WorkspaceChangesController` injects this to verify that a token-presented
 * tenant matches the projectId's owning tenant before serving SSE / running
 * invalidate. Default impl (no-op) denies all — solutions MUST register
 * their resolver to enable the feature.
 */
export const PROJECT_TENANT_RESOLVER = 'PROJECT_TENANT_RESOLVER';
/**
 * The tenant-aware registry. `SessionAssetSyncer` injects this rather
 * than the single `PROJECT_ARTIFACT_SOURCE` token so it can route by
 * `session.tenantId` at sync time. The single-source token is kept for
 * back-compat (legacy consumers + explicit `forRoot({ artifactSource })`
 * test injection).
 */
export const PROJECT_ARTIFACT_SOURCE_REGISTRY = 'PROJECT_ARTIFACT_SOURCE_REGISTRY';
/**
 * Phase 2b-4: binary-artifact registry, parallel to the text one above.
 * Solutions opt in by setting `tenant.config.binaryArtifactUrl`; the
 * registry returns `null` for tenants that don't, and the syncer skips
 * its binary half for them.
 */
export const PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY = 'PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY';
export const SNAPSHOT_STORE = 'SNAPSHOT_STORE';
export const CHANGE_STREAM = 'CHANGE_STREAM';
