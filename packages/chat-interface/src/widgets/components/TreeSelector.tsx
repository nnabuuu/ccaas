import { useState } from 'react'
import type { WidgetComponentProps } from '@/types/widget'
import { cn } from '@/lib/utils'

interface TreeItem {
  id: string
  label: string
  children?: TreeItem[]
}

interface TreeSelectorProps {
  label: string
  multi_select?: boolean
  items?: TreeItem[]
}

export function TreeSelector({
  props,
  widgetState,
  onStateChange,
}: WidgetComponentProps<TreeSelectorProps>) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const selected = (widgetState.selected as string[]) ?? []
  const items = props.items ?? []

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelect = (id: string) => {
    const multi = props.multi_select !== false
    let next: string[]

    if (multi) {
      next = selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
    } else {
      next = selected.includes(id) ? [] : [id]
    }

    onStateChange('selected', next)
  }

  const renderNode = (item: TreeItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedNodes.has(item.id)
    const isLeaf = !hasChildren
    const isSelected = selected.includes(item.id)

    return (
      <div key={item.id} className="text-[13px]">
        <div
          className="flex items-center gap-[6px] px-1 py-[3px] rounded cursor-pointer hover:bg-ck-bg2"
          style={{ paddingLeft: depth * 20 + 4 }}
          onClick={() => hasChildren ? toggleExpand(item.id) : toggleSelect(item.id)}
        >
          {hasChildren && (
            <span
              className={cn(
                'w-[14px] h-[14px] flex items-center justify-center text-[11px] text-ck-t3 transition-transform shrink-0',
                isExpanded && 'rotate-90',
              )}
            >
              &#9654;
            </span>
          )}
          {isLeaf && (
            <span
              className={cn(
                'w-[14px] h-[14px] rounded-[3px] border shrink-0 flex items-center justify-center transition-all',
                isSelected
                  ? 'bg-ck-t1 border-ck-t1'
                  : 'border-ck-b1',
              )}
              onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
            >
              {isSelected && (
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3L3 5L7 1" stroke="var(--bg1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          )}
          <span className={isSelected ? 'font-medium text-ck-t1' : ''}>{item.label}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {item.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs text-ck-t2 mb-2">{props.label}</div>
      <div className="border border-ck-b1 rounded-ck-lg px-[14px] py-[10px] max-h-[240px] overflow-y-auto">
        {items.map(item => renderNode(item))}
        {items.length === 0 && (
          <div className="text-xs text-ck-t3 py-4 text-center">No items available</div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="text-xs text-ck-t3 mt-[6px]">
          Selected: {selected.length} item{selected.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
