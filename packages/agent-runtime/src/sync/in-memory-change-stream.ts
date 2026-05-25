/**
 * `InMemoryChangeStream` — the single-process default impl of the
 * `ChangeStream` port from `./types.ts`.
 *
 * Fans out `ChangeEvent`s per projectId. Subscribers receive events
 * asynchronously via microtask scheduling (so a `publish()` call doesn't
 * synchronously block on listener work). Unsubscribe via the returned
 * thunk.
 *
 * A future Phase 2 impl will swap to Redis pub/sub for multi-instance
 * deployments. The interface (`ChangeStream`) stays the same so
 * consumers don't change.
 */

import type { ChangeEvent, ChangeListener, ChangeStream } from './types.js';

export class InMemoryChangeStream implements ChangeStream {
  private readonly listeners = new Map<string, Set<ChangeListener>>();

  subscribe(projectId: string, listener: ChangeListener): () => void {
    let set = this.listeners.get(projectId);
    if (!set) {
      set = new Set();
      this.listeners.set(projectId, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(projectId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(projectId);
    };
  }

  publish(event: ChangeEvent): void {
    const set = this.listeners.get(event.projectId);
    if (!set || set.size === 0) return;
    // Snapshot the listener set so an unsubscribe during dispatch
    // doesn't change what this publish call sees.
    const snapshot = Array.from(set);
    for (const listener of snapshot) {
      // Schedule each callback as a microtask so a throw doesn't
      // abort the fan-out for siblings, and so publish() returns
      // synchronously.
      queueMicrotask(() => {
        try {
          listener(event);
        } catch {
          // Swallow listener errors. A listener that wants logging
          // can do its own try/catch.
        }
      });
    }
  }

  /** Test helper: how many listeners are currently subscribed for projectId. */
  listenerCount(projectId: string): number {
    return this.listeners.get(projectId)?.size ?? 0;
  }
}
