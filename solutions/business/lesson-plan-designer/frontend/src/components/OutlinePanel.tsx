import React from 'react'
import { motion } from 'framer-motion'

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const listItem = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } },
}

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

      <motion.div className="py-2" variants={listContainer} initial="hidden" animate="show">
        {items.map((item) => {
          const isActive = activeSection === item.id

          return (
            <motion.div key={item.id} variants={listItem}>
              <button
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
            </motion.div>
          )
        })}
      </motion.div>
    </nav>
  )
}

export default OutlinePanel
