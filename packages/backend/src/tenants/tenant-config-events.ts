/**
 * Cross-module event names + payload types for tenant.config mutations.
 *
 * `TENANT_CONFIG_CHANGED` is emitted by `TenantsService.update()` whenever
 * an update payload carried a `config` field (no fire for name/plan/etc).
 * The `ProjectArtifactSourceRegistry` subscribes to invalidate its cached
 * `slug → ProjectArtifactSource` entry — so a `PUT /tenants/:id` that
 * changes `config.artifactUrl` takes effect on the next sync turn without
 * a backend restart.
 *
 * Both publisher and subscriber import from this file so a typo in the
 * event name can't desync them.
 */

export const TENANT_CONFIG_CHANGED = 'tenant.config.changed';

export interface TenantConfigChangedEvent {
  tenantId: string;
  slug: string;
}
