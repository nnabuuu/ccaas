/**
 * FilePreview Component
 *
 * Preview router that selects appropriate preview component based on file type.
 * Handles loading states and errors.
 */

import { FileTextPreview } from './FileTextPreview'
import { FileImagePreview } from './FileImagePreview'
import { useFilePreview } from '../hooks/useFilePreview'
import type { FileMetadata } from '../types'

export interface FilePreviewProps {
  file: FileMetadata | null
  maxBytes?: number
}

export function FilePreview({ file, maxBytes = 100 * 1024 }: FilePreviewProps) {
  const { preview, isLoading, error } = useFilePreview({
    fileId: file?.id || '',
    maxBytes,
    enabled: !!file,
  })

  // No file selected
  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <svg
            className="w-16 h-16 text-slate-300 dark:text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a file to preview
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading preview...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <svg
            className="w-12 h-12 text-red-400 dark:text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load preview
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error.message}
          </p>
        </div>
      </div>
    )
  }

  // No preview available
  if (!preview) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <svg
            className="w-12 h-12 text-slate-300 dark:text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Preview not available
          </p>
        </div>
      </div>
    )
  }

  // Route to appropriate preview component
  if (preview.encoding === 'base64' && file.mimeType?.startsWith('image/')) {
    return <FileImagePreview preview={preview} filename={file.filename} />
  }

  // Default to text preview
  return <FileTextPreview preview={preview} filename={file.filename} />
}
