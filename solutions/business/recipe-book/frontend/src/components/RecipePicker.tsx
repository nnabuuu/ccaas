import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useMentionContext } from '../lib/mention'
import { useRecipes } from '../hooks/useRecipes'
import { ContextLayerClient } from '@kedge-agentic/context-layer/client'

interface RecipePickerProps {
  baseUrl: string
  contextEntity?: { entityType: string; entityId: string; displayName: string; icon?: string }
  autoRef?: boolean
}

export function RecipePicker({ baseUrl, contextEntity, autoRef }: RecipePickerProps) {
  const { refs, addRef, removeRef, pickerOpen, closePicker } = useMentionContext()
  const [query, setQuery] = useState('')
  const { recipes, loading } = useRecipes(query || undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const autoRefAppliedRef = useRef<string | null>(null)
  const clientRef = useRef<ContextLayerClient | null>(null)
  const clientBaseUrlRef = useRef('')

  if (!clientRef.current || clientBaseUrlRef.current !== baseUrl) {
    clientRef.current = new ContextLayerClient(baseUrl)
    clientBaseUrlRef.current = baseUrl
  }

  const isReferenced = useCallback((id: string) => {
    return refs.some(r => r.entityType === 'recipe' && r.entityId === id)
  }, [refs])

  // Selectable items (not already referenced)
  const selectableIndices = useMemo(() => {
    if (loading) return []
    return recipes.reduce<number[]>((acc, r, i) => {
      if (!isReferenced(r.id)) acc.push(i)
      return acc
    }, [])
  }, [recipes, loading, isReferenced])

  // Auto-add contextEntity as a reference
  useEffect(() => {
    if (!autoRef || !contextEntity) return
    const key = `${contextEntity.entityType}:${contextEntity.entityId}`
    if (autoRefAppliedRef.current === key) return
    autoRefAppliedRef.current = key

    const client = clientRef.current!
    client.resolve(contextEntity.entityType, contextEntity.entityId).then(resolved => {
      addRef({
        entityType: contextEntity.entityType,
        entityId: contextEntity.entityId,
        displayName: contextEntity.displayName,
        icon: contextEntity.icon || '🍳',
        data: resolved.data,
        summary: resolved.displayName || contextEntity.displayName,
      })
    }).catch(() => {
      addRef({
        entityType: contextEntity.entityType,
        entityId: contextEntity.entityId,
        displayName: contextEntity.displayName,
        icon: contextEntity.icon || '🍳',
      })
    })
  }, [autoRef, contextEntity, addRef, baseUrl])

  // Focus input + reset active index when picker opens
  useEffect(() => {
    if (pickerOpen) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [pickerOpen])

  // Reset active index when recipes or selectableIndices change
  useEffect(() => { setActiveIndex(0) }, [selectableIndices])

  // Scroll active item into view
  useEffect(() => {
    if (!pickerOpen || selectableIndices.length === 0) return
    const realIdx = selectableIndices[activeIndex]
    if (realIdx == null) return
    const item = listRef.current?.children[realIdx] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, pickerOpen, selectableIndices])

  const handleSelect = useCallback(async (recipe: { id: string; title: string }) => {
    const client = clientRef.current!
    try {
      const resolved = await client.resolve('recipe', recipe.id)
      addRef({
        entityType: 'recipe',
        entityId: recipe.id,
        displayName: recipe.title,
        icon: '🍳',
        data: resolved.data,
        summary: resolved.displayName || recipe.title,
      })
    } catch {
      addRef({
        entityType: 'recipe',
        entityId: recipe.id,
        displayName: recipe.title,
        icon: '🍳',
      })
    }
    closePicker()
  }, [addRef, closePicker])

  // Keyboard navigation — handled on the search input so focus stays there
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePicker()
      return
    }
    if (selectableIndices.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % selectableIndices.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev - 1 + selectableIndices.length) % selectableIndices.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const realIdx = selectableIndices[activeIndex]
      if (realIdx != null && recipes[realIdx]) {
        handleSelect(recipes[realIdx])
      }
    }
  }, [closePicker, selectableIndices, activeIndex, recipes, handleSelect])

  const activeDescendant = selectableIndices.length > 0 && selectableIndices[activeIndex] != null
    ? `recipe-item-${selectableIndices[activeIndex]}`
    : undefined

  return (
    <>
      {/* Picker dropdown */}
      {pickerOpen && (
        <div className="recipe-picker-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePicker() }}>
          <div className="recipe-picker-dropdown">
            <input
              ref={inputRef}
              className="recipe-picker-search"
              type="text"
              role="combobox"
              aria-expanded={true}
              aria-controls="recipe-picker-listbox"
              aria-activedescendant={activeDescendant}
              placeholder="搜索食谱...  ↑↓ 选择  ⏎ 确认  Esc 关闭"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="recipe-picker-list" ref={listRef} id="recipe-picker-listbox" role="listbox">
              {loading && <div className="recipe-picker-empty">搜索中...</div>}
              {!loading && recipes.length === 0 && (
                <div className="recipe-picker-empty">未找到食谱</div>
              )}
              {!loading && recipes.map((r, i) => {
                const referenced = isReferenced(r.id)
                const isActive = !referenced && selectableIndices[activeIndex] === i
                return (
                  <button
                    type="button"
                    key={r.id}
                    id={`recipe-item-${i}`}
                    role="option"
                    aria-selected={isActive}
                    className={`recipe-picker-item${referenced ? ' referenced' : ''}${isActive ? ' active' : ''}`}
                    onClick={() => !referenced && handleSelect(r)}
                    onMouseEnter={() => {
                      if (!referenced) {
                        const si = selectableIndices.indexOf(i)
                        if (si !== -1) setActiveIndex(si)
                      }
                    }}
                    disabled={referenced}
                  >
                    <span className="recipe-picker-item-icon">🍳</span>
                    <span className="recipe-picker-item-name">{r.title}</span>
                    {referenced && <span className="recipe-picker-item-check">✓ 已引用</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reference pills */}
      {refs.length > 0 && (
        <div data-testid="mention-refs" className="recipe-picker-refs">
          {refs.map((ref, i) => (
            <span key={`${ref.entityType}:${ref.entityId}`} data-testid="ref-pill" className="recipe-picker-pill">
              <span>{ref.icon}</span>
              <span data-testid="ref-pill-name">{ref.displayName}</span>
              <button data-testid="ref-pill-remove" className="recipe-picker-pill-remove" onClick={() => removeRef(i)}>×</button>
            </span>
          ))}
          <div className="recipe-picker-refs-hint">
            {refs.length} 个食谱已引用 · 发送时注入上下文
          </div>
        </div>
      )}
    </>
  )
}
