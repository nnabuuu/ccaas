import { describe, it, expect, vi } from 'vitest';

import { InMemoryChangeStream } from '../in-memory-change-stream.js';
import type { ChangeEvent } from '../types.js';

function ev(projectId: string, path: string): ChangeEvent {
  return {
    projectId,
    path,
    source: 'agent',
    kind: 'updated',
    at: '2026-05-25T12:00:00.000Z',
  };
}

const tick = () => new Promise((r) => queueMicrotask(() => r(undefined)));

describe('InMemoryChangeStream', () => {
  it('delivers published events to subscribers of the same projectId', async () => {
    const stream = new InMemoryChangeStream();
    const listener = vi.fn();
    stream.subscribe('p1', listener);
    stream.publish(ev('p1', 'a.md'));
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].path).toBe('a.md');
  });

  it('does not deliver to other projectIds', async () => {
    const stream = new InMemoryChangeStream();
    const p1 = vi.fn();
    const p2 = vi.fn();
    stream.subscribe('p1', p1);
    stream.subscribe('p2', p2);
    stream.publish(ev('p1', 'a.md'));
    await tick();
    expect(p1).toHaveBeenCalledTimes(1);
    expect(p2).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivery', async () => {
    const stream = new InMemoryChangeStream();
    const listener = vi.fn();
    const unsubscribe = stream.subscribe('p1', listener);
    stream.publish(ev('p1', 'a.md'));
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    stream.publish(ev('p1', 'b.md'));
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(stream.listenerCount('p1')).toBe(0);
  });

  it('unsubscribing during fan-out does not skip sibling listeners', async () => {
    const stream = new InMemoryChangeStream();
    const a = vi.fn();
    let unsubB: () => void = () => {};
    const b = vi.fn(() => unsubB());
    const c = vi.fn();
    stream.subscribe('p1', a);
    unsubB = stream.subscribe('p1', b);
    stream.subscribe('p1', c);
    stream.publish(ev('p1', 'x.md'));
    await tick();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener does not break siblings', async () => {
    const stream = new InMemoryChangeStream();
    stream.subscribe('p1', () => {
      throw new Error('oops');
    });
    const good = vi.fn();
    stream.subscribe('p1', good);
    stream.publish(ev('p1', 'x.md'));
    await tick();
    expect(good).toHaveBeenCalledTimes(1);
  });
});
