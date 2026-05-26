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
 *   - `solutionId` is undefined (anonymous session)
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SolutionsService } from '../../solutions/solutions.service';

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
  /**
   * Per-tenant base URL for lesson-plan lib materialization. Parsed
   * from env `LESSON_PLAN_LIB_URLS=<slug>:<url>,<slug>:<url>`. Empty
   * map disables this feature (no lib files written).
   */
  private readonly lessonPlanLibUrls: Record<string, string>;

  constructor(
    @Inject(ConfigService) cfg: ConfigService,
    private readonly tenants: SolutionsService,
  ) {
    this.solutionDirs = cfg.get<Record<string, string>>(
      'workspace.solutionDirs',
      {},
    );
    this.lessonPlanLibUrls = parseLessonPlanLibUrls(
      process.env.LESSON_PLAN_LIB_URLS,
    );
    const keys = Object.keys(this.solutionDirs);
    if (keys.length > 0) {
      this.logger.log(
        `Session asset materializer active for ${keys.length} tenant(s): ${keys.join(', ')}`,
      );
    }
    const libKeys = Object.keys(this.lessonPlanLibUrls);
    if (libKeys.length > 0) {
      this.logger.log(
        `Lesson-plan lib materialization configured for ${libKeys.length} tenant(s): ${libKeys.join(', ')}`,
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
    solutionId: string | undefined,
  ): Promise<MaterializeAssetsResult | null> {
    if (!solutionId || Object.keys(this.solutionDirs).length === 0) return null;

    const tenant = await this.tenants.findOne(solutionId);
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
   * Optional second pass: fetch lesson-plan library + per-user
   * interpretations from a solution-provided URL and write them as
   * `_lib/teaching-requirements.md` + `_lib/my-interpretations.md`
   * into the session workspace.
   *
   * Opt-in via per-tenant env config `LESSON_PLAN_LIB_URLS=<slug>:<base>,...`
   * (e.g. `live-lesson:http://localhost:3007`). When set, ccaas issues
   * `GET <base>/api/teaching-requirements/_materialize?subject=<subj>`
   * with `X-Caller-User-Id: <userId>` and writes the two files.
   *
   * **SSRF + DoS hardening**:
   *  - 5s timeout (slow / black-holing hosts can't stall session boot)
   *  - 2 MB response cap (malicious server can't stream multi-GB body)
   *  - private/loopback addresses rejected unless
   *    `LESSON_PLAN_LIB_ALLOW_INTERNAL=true` (default for dev where the
   *    proxy IS localhost:3007; explicit opt-out in prod)
   *  - operators MUST point `LESSON_PLAN_LIB_URLS` at trusted hosts only;
   *    a misconfigured URL could leak `X-Caller-User-Id` to a third
   *    party. Documented in env help.
   *
   * Failure modes are non-fatal: if the URL is unreachable, times out,
   * or returns a malformed response, we log + return null. Agent then
   * operates without the materialized files — the lesson-plan format
   * design accounts for this by also offering the bash helper path
   * (§4.2 layer 3) for environments where library lookup is needed.
   *
   * Stays ccaas-core-agnostic: ccaas doesn't import any live-lesson
   * code; the URL config + HTTP contract are the entire surface.
   *
   * NOTE: not yet called from SessionService bootstrap — wiring is
   * tracked as a follow-up. The method is testable + ready.
   */
  async materializeLessonPlanLib(opts: {
    sessionDir: string;
    tenantSlug: string;
    subject: string;
    userId: string;
  }): Promise<{ libraryWritten: boolean; interpretationsWritten: boolean } | null> {
    const baseUrl = this.lessonPlanLibUrls[opts.tenantSlug];
    if (!baseUrl) return null;

    if (!isUrlSafeForServerFetch(baseUrl)) {
      this.logger.warn(
        `lesson-plan lib url for ${opts.tenantSlug} resolves to ` +
          `private/loopback (${baseUrl}); set LESSON_PLAN_LIB_ALLOW_INTERNAL=true to permit`,
      );
      return null;
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/api/teaching-requirements/_materialize?subject=${encodeURIComponent(opts.subject)}`;
    let payload: { libraryMd: string | null; interpretationsMd: string };
    try {
      const res = await fetch(url, {
        headers: {
          'X-Caller-User-Id': opts.userId,
          Accept: 'application/json',
        },
        // 5-second budget. Session bootstrap blocks on this; longer
        // delays would be perceived as a hang.
        signal: AbortSignal.timeout(MATERIALIZE_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(
          `lesson-plan lib materialize ${res.status} for ${opts.tenantSlug}/${opts.subject}`,
        );
        return null;
      }
      // Read body with a byte cap before parsing — protects against a
      // malicious server streaming a multi-GB payload.
      const text = await readWithByteCap(res, MATERIALIZE_MAX_BYTES);
      if (text == null) {
        this.logger.warn(
          `lesson-plan lib materialize response exceeded ${MATERIALIZE_MAX_BYTES}B cap`,
        );
        return null;
      }
      payload = JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`lesson-plan lib materialize failed: ${msg}`);
      return null;
    }

    const libDir = path.join(opts.sessionDir, '_lib');
    fs.mkdirSync(libDir, { recursive: true });
    let libraryWritten = false;
    let interpretationsWritten = false;
    if (payload.libraryMd) {
      fs.writeFileSync(
        path.join(libDir, 'teaching-requirements.md'),
        payload.libraryMd,
        'utf8',
      );
      libraryWritten = true;
    }
    if (typeof payload.interpretationsMd === 'string') {
      fs.writeFileSync(
        path.join(libDir, 'my-interpretations.md'),
        payload.interpretationsMd,
        'utf8',
      );
      interpretationsWritten = true;
    }
    if (libraryWritten || interpretationsWritten) {
      this.logger.log(
        `Materialized lesson-plan lib for ${opts.tenantSlug}/${opts.subject} ` +
          `(library=${libraryWritten}, interpretations=${interpretationsWritten})`,
      );
    }
    return { libraryWritten, interpretationsWritten };
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

const MATERIALIZE_TIMEOUT_MS = 5_000;
const MATERIALIZE_MAX_BYTES = 2_000_000; // 2 MB

/**
 * SSRF defense for `LESSON_PLAN_LIB_URLS` fetches.
 *
 * Rejects URLs whose hostname is a private / loopback / link-local
 * address — these are common SSRF targets (cloud metadata, internal
 * Redis, etc.). Local dev (`localhost:3007`) is the most common case
 * for this materializer, so we opt-in via
 * `LESSON_PLAN_LIB_ALLOW_INTERNAL=true`. Production deployments
 * should NOT set that flag and should point the materializer at an
 * external/proxied URL.
 *
 * Note: only checks the *hostname literal* in the URL. A hostname
 * that resolves via DNS to a private IP isn't caught — full
 * defense would require DNS lookup + IP check, with TOCTOU issues.
 * For our threat model (operator-controlled env, mostly localhost),
 * this catches the common misconfig without the complexity.
 */
export function isUrlSafeForServerFetch(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(parsed.protocol)) return false;

  const allowInternal = process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL === 'true';
  if (allowInternal) return true;

  // hostname may be wrapped in brackets for IPv6 (`[::1]`) in some
  // runtimes; strip for consistency.
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  // Loopback
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  // RFC1918 IPv4
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  // Link-local IPv4 (incl. cloud metadata 169.254.169.254)
  if (/^169\.254\./.test(host)) return false;
  // Link-local IPv6
  if (host.startsWith('fe80:')) return false;
  // Unique-local IPv6
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return false;
  return true;
}

/**
 * Read response body capped at `maxBytes`. Returns null when the cap
 * is exceeded (caller treats as a fetch failure). Avoids buffering
 * an attacker-controlled multi-GB stream into memory.
 */
async function readWithByteCap(
  res: Response,
  maxBytes: number,
): Promise<string | null> {
  // Cheap pre-check from Content-Length if the server is honest.
  const cl = Number(res.headers.get('content-length'));
  if (cl > maxBytes) return null;

  const reader = res.body?.getReader();
  if (!reader) {
    // Old runtime fallback: just buffer with size assertion.
    const text = await res.text();
    return text.length > maxBytes ? null : text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

/**
 * Parse the LESSON_PLAN_LIB_URLS env var.
 *
 * Format: `slug:url[,slug:url]*` where url is the live-lesson base
 * (e.g. `http://localhost:3007`). The `/api/...` path is appended
 * by the materializer.
 *
 * Examples:
 *   LESSON_PLAN_LIB_URLS=live-lesson:http://localhost:3007
 *   LESSON_PLAN_LIB_URLS=live-lesson:https://ll.internal,demo:http://demo:8080
 *
 * Bad entries are logged + skipped, not fatal: an operator
 * mistyping one entry shouldn't break boot for the others.
 */
export function parseLessonPlanLibUrls(
  raw: string | undefined,
): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    // Find the FIRST ':' so URLs with `://` work (slug:scheme://host).
    const sep = trimmed.indexOf(':');
    if (sep <= 0) continue;
    const slug = trimmed.slice(0, sep).trim();
    const url = trimmed.slice(sep + 1).trim();
    if (!slug || !url) continue;
    // Basic URL sanity — only http/https.
    if (!/^https?:\/\//.test(url)) continue;
    out[slug] = url;
  }
  return out;
}
