/**
 * Automated isolation check WITHOUT spawning claude — purely exercises the
 * mount/overlay layer so this runs fast in CI without depending on a Claude
 * API key. Spawning claude is covered by the demo scripts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SessionFsManager } from '../src/session-fs-manager.js';

const baseDir = '/tmp/vfs-poc-isolation-test/base';
const deltaStore = '/tmp/vfs-poc-isolation-test/sessions';
const mountRoot = '/tmp/vfs-poc-isolation-test/mnt';

function cleanup(): void {
  try { rmSync('/tmp/vfs-poc-isolation-test', { recursive: true, force: true }); } catch {}
}

test('base + delta overlay: writes isolate per session, base shared and untouched', async (t) => {
  cleanup();
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(join(baseDir, 'shared.txt'), 'hello from base');

  const mgr = new SessionFsManager({ baseDir, deltaStore, mountRoot });
  const A = await mgr.create('iso-A');
  const B = await mgr.create('iso-B');

  t.after(async () => {
    await A.destroy();
    await B.destroy();
    cleanup();
  });

  // base file visible through both mounts
  assert.equal(readFileSync(join(A.mountPoint, 'shared.txt'), 'utf8'), 'hello from base');
  assert.equal(readFileSync(join(B.mountPoint, 'shared.txt'), 'utf8'), 'hello from base');

  // session A writes a private file
  writeFileSync(join(A.mountPoint, 'mine.txt'), 'from-A');
  // session B writes its own private file
  writeFileSync(join(B.mountPoint, 'mine.txt'), 'from-B');

  // each session sees its OWN content (not the other's)
  assert.equal(readFileSync(join(A.mountPoint, 'mine.txt'), 'utf8'), 'from-A');
  assert.equal(readFileSync(join(B.mountPoint, 'mine.txt'), 'utf8'), 'from-B');

  // base remains untouched
  assert.equal(existsSync(join(baseDir, 'mine.txt')), false, 'base has no mine.txt');
  assert.equal(readFileSync(join(baseDir, 'shared.txt'), 'utf8'), 'hello from base');
});

test('snapshot + rollback restores delta state', async (t) => {
  cleanup();
  mkdirSync(baseDir, { recursive: true });

  const mgr = new SessionFsManager({ baseDir, deltaStore, mountRoot });
  const h = await mgr.create('snap-test');

  t.after(async () => {
    await h.destroy();
    cleanup();
  });

  writeFileSync(join(h.mountPoint, 'one.txt'), 'first');
  writeFileSync(join(h.mountPoint, 'two.txt'), 'second');
  await h.snapshot('cp1');

  writeFileSync(join(h.mountPoint, 'one.txt'), 'MUTATED');
  rmSync(join(h.mountPoint, 'two.txt'));
  writeFileSync(join(h.mountPoint, 'three.txt'), 'extra');

  assert.equal(readFileSync(join(h.mountPoint, 'one.txt'), 'utf8'), 'MUTATED');
  assert.equal(existsSync(join(h.mountPoint, 'two.txt')), false);
  assert.equal(readFileSync(join(h.mountPoint, 'three.txt'), 'utf8'), 'extra');

  await h.rollback('cp1');

  assert.equal(readFileSync(join(h.mountPoint, 'one.txt'), 'utf8'), 'first');
  assert.equal(readFileSync(join(h.mountPoint, 'two.txt'), 'utf8'), 'second');
  assert.equal(existsSync(join(h.mountPoint, 'three.txt')), false, 'post-snapshot file gone after rollback');
});
