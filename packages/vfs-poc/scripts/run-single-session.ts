/**
 * G1: claude runs inside an agentfs virtual FS.
 *
 * - Materialize base if missing
 * - Create one session (delta + mount)
 * - Spawn claude with prompt "create greeting.txt with the text hi"
 * - Assert: file appears in mount; nothing leaks into base; just-bash MCP was invoked.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { materializeBase } from '../src/base-materializer.js';
import { SessionFsManager } from '../src/session-fs-manager.js';
import { runClaude } from '../src/claude-runner.js';

const repoRoot = resolve(import.meta.dirname, '../../..');
const baseDir = '/tmp/vfs-poc/base';
const deltaStore = '/tmp/vfs-poc/sessions';
const mountRoot = '/tmp/vfs-poc/mnt';
const mcpLog = '/tmp/vfs-poc/logs/just-bash-mcp.log';

async function main(): Promise<void> {
  materializeBase({
    ccaasDbPath: resolve(repoRoot, '.agent-workspace/data.db'),
    baseDir,
  });

  const mgr = new SessionFsManager({ baseDir, deltaStore, mountRoot });
  const sessionId = `single-${Date.now()}`;
  const handle = await mgr.create(sessionId);

  console.log(`[demo] mount ready: ${handle.mountPoint}`);
  console.log(`[demo] base contents visible through mount:`,
    readdirSync(handle.mountPoint));

  try {
    const result = await runClaude({
      sessionId,
      mountPoint: handle.mountPoint,
      mcpLogPath: mcpLog,
      prompt:
        'Use the mcp__vfs-poc-bash__bash tool to create a file named ' +
        'greeting.txt in the current directory whose content is exactly the ' +
        'text: hi from vfs-poc. After creating the file, briefly confirm ' +
        'success.',
      timeoutMs: 120_000,
    });

    console.log(`[demo] claude exit=${result.exitCode}`);
    console.log(`[demo] assistant said: ${truncate(result.assistantText, 200)}`);
    console.log(`[demo] tool uses:`,
      result.toolUses.map((t) => t.name));

    const greetingInMount = join(handle.mountPoint, 'greeting.txt');
    const greetingInBase = join(baseDir, 'greeting.txt');
    const greetingExistsInMount = existsSync(greetingInMount);
    const greetingExistsInBase = existsSync(greetingInBase);

    console.log('');
    console.log('=== G1 assertions ===');
    assert(greetingExistsInMount, 'greeting.txt should exist in mount');
    assert(!greetingExistsInBase, 'greeting.txt MUST NOT leak into base dir');
    if (greetingExistsInMount) {
      const body = readFileSync(greetingInMount, 'utf8');
      assert(body.includes('hi from vfs-poc'), `mount file content matches; got ${JSON.stringify(body)}`);
    }
    assert(existsSync(mcpLog), 'just-bash MCP log was created → tool was loaded');
    if (existsSync(mcpLog)) {
      const log = readFileSync(mcpLog, 'utf8');
      const execLines = log.split('\n').filter((l) => l.includes('exec '));
      assert(execLines.length > 0, `just-bash exec was invoked ≥ once (saw ${execLines.length})`);
    }
    const deltaSize = statSync(handle.deltaPath).size;
    console.log(`[demo] delta db size: ${deltaSize} bytes (grew from baseline as claude wrote)`);
  } finally {
    await handle.destroy();
  }

  console.log('\n[demo] G1 OK');
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
