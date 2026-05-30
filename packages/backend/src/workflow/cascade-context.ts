/**
 * `CascadeContext` — per-async-call cascade tracking via Node's
 * `AsyncLocalStorage`.
 *
 * Used to propagate `(depth, correlationId, originStream)` from an
 * outer trigger dispatch into any actions it fires + any nested
 * triggers those actions cause via state changes or stream publishes.
 *
 * Why ALS: the workflow engine's dispatch crosses many async
 * boundaries (action handler → ManifestAccessor.setState →
 * onStateChange listener → another trigger). Threading a `cascade`
 * arg through every layer would touch too many surfaces; ALS lets
 * each layer just call `currentCascade()` when it needs depth.
 *
 * Depth ceiling is enforced by `WorkflowEngineService`, not here —
 * this module only carries the state.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface CascadeFrame {
  readonly depth: number;
  readonly correlationId: string;
  readonly originStream?: string;
}

const cascadeStore = new AsyncLocalStorage<CascadeFrame>();

/**
 * Read the current cascade frame. Returns a fresh frame at depth 0
 * with a new correlationId when called outside any cascade — useful
 * for external entry points (HTTP ingest, scheduler tick) that start
 * a new trace.
 */
export function currentCascade(): CascadeFrame {
  return cascadeStore.getStore() ?? newRootFrame();
}

/**
 * Enter a child cascade frame for the duration of `fn`. Depth is
 * incremented, correlationId is preserved.
 */
export function withChildCascade<T>(
  originStream: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const parent = cascadeStore.getStore() ?? newRootFrame();
  const child: CascadeFrame = {
    depth: parent.depth + 1,
    correlationId: parent.correlationId,
    originStream: originStream ?? parent.originStream,
  };
  return cascadeStore.run(child, fn);
}

/**
 * Enter a fresh root cascade frame (depth 0, new correlationId).
 * Used by external ingestion sites that aren't continuations of
 * an existing trigger chain.
 */
export function withRootCascade<T>(
  originStream: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const root: CascadeFrame = {
    depth: 0,
    correlationId: randomUUID(),
    originStream,
  };
  return cascadeStore.run(root, fn);
}

function newRootFrame(): CascadeFrame {
  return { depth: 0, correlationId: randomUUID() };
}
