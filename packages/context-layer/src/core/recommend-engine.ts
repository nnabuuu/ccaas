import type { CacheStore, Recommendation, RecommendContext } from './interfaces.js';
import type { EntityRegistry } from './entity-registry.js';

export interface IncrementParams {
  entityType: string;
  entityId: string;
  displayName: string;
  action: string;
}

export class RecommendEngine {
  constructor(
    private cache: CacheStore,
    private registry: EntityRegistry,
  ) {}

  async incrementScore(
    tenantId: string,
    userId: string,
    sessionId: string,
    params: IncrementParams,
  ): Promise<void> {
    const key = `ctx:recents:${tenantId}:${userId}:${sessionId}`;
    const member = `${params.entityType}:${params.entityId}`;

    // Score delta based on action type
    const delta = this.computeDelta(params.action);
    await this.cache.zincrby(key, delta, member);

    // Store display info for later retrieval
    const infoKey = `ctx:entity_info:${tenantId}`;
    await this.cache.hset(infoKey, member, JSON.stringify({
      displayName: params.displayName,
      entityType: params.entityType,
      entityId: params.entityId,
    }));
  }

  async getTopN(ctx: RecommendContext, limit: number = 10): Promise<Recommendation[]> {
    const key = `ctx:recents:${ctx.tenantId}:${ctx.userId}:${ctx.sessionId}`;
    const entries = await this.cache.zrevrange(key, 0, limit - 1);
    if (entries.length === 0) return [];

    // Batch fetch all entity info in one round-trip
    const infoKey = `ctx:entity_info:${ctx.tenantId}`;
    const members = entries.map(e => e.member);
    const infoValues = await this.cache.hmget(infoKey, members);

    return entries.map((entry, i) => {
      const [entityType, entityId] = entry.member.split(':');
      const infoStr = infoValues[i];

      let displayName = entityId;
      if (infoStr) {
        try {
          const info = JSON.parse(infoStr);
          displayName = info.displayName ?? entityId;
        } catch {
          // ignore parse error
        }
      }

      const entityDef = this.registry.getEntity(entityType);
      const breadcrumb = this.registry.getBreadcrumb(entityType, entityId);

      return {
        entityType,
        entityId,
        displayName,
        icon: entityDef?.options.icon ?? '📄',
        color: entityDef?.options.color ?? null,
        score: entry.score,
        breadcrumb,
      };
    });
  }

  private computeDelta(action: string): number {
    switch (action) {
      case 'referenced': return 10;
      case 'created': return 8;
      case 'updated': return 5;
      case 'viewed': return 2;
      case 'deleted': return -5;
      default: return 1;
    }
  }
}
