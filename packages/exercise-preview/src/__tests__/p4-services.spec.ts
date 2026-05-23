import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  FileShortCodesStore,
  MemoryShortCodesStore,
} from '../backend/shortcodes-store';
import { createRateLimiter } from '../backend/rate-limiter';

describe('ShortCodesStore (memory)', () => {
  let store: MemoryShortCodesStore;

  beforeEach(() => {
    store = new MemoryShortCodesStore();
  });

  it('create + resolve round-trip', async () => {
    const code = await store.create({ bundleId: 'quiz', storyName: 'Default' });
    expect(code).toBeTruthy();
    const entry = await store.resolve(code);
    expect(entry?.bundleId).toBe('quiz');
    expect(entry?.storyName).toBe('Default');
  });

  it('deterministic codes are stable across multiple calls', async () => {
    const c1 = await store.create({ bundleId: 'quiz', storyName: 'X' }, { deterministic: true });
    const c2 = await store.create({ bundleId: 'quiz', storyName: 'X' }, { deterministic: true });
    expect(c1).toBe(c2);
  });

  it('resolve returns null for expired entries', async () => {
    const code = await store.create({
      bundleId: 'quiz',
      storyName: 'Default',
      expiresAt: Date.now() - 1000,
    });
    expect(await store.resolve(code)).toBeNull();
  });

  it('prune removes expired entries', async () => {
    await store.create({ bundleId: 'a', storyName: 's', expiresAt: Date.now() - 1000 });
    await store.create({ bundleId: 'b', storyName: 's' });
    const removed = await store.prune();
    expect(removed).toBe(1);
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].bundleId).toBe('b');
  });

  it('delete removes entry', async () => {
    const code = await store.create({ bundleId: 'quiz', storyName: 'Default' });
    expect(await store.delete(code)).toBe(true);
    expect(await store.resolve(code)).toBeNull();
    expect(await store.delete(code)).toBe(false);
  });
});

describe('FileShortCodesStore (json file)', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-codes-'));
    filePath = path.join(tmpDir, 'codes.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists across instances', async () => {
    const a = new FileShortCodesStore(filePath);
    const code = await a.create({ bundleId: 'quiz', storyName: 'Default' });
    const b = new FileShortCodesStore(filePath);
    const entry = await b.resolve(code);
    expect(entry?.bundleId).toBe('quiz');
  });

  it('creates parent directories', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'codes.json');
    const store = new FileShortCodesStore(nested);
    await store.create({ bundleId: 'x', storyName: 'y' });
    expect(fs.existsSync(nested)).toBe(true);
  });
});

describe('RateLimiter', () => {
  it('allows hits up to max within window', () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(rl.hit('a')).toBe(true);
    expect(rl.hit('a')).toBe(true);
    expect(rl.hit('a')).toBe(true);
    expect(rl.hit('a')).toBe(false);
    expect(rl.remaining('a')).toBe(0);
  });

  it('per-key isolation', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.hit('a')).toBe(true);
    expect(rl.hit('b')).toBe(true); // different key, fresh budget
    expect(rl.hit('a')).toBe(false);
  });

  it('reset clears the bucket', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    rl.hit('a');
    expect(rl.hit('a')).toBe(false);
    rl.reset('a');
    expect(rl.hit('a')).toBe(true);
  });

  it('hits expire after windowMs', async () => {
    const rl = createRateLimiter({ max: 1, windowMs: 50 });
    expect(rl.hit('a')).toBe(true);
    expect(rl.hit('a')).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(rl.hit('a')).toBe(true);
  });
});
