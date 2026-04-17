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

  // Multi-select staging state
  const [staging, setStaging] = useState<Array<{ id: string; title: string }>>([])
  const [flashId, setFlashId] = useState<string | null>(null)

  if (!clientRef.current || clientBaseUrlRef.current !== baseUrl) {
    clientRef.current = new ContextLayerClient(baseUrl)
    clientBaseUrlRef.current = baseUrl
  }

  const isReferenced = useCallback((id: string) => {
    return refs.some(r => r.entityType === 'recipe' && r.entityId === id)
  }, [refs])

  const isStaged = useCallback((id: string) => {
    return staging.some(s => s.id === id)
  }, [staging])

  const toggleStaging = useCallback((recipe: { id: string; title: string }) => {
    setStaging(prev => {
      const exists = prev.some(s => s.id === recipe.id)
      if (exists) return prev.filter(s => s.id !== recipe.id)
      return [...prev, recipe]
    })
  }, [])

  const removeFromStaging = useCallback((id: string) => {
    setStaging(prev => prev.filter(s => s.id !== id))
  }, [])

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

  // Focus input + reset state when picker opens
  useEffect(() => {
    if (pickerOpen) {
      setQuery('')
      setActiveIndex(0)
      setStaging([])
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

  // Commit all staged items (+ optional extra recipe) then close
  const commitStaging = useCallback(async (extraRecipe?: { id: string; title: string }) => {
    const toCommit = [...staging]
    if (extraRecipe && !toCommit.some(s => s.id === extraRecipe.id)) {
      toCommit.push(extraRecipe)
    }
    if (toCommit.length === 0) return

    const client = clientRef.current!
    const results = await Promise.allSettled(
      toCommit.map(async (recipe) => {
        try {
          const resolved = await client.resolve('recipe', recipe.id)
          return { recipe, resolved }
        } catch {
          return { recipe, resolved: null }
        }
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { recipe, resolved } = result.value
        addRef({
          entityType: 'recipe',
          entityId: recipe.id,
          displayName: recipe.title,
          icon: '🍳',
          ...(resolved ? { data: resolved.data, summary: resolved.displayName || recipe.title } : {}),
        })
      }
    }

    setStaging([])
    closePicker()
  }, [staging, addRef, closePicker])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (staging.length > 0) {
        commitStaging()
      } else {
        closePicker()
      }
      return
    }

    if (e.key === ' ') {
      e.preventDefault()
      if (selectableIndices.length === 0) return
      const realIdx = selectableIndices[activeIndex]
      if (realIdx != null && recipes[realIdx] && !isReferenced(recipes[realIdx].id)) {
        const recipe = recipes[realIdx]
        // Flash animation only when adding (not removing)
        if (!isStaged(recipe.id)) {
          setFlashId(recipe.id)
          setTimeout(() => setFlashId(null), 400)
        }
        toggleStaging(recipe)
      }
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
        if (staging.length > 0) {
          commitStaging(recipes[realIdx])
        } else {
          handleSelect(recipes[realIdx])
        }
      }
    }
  }, [closePicker, selectableIndices, activeIndex, recipes, handleSelect, staging, commitStaging, isReferenced, isStaged, toggleStaging])

  // Handle overlay click — commit staging if any, then close
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    if (staging.length > 0) {
      commitStaging()
    } else {
      closePicker()
    }
  }, [staging, commitStaging, closePicker])

  const activeDescendant = selectableIndices.length > 0 && selectableIndices[activeIndex] != null
    ? `recipe-item-${selectableIndices[activeIndex]}`
    : undefined

  return (
    <>
      {/* Picker dropdown */}
      {pickerOpen && (
        <div className="recipe-picker-overlay" onClick={handleOverlayClick}>
          <div className="recipe-picker-dropdown">
            <input
              ref={inputRef}
              className="recipe-picker-search"
              type="text"
              role="combobox"
              aria-expanded={true}
              aria-controls="recipe-picker-listbox"
              aria-activedescendant={activeDescendant}
              placeholder={staging.length > 0
                ? `已选 ${staging.length} 个 · Space继续选 ⏎确认`
                : '搜索食谱... ↑↓选择 Space添加 ⏎确认 Esc关闭'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {/* Staging area */}
            {staging.length > 0 && (
              <div className="recipe-picker-staging">
                <div className="recipe-picker-staging-pills">
                  {staging.map(s => (
                    <span key={s.id} className="recipe-picker-staging-pill">
                      <span>🍳</span>
                      <span>{s.title}</span>
                      <button className="recipe-picker-staging-pill-remove" onClick={() => removeFromStaging(s.id)}>×</button>
                    </span>
                  ))}
                </div>
                <div className="recipe-picker-staging-count">已选 {staging.length} 个</div>
              </div>
            )}
            <div className="recipe-picker-list" ref={listRef} id="recipe-picker-listbox" role="listbox">
              {loading && <div className="recipe-picker-empty">搜索中...</div>}
              {!loading && recipes.length === 0 && (
                <div className="recipe-picker-empty">未找到食谱</div>
              )}
              {!loading && recipes.map((r, i) => {
                const referenced = isReferenced(r.id)
                const staged = isStaged(r.id)
                const isActive = !referenced && selectableIndices[activeIndex] === i
                return (
                  <button
                    type="button"
                    key={r.id}
                    id={`recipe-item-${i}`}
                    role="option"
                    aria-selected={isActive}
                    className={`recipe-picker-item${referenced ? ' referenced' : ''}${staged ? ' staged' : ''}${isActive ? ' active' : ''}${flashId === r.id ? ' flash' : ''}`}
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
                    {staged && !referenced && <span className="recipe-picker-item-check staged-check">✓ 已选</span>}
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
