import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';
import type {
  EntityTypeInfo,
  RelationInfo,
  RelationTree,
  BreadcrumbItem,
  BrowseItem,
  Recommendation,
  SearchResult,
} from '@kedge-agentic/context-layer/client';

export type { EntityTypeInfo, RelationInfo, RelationTree, BreadcrumbItem, BrowseItem, Recommendation, SearchResult };

interface AtPickerContextValue {
  baseUrl: string;
  sessionId: string;
  entityTypes: EntityTypeInfo[];
  tree: RelationTree | null;
  loading: boolean;
  fetchEntityTypes: () => Promise<void>;
  fetchSuggest: () => Promise<Recommendation[]>;
  fetchBrowse: (entityType: string, parentType?: string, parentId?: string) => Promise<{ items: BrowseItem[]; total: number }>;
  fetchSearch: (query: string) => Promise<SearchResult[]>;
  fetchResolve: (entityType: string, entityId: string) => Promise<unknown>;
  recordActivity: (entityType: string, entityId: string, displayName: string, action: string) => Promise<void>;
  getShortcuts: (sessionTemplate?: string) => Promise<{ pinned: string[]; hidden: string[] }>;
}

const AtPickerContext = createContext<AtPickerContextValue | null>(null);

export function useAtPickerContext(): AtPickerContextValue {
  const ctx = useContext(AtPickerContext);
  if (!ctx) throw new Error('useAtPickerContext must be used within AtPickerProvider');
  return ctx;
}

interface AtPickerProviderProps {
  baseUrl: string;
  sessionId: string;
  client?: ContextLayerClient;
  children: React.ReactNode;
}

export function AtPickerProvider({ baseUrl, sessionId, client: externalClient, children }: AtPickerProviderProps) {
  const [entityTypes, setEntityTypes] = useState<EntityTypeInfo[]>([]);
  const [tree, setTree] = useState<RelationTree | null>(null);
  const [loading, setLoading] = useState(false);

  const client = useMemo(
    () => externalClient ?? new ContextLayerClient(baseUrl),
    [externalClient, baseUrl],
  );

  const fetchEntityTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await client.getEntityTypes();
      setEntityTypes(data.types);
      setTree(data.tree);
    } finally {
      setLoading(false);
    }
  }, [client]);

  const fetchSuggest = useCallback(async (): Promise<Recommendation[]> => {
    const data = await client.suggest(sessionId);
    return data.recents;
  }, [client, sessionId]);

  const fetchBrowse = useCallback(async (entityType: string, parentType?: string, parentId?: string) => {
    const data = await client.browse(entityType, { parentType, parentId });
    return { items: data.items, total: data.total };
  }, [client]);

  const fetchSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
    const data = await client.search(query);
    return data.results;
  }, [client]);

  const fetchResolve = useCallback(async (entityType: string, entityId: string) => {
    return client.resolve(entityType, entityId);
  }, [client]);

  const recordActivity = useCallback(async (entityType: string, entityId: string, displayName: string, action: string) => {
    await client.recordActivity({ entityType, entityId, entityDisplayName: displayName, sessionId, action });
  }, [client, sessionId]);

  const getShortcuts = useCallback(async (sessionTemplate?: string) => {
    return client.getShortcuts(sessionTemplate);
  }, [client]);

  useEffect(() => {
    fetchEntityTypes();
  }, [fetchEntityTypes]);

  const value: AtPickerContextValue = {
    baseUrl,
    sessionId,
    entityTypes,
    tree,
    loading,
    fetchEntityTypes,
    fetchSuggest,
    fetchBrowse,
    fetchSearch,
    fetchResolve,
    recordActivity,
    getShortcuts,
  };

  return <AtPickerContext.Provider value={value}>{children}</AtPickerContext.Provider>;
}
