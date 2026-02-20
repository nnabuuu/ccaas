import React from 'react'
import type { SyncField } from '../types'

interface FormSectionProps {
  title: string
  field?: SyncField
  isModified?: boolean
  canUndo?: boolean
  onUndo?: () => void
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function FormSection({
  title,
  isModified = false,
  canUndo = false,
  onUndo,
  collapsed,
  onToggle,
  children,
}: FormSectionProps) {
  return (
    <div className={`form-section ${isModified ? 'ring-2 ring-yellow-400' : ''}`}>
      <div
        className="form-section-header"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {/* Chevron Icon */}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${
              collapsed ? '' : 'rotate-90'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          <span className="font-medium text-gray-700">{title}</span>

          {/* AI Modified Badge */}
          {isModified && (
            <span className="ai-modified-badge">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
              AI已修改
            </span>
          )}
        </div>

        {/* Undo Button */}
        {canUndo && onUndo && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onUndo()
            }}
            className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
          >
            撤销
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="form-section-content">
          {children}
        </div>
      )}
    </div>
  )
}

export default FormSection
