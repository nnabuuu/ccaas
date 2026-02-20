import React from 'react'

export interface OutlineItem {
  id: string
  label: string
}

export interface OutlinePanelProps {
  items: OutlineItem[]
  activeSection: string
  onSelect: (sectionId: string) => void
  title?: string
}

/**
 * OutlinePanel - A sticky sidebar navigation component
 * that displays section links and highlights the active section.
 */
export function OutlinePanel({
  items,
  activeSection,
  onSelect,
  title,
}: OutlinePanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent, sectionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(sectionId)
    }
  }

  return (
    <nav className="sticky top-0 h-full w-full bg-white border-r border-gray-200 overflow-y-auto">
      {title && (
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        </div>
      )}

      <div className="py-2">
        {items.map((item) => {
          const isActive = activeSection === item.id

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              className={`
                w-full text-left px-4 py-2 text-sm transition-colors
                ${isActive
                  ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-500 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent'
                }
              `}
              aria-current={isActive ? 'true' : undefined}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default OutlinePanel
