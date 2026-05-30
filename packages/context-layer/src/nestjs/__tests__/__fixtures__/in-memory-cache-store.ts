/**
 * In-memory `CacheStore` for context-layer integration tests.
 *
 * Implements the seven `CacheStore` methods using plain Maps:
 *   - key → value (for get/set)
 *   - key → Map<member, score> (for zincrby/zrevrange)
 *   - key → Map<field, string> (for hget/hmget/hset)
 *
 * Behavior mirrors Redis semantics for the subset the production
 * implementations use: `zincrby` adds to existing score, `zrevrange`
 * returns by score descending with stable tiebreak on member name,
 * `hmget` returns null for missing fields.
 *
 * Test code can introspect internal state via `getZsetSize` /
 * `getAllZsetMembers` for assertions that don't go through the public
 * read APIs.
 */

import type { CacheStore } from '../../../core/interfaces.js';

export class InMemoryCacheStore implements CacheStore {
  private readonly kv = new Map<string, unknown>();
  private readonly zsets = new Map<string, Map<string, number>>();
  private readonly hashes = new Map<string, Map<string, string>>();

  async get<T>(key: string): Promise<T | null> {
    const v = this.kv.get(key);
    return v === undefined ? null : (v as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.kv.set(key, value);
  }

  async zincrby(key: string, increment: number, member: string): Promise<void> {
    let zset = this.zsets.get(key);
    if (!zset) {
      zset = new Map();
      this.zsets.set(key, zset);
    }
    zset.set(member, (zset.get(member) ?? 0) + increment);
  }

  async zrevrange(
    key: string,
    start: number,
    stop: number,
  ): Promise<Array<{ member: string; score: number }>> {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const sorted = Array.from(zset.entries())
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.member.localeCompare(b.member);
      });
    return sorted.slice(start, stop + 1);
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashes.get(key);
    if (!hash) return null;
    return hash.get(field) ?? null;
  }

  async hmget(key: string, fields: string[]): Promise<Array<string | null>> {
    const hash = this.hashes.get(key);
    if (!hash) return fields.map(() => null);
    return fields.map((f) => hash.get(f) ?? null);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    hash.set(field, value);
  }

  // ─── Test helpers (not on the CacheStore interface) ───

  /** Snapshot the current member set + scores for a sorted-set key. */
  getZsetSnapshot(key: string): Array<{ member: string; score: number }> {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    return Array.from(zset.entries())
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score);
  }

  /** Snapshot a hash key as a plain object. */
  getHashSnapshot(key: string): Record<string, string> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  /** Reset all storage; useful in beforeEach. */
  reset(): void {
    this.kv.clear();
    this.zsets.clear();
    this.hashes.clear();
  }
}
