/**
 * SessionAssetMaterializer unit tests
 *
 * Uses a tmp dir as the "solution dir" + a separate tmp dir as the
 * "session dir" — no mocking of fs. Covers:
 *   - both entities/ and resources/ copied
 *   - missing subdirs skipped silently
 *   - SHA-1 idempotency (rerun is no-op)
 *   - no-op when SOLUTION_DIRS unset / tenant unknown
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { SessionAssetMaterializer } from './session-asset-materializer.service';
import { TenantsService } from '../../tenants/tenants.service';

describe('SessionAssetMaterializer', () => {
  let solutionRoot: string;
  let sessionDir: string;

  beforeEach(() => {
    solutionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sam-sol-'));
    sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sam-sess-'));
  });

  afterEach(() => {
    fs.rmSync(solutionRoot, { recursive: true, force: true });
    fs.rmSync(sessionDir, { recursive: true, force: true });
  });

  const seed = (rel: string, body: string) => {
    const p = path.join(solutionRoot, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  };

  const build = async (
    solutionDirsMap: Record<string, string>,
    tenant: { slug: string; id: string } | null,
  ): Promise<SessionAssetMaterializer> => {
    const module = await Test.createTestingModule({
      providers: [
        SessionAssetMaterializer,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, d?: unknown) =>
              key === 'workspace.solutionDirs' ? solutionDirsMap : d,
          },
        },
        {
          provide: TenantsService,
          useValue: { findOne: jest.fn().mockResolvedValue(tenant) },
        },
      ],
    }).compile();
    return module.get(SessionAssetMaterializer);
  };

  it('copies entities/ and resources/ trees into session dir', async () => {
    seed('entities/customers/acme.md', '# ACME\nhealthy');
    seed('entities/plans/q2.json', '{"plan":1}');
    seed('resources/glossary.md', 'glossary');

    const svc = await build(
      { 'demo-sandbox': solutionRoot },
      { id: 'tid-1', slug: 'demo-sandbox' },
    );
    const r = await svc.materialize(sessionDir, 'tid-1');

    expect(r).not.toBeNull();
    expect(r!.copied).toBe(3);
    expect(r!.unchanged).toBe(0);
    expect(fs.readFileSync(path.join(sessionDir, 'entities/customers/acme.md'), 'utf8'))
      .toBe('# ACME\nhealthy');
    expect(fs.existsSync(path.join(sessionDir, 'resources/glossary.md'))).toBe(true);
  });

  it('skips entities/ when missing on disk (resources/ still copies)', async () => {
    seed('resources/glossary.md', 'g');

    const svc = await build(
      { 'demo-sandbox': solutionRoot },
      { id: 'tid-1', slug: 'demo-sandbox' },
    );
    const r = await svc.materialize(sessionDir, 'tid-1');

    expect(r!.copied).toBe(1);
    expect(fs.existsSync(path.join(sessionDir, 'entities'))).toBe(false);
  });

  it('is idempotent — second run reports all files unchanged', async () => {
    seed('entities/customers/acme.md', '# ACME');
    seed('resources/glossary.md', 'g');

    const svc = await build(
      { 'demo-sandbox': solutionRoot },
      { id: 'tid-1', slug: 'demo-sandbox' },
    );
    await svc.materialize(sessionDir, 'tid-1');
    const r2 = await svc.materialize(sessionDir, 'tid-1');

    expect(r2!.copied).toBe(0);
    expect(r2!.unchanged).toBe(2);
  });

  it('re-copies only the changed file when source mutates', async () => {
    seed('entities/customers/acme.md', '# ACME v1');
    seed('resources/glossary.md', 'glossary v1');

    const svc = await build(
      { 'demo-sandbox': solutionRoot },
      { id: 'tid-1', slug: 'demo-sandbox' },
    );
    await svc.materialize(sessionDir, 'tid-1');
    seed('entities/customers/acme.md', '# ACME v2');
    const r2 = await svc.materialize(sessionDir, 'tid-1');

    expect(r2!.copied).toBe(1);
    expect(r2!.unchanged).toBe(1);
    expect(fs.readFileSync(path.join(sessionDir, 'entities/customers/acme.md'), 'utf8'))
      .toBe('# ACME v2');
  });

  it('no-op when SOLUTION_DIRS map is empty', async () => {
    seed('entities/x.md', 'x');
    const svc = await build({}, { id: 'tid-1', slug: 'demo-sandbox' });
    expect(await svc.materialize(sessionDir, 'tid-1')).toBeNull();
    expect(fs.existsSync(path.join(sessionDir, 'entities'))).toBe(false);
  });

  it('no-op when tenant slug not in solutionDirs', async () => {
    seed('entities/x.md', 'x');
    const svc = await build(
      { 'other-solution': solutionRoot },
      { id: 'tid-1', slug: 'demo-sandbox' },
    );
    expect(await svc.materialize(sessionDir, 'tid-1')).toBeNull();
  });

  it('no-op when tenantId is undefined', async () => {
    const svc = await build(
      { 'demo-sandbox': solutionRoot },
      { id: 'tid-1', slug: 'demo-sandbox' },
    );
    expect(await svc.materialize(sessionDir, undefined)).toBeNull();
  });

  it('no-op when tenant lookup returns null', async () => {
    seed('entities/x.md', 'x');
    const svc = await build({ 'demo-sandbox': solutionRoot }, null);
    expect(await svc.materialize(sessionDir, 'tid-unknown')).toBeNull();
  });

  it('handles nested subdirectories (resources/playbooks/foo.md)', async () => {
    seed('resources/playbooks/churn.md', 'churn');
    seed('resources/playbooks/expansion.md', 'expansion');
    seed('resources/glossary.md', 'g');

    const svc = await build(
      { 'demo-sandbox': solutionRoot },
      { id: 'tid-1', slug: 'demo-sandbox' },
    );
    const r = await svc.materialize(sessionDir, 'tid-1');

    expect(r!.copied).toBe(3);
    expect(fs.existsSync(path.join(sessionDir, 'resources/playbooks/churn.md'))).toBe(true);
    expect(fs.existsSync(path.join(sessionDir, 'resources/playbooks/expansion.md'))).toBe(true);
  });

  // ─── Security guards (review HIGH #1, #2) ────────────────────────────────

  describe('security guards', () => {
    let hostSecret: string;
    beforeEach(() => {
      // Drop a "host" file that a symlink might try to escape to.
      hostSecret = fs.mkdtempSync(path.join(os.tmpdir(), 'sam-host-'));
      fs.writeFileSync(path.join(hostSecret, 'leaked.txt'), 'SHOULD_NOT_LEAK');
    });
    afterEach(() => fs.rmSync(hostSecret, { recursive: true, force: true }));

    it('skips a symlinked top-level subdir (entities/ → host path)', async () => {
      // entities is a symlink to outside-tree dir; resources stays a real file
      fs.symlinkSync(hostSecret, path.join(solutionRoot, 'entities'), 'dir');
      seed('resources/glossary.md', 'g');

      const svc = await build(
        { 'demo-sandbox': solutionRoot },
        { id: 'tid-1', slug: 'demo-sandbox' },
      );
      const r = await svc.materialize(sessionDir, 'tid-1');

      // Symlinked entities/ counts as skipped; resources/ still copies
      expect(r!.copied).toBe(1);
      expect(r!.skipped).toBe(1);
      expect(fs.existsSync(path.join(sessionDir, 'entities'))).toBe(false);
      expect(fs.existsSync(path.join(sessionDir, 'leaked.txt'))).toBe(false);
    });

    it('skips a symlinked file inside entities/ (does not dereference)', async () => {
      seed('entities/customers/real.md', 'real');
      fs.symlinkSync(
        path.join(hostSecret, 'leaked.txt'),
        path.join(solutionRoot, 'entities/customers/sneaky.md'),
        'file',
      );

      const svc = await build(
        { 'demo-sandbox': solutionRoot },
        { id: 'tid-1', slug: 'demo-sandbox' },
      );
      const r = await svc.materialize(sessionDir, 'tid-1');

      expect(r!.copied).toBe(1);
      expect(r!.skipped).toBe(1);
      expect(fs.readFileSync(path.join(sessionDir, 'entities/customers/real.md'), 'utf8'))
        .toBe('real');
      expect(fs.existsSync(path.join(sessionDir, 'entities/customers/sneaky.md'))).toBe(false);
    });

    it('skips files exceeding MAX_FILE_BYTES (1 MB) without reading them', async () => {
      seed('entities/small.md', 'fine');
      const big = Buffer.alloc(1_000_001, 'x'); // 1 byte over the cap
      fs.writeFileSync(path.join(solutionRoot, 'entities/huge.bin'), big);

      const svc = await build(
        { 'demo-sandbox': solutionRoot },
        { id: 'tid-1', slug: 'demo-sandbox' },
      );
      const r = await svc.materialize(sessionDir, 'tid-1');

      expect(r!.copied).toBe(1);
      expect(r!.skipped).toBe(1);
      expect(fs.existsSync(path.join(sessionDir, 'entities/huge.bin'))).toBe(false);
    });

    it('stops once MAX_TOTAL_BYTES (10 MB) cumulative cap is hit', async () => {
      // 12 files at 900 KB each = 10.8 MB total; cap should trip mid-way
      fs.mkdirSync(path.join(solutionRoot, 'entities'), { recursive: true });
      const chunk = Buffer.alloc(900_000, 'y');
      for (let i = 0; i < 12; i++) {
        fs.writeFileSync(path.join(solutionRoot, `entities/chunk-${i}.bin`), chunk);
      }

      const svc = await build(
        { 'demo-sandbox': solutionRoot },
        { id: 'tid-1', slug: 'demo-sandbox' },
      );
      const r = await svc.materialize(sessionDir, 'tid-1');

      // 11 × 900k = 9.9 MB fits; 12th would push past 10 MB → skip
      expect(r!.copied).toBe(11);
      expect(r!.skipped).toBe(1);
    });
  });
});
