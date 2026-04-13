import type { CacheStore } from '@kedge-agentic/context-layer/core';

/**
 * In-memory CacheStore for edu-platform.
 * Sufficient for single-instance deployment; replace with Redis for production.
 */
export class EduCacheStore implements CacheStore {
  private kv = new Map<string, unknown>();
  private sortedSets = new Map<string, Map<string, number>>();
  private hashes = new Map<string, Map<string, string>>();

  async get<T>(key: string): Promise<T | null> {
    return (this.kv.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.kv.set(key, value);
  }

  async zincrby(key: string, increment: number, member: string): Promise<void> {
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
    const set = this.sortedSets.get(key)!;
    set.set(member, (set.get(member) ?? 0) + increment);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<Array<{ member: string; score: number }>> {
    const set = this.sortedSets.get(key);
    if (!set) return [];
    const entries = [...set.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score);
    return entries.slice(start, stop + 1);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hmget(key: string, fields: string[]): Promise<Array<string | null>> {
    const hash = this.hashes.get(key);
    return fields.map(f => hash?.get(f) ?? null);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key)!.set(field, value);
  }
}
