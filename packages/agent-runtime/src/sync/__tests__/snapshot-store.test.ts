import { describe, it, expect } from 'vitest';

import { InMemorySnapshotStore } from '../snapshot-store.js';

const SID = 'sess-1';
const OTHER = 'sess-2';
const NOW = '2026-05-25T12:00:00.000Z';

describe('InMemorySnapshotStore', () => {
  it('starts empty', async () => {
    const store = new InMemorySnapshotStore();
    expect(await store.list(SID)).toEqual([]);
  });

  it('put + list returns the entry', async () => {
    const store = new InMemorySnapshotStore();
    await store.put({ sessionId: SID, path: 'a.md', contentHash: 'h1', type: 'md', updatedAt: NOW });
    const list = await store.list(SID);
    expect(list).toHaveLength(1);
    expect(list[0].path).toBe('a.md');
    expect(list[0].contentHash).toBe('h1');
  });

  it('put on existing (sessionId, path) overwrites', async () => {
    const store = new InMemorySnapshotStore();
    await store.put({ sessionId: SID, path: 'a.md', contentHash: 'h1', type: 'md', updatedAt: NOW });
    await store.put({ sessionId: SID, path: 'a.md', contentHash: 'h2', type: 'md', updatedAt: NOW });
    const list = await store.list(SID);
    expect(list).toHaveLength(1);
    expect(list[0].contentHash).toBe('h2');
  });

  it('isolates sessions', async () => {
    const store = new InMemorySnapshotStore();
    await store.put({ sessionId: SID, path: 'a.md', contentHash: 'h1', type: 'md', updatedAt: NOW });
    await store.put({ sessionId: OTHER, path: 'a.md', contentHash: 'hX', type: 'md', updatedAt: NOW });
    const list1 = await store.list(SID);
    const list2 = await store.list(OTHER);
    expect(list1).toHaveLength(1);
    expect(list2).toHaveLength(1);
    expect(list1[0].contentHash).toBe('h1');
    expect(list2[0].contentHash).toBe('hX');
  });

  it('remove deletes a single entry', async () => {
    const store = new InMemorySnapshotStore();
    await store.put({ sessionId: SID, path: 'a.md', contentHash: 'h1', type: 'md', updatedAt: NOW });
    await store.put({ sessionId: SID, path: 'b.md', contentHash: 'h2', type: 'md', updatedAt: NOW });
    await store.remove(SID, 'a.md');
    const list = await store.list(SID);
    expect(list).toHaveLength(1);
    expect(list[0].path).toBe('b.md');
  });

  it('clear drops every entry for a session', async () => {
    const store = new InMemorySnapshotStore();
    await store.put({ sessionId: SID, path: 'a.md', contentHash: 'h1', type: 'md', updatedAt: NOW });
    await store.put({ sessionId: SID, path: 'b.md', contentHash: 'h2', type: 'md', updatedAt: NOW });
    await store.put({ sessionId: OTHER, path: 'a.md', contentHash: 'hX', type: 'md', updatedAt: NOW });
    await store.clear(SID);
    expect(await store.list(SID)).toEqual([]);
    expect(await store.list(OTHER)).toHaveLength(1);
  });
});
