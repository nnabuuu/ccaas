/**
 * FileListItem Component
 *
 * Individual file item with icon, name, size, timestamp, and status badge.
 * Follows minimalist VS Code file explorer aesthetic.
 */

import { formatFileSize, formatFileDate, getFileIcon } from '../utils/fileIcons'
import type { FileMetadata } from '../types'

export interface FileListItemProps {
  file: FileMetadata
  selected?: boolean
  onSelect?: (file: FileMetadata) => void
  onDownload?: (file: FileMetadata) => void
  onDelete?: (file: FileMetadata) => void
}

export function FileListItem({
  file,
  selected = false,
  onSelect,
  onDownload,
  onDelete,
}: FileListItemProps) {
  const { icon, color } = getFileIcon(file.mimeType)

  return (
    <div
      className={`
        group relative flex items-center gap-3 px-3 py-2
        border-l-2 transition-all duration-200
        cursor-pointer
        ${
          selected
            ? 'bg-slate-100 dark:bg-slate-800 border-l-blue-500'
            : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
      `}
      onClick={() => onSelect?.(file)}
    >
      {/* Status Badge - Pulsing red dot for new, yellow for modified */}
      {file.status === 'new' && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-red-500 rounded-full animate-ping opacity-75" />
          </div>
        </div>
      )}
      {file.status === 'modified' && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
        </div>
      )}

      {/* File Icon */}
      <div className={`flex-shrink-0 ${color}`}>
        {/* Render icon name - actual icon component should be provided by consumer */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Default file icon path */}
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {file.filename}
          </p>
          {file.uploadedBy === 'user' && (
            <span className="flex-shrink-0 text-xs text-slate-500 dark:text-slate-400">
              (you)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{formatFileSize(file.size)}</span>
          <span>·</span>
          <span>{formatFileDate(file.createdAt)}</span>
        </div>
      </div>

      {/* Actions (show on hover) */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {onDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDownload(file)
            }}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Download file"
          >
            <svg
              className="w-4 h-4 text-slate-600 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete ${file.filename}?`)) {
                onDelete(file)
              }
            }}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            aria-label="Delete file"
          >
            <svg
              className="w-4 h-4 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
