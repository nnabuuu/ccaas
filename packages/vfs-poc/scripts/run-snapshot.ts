/**
 * G2: snapshot and rollback the session delta.
 *
 * - Have claude write a.txt, b.txt, c.txt (turn 1)
 * - Snapshot the delta as "checkpoint"
 * - Have claude delete b.txt and overwrite a.txt (turn 2)
 * - Rollback to checkpoint
 * - Assert: a.txt original content, b.txt back, c.txt unchanged
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { materializeBase } from '../src/base-materializer.js';
import { SessionFsManager } from '../src/session-fs-manager.js';
import { runClaude } from '../src/claude-runner.js';

const repoRoot = resolve(import.meta.dirname, '../../..');
const baseDir = '/tmp/vfs-poc/base';
const deltaStore = '/tmp/vfs-poc/sessions';
const mountRoot = '/tmp/vfs-poc/mnt';

async function main(): Promise<void> {
  materializeBase({ ccaasDbPath: resolve(repoRoot, '.agent-workspace/data.db'), baseDir });

  const mgr = new SessionFsManager({ baseDir, deltaStore, mountRoot });
  const sessionId = `snap-${Date.now()}`;
  const handle = await mgr.create(sessionId);

  try {
    console.log('[demo] turn 1 — create a/b/c');
    const r1 = await runClaude({
      sessionId,
      mountPoint: handle.mountPoint,
      prompt:
        'Use the mcp__vfs-poc-bash__bash tool to create exactly three files ' +
        'in the current directory (each via a separate bash invocation):\n' +
        '  a.txt with content exactly: AAA\n' +
        '  b.txt with content exactly: BBB\n' +
        '  c.txt with content exactly: CCC\n' +
        'After creating all three, briefly confirm.',
      timeoutMs: 120_000,
    });
    console.log(`[demo] turn 1 tools=${JSON.stringify(r1.toolUses.map((t) => t.name))}`);
    console.log(`[demo] turn 1 said: ${truncate(r1.assistantText, 200)}`);

    const a = join(handle.mountPoint, 'a.txt');
    const b = join(handle.mountPoint, 'b.txt');
    const c = join(handle.mountPoint, 'c.txt');

    const preSnapshot = { a: read(a), b: read(b), c: read(c) };
    console.log('[demo] pre-snapshot state:', preSnapshot);

    console.log('[demo] snapshot → checkpoint');
    await handle.snapshot('checkpoint');

    console.log('[demo] turn 2 — overwrite a, delete b, leave c');
    const r2 = await runClaude({
      sessionId,
      mountPoint: handle.mountPoint,
      prompt:
        'Use the mcp__vfs-poc-bash__bash tool to do these two operations in ' +
        'the current directory (each via a separate bash invocation):\n' +
        '  1. Overwrite a.txt so its content is exactly: MODIFIED\n' +
        '  2. Delete the file b.txt (rm b.txt)\n' +
        'Do not touch c.txt. After completing both operations, briefly ' +
        'confirm.',
      timeoutMs: 120_000,
    });
    console.log(`[demo] turn 2 tools=${JSON.stringify(r2.toolUses.map((t) => t.name))}`);
    console.log(`[demo] turn 2 said: ${truncate(r2.assistantText, 200)}`);

    // Force a fresh read by re-stat-ing — NFS client cache can return stale
    // data within the attr-cache TTL window. unmount+remount around rollback
    // clears caches, but mid-session post-turn-2 we may still see stale.
    const postTurn2 = { a: read(a), b: read(b), c: read(c) };
    console.log('[demo] post-turn-2 state:', postTurn2);

    console.log('\n=== G2 pre-rollback sanity ===');
    assert(postTurn2.a === 'MODIFIED', `turn 2 actually overwrote a.txt (got ${JSON.stringify(postTurn2.a)})`);
    assert(postTurn2.b === null, `turn 2 actually deleted b.txt (got ${JSON.stringify(postTurn2.b)})`);
    assert(postTurn2.c === 'CCC', 'turn 2 left c.txt alone');

    console.log('\n[demo] rollback → checkpoint');
    await handle.rollback('checkpoint');

    const after = { a: read(a), b: read(b), c: read(c) };
    console.log('[demo] post-rollback state:', after);

    console.log('\n=== G2 rollback assertions ===');
    assert(after.a === 'AAA', 'a.txt restored to AAA');
    assert(after.b === 'BBB', 'b.txt restored from deletion');
    assert(after.c === 'CCC', 'c.txt unchanged');
  } finally {
    await handle.destroy();
  }

  console.log('\n[demo] G2 OK');
}

function read(p: string): string | null {
  return existsSync(p) ? readFileSync(p, 'utf8').trim() : null;
}

function assert(cond: unknown, msg: string): void {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.log(`  ✗ ${msg}`);
    process.exitCode = 1;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

await main();
