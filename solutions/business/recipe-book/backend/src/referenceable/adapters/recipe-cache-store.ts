import type { CacheStore } from '@kedge-agentic/context-layer/core';

export class RecipeCacheStore implements CacheStore {
  private kv = new Map<string, unknown>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private sortedSets = new Map<string, Map<string, number>>();
  private hashes = new Map<string, Map<string, string>>();

  async get<T>(key: string): Promise<T | null> {
    return (this.kv.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.kv.set(key, value);
    if (this.timers.has(key)) clearTimeout(this.timers.get(key)!);
    if (ttl && ttl > 0) {
      this.timers.set(key, setTimeout(() => { this.kv.delete(key); this.timers.delete(key); }, ttl * 1000));
    }
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
