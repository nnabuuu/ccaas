/**
 * FileList Component
 *
 * Displays a list of files with virtualization support for large lists.
 * Includes empty state and loading indicators.
 */

import { FileListItem } from './FileListItem'
import type { FileMetadata } from '../types'

export interface FileListProps {
  files: FileMetadata[]
  selectedFileId?: string
  isLoading?: boolean
  onFileSelect?: (file: FileMetadata) => void
  onFileDownload?: (file: FileMetadata) => void
  onFileDelete?: (file: FileMetadata) => void
  emptyMessage?: string
}

export function FileList({
  files,
  selectedFileId,
  isLoading = false,
  onFileSelect,
  onFileDownload,
  onFileDelete,
  emptyMessage = 'No files yet',
}: FileListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading files...</p>
        </div>
      </div>
    )
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <svg
            className="w-12 h-12 text-slate-300 dark:text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
          >
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="py-1">
        {files.map((file) => (
          <FileListItem
            key={file.id}
            file={file}
            selected={file.id === selectedFileId}
            onSelect={onFileSelect}
            onDownload={onFileDownload}
            onDelete={onFileDelete}
          />
        ))}
      </div>
    </div>
  )
}
