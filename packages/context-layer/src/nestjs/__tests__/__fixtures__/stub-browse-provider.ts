/**
 * Stub `EntityBrowseProvider` for context-layer integration tests.
 *
 * Holds an in-memory entity catalog keyed by `entityType:entityId`.
 * Tests seed it with canned rows; `browse` / `search` / `resolve`
 * read from the catalog with the same filtering semantics the real
 * implementations use.
 */

import type {
  BrowseItem,
  BrowseResponse,
  EntityBrowseProvider,
  ResolveResponse,
  SearchResponse,
  SearchResult,
} from '../../../core/interfaces.js';

export interface StubEntityRow {
  readonly entityType: string;
  readonly entityId: string;
  readonly displayName: string;
  readonly subtitle?: string;
  readonly summary?: string;
  readonly data: Record<string, unknown>;
  readonly hasChildren?: boolean;
  readonly parent?: { entityType: string; entityId: string };
  readonly icon?: string;
  readonly timestamp?: string;
}

export class StubBrowseProvider implements EntityBrowseProvider {
  private readonly rows = new Map<string, StubEntityRow>();

  addRow(row: StubEntityRow): void {
    this.rows.set(this.key(row.entityType, row.entityId), row);
  }

  /** Test-only inspection helper. */
  getRow(entityType: string, entityId: string): StubEntityRow | undefined {
    return this.rows.get(this.key(entityType, entityId));
  }

  async browse(
    entityType: string,
    opts: { parentType?: string; parentId?: string; page?: number },
  ): Promise<BrowseResponse> {
    const filtered = Array.from(this.rows.values()).filter((r) => {
      if (r.entityType !== entityType) return false;
      if (opts.parentType && opts.parentId) {
        if (!r.parent) return false;
        if (
          r.parent.entityType !== opts.parentType ||
          r.parent.entityId !== opts.parentId
        ) {
          return false;
        }
      }
      return true;
    });
    const page = opts.page ?? 1;
    const items: BrowseItem[] = filtered.map((r) => ({
      entityType: r.entityType,
      entityId: r.entityId,
      displayName: r.displayName,
      subtitle: r.subtitle,
      timestamp: r.timestamp,
      hasChildren: r.hasChildren ?? false,
      summary: r.summary,
    }));
    return {
      items,
      total: items.length,
      page,
    };
  }

  async search(
    query: string,
    opts?: { entityType?: string; limit?: number },
  ): Promise<SearchResponse> {
    const q = query.toLowerCase();
    const results: SearchResult[] = Array.from(this.rows.values())
      .filter((r) => {
        if (opts?.entityType && r.entityType !== opts.entityType) return false;
        return (
          r.displayName.toLowerCase().includes(q) ||
          (r.subtitle ?? '').toLowerCase().includes(q) ||
          (r.summary ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, opts?.limit ?? 20)
      .map((r) => ({
        entityType: r.entityType,
        entityId: r.entityId,
        displayName: r.displayName,
        subtitle: r.subtitle,
        icon: r.icon ?? '📄',
        breadcrumb: null,
        summary: r.summary,
      }));
    return { results };
  }

  async resolve(entityType: string, entityId: string): Promise<ResolveResponse> {
    const row = this.rows.get(this.key(entityType, entityId));
    if (!row) {
      throw new Error(
        `StubBrowseProvider.resolve: no row for ${entityType}:${entityId}`,
      );
    }
    return {
      entityType: row.entityType,
      entityId: row.entityId,
      displayName: row.displayName,
      data: row.data,
      dataHash: `hash-${entityType}-${entityId}`,
      resolvedAt: new Date(0).toISOString(),
      breadcrumb: null,
    };
  }

  reset(): void {
    this.rows.clear();
  }

  private key(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }
}
