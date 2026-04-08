import type { EntityBrowseProvider, ResolveResponse, BrowseResponse, SearchResponse } from './interfaces.js';
import type { EntityRegistry } from './entity-registry.js';

export class ContextInjector {
  constructor(
    private registry: EntityRegistry,
    private provider: EntityBrowseProvider,
  ) {}

  async browse(entityType: string, opts?: { parentType?: string; parentId?: string; page?: number }): Promise<BrowseResponse> {
    const result = await this.provider.browse(entityType, opts ?? {});

    // Enrich items with hasChildren from registry
    const enriched = result.items.map(item => ({
      ...item,
      hasChildren: item.hasChildren ?? this.registry.hasChildren(item.entityType),
    }));

    // Cache parent relationships for breadcrumb generation
    if (opts?.parentType && opts?.parentId) {
      for (const item of enriched) {
        const parentEntity = this.registry.getEntity(opts.parentType);
        if (parentEntity) {
          this.registry.cacheParent(
            item.entityType,
            item.entityId,
            opts.parentType,
            opts.parentId,
            item.displayName,
          );
        }
      }
    }

    return {
      items: enriched,
      total: result.total,
      page: result.page,
    };
  }

  async search(query: string, opts?: { entityType?: string; limit?: number }): Promise<SearchResponse> {
    const result = await this.provider.search(query, opts);

    // Enrich search results with breadcrumbs from the registry cache
    const enriched = result.results.map(item => ({
      ...item,
      breadcrumb: item.breadcrumb ?? this.registry.getBreadcrumb(item.entityType, item.entityId),
    }));

    return { results: enriched };
  }

  async resolve(entityType: string, entityId: string, fields?: string[]): Promise<ResolveResponse> {
    return this.provider.resolve(entityType, entityId, fields);
  }
}
