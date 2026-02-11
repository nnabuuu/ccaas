/**
 * FilePanel Component
 *
 * Main file browser container with 2-column layout:
 * - Left: File list with upload button and badge
 * - Right: File preview area
 *
 * Responsive: stacks vertically on mobile
 */

import { useState } from 'react'
import { FileList } from './FileList'
import { FilePreview } from './FilePreview'
import { FileUploadButton } from './FileUploadButton'
import { useFiles } from '../hooks/useFiles'
import type { UseAgentConnectionReturn, FileMetadata } from '../types'

export interface FilePanelProps {
  connection: UseAgentConnectionReturn
  sessionId: string
  className?: string
  renderUploadButton?: (props: {
    onUpload: (file: File) => Promise<void>
  }) => React.ReactNode
}

export function FilePanel({
  connection,
  sessionId,
  className = '',
  renderUploadButton,
}: FilePanelProps) {
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const files = useFiles({
    connection,
    sessionId,
    enabled: true,
  })

  const handleUpload = async (file: File) => {
    await files.uploadFile(file)
    setShowUpload(false)
  }

  const handleFileSelect = (file: FileMetadata) => {
    setSelectedFile(file)
    if (file.status === 'new') {
      files.markAsSynced(file.id)
    }
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Files
          </h2>
          {files.hasNewFiles && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
              {files.newFilesCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {files.hasNewFiles && (
            <button
              onClick={() => files.markAllSeen()}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Mark all seen
            </button>
          )}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            {showUpload ? 'Cancel' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Upload Area (collapsible) */}
      {showUpload && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {renderUploadButton ? (
            renderUploadButton({ onUpload: handleUpload })
          ) : (
            <FileUploadButton onUpload={handleUpload} />
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* File List (Left Panel) */}
        <div className="w-full md:w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-hidden">
          <FileList
            files={files.files}
            selectedFileId={selectedFile?.id}
            isLoading={files.isLoading}
            onFileSelect={handleFileSelect}
            onFileDownload={(file) => files.downloadFile(file.id)}
            onFileDelete={(file) => files.deleteFile(file.id)}
            emptyMessage="No files yet. Upload a file to get started."
          />
        </div>

        {/* Preview Area (Right Panel) */}
        <div className="flex-1 overflow-hidden">
          <FilePreview file={selectedFile} />
        </div>
      </div>

      {/* Error Display */}
      {files.error && (
        <div className="absolute bottom-4 right-4 max-w-md p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {files.error.message}
              </p>
            </div>
            <button
              onClick={() => files.refetch()}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
