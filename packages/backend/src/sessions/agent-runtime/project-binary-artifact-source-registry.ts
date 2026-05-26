/**
 * ProjectBinaryArtifactSourceRegistry — tenant.config-backed lookup
 * for `BinaryArtifactSource` instances. Parallel to the text registry,
 * keyed on `tenant.config.binaryArtifactUrl` (separate field from
 * `artifactUrl`; solutions opt in to binaries independently).
 *
 * Same cache semantics as `ProjectArtifactSourceRegistry`:
 *   - `null` sentinel for "looked up; no binaryArtifactUrl set" so we
 *     don't re-query the DB every turn for tenants that are text-only.
 *   - Cache invalidation via `SOLUTION_CONFIG_CHANGED` event.
 *   - Lazy construction; nothing eagerly loaded at boot.
 *
 * URL validation: same defense-in-depth as the text registry —
 * http(s) only, no `file://` or `javascript:`.
 *
 * Phase 2b-4 adds the `binaryArtifactUrl` field to `tenant.config`. The
 * existing `SolutionsService.update()` partial-merge handles it without
 * schema changes (config is a JSON column).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { BinaryArtifactSource } from '@kedge-agentic/agent-runtime';

import { SolutionsService } from '../../solutions/solutions.service';
import { RestBinaryArtifactSource } from './rest-binary-artifact-source';
import {
  SOLUTION_CONFIG_CHANGED,
  type SolutionConfigChangedEvent,
} from '../../solutions/solution-config-events';

@Injectable()
export class ProjectBinaryArtifactSourceRegistry implements OnModuleInit {
  private readonly logger = new Logger(ProjectBinaryArtifactSourceRegistry.name);
  private readonly cache = new Map<string, BinaryArtifactSource | null>();

  constructor(private readonly tenants: SolutionsService) {}

  onModuleInit(): void {
    this.logger.log(
      'tenant.config.binaryArtifactUrl is the registration source for binary artifacts',
    );
  }

  /**
   * Resolve the `BinaryArtifactSource` for a tenant slug. Returns null
   * when the tenant has no `binaryArtifactUrl` configured (the syncer
   * treats this as "skip binary half") — text artifacts are unaffected.
   *
   * `maxBytes` is read from `tenant.config.binaryMaxBytes` if set;
   * solutions can pin the limit per-tenant. Omitted → unbounded
   * (subject to the adapter's own 100MB safety cap).
   */
  async getForTenantSlug(
    slug: string | null | undefined,
  ): Promise<BinaryArtifactSource | null> {
    if (!slug) return null;
    if (this.cache.has(slug)) {
      return this.cache.get(slug) ?? null;
    }

    const tenant = await this.tenants.findOne(slug);
    const config = tenant?.config as
      | { binaryArtifactUrl?: unknown; binaryMaxBytes?: unknown }
      | undefined;
    const url = typeof config?.binaryArtifactUrl === 'string'
      ? config.binaryArtifactUrl
      : undefined;
    if (!url) {
      this.cache.set(slug, null);
      return null;
    }
    if (!isSafeBinaryArtifactUrl(url)) {
      this.logger.error(
        `tenant ${slug}: binaryArtifactUrl "${url}" is not a valid http(s) URL, treating as unset`,
      );
      this.cache.set(slug, null);
      return null;
    }
    const maxBytes = typeof config?.binaryMaxBytes === 'number'
      ? config.binaryMaxBytes
      : undefined;
    const source = new RestBinaryArtifactSource(url, { maxBytes });
    this.cache.set(slug, source);
    this.logger.log(
      `cached binary source for slug=${slug} (url=${url}${maxBytes ? `, maxBytes=${maxBytes}` : ''})`,
    );
    return source;
  }

  @OnEvent(SOLUTION_CONFIG_CHANGED)
  onTenantConfigChanged(event: SolutionConfigChangedEvent): void {
    if (this.cache.delete(event.slug)) {
      this.logger.log(
        `binary-source cache evicted for slug=${event.slug} (config changed)`,
      );
    }
  }
}

function isSafeBinaryArtifactUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
