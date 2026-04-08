import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AtPickerProvider, useAtPickerContext } from './AtPickerProvider.js';
import type { Recommendation, BrowseItem, SearchResult, BreadcrumbItem, EntityTypeInfo, RelationInfo } from './AtPickerProvider.js';

export interface EntityRef {
  entityType: string;
  entityId: string;
  displayName: string;
  icon: string;
  data?: unknown;
}

export interface AtPickerProps {
  baseUrl: string;
  sessionId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (entity: EntityRef) => void;
  sessionTemplate?: string;
  initialDrillType?: string;
}

export function AtPicker(props: AtPickerProps) {
  return (
    <AtPickerProvider baseUrl={props.baseUrl} sessionId={props.sessionId}>
      <AtPickerInner {...props} />
    </AtPickerProvider>
  );
}

type ViewState =
  | { kind: 'home' }
  | { kind: 'browse'; entityType: string; parentType?: string; parentId?: string; parentDisplayName?: string; trail: BreadcrumbTrail[] }
  | { kind: 'search'; query: string };

interface BreadcrumbTrail {
  entityType: string;
  parentType?: string;
  parentId?: string;
  displayName: string;
  icon: string;
}

function AtPickerInner({ open, onClose, onSelect, sessionTemplate, initialDrillType }: AtPickerProps) {
  const ctx = useAtPickerContext();
  const [view, setView] = useState<ViewState>({ kind: 'home' });
  const [recents, setRecents] = useState<Recommendation[]>([]);
  const [browseItems, setBrowseItems] = useState<BrowseItem[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [shortcuts, setShortcuts] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recents on open
  useEffect(() => {
    if (!open) return;
    ctx.fetchSuggest().then(setRecents);
    ctx.getShortcuts(sessionTemplate).then(s => setShortcuts(s.pinned));
  }, [open, ctx, sessionTemplate]);

  // Handle initial drill type (from toolbar shortcut)
  useEffect(() => {
    if (open && initialDrillType && ctx.tree) {
      const typeInfo = ctx.entityTypes.find(t => t.type === initialDrillType);
      if (typeInfo) {
        setView({
          kind: 'browse',
          entityType: initialDrillType,
          trail: [{ entityType: initialDrillType, displayName: typeInfo.displayName, icon: typeInfo.icon }],
        });
        ctx.fetchBrowse(initialDrillType).then(r => setBrowseItems(r.items));
      }
    }
  }, [open, initialDrillType, ctx]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setView({ kind: 'home' });
      setSearchQuery('');
      setSearchResults([]);
      setBrowseItems([]);
    }
  }, [open]);

  // Debounced search
  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setView({ kind: 'home' });
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setView({ kind: 'search', query });
      const results = await ctx.fetchSearch(query);
      setSearchResults(results);
    }, 200);
  }, [ctx]);

  // Handle type browse
  const handleTypeBrowse = useCallback(async (type: string) => {
    const typeInfo = ctx.entityTypes.find(t => t.type === type);
    if (!typeInfo) return;
    setView({
      kind: 'browse',
      entityType: type,
      trail: [{ entityType: type, displayName: typeInfo.displayName, icon: typeInfo.icon }],
    });
    const result = await ctx.fetchBrowse(type);
    setBrowseItems(result.items);
  }, [ctx]);

  // Handle drill down
  const handleDrillDown = useCallback(async (item: BrowseItem) => {
    if (!ctx.tree) return;
    const childRel = ctx.tree.relations.find(r => r.parent === item.entityType);
    if (!childRel) return;

    const childTypeInfo = ctx.entityTypes.find(t => t.type === childRel.child);
    if (!childTypeInfo) return;

    setView(prev => {
      if (prev.kind !== 'browse') return prev;
      return {
        kind: 'browse',
        entityType: childRel.child,
        parentType: item.entityType,
        parentId: item.entityId,
        parentDisplayName: item.displayName,
        trail: [...prev.trail, {
          entityType: childRel.child,
          parentType: item.entityType,
          parentId: item.entityId,
          displayName: item.displayName,
          icon: childTypeInfo.icon,
        }],
      };
    });

    const result = await ctx.fetchBrowse(childRel.child, item.entityType, item.entityId);
    setBrowseItems(result.items);
  }, [ctx]);

  // Handle select
  const handleSelect = useCallback(async (entityType: string, entityId: string, displayName: string) => {
    const typeInfo = ctx.entityTypes.find(t => t.type === entityType);
    const resolvedData = await ctx.fetchResolve(entityType, entityId);
    await ctx.recordActivity(entityType, entityId, displayName, 'referenced');
    onSelect({
      entityType,
      entityId,
      displayName,
      icon: typeInfo?.icon ?? '📄',
      data: resolvedData,
    });
    onClose();
  }, [ctx, onSelect, onClose]);

  // Handle back navigation
  const handleBack = useCallback(async () => {
    if (view.kind !== 'browse') return;
    const trail = view.trail;

    if (trail.length <= 1) {
      setView({ kind: 'home' });
      return;
    }

    const newTrail = trail.slice(0, -1);
    const prev = newTrail[newTrail.length - 1];
    const parentTrail = newTrail.length > 1 ? newTrail[newTrail.length - 2] : undefined;

    setView({
      kind: 'browse',
      entityType: prev.entityType,
      parentType: parentTrail?.entityType,
      parentId: prev.parentId,
      trail: newTrail,
    });

    const result = await ctx.fetchBrowse(prev.entityType, parentTrail?.entityType, prev.parentId);
    setBrowseItems(result.items);
  }, [view, ctx]);

  // Reset focused index when view or items change
  useEffect(() => { setFocusedIndex(-1); }, [view, recents, browseItems, searchResults]);

  // Compute navigable items count for keyboard navigation
  const getNavigableCount = useCallback((): number => {
    if (view.kind === 'home') return recents.length + (ctx.tree?.roots.length ?? 0);
    if (view.kind === 'browse') return browseItems.length;
    if (view.kind === 'search') return searchResults.length;
    return 0;
  }, [view, recents, browseItems, searchResults, ctx.tree]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const count = getNavigableCount();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % count);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev <= 0 ? count - 1 : prev - 1));
      return;
    }
    if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      if (view.kind === 'home') {
        if (focusedIndex < recents.length) {
          const item = recents[focusedIndex];
          handleSelect(item.entityType, item.entityId, item.displayName);
        } else {
          const rootIndex = focusedIndex - recents.length;
          const rootType = ctx.tree?.roots[rootIndex];
          if (rootType) handleTypeBrowse(rootType);
        }
      } else if (view.kind === 'browse') {
        const item = browseItems[focusedIndex];
        if (item) handleSelect(item.entityType, item.entityId, item.displayName);
      } else if (view.kind === 'search') {
        const item = searchResults[focusedIndex];
        if (item) handleSelect(item.entityType, item.entityId, item.displayName);
      }
      return;
    }
    if (e.key === 'ArrowRight' && focusedIndex >= 0 && view.kind === 'browse') {
      e.preventDefault();
      const item = browseItems[focusedIndex];
      if (item && hasChildren(item.entityType) && item.hasChildren) handleDrillDown(item);
      return;
    }
    if (e.key === 'ArrowLeft' && view.kind === 'browse') {
      e.preventDefault();
      handleBack();
      return;
    }
  }, [focusedIndex, getNavigableCount, view, recents, browseItems, searchResults, ctx.tree, handleSelect, handleTypeBrowse, handleDrillDown, handleBack, onClose]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-nav-item]');
    items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  if (!open) return null;

  const hasChildren = (entityType: string): boolean => {
    return ctx.tree?.relations.some(r => r.parent === entityType) ?? false;
  };

  const focusStyle = (index: number) => index === focusedIndex ? { background: '#e8f0fe' } : {};

  return (
    <div
      className="at-picker-overlay"
      data-testid="at-picker"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        maxHeight: '400px',
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'atPickerSlideUp 0.15s ease-out',
      }}
    >
      {/* Search input */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <input
          ref={searchInputRef}
          data-testid="at-picker-search"
          type="text"
          placeholder="🔍 搜索实体..."
          value={searchQuery}
          onChange={e => handleSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            padding: '4px 0',
            background: 'transparent',
          }}
          autoFocus
        />
      </div>

      <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
        {/* Home view: recents + type browse */}
        {view.kind === 'home' && (
          <>
            {/* Recents */}
            {recents.length > 0 && (
              <div data-testid="recents-section">
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#888', fontWeight: 600 }}>最近使用</div>
                {recents.map((item, idx) => (
                  <div
                    key={`${item.entityType}:${item.entityId}`}
                    data-testid={`recent-item-${item.entityId}`}
                    data-nav-item
                    onClick={() => handleSelect(item.entityType, item.entityId, item.displayName)}
                    style={{
                      padding: '6px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      ...focusStyle(idx),
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; setFocusedIndex(idx); }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{item.icon}</span>
                      <span style={{ fontSize: '14px' }}>{item.displayName}</span>
                    </div>
                    {item.breadcrumb && (
                      <div data-testid={`breadcrumb-${item.entityId}`} style={{ fontSize: '11px', color: '#999', paddingLeft: '22px' }}>
                        └ {item.breadcrumb.map((b, i) => (
                          <span key={i}>
                            {i > 0 && ' › '}
                            {b.icon} {b.displayName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Type browse */}
            {ctx.tree && (
              <div data-testid="type-browse-section">
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#888', fontWeight: 600, borderTop: '1px solid #f0f0f0' }}>按类型浏览</div>
                {ctx.tree.roots.map((rootType, idx) => {
                  const typeInfo = ctx.entityTypes.find(t => t.type === rootType);
                  if (!typeInfo) return null;
                  const navIdx = recents.length + idx;
                  return (
                    <div
                      key={rootType}
                      data-testid={`type-browse-${rootType}`}
                      data-nav-item
                      onClick={() => handleTypeBrowse(rootType)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        ...focusStyle(navIdx),
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; setFocusedIndex(navIdx); }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{typeInfo.icon}</span>
                        <span style={{ fontSize: '14px' }}>{typeInfo.displayName}</span>
                      </span>
                      <span style={{ color: '#ccc' }}>›</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Browse view */}
        {view.kind === 'browse' && (
          <div data-testid="browse-view">
            {/* Breadcrumb header */}
            <div
              data-testid="browse-breadcrumb"
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderBottom: '1px solid #f0f0f0',
                flexWrap: 'wrap',
              }}
            >
              <span
                data-testid="browse-back"
                onClick={handleBack}
                style={{ cursor: 'pointer', color: '#1a73e8' }}
              >
                ← {view.trail.length > 1 ? view.trail[view.trail.length - 2].displayName : '返回'}
              </span>
              {view.trail.length > 1 && (
                <>
                  <span>›</span>
                  <span>{view.trail[view.trail.length - 1].displayName}</span>
                </>
              )}
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
                {(() => {
                  const currentTypeInfo = ctx.entityTypes.find(t => t.type === view.entityType);
                  return currentTypeInfo ? `${currentTypeInfo.icon} ${currentTypeInfo.displayName}` : '';
                })()}
              </span>
            </div>

            {/* Browse items */}
            {browseItems.map((item, idx) => (
              <div
                key={`${item.entityType}:${item.entityId}`}
                data-testid={`browse-item-${item.entityId}`}
                data-nav-item
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  ...focusStyle(idx),
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; setFocusedIndex(idx); }}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <span>{ctx.entityTypes.find(t => t.type === item.entityType)?.icon}</span>
                  <span style={{ fontSize: '14px' }}>{item.displayName}</span>
                  {item.subtitle && <span style={{ fontSize: '12px', color: '#999' }}>{item.subtitle}</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {hasChildren(item.entityType) && item.hasChildren && (
                    <button
                      data-testid={`drill-${item.entityId}`}
                      onClick={(e) => { e.stopPropagation(); handleDrillDown(item); }}
                      style={{
                        background: 'none',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      ▶
                    </button>
                  )}
                  <button
                    data-testid={`select-${item.entityId}`}
                    onClick={(e) => { e.stopPropagation(); handleSelect(item.entityType, item.entityId, item.displayName); }}
                    style={{
                      background: '#1a73e8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 10px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    选择
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Search view */}
        {view.kind === 'search' && (
          <div data-testid="search-results">
            {searchResults.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>无结果</div>
            )}
            {searchResults.map((item, idx) => (
              <div
                key={`${item.entityType}:${item.entityId}`}
                data-testid={`search-item-${item.entityId}`}
                data-nav-item
                onClick={() => handleSelect(item.entityType, item.entityId, item.displayName)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  ...focusStyle(idx),
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; setFocusedIndex(idx); }}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{item.icon}</span>
                  <span style={{ fontSize: '14px' }}>{item.displayName}</span>
                </div>
                {item.breadcrumb && (
                  <div data-testid={`search-breadcrumb-${item.entityId}`} style={{ fontSize: '11px', color: '#999', paddingLeft: '22px' }}>
                    └ {item.breadcrumb.map((b, i) => (
                      <span key={i}>
                        {i > 0 && ' › '}
                        {b.icon} {b.displayName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes atPickerSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
