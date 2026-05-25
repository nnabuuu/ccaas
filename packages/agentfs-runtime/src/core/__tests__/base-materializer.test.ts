/**
 * BaseMaterializer pure-logic tests.
 *
 * Uses a tiny `InMemoryContentSource` test helper (no NestJS, no
 * TypeORM) and a real tmpdir for the projected files. Covers the
 * behavior that today's backend `base-materializer.spec.ts` asserts,
 * adapted to the new port-based interface:
 *
 *   - SKILL.md + .skill.json per skill
 *   - skill files written at their relative path under the skill dir
 *   - mcp-server config.json with the right shape
 *   - sha1 idempotency (re-run is a no-op for unchanged content)
 *   - works on an empty content source (no-op + correct counts)
 *   - logger swap is honored (captures log output)
 *   - changed content IS re-written on second run (positive idempotency)
 *
 * Note: "orphan SkillFile" filtering that today's backend spec asserts
 * has moved into the adapter layer — by construction, `SkillContent.files`
 * here are always owned by the parent skill.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { BaseMaterializer } from '../base-materializer.js';
import { InMemoryContentSource } from '../../testing/in-memory-content-source.js';
import type { ContentSource } from '../types.js';
import type { Logger } from '../logger.js';

function captureLogger(): Logger & { entries: string[] } {
  const entries: string[] = [];
  return {
    entries,
    log: (m) => entries.push(`LOG ${m}`),
    warn: (m) => entries.push(`WARN ${m}`),
    error: (m) => entries.push(`ERROR ${m}`),
    debug: (m) => entries.push(`DEBUG ${m}`),
  };
}

describe('BaseMaterializer', () => {
  let baseDir: string;
  beforeEach(() => { baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-')); });
  afterEach(()  => { fs.rmSync(baseDir, { recursive: true, force: true }); });

  it('writes SKILL.md + .skill.json per skill', async () => {
    const src = new InMemoryContentSource([
      {
        id: 's1', tenantId: 't1', slug: 'hello',
        name: 'Hello', description: 'desc',
        content: '# Hello\n',
        files: [],
      },
    ]);
    const bm = new BaseMaterializer(src, baseDir);
    const r = await bm.materialize();
    expect(r.skillsWritten).toBe(1);
    expect(r.skillFilesWritten).toBe(0);

    const skillDir = path.join(baseDir, 'tenants', 't1', 'skills', 'hello');
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe('# Hello\n');
    expect(JSON.parse(fs.readFileSync(path.join(skillDir, '.skill.json'), 'utf8')))
      .toEqual({ id: 's1', name: 'Hello', description: 'desc' });
  });

  it('writes skill files at their relative paths under the skill dir', async () => {
    const src = new InMemoryContentSource([
      {
        id: 's1', tenantId: 't1', slug: 'hello',
        name: '', content: '',
        files: [
          { relativePath: 'examples/a.md', content: 'aaa' },
          { relativePath: 'README.md',     content: 'rr'  },
        ],
      },
    ]);
    const r = await new BaseMaterializer(src, baseDir).materialize();
    expect(r.skillFilesWritten).toBe(2);

    const root = path.join(baseDir, 'tenants', 't1', 'skills', 'hello');
    expect(fs.readFileSync(path.join(root, 'examples/a.md'), 'utf8')).toBe('aaa');
    expect(fs.readFileSync(path.join(root, 'README.md'),    'utf8')).toBe('rr');
  });

  it('writes mcp-servers config.json with name/type/config', async () => {
    const src = new InMemoryContentSource(
      [],
      [{
        tenantId: 't1', slug: 'srv',
        name: 'My MCP', type: 'stdio',
        config: { command: 'node', args: ['x.js'] },
      }],
    );
    const r = await new BaseMaterializer(src, baseDir).materialize();
    expect(r.mcpServersWritten).toBe(1);

    const cfg = JSON.parse(fs.readFileSync(
      path.join(baseDir, 'tenants', 't1', 'mcp-servers', 'srv', 'config.json'),
      'utf8',
    ));
    expect(cfg).toEqual({
      name: 'My MCP', type: 'stdio',
      config: { command: 'node', args: ['x.js'] },
    });
  });

  it('is idempotent — second run does NOT touch unchanged files (mtime preserved)', async () => {
    const src = new InMemoryContentSource([
      { id: 's1', tenantId: 't1', slug: 'hello', name: 'H', content: 'x', files: [] },
    ]);
    const bm = new BaseMaterializer(src, baseDir);
    await bm.materialize();
    const target = path.join(baseDir, 'tenants/t1/skills/hello/SKILL.md');
    const mtimeBefore = fs.statSync(target).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await bm.materialize();
    expect(fs.statSync(target).mtimeMs).toBe(mtimeBefore);
  });

  it('positive idempotency — changed content IS re-written on next run', async () => {
    let body = 'v1';
    const src: ContentSource = {
      listActiveSkills: async () => [
        { id: 's1', tenantId: 't1', slug: 'hello', name: 'H', content: body, files: [] },
      ],
      listActiveMcpServers: async () => [],
    };
    const bm = new BaseMaterializer(src, baseDir);
    await bm.materialize();
    body = 'v2';
    await bm.materialize();
    expect(fs.readFileSync(
      path.join(baseDir, 'tenants/t1/skills/hello/SKILL.md'),
      'utf8',
    )).toBe('v2');
  });

  it('empty content source → no-op with zero counts', async () => {
    const r = await new BaseMaterializer(new InMemoryContentSource(), baseDir).materialize();
    expect(r).toMatchObject({
      skillsWritten: 0,
      skillFilesWritten: 0,
      mcpServersWritten: 0,
    });
    expect(fs.existsSync(path.join(baseDir, 'tenants'))).toBe(false);
  });

  it('honors the injected logger (captures the materialized line)', async () => {
    const logger = captureLogger();
    const src = new InMemoryContentSource([
      { id: 's1', tenantId: 't1', slug: 'h', name: '', content: '', files: [] },
    ]);
    await new BaseMaterializer(src, baseDir, logger).materialize();
    const summary = logger.entries.find((e) => e.startsWith('LOG materialized'));
    expect(summary).toBeDefined();
    expect(summary!).toMatch(/materialized 1 skills \(0 files\) \+ 0 mcp servers/);
  });

  it('getBaseDir reflects the constructor arg verbatim', () => {
    const bm = new BaseMaterializer(new InMemoryContentSource(), '/some/where');
    expect(bm.getBaseDir()).toBe('/some/where');
  });

  // ─── path-traversal defense in depth ───────────────────────────────────

  describe('skill file relativePath safety', () => {
    function withTraversal(relativePath: string) {
      return new InMemoryContentSource([
        { id: 's1', tenantId: 't1', slug: 'hello', name: '', content: '',
          files: [
            { relativePath: 'safe.md', content: 'safe' },
            { relativePath, content: 'pwned' },
          ],
        },
      ]);
    }

    it('skips files whose relativePath contains `..` segments', async () => {
      const logger = captureLogger();
      const r = await new BaseMaterializer(
        withTraversal('../../etc/passwd'), baseDir, logger,
      ).materialize();
      expect(r.skillFilesWritten).toBe(1); // only safe.md
      expect(fs.existsSync(path.join(baseDir, 'etc/passwd'))).toBe(false);
      // and we logged loudly
      expect(logger.entries.some((e) => e.startsWith('WARN') && e.includes('escapes parent dir'))).toBe(true);
    });

    it('skips files whose relativePath is absolute', async () => {
      const logger = captureLogger();
      await new BaseMaterializer(
        withTraversal('/etc/passwd'), baseDir, logger,
      ).materialize();
      expect(fs.existsSync('/etc/passwd-pwned-by-test')).toBe(false);
      expect(logger.entries.some((e) => e.includes('must be relative'))).toBe(true);
    });

    it('continues materializing the rest of the source after a bad file', async () => {
      const r = await new BaseMaterializer(
        withTraversal('../escape.md'), baseDir,
      ).materialize();
      // safe.md still written
      expect(fs.readFileSync(
        path.join(baseDir, 'tenants/t1/skills/hello/safe.md'),
        'utf8',
      )).toBe('safe');
    });
  });
});
