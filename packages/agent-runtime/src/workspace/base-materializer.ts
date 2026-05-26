/**
 * BaseMaterializer — projects a `ContentSource`'s skills + mcp-server
 * config onto a host directory tree that the agentfs `--base` flag
 * overlays into every session mount.
 *
 * Pure logic — depends only on `node:fs`, `node:crypto`, `node:path`,
 * and the `ContentSource` + `Logger` ports defined in this package.
 * No framework, no DI container, no storage knowledge.
 *
 * Idempotent: each file is sha1-gated, so a re-run only writes content
 * that actually changed. Safe to call on every backend startup.
 *
 * Output layout:
 *   ${baseDir}/
 *   └── tenants/
 *       └── {solutionId}/
 *           ├── skills/
 *           │   └── {slug}/
 *           │       ├── SKILL.md       ← skill.content
 *           │       ├── .skill.json    ← { id, name, description }
 *           │       └── <relativePath> ← per SkillFileContent
 *           └── mcp-servers/
 *               └── {slug}/
 *                   └── config.json    ← { name, type, config }
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ContentSource, MaterializeResult } from './types.js';
import { noopLogger, type Logger } from './logger.js';

/**
 * Reject a `SkillFileContent.relativePath` that would escape the
 * skill's own directory via `..` segments or absolute prefixes.
 * Defense in depth — adapters should sanitize too, but skill content
 * ultimately comes from tenant-authored input via the skills API, and
 * the materializer writes as the backend process. Returns the safe
 * absolute path or throws.
 */
function safeJoinUnderDir(parentDir: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error(
      `unsafe relativePath: must be relative, got absolute "${relativePath}"`,
    );
  }
  const joined = path.resolve(parentDir, relativePath);
  // resolve normalizes '..' segments — verify the result stays under parent.
  // Use path.sep + path.relative for cross-platform correctness.
  const rel = path.relative(parentDir, joined);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `unsafe relativePath: escapes parent dir, got "${relativePath}"`,
    );
  }
  return joined;
}

export class BaseMaterializer {
  constructor(
    private readonly contentSource: ContentSource,
    private readonly baseDir: string,
    private readonly logger: Logger = noopLogger,
  ) {}

  /** Path that agentfs init should use as `--base`. */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Enumerate active skills + mcp servers from the content source and
   * project anything whose sha1 differs from what's already on disk.
   * Idempotent. Returns counts + timing.
   */
  async materialize(): Promise<MaterializeResult> {
    const t0 = Date.now();
    fs.mkdirSync(this.baseDir, { recursive: true });

    const activeSkills = await this.contentSource.listActiveSkills();

    let skillsWritten = 0;
    let skillFilesWritten = 0;
    for (const s of activeSkills) {
      const skillDir = path.join(this.baseDir, 'tenants', s.solutionId, 'skills', s.slug);
      this.writeIfChanged(path.join(skillDir, 'SKILL.md'), s.content);
      this.writeIfChanged(
        path.join(skillDir, '.skill.json'),
        JSON.stringify({ id: s.id, name: s.name, description: s.description }, null, 2),
      );
      skillsWritten++;

      for (const f of s.files) {
        let target: string;
        try {
          target = safeJoinUnderDir(skillDir, f.relativePath);
        } catch (err) {
          // Skip + log loudly. Don't throw — one bad skill file shouldn't
          // halt materialization of every other skill in the source.
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `skill ${s.solutionId}/${s.slug}: ignoring file ${JSON.stringify(f.relativePath)} — ${msg}`,
          );
          continue;
        }
        this.writeIfChanged(target, f.content);
        skillFilesWritten++;
      }
    }

    const activeMcps = await this.contentSource.listActiveMcpServers();
    let mcpServersWritten = 0;
    for (const m of activeMcps) {
      this.writeIfChanged(
        path.join(this.baseDir, 'tenants', m.solutionId, 'mcp-servers', m.slug, 'config.json'),
        JSON.stringify({ name: m.name, type: m.type, config: m.config }, null, 2),
      );
      mcpServersWritten++;
    }

    const result: MaterializeResult = {
      baseDir: this.baseDir,
      skillsWritten,
      skillFilesWritten,
      mcpServersWritten,
      durationMs: Date.now() - t0,
    };
    // Log format is API-shaped — operators grep for it; tests assert on it.
    this.logger.log(
      `materialized ${skillsWritten} skills (${skillFilesWritten} files) + ` +
      `${mcpServersWritten} mcp servers → ${this.baseDir} (${result.durationMs}ms)`,
    );
    return result;
  }

  private writeIfChanged(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath);
      if (sha1(existing) === sha1(content)) return;
    }
    fs.writeFileSync(filePath, content);
  }
}

function sha1(buf: Buffer | string): string {
  return createHash('sha1').update(buf).digest('hex');
}
