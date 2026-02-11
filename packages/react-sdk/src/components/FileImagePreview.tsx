/**
 * FileImagePreview Component
 *
 * Displays image file preview with zoom and metadata.
 */

import { useState } from 'react'
import type { FilePreviewData } from '../types'

export interface FileImagePreviewProps {
  preview: FilePreviewData
  filename: string
}

export function FileImagePreview({ preview, filename }: FileImagePreviewProps) {
  const [zoom, setZoom] = useState(false)
  const imageSrc = `data:${preview.mimeType};base64,${preview.content}`

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {filename}
          </span>
        </div>
        <button
          onClick={() => setZoom(!zoom)}
          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors"
        >
          {zoom ? 'Fit' : 'Zoom'}
        </button>
      </div>

      {/* Image Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <img
          src={imageSrc}
          alt={filename}
          className={`
            transition-all duration-200
            ${zoom ? 'max-w-none' : 'max-w-full max-h-full object-contain'}
            ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}
          `}
          onClick={() => setZoom(!zoom)}
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>{preview.mimeType}</span>
          <span>{(preview.size / 1024).toFixed(1)} KB</span>
          {preview.truncated && (
            <span className="text-amber-600 dark:text-amber-400">
              Preview may be incomplete
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
