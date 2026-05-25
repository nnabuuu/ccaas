/**
 * ProjectArtifactSourceRegistry — pure slug → source lookup.
 *
 * The orchestrator (SessionAssetSyncer) is responsible for resolving
 * the session's tenantId to a tenant slug (via TenantsService); this
 * registry then maps that slug to its configured
 * `ProjectArtifactSource`, with an optional default fallback for
 * tenants without an explicit per-tenant entry.
 *
 * Keeping the registry tenant-service-free avoids putting TenantsService
 * in the dynamic-module factory's `inject` array (which has been
 * observed to trigger NestJS DI recursion issues across @Global
 * boundaries in test contexts).
 *
 * Resolution (in `getForTenantSlug`):
 *   1. perTenant.get(slug) → source if mapped
 *   2. else defaultSource (may be null)
 */

import { Injectable, Logger } from '@nestjs/common';

import type { ProjectArtifactSource } from '@kedge-agentic/agent-runtime';

@Injectable()
export class ProjectArtifactSourceRegistry {
  private readonly logger = new Logger(ProjectArtifactSourceRegistry.name);

  constructor(
    private readonly perTenant: ReadonlyMap<string, ProjectArtifactSource>,
    private readonly defaultSource: ProjectArtifactSource | null,
  ) {
    if (perTenant.size > 0) {
      this.logger.log(
        `tenant-keyed sources registered: ${Array.from(perTenant.keys()).join(', ')}` +
          (defaultSource ? ' (+default fallback)' : ''),
      );
    } else if (defaultSource) {
      this.logger.log('single default source registered (no per-tenant overrides)');
    } else {
      // Loud-on-empty: an operator who fat-fingers SOLUTION_ARTIFACT_URLS
      // (e.g. forgets the colon → parseSlugMap silently skips the entry)
      // otherwise sees zero output. Warn so the misconfig surfaces in
      // routine boot logs.
      this.logger.warn(
        'no artifact sources configured — syncer will no-op for all tenants ' +
          '(set SOLUTION_ARTIFACT_URL or SOLUTION_ARTIFACT_URLS to enable)',
      );
    }
  }

  /**
   * Resolve a `ProjectArtifactSource` for the given tenant slug. The
   * caller (`SessionAssetSyncer`) has already mapped `session.tenantId`
   * to the slug via `TenantsService.findOne(tenantId).slug`.
   *
   * Returns null when no source is configured AND no default fallback
   * exists — the syncer treats null as "no-op for this tenant".
   *
   * Behavior for unknown/null slug: fall back to defaultSource. This
   * keeps legacy sessions (pre-tenant tracking) working when the
   * deployment configured a single URL.
   */
  getForTenantSlug(slug: string | null | undefined): ProjectArtifactSource | null {
    if (slug) {
      const bySlug = this.perTenant.get(slug);
      if (bySlug) return bySlug;
    }
    return this.defaultSource;
  }
}
