/**
 * Simple sliding-window rate limiter (§18 / P4).
 *
 * Per-key (typically IP), counts hits in the last `windowMs` and rejects when
 * count >= `max`. Memory-only; resets across process restarts. Good enough for
 * a single-instance public demo; production-scale needs Redis.
 */
export interface RateLimiter {
  /** Returns true when the hit is allowed, false when over limit. */
  hit(key: string): boolean;
  /** Returns the remaining count for the key without consuming a hit. */
  remaining(key: string): number;
  /** Force-reset the limiter for a key (e.g. admin override). */
  reset(key?: string): void;
}

export function createRateLimiter(options: {
  /** Max hits per window */
  max: number;
  /** Window length in ms */
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>(); // key → timestamps

  function prune(key: string, now: number): number[] {
    const arr = hits.get(key) ?? [];
    const fresh = arr.filter((t) => t > now - options.windowMs);
    hits.set(key, fresh);
    return fresh;
  }

  return {
    hit(key: string): boolean {
      const now = Date.now();
      const fresh = prune(key, now);
      if (fresh.length >= options.max) return false;
      fresh.push(now);
      return true;
    },
    remaining(key: string): number {
      const fresh = prune(key, Date.now());
      return Math.max(0, options.max - fresh.length);
    },
    reset(key?: string): void {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },
  };
}
