/**
 * G3: N sessions concurrently share one base, isolation holds.
 *
 * - 3 sessions launched in parallel (5 is slow on macOS NFS; 3 is sufficient to prove isolation)
 * - Each tells claude to write mine.txt containing its session id
 * - Assert: each mount sees only its own mine.txt; base unchanged; delta files independent
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
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
  const stamp = Date.now();
  const sessionIds = [`con-${stamp}-A`, `con-${stamp}-B`, `con-${stamp}-C`];

  console.log(`[demo] spinning up ${sessionIds.length} sessions in parallel`);
  const t0 = Date.now();
  const handles = await Promise.all(sessionIds.map((id) => mgr.create(id)));
  console.log(`[demo] all mounts ready in ${Date.now() - t0}ms`);

  try {
    const results = await Promise.all(
      handles.map((h) =>
        runClaude({
          sessionId: h.sessionId,
          mountPoint: h.mountPoint,
          prompt:
            `Use the mcp__vfs-poc-bash__bash tool to create a file named ` +
            `mine.txt in the current directory whose content is exactly the ` +
            `text: ${h.sessionId}. After creating the file, briefly confirm ` +
            `success.`,
          timeoutMs: 120_000,
        }),
      ),
    );

    for (let i = 0; i < handles.length; i++) {
      const h = handles[i]!;
      const r = results[i]!;
      console.log(`[${h.sessionId}] tools=${JSON.stringify(r.toolUses.map((t) => t.name))}`);
      console.log(`[${h.sessionId}] said: ${truncate(r.assistantText, 200)}`);
    }

    console.log('\n=== G3 assertions ===');

    // 1. each mount sees ONLY its own mine.txt
    for (const h of handles) {
      const p = join(h.mountPoint, 'mine.txt');
      const exists = existsSync(p);
      assert(exists, `${h.sessionId}: mine.txt exists in own mount`);
      if (!exists) continue;
      const body = readFileSync(p, 'utf8').trim();
      assert(body === h.sessionId, `${h.sessionId}: mine.txt content matches (got ${JSON.stringify(body)})`);
    }

    // 2. no leakage between mounts (each mount's mine.txt is only its own content)
    for (const h of handles) {
      const p = join(h.mountPoint, 'mine.txt');
      if (!existsSync(p)) continue;
      const myContent = readFileSync(p, 'utf8').trim();
      for (const other of handles) {
        if (other.sessionId === h.sessionId) continue;
        assert(myContent !== other.sessionId, `${h.sessionId} does not see ${other.sessionId}'s content`);
      }
    }

    // 3. base unchanged
    assert(!existsSync(join(baseDir, 'mine.txt')), 'base has no mine.txt — writes did not escape COW');

    // 4. independent delta dbs
    const sizes = handles.map((h) => statSync(h.deltaPath).size);
    console.log('  delta db sizes:', sizes);
    assert(new Set(handles.map((h) => h.deltaPath)).size === handles.length, 'all delta paths distinct');
  } finally {
    await Promise.all(handles.map((h) => h.destroy()));
  }

  console.log('\n[demo] G3 OK');
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
