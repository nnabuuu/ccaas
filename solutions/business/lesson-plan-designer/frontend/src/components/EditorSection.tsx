import React from 'react'

export interface EditorSectionProps {
  /**
   * Unique identifier for the section (used for scroll targeting)
   */
  id: string

  /**
   * Section title displayed in the header
   */
  title: string

  /**
   * Section content
   */
  children: React.ReactNode

  /**
   * Whether the section is currently being edited
   */
  isEditing: boolean

  /**
   * Whether the section is currently being saved
   */
  isSaving: boolean

  /**
   * Whether the section has been modified by AI
   */
  isModified?: boolean

  /**
   * Whether undo is available for this section
   */
  canUndo?: boolean

  /**
   * Callback when edit button is clicked
   */
  onStartEdit: () => void

  /**
   * Callback when save button is clicked
   */
  onSave: () => void

  /**
   * Callback when cancel button is clicked
   */
  onCancel: () => void

  /**
   * Callback when undo button is clicked
   */
  onUndo?: () => void

  /**
   * Callback when AI assist button is clicked
   */
  onAiAssist?: () => void
}

/**
 * EditorSection - A section wrapper component with per-section edit controls.
 * Displays edit/save/cancel buttons and highlights the section when editing.
 */
export function EditorSection({
  id,
  title,
  children,
  isEditing,
  isSaving,
  isModified = false,
  canUndo = false,
  onStartEdit,
  onSave,
  onCancel,
  onUndo,
  onAiAssist,
}: EditorSectionProps) {
  return (
    <section
      id={id}
      className={`
        bg-white rounded-lg shadow-sm overflow-hidden transition-all
        ${isEditing ? 'border-l-4 border-primary-500 ring-2 ring-primary-100' : 'border border-gray-200'}
      `}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium text-gray-900">{title}</h3>

          {/* AI Modified Badge */}
          {isModified && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
              AI已修改
            </span>
          )}

          {/* Undo Button */}
          {canUndo && onUndo && (
            <button
              onClick={onUndo}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              撤销
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* AI Assist Button */}
          {onAiAssist && (
            <button
              onClick={onAiAssist}
              title="AI 辅助"
              className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}

          {isEditing ? (
            <>
              {/* Save Button */}
              <button
                onClick={onSave}
                disabled={isSaving}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </button>

              {/* Cancel Button */}
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
            </>
          ) : (
            /* Edit Button */
            <button
              onClick={onStartEdit}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              编辑
            </button>
          )}
        </div>
      </div>

      {/* Section Content */}
      <div className="p-4">
        {children}
      </div>
    </section>
  )
}

export default EditorSection
