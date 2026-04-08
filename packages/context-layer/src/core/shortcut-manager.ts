import type { CacheStore, ShortcutsConfig, ShortcutsResponse } from './interfaces.js';

export class ShortcutManager {
  constructor(private cache: CacheStore) {}

  async getShortcuts(userId: string, tenantId: string, sessionTemplate?: string): Promise<ShortcutsResponse> {
    const key = sessionTemplate
      ? `ctx:shortcuts:${tenantId}:${userId}:${sessionTemplate}`
      : `ctx:shortcuts:${tenantId}:${userId}`;
    const stored = await this.cache.get<ShortcutsConfig>(key);

    if (stored) {
      return { pinned: stored.pinned, hidden: stored.hidden };
    }

    return { pinned: [], hidden: [] };
  }

  async updateShortcuts(userId: string, tenantId: string, config: ShortcutsConfig): Promise<void> {
    const key = `ctx:shortcuts:${tenantId}:${userId}`;
    await this.cache.set(key, config);
  }
}
