/**
 * Proxy-based plugin instrumentation.
 *
 * Wraps a plugin reference so every method call is recorded into a tracer.
 * Plugin authors export a `grade` function on their plugin — instrumenting
 * it lets the Inspector show:
 *   - which lifecycle hooks were invoked
 *   - call count per method
 *   - last call timing
 *   - thrown errors with stack
 *
 * Used by the preview server to capture grade timing transparently; can also
 * be applied client-side in the PreviewApp UI when running plugins in-browser.
 */
import type { PreviewPluginRef } from '../core/types';

export interface LifecycleEvent {
  method: string;
  argSnapshot: unknown[];
  result?: unknown;
  error?: { message: string; stack?: string };
  durationMs: number;
  timestamp: number;
}

export interface Tracer {
  record(event: LifecycleEvent): void;
  events(): LifecycleEvent[];
  clear(): void;
  /** Aggregate: { methodName → call count } */
  countByMethod(): Record<string, number>;
}

export function createTracer(): Tracer {
  const events: LifecycleEvent[] = [];
  return {
    record(e: LifecycleEvent) {
      events.push(e);
    },
    events() {
      return events.slice();
    },
    clear() {
      events.length = 0;
    },
    countByMethod() {
      const counts: Record<string, number> = {};
      for (const e of events) counts[e.method] = (counts[e.method] ?? 0) + 1;
      return counts;
    },
  };
}

/**
 * Proxy-wrap a plugin so every function-valued property logs to the tracer.
 *
 * Returns a new object with the same shape — read-only properties are
 * forwarded unchanged; methods are wrapped.
 *
 * @example
 * const tracer = createTracer();
 * const instrumented = instrumentPlugin(longDivisionPlugin, tracer);
 * await instrumented.grade?.({ ... });
 * console.log(tracer.events());
 */
export function instrumentPlugin<T extends PreviewPluginRef & Record<string, unknown>>(
  plugin: T,
  tracer: Tracer,
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Proxy(plugin, {
    get(target, prop) {
      const value = (target as Record<string | symbol, unknown>)[prop];
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const t0 = Date.now();
        const snapshot = args.map((a) => safeClone(a));
        try {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (result instanceof Promise) {
            return result.then(
              (resolved) => {
                tracer.record({
                  method: String(prop),
                  argSnapshot: snapshot,
                  result: safeClone(resolved),
                  durationMs: Date.now() - t0,
                  timestamp: Date.now(),
                });
                return resolved;
              },
              (err) => {
                tracer.record({
                  method: String(prop),
                  argSnapshot: snapshot,
                  error: {
                    message: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                  },
                  durationMs: Date.now() - t0,
                  timestamp: Date.now(),
                });
                throw err;
              },
            );
          }
          tracer.record({
            method: String(prop),
            argSnapshot: snapshot,
            result: safeClone(result),
            durationMs: Date.now() - t0,
            timestamp: Date.now(),
          });
          return result;
        } catch (err) {
          tracer.record({
            method: String(prop),
            argSnapshot: snapshot,
            error: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            durationMs: Date.now() - t0,
            timestamp: Date.now(),
          });
          throw err;
        }
      };
    },
  }) as T;
}

/**
 * Deep-clone a value safely — strips functions, recurses through objects/arrays,
 * caps depth to avoid pathological cases. Used for the argument snapshot so the
 * recorded event survives later mutation.
 */
function safeClone(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max-depth]';
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t === 'function') return `[function ${(value as Function).name || 'anonymous'}]`;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => safeClone(v, depth + 1));
  if (t === 'object') {
    const out: Record<string, unknown> = {};
    let i = 0;
    for (const k of Object.keys(value as object)) {
      if (i++ >= 50) {
        out['…'] = `[+${Object.keys(value as object).length - 50} more keys]`;
        break;
      }
      out[k] = safeClone((value as Record<string, unknown>)[k], depth + 1);
    }
    return out;
  }
  return String(value);
}
