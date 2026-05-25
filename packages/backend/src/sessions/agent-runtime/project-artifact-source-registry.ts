/**
 * ProjectArtifactSourceRegistry — tenant.config-backed lookup of
 * `ProjectArtifactSource` instances.
 *
 * Where the URL lives: `tenant.config.artifactUrl` (set via `solution.json`
 * import on boot, or via `PUT /tenants/:id` at runtime). The registry
 * caches `slug → ProjectArtifactSource | null` in-memory; null is a
 * deliberate cached value meaning "this tenant has no artifactUrl yet"
 * so we don't re-query the DB every turn for unconfigured tenants.
 *
 * Cache invalidation: subscribes to the `tenant.config.changed` event
 * emitted by `TenantsService.update()`. Eviction is by slug, so the
 * next sync after a config change reconstructs the source from the
 * fresh `tenant.config.artifactUrl` value.
 *
 * The runtime's `ProjectArtifactSource` interface stays single-tenant
 * pure (no tenant param); routing happens at the orchestrator level
 * (`SessionAssetSyncer` resolves `session.tenantId → tenant.slug`
 * via `TenantsService`, then calls `getForTenantSlug(slug)`).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { ProjectArtifactSource } from '@kedge-agentic/agent-runtime';

import { TenantsService } from '../../tenants/tenants.service';
import { RestProjectArtifactSource } from './rest-project-artifact-source';
import {
  TENANT_CONFIG_CHANGED,
  type TenantConfigChangedEvent,
} from './tenant-config-events';

@Injectable()
export class ProjectArtifactSourceRegistry implements OnModuleInit {
  private readonly logger = new Logger(ProjectArtifactSourceRegistry.name);
  /**
   * `null` is a sentinel meaning "looked up; tenant has no artifactUrl
   * configured." Cached to avoid re-hitting TenantsService every turn
   * for unconfigured tenants.
   */
  private readonly cache = new Map<string, ProjectArtifactSource | null>();

  constructor(private readonly tenants: TenantsService) {}

  onModuleInit(): void {
    // Boot-time sanity log; nothing to eagerly load — sources are
    // lazily constructed on first sync per tenant.
    this.logger.log('tenant.config.artifactUrl is the registration source');
  }

  /**
   * Resolve the `ProjectArtifactSource` for a tenant slug.
   *
   * Behavior:
   *   - cache hit: returns the cached instance (or null sentinel)
   *   - cache miss + tenant has valid `config.artifactUrl`: construct
   *     `RestProjectArtifactSource(url)`, cache, return
   *   - cache miss + tenant has no `artifactUrl` (or it's invalid):
   *     cache `null` so we don't re-query, return `null`
   *   - null/undefined slug: return `null` (no DB call)
   *
   * Null returns mean "no-op for this tenant" — the syncer treats it
   * the same as "session has no projectId binding."
   */
  async getForTenantSlug(
    slug: string | null | undefined,
  ): Promise<ProjectArtifactSource | null> {
    if (!slug) return null;
    if (this.cache.has(slug)) {
      return this.cache.get(slug) ?? null;
    }

    const tenant = await this.tenants.findOne(slug);
    const url = tenant?.config?.artifactUrl;
    if (!url) {
      this.cache.set(slug, null);
      return null;
    }
    try {
      new URL(url);
    } catch {
      this.logger.error(
        `tenant ${slug}: invalid artifactUrl "${url}", treating as unset`,
      );
      this.cache.set(slug, null);
      return null;
    }
    const source = new RestProjectArtifactSource(url);
    this.cache.set(slug, source);
    this.logger.log(`cached artifact source for slug=${slug} (url=${url})`);
    return source;
  }

  /**
   * Invalidate the cached entry for a tenant whose config changed. Fired
   * by `TenantsService.update()` whenever the update payload included a
   * `config` field. The next `getForTenantSlug` call rebuilds the entry
   * from a fresh DB read — covers both new tenants gaining `artifactUrl`
   * and existing tenants having their URL re-pointed.
   */
  @OnEvent(TENANT_CONFIG_CHANGED)
  onTenantConfigChanged(event: TenantConfigChangedEvent): void {
    if (this.cache.delete(event.slug)) {
      this.logger.log(`cache evicted for slug=${event.slug} (config changed)`);
    }
  }
}
