/**
 * V1 git-in-agentfs test definitions. Each test is self-contained:
 * gets its own fresh session via withSession(), exercises one risk area,
 * asserts pass/fail. See validation/harness.ts for the runner contract.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import type { DefineTestOpts, TestContext } from '../harness.js';
import {
  assert, configureRepo, existsF, gitIn, gitMust, nlinkOf, readF, wait, withSession, writeF,
} from './helpers.js';

const isLinux = () => platform() === 'linux';
const isDarwin = () => platform() === 'darwin';

// ---------- T1.1 baseline ----------
const t1_1: DefineTestOpts = {
  id: 'T1.1',
  suite: 'V1',
  description: 'baseline — init / add / commit / log / fsck',
  body: async (ctx) => {
    await withSession('t1-1', async (h) => {
      await gitMust(ctx, h.mountPoint, ['init']);
      await configureRepo(ctx, h.mountPoint);
      writeF(join(h.mountPoint, 'README.md'), '# hello\n');
      writeF(join(h.mountPoint, 'a.txt'), 'a\n');
      writeF(join(h.mountPoint, 'b.txt'), 'b\n');
      await gitMust(ctx, h.mountPoint, ['add', '-A']);
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'init']);
      const log = await gitMust(ctx, h.mountPoint, ['log', '--oneline']);
      assert(log.stdout.includes('init'), 'log must include commit subject');
      const fsck = await gitMust(ctx, h.mountPoint, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck must be clean');
    });
  },
};

// ---------- T1.2 hardlink via git clone --local ----------
const HOST_SOURCE_REPO = '/tmp/vfs-poc-validation/host-source-repo';

function ensureHostSourceRepo(ctx: TestContext): void {
  if (existsSync(join(HOST_SOURCE_REPO, '.git'))) return;
  mkdirSync(HOST_SOURCE_REPO, { recursive: true });
  const sh = (args: string[]) => {
    const r = spawnSync('git', args, { cwd: HOST_SOURCE_REPO, encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'src', GIT_AUTHOR_EMAIL: 'src@x', GIT_COMMITTER_NAME: 'src', GIT_COMMITTER_EMAIL: 'src@x' } });
    if (r.status !== 0) throw new Error(`host-source-repo prep: git ${args.join(' ')} failed: ${r.stderr}`);
  };
  sh(['init', '-b', 'main']);
  writeF(join(HOST_SOURCE_REPO, 'seed.txt'), 'seeded\n');
  sh(['add', 'seed.txt']); sh(['commit', '-m', 'seed']);
  // Make a pack so clone --local has something to dedupe via hardlink.
  for (let i = 0; i < 50; i++) {
    writeF(join(HOST_SOURCE_REPO, `f${i}.txt`), `${i}\n`.repeat(100));
  }
  sh(['add', '-A']); sh(['commit', '-m', 'bulk']);
  sh(['gc', '--aggressive']);
  ctx.log(`host source repo ready at ${HOST_SOURCE_REPO}`);
}

const t1_2: DefineTestOpts = {
  id: 'T1.2',
  suite: 'V1',
  description: 'hardlink — git clone --local from host into mount',
  body: async (ctx) => {
    ensureHostSourceRepo(ctx);
    await withSession('t1-2', async (h) => {
      const cloneInto = join(h.mountPoint, 'clone');
      const r = await gitIn(ctx, h.mountPoint, ['clone', '--local', HOST_SOURCE_REPO, 'clone']);
      assert(r.exitCode === 0, `clone --local should succeed: ${r.stderr.slice(0, 200)}`);

      // Locate a pack file in the clone.
      const packDir = join(cloneInto, '.git', 'objects', 'pack');
      assert(existsF(packDir), 'pack dir must exist in clone');
      const packs = readdirSync(packDir).filter((n) => n.endsWith('.pack'));
      assert(packs.length > 0, 'clone should contain at least one packfile (host repo was gc-ed)');

      const clonePack = join(packDir, packs[0]!);
      const sourcePack = join(HOST_SOURCE_REPO, '.git', 'objects', 'pack', packs[0]!);
      const cloneNlink = nlinkOf(clonePack);
      const sourceNlink = existsF(sourcePack) ? nlinkOf(sourcePack) : -1;
      ctx.metric('cloneNlink', cloneNlink);
      ctx.metric('sourceNlink', sourceNlink);
      ctx.metric('hardlinked', cloneNlink > 1);

      // Independent of hardlink optimization, isolation MUST hold:
      // mutating host repo must not affect the clone's read.
      writeF(join(HOST_SOURCE_REPO, 'mutated-after-clone.txt'), 'gone\n');
      const cloneFiles = readdirSync(cloneInto).filter((n) => !n.startsWith('.'));
      assert(!cloneFiles.includes('mutated-after-clone.txt'), 'clone must be isolated from host mutation');

      // Repo must be usable.
      await gitMust(ctx, cloneInto, ['log', '--oneline']);
      const fsck = await gitMust(ctx, cloneInto, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'clone fsck must pass');
      ctx.note(cloneNlink > 1 ? 'hardlink optimization works' : 'hardlink fell back to copy (acceptable if isolation OK)');
    });
  },
};

// ---------- T1.3 mmap pack ----------
const t1_3: DefineTestOpts = {
  id: 'T1.3',
  suite: 'V1',
  description: 'mmap packfile — gc + concurrent cat-file (R2, R9)',
  body: async (ctx) => {
    await withSession('t1-3', async (h) => {
      await gitMust(ctx, h.mountPoint, ['init', '-b', 'main']);
      await configureRepo(ctx, h.mountPoint);
      // Create ~1000 small files in chunks.
      for (let i = 0; i < 1000; i++) {
        writeF(join(h.mountPoint, 'files', `f${i}.txt`), `content-${i}\n`.repeat(20));
      }
      await gitMust(ctx, h.mountPoint, ['add', '-A']);
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'bulk-1k']);
      // gc forces packfiles; --aggressive ensures coverage.
      await gitMust(ctx, h.mountPoint, ['gc', '--aggressive', '--quiet'], { timeoutMs: 180_000 });
      // Read every object: forces mmap on packfile.
      const logp = await gitMust(ctx, h.mountPoint, ['log', '-p'], { timeoutMs: 120_000 });
      assert(logp.stdout.length > 1000, 'git log -p should produce content');
      // Concurrent cat-file pulls from same packs.
      const head = (await gitMust(ctx, h.mountPoint, ['rev-parse', 'HEAD'])).stdout.trim();
      const tasks = Array.from({ length: 10 }, () =>
        gitMust(ctx, h.mountPoint, ['cat-file', '-p', head]),
      );
      const results = await Promise.all(tasks);
      for (const r of results) {
        assert(r.stdout.includes('bulk-1k'), 'concurrent cat-file must return correct commit content');
      }
      ctx.metric('parallelCatFile', results.length);
      const fsck = await gitMust(ctx, h.mountPoint, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck after gc must pass');
    });
  },
};

// ---------- T1.4 worktree happy path ----------
const t1_4: DefineTestOpts = {
  id: 'T1.4',
  suite: 'V1',
  description: 'worktree add → commit → merge → remove (spec ③⑧ main flow)',
  body: async (ctx) => {
    await withSession('t1-4', async (h) => {
      const main = join(h.mountPoint, 'project');
      mkdirSync(main, { recursive: true });
      await gitMust(ctx, main, ['init', '-b', 'main']);
      await configureRepo(ctx, main);
      writeF(join(main, 'shared.txt'), 'initial\n');
      await gitMust(ctx, main, ['add', '-A']);
      await gitMust(ctx, main, ['commit', '-m', 'initial']);

      const wt = join(h.mountPoint, 'worktree-A');
      await gitMust(ctx, main, ['worktree', 'add', '-b', 'session-A', wt]);
      assert(existsF(join(wt, 'shared.txt')), 'worktree must contain HEAD files');

      writeF(join(wt, 'shared.txt'), 'modified by session A\n');
      writeF(join(wt, 'session-only.txt'), 'A\n');
      await gitMust(ctx, wt, ['add', '-A']);
      await gitMust(ctx, wt, ['commit', '-m', 'session-A work']);

      // Merge back into main.
      await gitMust(ctx, main, ['merge', '--no-ff', '-m', 'merge session-A', 'session-A']);
      assert(readF(join(main, 'shared.txt')).includes('modified by session A'), 'merge propagated content');
      assert(existsF(join(main, 'session-only.txt')), 'merge added new file');

      await gitMust(ctx, main, ['worktree', 'remove', wt]);
      assert(!existsF(wt), 'worktree dir removed');
      const fsck = await gitMust(ctx, main, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck after merge clean');
    });
  },
};

// ---------- T1.5 concurrent git add ----------
const t1_5: DefineTestOpts = {
  id: 'T1.5',
  suite: 'V1',
  description: 'concurrent git add — lock + atomicity stress (R1)',
  body: async (ctx) => {
    await withSession('t1-5', async (h) => {
      await gitMust(ctx, h.mountPoint, ['init', '-b', 'main']);
      await configureRepo(ctx, h.mountPoint);
      writeF(join(h.mountPoint, 'seed.txt'), 'seed\n');
      await gitMust(ctx, h.mountPoint, ['add', '-A']);
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'seed']);

      // 50 parallel git add on distinct files. Git's own index.lock will
      // serialize — losers exit non-zero with "Unable to create lock file".
      // That's NORMAL git behavior, not a fs bug. We care that:
      //   (a) at least some succeed (otherwise something deeper is broken)
      //   (b) no spurious "lock file exists" left over after all done
      //   (c) re-running git add -A picks up all 50 files
      //   (d) fsck stays clean
      const N = 50;
      for (let i = 0; i < N; i++) {
        writeF(join(h.mountPoint, `f${i}.txt`), `${i}\n`);
      }
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) => gitIn(ctx, h.mountPoint, ['add', `f${i}.txt`])),
      );
      const ok = results.filter((r) => r.exitCode === 0).length;
      const lockBusy = results.filter((r) =>
        r.exitCode !== 0 && /lock|index\.lock/i.test(r.stderr),
      ).length;
      const other = results.filter((r) =>
        r.exitCode !== 0 && !/lock|index\.lock/i.test(r.stderr),
      ).length;
      ctx.metric('ok', ok); ctx.metric('lockBusy', lockBusy); ctx.metric('otherFail', other);
      assert(ok >= 1, 'at least one concurrent add must succeed');
      assert(other === 0, `non-lock failures unexpected: ${other}`);
      // No leftover lock.
      assert(!existsF(join(h.mountPoint, '.git', 'index.lock')), 'no leftover index.lock');
      // Re-run serially to pick up rest.
      await gitMust(ctx, h.mountPoint, ['add', '-A']);
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'all-50']);
      const ls = await gitMust(ctx, h.mountPoint, ['ls-tree', '-r', '--name-only', 'HEAD']);
      assert(ls.stdout.split('\n').filter((n) => /^f\d+\.txt$/.test(n)).length === N,
        `all ${N} files must be tracked at HEAD`);
      const fsck = await gitMust(ctx, h.mountPoint, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck clean');
    });
  },
};

// ---------- T1.6 concurrent worktrees ----------
const t1_6: DefineTestOpts = {
  id: 'T1.6',
  suite: 'V1',
  description: '2 worktrees, parallel commits, serial merge (R1, R7)',
  body: async (ctx) => {
    await withSession('t1-6', async (h) => {
      const main = join(h.mountPoint, 'project');
      mkdirSync(main, { recursive: true });
      await gitMust(ctx, main, ['init', '-b', 'main']);
      await configureRepo(ctx, main);
      writeF(join(main, 'shared.txt'), 'base\n');
      await gitMust(ctx, main, ['add', '-A']);
      await gitMust(ctx, main, ['commit', '-m', 'base']);

      const wtA = join(h.mountPoint, 'wt-A');
      const wtB = join(h.mountPoint, 'wt-B');
      await gitMust(ctx, main, ['worktree', 'add', '-b', 'branch-A', wtA]);
      await gitMust(ctx, main, ['worktree', 'add', '-b', 'branch-B', wtB]);

      // Parallel commits to two different branches in two different worktrees.
      writeF(join(wtA, 'a.txt'), 'A\n');
      writeF(join(wtB, 'b.txt'), 'B\n');
      const [ra, rb] = await Promise.all([
        (async () => {
          await gitMust(ctx, wtA, ['add', '-A']);
          return gitMust(ctx, wtA, ['commit', '-m', 'A commit']);
        })(),
        (async () => {
          await gitMust(ctx, wtB, ['add', '-A']);
          return gitMust(ctx, wtB, ['commit', '-m', 'B commit']);
        })(),
      ]);
      assert(ra.exitCode === 0 && rb.exitCode === 0, 'both parallel commits succeed');

      // Serial merges back into main.
      await gitMust(ctx, main, ['merge', '--no-ff', '-m', 'merge A', 'branch-A']);
      await gitMust(ctx, main, ['merge', '--no-ff', '-m', 'merge B', 'branch-B']);
      assert(existsF(join(main, 'a.txt')) && existsF(join(main, 'b.txt')), 'both files merged');

      const fsck = await gitMust(ctx, main, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck clean');
    });
  },
};

// ---------- T1.7 case collision (macOS only) ----------
const t1_7: DefineTestOpts = {
  id: 'T1.7',
  suite: 'V1',
  description: 'case collision Foo.md vs foo.md (macOS NFS) (R4)',
  skipIf: () => (isLinux() ? 'Linux FUSE is case-sensitive by default — not a useful test here' : false),
  body: async (ctx) => {
    await withSession('t1-7', async (h) => {
      await gitMust(ctx, h.mountPoint, ['init', '-b', 'main']);
      await configureRepo(ctx, h.mountPoint);
      writeF(join(h.mountPoint, 'Foo.md'), 'CAPITAL\n');
      // Detect case-folding behavior of this NFS export.
      const upperExists = existsF(join(h.mountPoint, 'Foo.md'));
      const lowerExists = existsF(join(h.mountPoint, 'foo.md'));
      ctx.metric('caseFolding', upperExists && lowerExists && readF(join(h.mountPoint, 'foo.md')) === 'CAPITAL');

      writeF(join(h.mountPoint, 'foo.md'), 'lowercase\n');
      // On case-folding fs the second write overwrites the first; on case-sensitive it's a separate file.
      const fooContent = existsF(join(h.mountPoint, 'foo.md')) ? readF(join(h.mountPoint, 'foo.md')) : '';
      const FooContent = existsF(join(h.mountPoint, 'Foo.md')) ? readF(join(h.mountPoint, 'Foo.md')) : '';
      ctx.note(`Foo.md=${JSON.stringify(FooContent.trim())} foo.md=${JSON.stringify(fooContent.trim())}`);
      // Attempt to commit and verify git's view matches fs reality.
      await gitMust(ctx, h.mountPoint, ['add', '-A']);
      const ls = await gitMust(ctx, h.mountPoint, ['ls-files']);
      ctx.metric('trackedFiles', ls.stdout.trim().split('\n').filter(Boolean));
      // Important: this test reports behavior, doesn't strictly fail on either outcome.
      // Failure would be if git itself crashes or fsck reports corruption.
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'case test']);
      const fsck = await gitMust(ctx, h.mountPoint, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck clean regardless of case folding');
    });
  },
};

// ---------- T1.8 status perf + cache ----------
const t1_8: DefineTestOpts = {
  id: 'T1.8',
  suite: 'V1',
  description: 'git status perf + stat-cache stability across remount (R5, R8)',
  body: async (ctx) => {
    // This test needs to remount mid-test; do it by manually destroying and recreating.
    const sid = `t1-8-${Date.now()}`;
    const { SessionFsManager } = await import('../../src/session-fs-manager.js');
    const mgr = new SessionFsManager({
      baseDir: '/tmp/vfs-poc-validation/base',
      deltaStore: '/tmp/vfs-poc-validation/sessions',
      mountRoot: '/tmp/vfs-poc-validation/mnt',
    });
    let h = await mgr.create(sid);
    try {
      await gitMust(ctx, h.mountPoint, ['init', '-b', 'main']);
      await configureRepo(ctx, h.mountPoint);
      // 1000 files (plenty for a stat-cache signal).
      for (let i = 0; i < 1000; i++) {
        writeF(join(h.mountPoint, 'tree', `f${i}.txt`), `${i}\n`);
      }
      await gitMust(ctx, h.mountPoint, ['add', '-A']);
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'tree']);
      const r1 = await gitMust(ctx, h.mountPoint, ['status', '--porcelain']);
      const r2 = await gitMust(ctx, h.mountPoint, ['status', '--porcelain']);
      ctx.metric('statusCold_ms', r1.durationMs);
      ctx.metric('statusWarm_ms', r2.durationMs);

      // Now snapshot, destroy + recreate to force a remount, see if stat cache survives.
      // (We don't have a "remount only" API; destroy+create gives a fresh mount of same delta.)
      // For this test, simpler: use snapshot+rollback to cycle the mount.
      await h.snapshot('cycle');
      await h.rollback('cycle');
      const r3 = await gitMust(ctx, h.mountPoint, ['status', '--porcelain']);
      ctx.metric('statusAfterRemount_ms', r3.durationMs);
      ctx.note(`cold=${r1.durationMs}ms warm=${r2.durationMs}ms postRemount=${r3.durationMs}ms`);

      // We don't strictly fail on perf; we report. Real failure would be incorrect output.
      assert(r1.stdout === '' && r2.stdout === '' && r3.stdout === '', 'status must report clean tree throughout');
    } finally {
      await h.destroy();
    }
  },
};

// ---------- T1.9 dir rename via git mv ----------
const t1_9: DefineTestOpts = {
  id: 'T1.9',
  suite: 'V1',
  description: 'git mv directory with mixed modified entries (R10)',
  body: async (ctx) => {
    await withSession('t1-9', async (h) => {
      await gitMust(ctx, h.mountPoint, ['init', '-b', 'main']);
      await configureRepo(ctx, h.mountPoint);
      writeF(join(h.mountPoint, 'old', 'a.txt'), 'a\n');
      writeF(join(h.mountPoint, 'old', 'b.txt'), 'b\n');
      writeF(join(h.mountPoint, 'old', 'c.txt'), 'c\n');
      await gitMust(ctx, h.mountPoint, ['add', '-A']);
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'init dir']);
      // Modify one file then mv the whole directory.
      writeF(join(h.mountPoint, 'old', 'a.txt'), 'a-modified\n');
      await gitMust(ctx, h.mountPoint, ['mv', 'old', 'new']);
      assert(!existsF(join(h.mountPoint, 'old')), 'old dir removed');
      assert(existsF(join(h.mountPoint, 'new', 'a.txt')), 'new/a.txt exists');
      assert(readF(join(h.mountPoint, 'new', 'a.txt')) === 'a-modified\n', 'modification preserved');
      await gitMust(ctx, h.mountPoint, ['commit', '-m', 'rename dir']);
      const fsck = await gitMust(ctx, h.mountPoint, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck clean');
    });
  },
};

// ---------- T1.10 lifecycle stress ----------
const t1_10: DefineTestOpts = {
  id: 'T1.10',
  suite: 'V1',
  description: '10 rounds of full worktree lifecycle (combined stress)',
  body: async (ctx) => {
    await withSession('t1-10', async (h) => {
      const main = join(h.mountPoint, 'project');
      mkdirSync(main, { recursive: true });
      await gitMust(ctx, main, ['init', '-b', 'main']);
      await configureRepo(ctx, main);
      writeF(join(main, 'base.txt'), '0\n');
      await gitMust(ctx, main, ['add', '-A']);
      await gitMust(ctx, main, ['commit', '-m', 'base']);

      const ROUNDS = 10;
      for (let i = 0; i < ROUNDS; i++) {
        const wt = join(h.mountPoint, `wt-${i}`);
        const branch = `session-${i}`;
        await gitMust(ctx, main, ['worktree', 'add', '-b', branch, wt]);
        writeF(join(wt, `r${i}.txt`), `round-${i}\n`);
        writeF(join(wt, 'base.txt'), `${i}\n`);
        await gitMust(ctx, wt, ['add', '-A']);
        await gitMust(ctx, wt, ['commit', '-m', `round-${i}`]);
        await gitMust(ctx, main, ['merge', '--no-ff', '-m', `merge ${branch}`, branch]);
        await gitMust(ctx, main, ['worktree', 'remove', wt]);
      }
      // After all rounds, base.txt should reflect last round; all rN.txt files should exist.
      assert(readF(join(main, 'base.txt')).trim() === String(ROUNDS - 1), 'last round wins on base.txt');
      for (let i = 0; i < ROUNDS; i++) {
        assert(existsF(join(main, `r${i}.txt`)), `r${i}.txt persists from round ${i}`);
      }
      const fsck = await gitMust(ctx, main, ['fsck', '--full']);
      assert(!/error|fatal/i.test(fsck.stderr), 'fsck clean after stress');
      ctx.metric('roundsCompleted', ROUNDS);
    });
  },
};

export const tests: DefineTestOpts[] = [
  t1_1, t1_2, t1_3, t1_4, t1_5, t1_6, t1_7, t1_8, t1_9, t1_10,
];
