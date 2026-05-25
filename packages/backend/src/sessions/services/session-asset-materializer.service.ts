/**
 * SessionAssetMaterializer — copies a solution's static `entities/` and
 * `resources/` directory trees into each newly-created session's
 * workspace root, so the agent's CWD has `entities/` and `resources/`
 * visible at relative paths from turn 1.
 *
 * Driven by the `SOLUTION_DIRS` env var (resolved into
 * `workspace.solutionDirs: Record<tenantSlug, absoluteDir>`). For each
 * session whose tenant slug matches a key, the matching subtrees are
 * copied with a SHA-1 idempotency gate identical to BaseMaterializer.
 *
 * Why per-session, not per-tenant overlay base: the agentfs base dir is
 * shared across all tenants, so writing tenant-scoped content there
 * forces ugly `tenants/{slug}/` prefixes in the agent's view. Per-session
 * copy puts assets at the workspace root where the skill expects them.
 *
 * No-op when:
 *   - `SOLUTION_DIRS` env unset / tenant slug not in the map
 *   - Source `entities/` / `resources/` directory doesn't exist
 *   - `tenantId` is undefined (anonymous session)
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { TenantsService } from '../../tenants/tenants.service';

const ASSET_SUBDIRS = ['entities', 'resources'] as const;

export interface MaterializeAssetsResult {
  tenantSlug: string;
  copied: number;
  unchanged: number;
  durationMs: number;
}

@Injectable()
export class SessionAssetMaterializer {
  private readonly logger = new Logger(SessionAssetMaterializer.name);
  private readonly solutionDirs: Record<string, string>;

  constructor(
    @Inject(ConfigService) cfg: ConfigService,
    private readonly tenants: TenantsService,
  ) {
    this.solutionDirs = cfg.get<Record<string, string>>(
      'workspace.solutionDirs',
      {},
    );
    const keys = Object.keys(this.solutionDirs);
    if (keys.length > 0) {
      this.logger.log(
        `Session asset materializer active for ${keys.length} tenant(s): ${keys.join(', ')}`,
      );
    }
  }

  /**
   * Copy entities/ + resources/ from the matching solution dir into the
   * session workspace. No-op if the tenant isn't registered or the
   * source dirs don't exist.
   */
  async materialize(
    sessionDir: string,
    tenantId: string | undefined,
  ): Promise<MaterializeAssetsResult | null> {
    if (!tenantId || Object.keys(this.solutionDirs).length === 0) return null;

    const tenant = await this.tenants.findOne(tenantId);
    if (!tenant) return null;

    const solutionDir = this.solutionDirs[tenant.slug];
    if (!solutionDir) return null;

    const t0 = Date.now();
    let copied = 0;
    let unchanged = 0;

    for (const sub of ASSET_SUBDIRS) {
      const src = path.join(solutionDir, sub);
      if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) continue;
      const dst = path.join(sessionDir, sub);
      const r = this.copyTreeIfChanged(src, dst);
      copied += r.copied;
      unchanged += r.unchanged;
    }

    const result: MaterializeAssetsResult = {
      tenantSlug: tenant.slug,
      copied,
      unchanged,
      durationMs: Date.now() - t0,
    };
    if (copied > 0 || unchanged > 0) {
      this.logger.log(
        `Materialized session assets for ${tenant.slug} → ${sessionDir} ` +
        `(copied=${copied}, unchanged=${unchanged}, ${result.durationMs}ms)`,
      );
    }
    return result;
  }

  private copyTreeIfChanged(
    src: string,
    dst: string,
  ): { copied: number; unchanged: number } {
    fs.mkdirSync(dst, { recursive: true });
    let copied = 0;
    let unchanged = 0;
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const sp = path.join(src, entry.name);
      const dp = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        const r = this.copyTreeIfChanged(sp, dp);
        copied += r.copied;
        unchanged += r.unchanged;
      } else if (entry.isFile()) {
        if (this.writeIfChanged(dp, fs.readFileSync(sp))) copied++;
        else unchanged++;
      }
    }
    return { copied, unchanged };
  }

  private writeIfChanged(filePath: string, content: Buffer): boolean {
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath);
      if (sha1(existing) === sha1(content)) return false;
    }
    fs.writeFileSync(filePath, content);
    return true;
  }
}

function sha1(buf: Buffer | string): string {
  return createHash('sha1').update(buf).digest('hex');
}
