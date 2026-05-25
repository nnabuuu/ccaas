#!/usr/bin/env node
/**
 * Spike 0 — agentfs mount-write safety
 *
 * Verifies that the backend can safely write into a session's
 * agentfs FUSE mount via host `fs.writeFile` and that those writes
 * are visible from inside the mount even when another process is
 * holding the mount as cwd (the "idle agent" scenario between
 * turns).
 *
 * Why this matters: Phase 1's pull-based syncer needs to write
 * DB-side changes into the agent's workspace at turn boundaries.
 * If host writes through the mount path don't propagate to a live
 * process holding the mount, the entire DB→fs direction has to
 * fall back to an MCP-tool-write design (worse UX).
 *
 * Three scenarios:
 *   1. host write → host read via mount             (baseline)
 *   2. host write while subprocess idle → subprocess sees on next read
 *   3. host write while subprocess actively reads → no EIO, no stale
 *
 * Run:
 *   npx tsx packages/backend/scripts/spike-agentfs-write.ts
 *
 * Requires the agentfs binary on PATH (or WORKSPACE_AGENTFS_BIN set).
 *
 * Exits 0 on pass, non-zero on failure. Prints a verdict line that
 * Phase 1's syncer design is gated on.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const BIN = process.env.WORKSPACE_AGENTFS_BIN ?? 'agentfs';
const SID = `spike-${Date.now()}`;
const ROOT = path.join(os.tmpdir(), `afs-spike-${Date.now()}`);
const BASE = path.join(ROOT, 'base');
const SCRATCH = path.join(ROOT, 'scratch');
const MOUNT = path.join(ROOT, 'mount');

let mountDaemon: ChildProcess | null = null;
let idleSubprocess: ChildProcess | null = null;
let failures = 0;

function log(msg: string): void {
  console.log(`[spike] ${msg}`);
}

function fail(msg: string): void {
  console.error(`[spike] ✗ ${msg}`);
  failures++;
}

function pass(msg: string): void {
  console.log(`[spike] ✓ ${msg}`);
}

async function preflightBinary(): Promise<void> {
  try {
    const out = execFileSync(BIN, ['--version'], { encoding: 'utf8' }).trim();
    log(`agentfs binary: ${out}`);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    throw new Error(
      `agentfs binary '${BIN}' not invokable: ${m}\n` +
        `Set WORKSPACE_AGENTFS_BIN or install agentfs to run this spike.`,
    );
  }
}

async function setupMount(): Promise<void> {
  await fs.mkdir(BASE, { recursive: true });
  await fs.mkdir(SCRATCH, { recursive: true });
  await fs.mkdir(MOUNT, { recursive: true });
  log(`workspace root: ${ROOT}`);
  log(`init session ${SID}`);
  execFileSync(BIN, ['init', SID, '--base', BASE, '--force'], { cwd: SCRATCH });
  log(`mount at ${MOUNT}`);
  mountDaemon = spawn(BIN, ['mount', '-f', '-a', SID, MOUNT], {
    cwd: SCRATCH,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  mountDaemon.stdout?.on('data', (b: Buffer) =>
    log(`[daemon-stdout] ${b.toString().trim()}`));
  mountDaemon.stderr?.on('data', (b: Buffer) =>
    log(`[daemon-stderr] ${b.toString().trim()}`));
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await isMounted()) {
      log('mount is live');
      return;
    }
    if (mountDaemon.exitCode !== null) {
      throw new Error(`mount daemon exited early code=${mountDaemon.exitCode}`);
    }
    await wait(100);
  }
  throw new Error('mount did not appear within 10s');
}

async function isMounted(): Promise<boolean> {
  try {
    const mounts = execFileSync('mount', [], { encoding: 'utf8' });
    return mounts.includes(MOUNT) || mounts.includes(`/private${MOUNT}`);
  } catch {
    return false;
  }
}

async function teardown(): Promise<void> {
  if (idleSubprocess && idleSubprocess.exitCode === null) {
    idleSubprocess.kill('SIGTERM');
    await wait(200);
  }
  if (mountDaemon && mountDaemon.exitCode === null) {
    mountDaemon.kill('SIGTERM');
    await wait(500);
    if (os.platform() === 'darwin') {
      try { execFileSync('diskutil', ['unmount', 'force', MOUNT], { stdio: 'ignore' }); } catch {}
    } else {
      try { execFileSync('fusermount', ['-u', MOUNT], { stdio: 'ignore' }); } catch {}
    }
  }
  try { await fs.rm(ROOT, { recursive: true, force: true }); } catch {}
}

// ─── Scenario 1: baseline host write/read ─────────────────────────────────

async function scenario1Baseline(): Promise<void> {
  log('scenario 1 — baseline host write/read via mount');
  const file = path.join(MOUNT, 'baseline.txt');
  await fs.writeFile(file, 'hello-baseline');
  const back = await fs.readFile(file, 'utf8');
  if (back === 'hello-baseline') pass('host write then host read via mount returns the same content');
  else fail(`read returned "${back}", expected "hello-baseline"`);
}

// ─── Scenario 2: subprocess idle, host writes, subprocess reads later ────

async function scenario2IdleSubprocess(): Promise<void> {
  log('scenario 2 — host writes during subprocess idle gap');
  const target = path.join(MOUNT, 'idle-target.txt');
  await fs.writeFile(target, 'v0');

  // Subprocess reads target.txt, sleeps 2s, reads again, prints both reads.
  // Simulates an "idle agent" between turns.
  idleSubprocess = spawn(
    'bash',
    [
      '-c',
      `cd ${MOUNT} && echo "first=$(cat idle-target.txt)" && sleep 2 && echo "second=$(cat idle-target.txt)"`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  idleSubprocess.stdout?.on('data', (b: Buffer) => (stdout += b.toString()));
  let stderr = '';
  idleSubprocess.stderr?.on('data', (b: Buffer) => (stderr += b.toString()));

  // Wait for the subprocess to do its first read.
  await wait(600);

  // Host writes "v1" through the mount while subprocess is sleeping.
  log('  host writes v1 to idle-target.txt');
  await fs.writeFile(target, 'v1');

  // Wait for subprocess to finish.
  const exitCode: number = await new Promise((resolve) => {
    idleSubprocess!.on('exit', (code) => resolve(code ?? -1));
  });
  if (exitCode !== 0) {
    fail(`subprocess exited code=${exitCode}; stderr=${stderr.trim()}`);
    return;
  }
  if (/first=v0/.test(stdout) && /second=v1/.test(stdout)) {
    pass('subprocess saw v0 then v1 — host write through mount is visible after idle');
  } else {
    fail(`unexpected subprocess output:\n${stdout}`);
  }
}

// ─── Scenario 3: rapid alternating host write + subprocess read ──────────

async function scenario3RapidAlternation(): Promise<void> {
  log('scenario 3 — host writes during subprocess active loop reads');
  const target = path.join(MOUNT, 'rapid-target.txt');
  await fs.writeFile(target, 'r0');

  // Subprocess loops reading the file every 100ms for 3s, prints each read.
  idleSubprocess = spawn(
    'bash',
    [
      '-c',
      `cd ${MOUNT} && for i in $(seq 1 30); do echo "read$i=$(cat rapid-target.txt)"; sleep 0.1; done`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  idleSubprocess.stdout?.on('data', (b: Buffer) => (stdout += b.toString()));
  let stderr = '';
  idleSubprocess.stderr?.on('data', (b: Buffer) => (stderr += b.toString()));

  // Concurrently write r1..r5 every ~500ms while subprocess is looping.
  await wait(250);
  for (let i = 1; i <= 5; i++) {
    await fs.writeFile(target, `r${i}`);
    log(`  host wrote r${i}`);
    await wait(500);
  }

  const exitCode: number = await new Promise((resolve) => {
    idleSubprocess!.on('exit', (code) => resolve(code ?? -1));
  });
  if (exitCode !== 0) {
    fail(`subprocess exited code=${exitCode}; stderr=${stderr.trim()}`);
    return;
  }
  const reads = stdout.match(/read\d+=r\d+/g) ?? [];
  if (reads.length < 25) {
    fail(`only got ${reads.length} reads (expected ~30); stdout was:\n${stdout}`);
    return;
  }
  // EIO would show up as the subprocess printing empty content / errors.
  // Stale content would show up as repeated old values past their host-write time.
  const distinctValues = new Set(reads.map((r) => r.split('=')[1]));
  if (distinctValues.size < 4) {
    fail(`subprocess saw only ${distinctValues.size} distinct values across ${reads.length} reads — host writes may not be propagating`);
  } else {
    pass(`subprocess saw ${distinctValues.size} distinct values (${Array.from(distinctValues).join(',')}) — host writes propagate to live readers`);
  }
}

async function main(): Promise<void> {
  console.log('\n=== Spike 0: agentfs mount-write safety ===\n');
  try {
    await preflightBinary();
    await setupMount();
    await scenario1Baseline();
    await scenario2IdleSubprocess();
    await scenario3RapidAlternation();
  } catch (err) {
    fail(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    log('teardown');
    await teardown();
  }

  console.log('\n=== Verdict ===');
  if (failures === 0) {
    console.log('PASS — host writes through the mount are safe and propagate to live readers.');
    console.log('       Phase 1 syncer design can use fs.writeFile against the mount path.\n');
    process.exit(0);
  } else {
    console.log(`FAIL — ${failures} check(s) failed.`);
    console.log('       Phase 1 syncer should fall back to MCP-tool-write design');
    console.log('       (agent invokes update_artifact tool instead of free Edit).\n');
    process.exit(1);
  }
}

main();
