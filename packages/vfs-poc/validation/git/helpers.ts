/**
 * Shared helpers for V1 (git-in-agentfs) tests.
 *
 * Each test uses `withSession()` to get an isolated mount + cleanup, and
 * `gitIn()` to run git commands inside that mount with stdio captured to the
 * test's log file.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { SessionFsManager, type SessionHandle } from '../../src/session-fs-manager.js';
import type { TestContext } from '../harness.js';

const DELTA_STORE = '/tmp/vfs-poc-validation/sessions';
const MOUNT_ROOT = '/tmp/vfs-poc-validation/mnt';
const BASE_DIR = '/tmp/vfs-poc-validation/base';

// One shared base dir for all V1 tests — empty (git tests don't read base).
mkdirSync(BASE_DIR, { recursive: true });

const mgr = new SessionFsManager({
  baseDir: BASE_DIR,
  deltaStore: DELTA_STORE,
  mountRoot: MOUNT_ROOT,
});

export async function withSession<T>(
  testId: string,
  fn: (handle: SessionHandle) => Promise<T>,
): Promise<T> {
  const sid = `${testId}-${Date.now()}`;
  const handle = await mgr.create(sid);
  try {
    return await fn(handle);
  } finally {
    await handle.destroy();
  }
}

export interface GitResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Run a git command inside the mount. Captures stdout/stderr fully; also
 * teed into the test log so failure debug is easy.
 */
export async function gitIn(
  ctx: TestContext,
  cwd: string,
  args: string[],
  opts: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<GitResult> {
  const { timeoutMs = 60_000, env: extraEnv } = opts;
  const t0 = Date.now();
  ctx.log(`$ cd ${cwd} && git ${args.join(' ')}`);

  return await new Promise<GitResult>((resolveP) => {
    const child = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv,
        // Deterministic identity for reproducibility.
        GIT_AUTHOR_NAME: 'vfs-poc',
        GIT_AUTHOR_EMAIL: 'vfs-poc@example.invalid',
        GIT_COMMITTER_NAME: 'vfs-poc',
        GIT_COMMITTER_EMAIL: 'vfs-poc@example.invalid',
        // Don't let host ~/.gitconfig change behavior between machines.
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => {
      stdout += b.toString('utf8');
      ctx.log(`  | ${b.toString('utf8').trimEnd().replace(/\n/g, '\n  | ')}`);
    });
    child.stderr.on('data', (b: Buffer) => {
      stderr += b.toString('utf8');
      ctx.log(`  ! ${b.toString('utf8').trimEnd().replace(/\n/g, '\n  ! ')}`);
    });

    const timer = setTimeout(() => {
      ctx.log(`  ! TIMEOUT after ${timeoutMs}ms — killing`);
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - t0;
      ctx.log(`  → exit ${code} (${durationMs}ms)`);
      resolveP({ exitCode: code, stdout, stderr, durationMs });
    });
  });
}

/** Throwing variant — fails the test if exit != 0. */
export async function gitMust(
  ctx: TestContext,
  cwd: string,
  args: string[],
  opts: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<GitResult> {
  const r = await gitIn(ctx, cwd, args, opts);
  if (r.exitCode !== 0) {
    throw new Error(
      `git ${args.join(' ')} exit=${r.exitCode}: ${r.stderr.split('\n')[0] || r.stdout.split('\n')[0]}`,
    );
  }
  return r;
}

export function writeF(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

export function readF(path: string): string {
  return readFileSync(path, 'utf8');
}

export function existsF(path: string): boolean {
  return existsSync(path);
}

export function nlinkOf(path: string): number {
  return statSync(path).nlink;
}

/**
 * Recursively remove macOS AppleDouble (`._foo`) sidecar files from a tree.
 * These appear on agentfs NFS mounts because macOS NFS client falls back to
 * AppleDouble when the server doesn't support extended attributes (it
 * silently writes `com.apple.provenance` to every new file). They are not
 * a function of the data git stores — Linux FUSE never produces them. Use
 * this between operations whose downstream consumers (e.g. `git fsck`)
 * would misinterpret the sidecars.
 */
export function cleanAppleDoubles(dir: string): void {
  // No-op when VFS_POC_BARE=1 — see configureRepo() rationale.
  if (process.env.VFS_POC_BARE === '1') return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) cleanAppleDoubles(p);
    else if (entry.name.startsWith('._') || entry.name === '.DS_Store') {
      try { unlinkSync(p); } catch {}
    }
  }
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assert: ${msg}`);
}

export async function configureRepo(ctx: TestContext, cwd: string): Promise<void> {
  // Pin to packed-refs avoidance; ensure default branch name.
  await gitMust(ctx, cwd, ['config', 'init.defaultBranch', 'main']);
  // macOS NFS client auto-creates `._foo` AppleDouble sidecars for every file
  // (because com.apple.provenance xattr can't be stored in agentfs NFS, kernel
  // falls back to AppleDouble). Excluding `._*` from git prevents them from
  // being staged/committed/merged.
  // Skip when VFS_POC_BARE=1 — used to validate that a patched agentfs
  // (which drops sidecars server-side, see appledouble.rs) makes the workaround
  // unnecessary.
  if (process.env.VFS_POC_BARE !== '1') {
    writeF(join(cwd, '.gitignore'), '._*\n.DS_Store\n');
  }
}

export { wait };
