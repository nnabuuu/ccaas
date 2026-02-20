import { useState, useCallback } from 'react'
import type { TextbookChapter } from '../types'

interface ChapterTreeProps {
  chapters: TextbookChapter[]
  selectedChapterId: number | null
  onSelect: (chapterId: number, chapterTitle: string) => void
  loading?: boolean
}

interface ChapterItemProps {
  chapter: TextbookChapter
  level: number
  selectedChapterId: number | null
  expandedIds: Set<number>
  onToggleExpand: (id: number) => void
  onSelect: (chapterId: number, chapterTitle: string) => void
}

function ChapterItem({
  chapter,
  level,
  selectedChapterId,
  expandedIds,
  onToggleExpand,
  onSelect,
}: ChapterItemProps) {
  const hasChildren = chapter.children && chapter.children.length > 0
  const isExpanded = expandedIds.has(chapter.id)
  const isSelected = selectedChapterId === chapter.id
  const isLeaf = !hasChildren

  const handleClick = () => {
    if (hasChildren) {
      onToggleExpand(chapter.id)
    } else {
      onSelect(chapter.id, chapter.title)
    }
  }

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer
          transition-colors duration-150
          ${isSelected ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'}
          ${level > 0 ? 'ml-' + (level * 4) : ''}
        `}
        style={{ marginLeft: level * 16 }}
        onClick={handleClick}
      >
        {/* Expand/collapse icon for non-leaf nodes */}
        {hasChildren ? (
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        ) : (
          <div className="w-4 h-4 flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary-500' : 'bg-gray-300'}`} />
          </div>
        )}

        {/* Chapter title */}
        <span className={`text-sm ${isLeaf ? 'font-normal' : 'font-medium'}`}>
          {chapter.title}
        </span>

        {/* Selection indicator for leaf nodes */}
        {isLeaf && isSelected && (
          <svg className="w-4 h-4 ml-auto text-primary-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {chapter.children!.map((child) => (
            <ChapterItem
              key={child.id}
              chapter={child}
              level={level + 1}
              selectedChapterId={selectedChapterId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChapterTree({
  chapters,
  selectedChapterId,
  onSelect,
  loading = false,
}: ChapterTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Expand all top-level chapters by default
  const expandAll = useCallback(() => {
    setExpandedIds(new Set(chapters.map((c) => c.id)))
  }, [chapters])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-sm text-gray-500">加载章节...</span>
      </div>
    )
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="w-12 h-12 mx-auto mb-2 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <p className="text-sm">请先选择学科、年级、出版社和册别</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 pb-2 border-b border-gray-200">
        <span className="text-xs text-gray-500">请选择具体课时</span>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            全部展开
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            全部收起
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="max-h-64 overflow-y-auto">
        {chapters.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            level={0}
            selectedChapterId={selectedChapterId}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
