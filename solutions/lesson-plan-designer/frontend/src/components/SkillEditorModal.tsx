import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Skill } from '../types'

interface SkillEditorModalProps {
  skill: Skill | null
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (skillId: string, content: string) => Promise<void>
}

/**
 * SkillEditorModal - Modal dialog for editing skill prompts.
 * Features:
 * - Two-panel layout: editor on left, markdown preview on right
 * - Unsaved changes indicator
 * - Keyboard shortcuts: Cmd/Ctrl+S to save, ESC to close
 */
export function SkillEditorModal({
  skill,
  open,
  saving,
  onClose,
  onSave,
}: SkillEditorModalProps) {
  const [editedContent, setEditedContent] = useState('')

  // Initialize content when skill changes
  useEffect(() => {
    if (skill) {
      setEditedContent(skill.content || '')
    }
  }, [skill])

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    if (!skill) return false
    return editedContent !== (skill.content || '')
  }, [skill, editedContent])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!skill || saving) return
    await onSave(skill.id, editedContent)
  }, [skill, editedContent, saving, onSave])

  // Handle close with confirmation
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm('有未保存的更改，确定要关闭吗？')
      if (!confirmed) return
    }
    onClose()
  }, [hasChanges, onClose])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // ESC to close
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleSave, handleClose])

  // Simple markdown preview (basic formatting)
  const renderPreview = useMemo(() => {
    if (!editedContent) {
      return <span className="text-gray-400 italic">无内容</span>
    }

    // Basic markdown-like rendering
    const lines = editedContent.split('\n')
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(3)}</h2>
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>
      }
      // List items
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="ml-4">{line.slice(2)}</li>
      }
      // Code blocks (simplified)
      if (line.startsWith('```')) {
        return <div key={i} className="text-xs text-gray-500">{line}</div>
      }
      // Empty lines
      if (!line.trim()) {
        return <br key={i} />
      }
      // Regular text
      return <p key={i} className="mb-1">{line}</p>
    })
  }, [editedContent])

  if (!open || !skill) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {skill.name}
              {hasChanges && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                  未保存
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{skill.description}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="关闭 (ESC)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Two Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Panel */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-600">编辑</span>
            </div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="输入技能提示词..."
              className="flex-1 p-4 text-sm font-mono resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Preview Panel */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-600">预览</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto text-sm prose prose-sm max-w-none">
              {renderPreview}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
              {skill.slug}
            </span>
            <span className="mx-2">|</span>
            <span className={skill.status === 'published' ? 'text-green-600' : 'text-yellow-600'}>
              {skill.status === 'published' ? '已发布' : '草稿'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+S 保存
            </span>
            <button
              onClick={handleClose}
              className="btn-secondary"
              disabled={saving}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="btn-primary"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SkillEditorModal
