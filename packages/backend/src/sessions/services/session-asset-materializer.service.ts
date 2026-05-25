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

/**
 * Resource caps — copy stops gracefully when any is exceeded. Per-session
 * I/O multiplier, so be conservative. Sized for typical solution
 * directories (dozens of small md/json files); a real solution that
 * needs more should not be using this disk-copy seed mechanism at all.
 */
const MAX_FILES = 500;
const MAX_FILE_BYTES = 1_000_000;       // 1 MB per file
const MAX_TOTAL_BYTES = 10_000_000;     // 10 MB per session

export interface MaterializeAssetsResult {
  tenantSlug: string;
  copied: number;
  unchanged: number;
  skipped: number;     // files skipped due to symlink / size / count cap
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
    // Budget is shared across both subdirs (entities + resources). Carried
    // mutably so a deep tree can't bypass caps by being spread across roots.
    const budget = { files: 0, bytes: 0 };
    let copied = 0;
    let unchanged = 0;
    let skipped = 0;

    for (const sub of ASSET_SUBDIRS) {
      const src = path.join(solutionDir, sub);
      // lstat (not stat) so a symlinked subdir doesn't get followed.
      if (!fs.existsSync(src)) continue;
      const lst = fs.lstatSync(src);
      if (lst.isSymbolicLink()) {
        this.logger.warn(`Skipping ${sub}/ for ${tenant.slug}: symlink not allowed`);
        skipped++;
        continue;
      }
      if (!lst.isDirectory()) continue;
      const dst = path.join(sessionDir, sub);
      const r = this.copyTreeIfChanged(src, dst, budget, tenant.slug);
      copied += r.copied;
      unchanged += r.unchanged;
      skipped += r.skipped;
    }

    const result: MaterializeAssetsResult = {
      tenantSlug: tenant.slug,
      copied,
      unchanged,
      skipped,
      durationMs: Date.now() - t0,
    };
    if (copied > 0 || unchanged > 0 || skipped > 0) {
      this.logger.log(
        `Materialized session assets for ${tenant.slug} → ${sessionDir} ` +
        `(copied=${copied}, unchanged=${unchanged}, skipped=${skipped}, ${result.durationMs}ms)`,
      );
    }
    return result;
  }

  /**
   * Recursive copy with security + resource guards. Mutates `budget`
   * across the whole materialize() call. On budget overage, stops
   * gracefully (no exception) and increments `skipped`.
   *
   * Security: uses `lstat` for every entry so symlinks are detected and
   * skipped — never dereferenced. Without this, a symlink in `entities/`
   * pointing to `/etc/passwd` would copy into the session workspace,
   * readable via just-bash.
   */
  private copyTreeIfChanged(
    src: string,
    dst: string,
    budget: { files: number; bytes: number },
    tenantSlug: string,
  ): { copied: number; unchanged: number; skipped: number } {
    fs.mkdirSync(dst, { recursive: true });
    let copied = 0;
    let unchanged = 0;
    let skipped = 0;
    for (const entryName of fs.readdirSync(src)) {
      const sp = path.join(src, entryName);
      const dp = path.join(dst, entryName);
      const lst = fs.lstatSync(sp);
      if (lst.isSymbolicLink()) {
        this.logger.warn(`Skipping ${sp}: symlink (target would escape sandbox)`);
        skipped++;
        continue;
      }
      if (lst.isDirectory()) {
        const r = this.copyTreeIfChanged(sp, dp, budget, tenantSlug);
        copied += r.copied;
        unchanged += r.unchanged;
        skipped += r.skipped;
        continue;
      }
      if (!lst.isFile()) continue;

      // Cap: total file count
      if (budget.files >= MAX_FILES) {
        this.logger.warn(
          `Skipping ${sp}: max-files cap (${MAX_FILES}) reached for ${tenantSlug}`,
        );
        skipped++;
        continue;
      }
      // Cap: per-file size (cheap stat-level check before read)
      if (lst.size > MAX_FILE_BYTES) {
        this.logger.warn(
          `Skipping ${sp}: ${lst.size}B exceeds per-file cap (${MAX_FILE_BYTES}B)`,
        );
        skipped++;
        continue;
      }
      // Cap: total bytes (would-be-after-add)
      if (budget.bytes + lst.size > MAX_TOTAL_BYTES) {
        this.logger.warn(
          `Skipping ${sp}: would exceed total cap (${MAX_TOTAL_BYTES}B) for ${tenantSlug}`,
        );
        skipped++;
        continue;
      }

      const content = fs.readFileSync(sp);
      budget.files += 1;
      budget.bytes += lst.size;
      if (this.writeIfChanged(dp, content)) copied++;
      else unchanged++;
    }
    return { copied, unchanged, skipped };
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
