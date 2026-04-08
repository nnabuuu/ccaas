import type {
  EntityTypesResponse,
  SuggestResponse,
  BrowseResponse,
  SearchResponse,
  ResolveResponse,
  ShortcutsResponse,
  ShortcutsConfig,
} from '../core/interfaces.js';

export class ContextLayerClient {
  constructor(
    private baseUrl: string,
    private authProvider?: () => string,
  ) {}

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authProvider) {
      headers['Authorization'] = `Bearer ${this.authProvider()}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    });

    if (!response.ok) {
      throw new Error(`ContextLayer API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getEntityTypes(): Promise<EntityTypesResponse> {
    return this.fetch<EntityTypesResponse>('/entity-types');
  }

  async suggest(sessionId: string, limit?: number): Promise<SuggestResponse> {
    const params = new URLSearchParams({ session_id: sessionId });
    if (limit) params.set('limit', String(limit));
    return this.fetch<SuggestResponse>(`/suggest?${params}`);
  }

  async browse(entityType: string, opts?: { parentType?: string; parentId?: string; page?: number }): Promise<BrowseResponse> {
    const params = new URLSearchParams({ entity_type: entityType });
    if (opts?.parentType) params.set('parent_type', opts.parentType);
    if (opts?.parentId) params.set('parent_id', opts.parentId);
    if (opts?.page) params.set('page', String(opts.page));
    return this.fetch<BrowseResponse>(`/browse?${params}`);
  }

  async search(query: string, opts?: { entityType?: string; limit?: number }): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (opts?.entityType) params.set('entity_type', opts.entityType);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return this.fetch<SearchResponse>(`/search?${params}`);
  }

  async resolve(entityType: string, entityId: string, fields?: string[]): Promise<ResolveResponse> {
    const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
    if (fields) params.set('fields', fields.join(','));
    return this.fetch<ResolveResponse>(`/resolve?${params}`);
  }

  async recordActivity(body: {
    entityType: string;
    entityId: string;
    entityDisplayName: string;
    sessionId: string;
    action: string;
  }): Promise<void> {
    await this.fetch('/activity', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getShortcuts(sessionTemplate?: string): Promise<ShortcutsResponse> {
    const params = sessionTemplate ? `?session_template=${encodeURIComponent(sessionTemplate)}` : '';
    return this.fetch<ShortcutsResponse>(`/shortcuts${params}`);
  }

  async updateShortcuts(config: ShortcutsConfig): Promise<void> {
    await this.fetch('/shortcuts', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }
}
