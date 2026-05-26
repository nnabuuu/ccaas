/**
 * WorkspaceArtifactSourceRegistry — tenant.config-backed lookup of
 * `WorkspaceArtifactSource` instances.
 *
 * Where the URL lives: `tenant.config.artifactUrl` (set via `solution.json`
 * import on boot, or via `PUT /solutions/:id` at runtime). The registry
 * caches `slug → WorkspaceArtifactSource | null` in-memory; null is a
 * deliberate cached value meaning "this tenant has no artifactUrl yet"
 * so we don't re-query the DB every turn for unconfigured tenants.
 *
 * Cache invalidation: subscribes to the `tenant.config.changed` event
 * emitted by `SolutionsService.update()`. Eviction is by slug, so the
 * next sync after a config change reconstructs the source from the
 * fresh `tenant.config.artifactUrl` value.
 *
 * The runtime's `WorkspaceArtifactSource` interface stays single-tenant
 * pure (no tenant param); routing happens at the orchestrator level
 * (`SessionAssetSyncer` resolves `session.solutionId → tenant.slug`
 * via `SolutionsService`, then calls `getForTenantSlug(slug)`).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { WorkspaceArtifactSource } from '@kedge-agentic/agent-runtime';

import { SolutionsService } from '../../solutions/solutions.service';
import { RestWorkspaceArtifactSource } from './rest-workspace-artifact-source';
import {
  SOLUTION_CONFIG_CHANGED,
  type SolutionConfigChangedEvent,
} from '../../solutions/solution-config-events';

@Injectable()
export class WorkspaceArtifactSourceRegistry implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceArtifactSourceRegistry.name);
  /**
   * `null` is a sentinel meaning "looked up; tenant has no artifactUrl
   * configured." Cached to avoid re-hitting SolutionsService every turn
   * for unconfigured tenants.
   */
  private readonly cache = new Map<string, WorkspaceArtifactSource | null>();

  constructor(private readonly tenants: SolutionsService) {}

  onModuleInit(): void {
    // Boot-time sanity log; nothing to eagerly load — sources are
    // lazily constructed on first sync per tenant.
    this.logger.log('tenant.config.artifactUrl is the registration source');
  }

  /**
   * Resolve the `WorkspaceArtifactSource` for a tenant slug.
   *
   * Behavior:
   *   - cache hit: returns the cached instance (or null sentinel)
   *   - cache miss + tenant has valid `config.artifactUrl`: construct
   *     `RestWorkspaceArtifactSource(url)`, cache, return
   *   - cache miss + tenant has no `artifactUrl` (or it's invalid):
   *     cache `null` so we don't re-query, return `null`
   *   - null/undefined slug: return `null` (no DB call)
   *
   * Null returns mean "no-op for this tenant" — the syncer treats it
   * the same as "session has no projectId binding."
   */
  async getForTenantSlug(
    slug: string | null | undefined,
  ): Promise<WorkspaceArtifactSource | null> {
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
    if (!isSafeArtifactUrl(url)) {
      this.logger.error(
        `tenant ${slug}: artifactUrl "${url}" is not a valid http(s) URL, treating as unset`,
      );
      this.cache.set(slug, null);
      return null;
    }
    const source = new RestWorkspaceArtifactSource(url);
    this.cache.set(slug, source);
    this.logger.log(`cached artifact source for slug=${slug} (url=${url})`);
    return source;
  }

  /**
   * Invalidate the cached entry for a tenant whose config changed. Fired
   * by `SolutionsService.update()` whenever the update payload included a
   * `config` field. The next `getForTenantSlug` call rebuilds the entry
   * from a fresh DB read — covers both new tenants gaining `artifactUrl`
   * and existing tenants having their URL re-pointed.
   */
  @OnEvent(SOLUTION_CONFIG_CHANGED)
  onTenantConfigChanged(event: SolutionConfigChangedEvent): void {
    if (this.cache.delete(event.slug)) {
      this.logger.log(`cache evicted for slug=${event.slug} (config changed)`);
    }
  }
}

/**
 * Defense in depth — reject artifactUrl values that aren't http(s).
 * Bare `new URL(...)` accepts `file://`, `javascript:`, `gopher://`,
 * etc.; `fetch()` will happily walk into `file://` on some runtimes,
 * which would let a misconfigured/compromised `tenant.config.artifactUrl`
 * read local files from the ccaas process.
 */
function isSafeArtifactUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
