import { useState } from 'react'
import { useFiles, FileUploadButton, type UseAgentConnectionReturn, type FileMetadata } from '@kedge-agentic/react-sdk'
import { DownloadSimple, Paperclip, File, MusicNote, FileText, FileCode, Presentation } from '@phosphor-icons/react'

interface FilesViewProps {
  connection: UseAgentConnectionReturn
  sessionId: string

  // Optional attachment functionality
  onAttachFile?: (file: FileMetadata) => Promise<{ success: boolean }>
  attachButtonLabel?: string
  attachButtonTitle?: string
}

/**
 * Get file type icon component
 */
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File

  if (mimeType.startsWith('audio/')) return MusicNote
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return Presentation
  if (mimeType === 'application/pdf') return FileText
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') return FileCode

  return File
}

/**
 * Get file type color
 */
function getFileColor(mimeType: string | null): string {
  if (!mimeType) return 'text-gray-600'

  if (mimeType.startsWith('audio/')) return 'text-purple-600'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'text-orange-600'
  if (mimeType === 'application/pdf') return 'text-red-600'
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') return 'text-blue-600'

  return 'text-gray-600'
}

/**
 * Format file size
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * FilesView Component
 *
 * Generic session file browser with optional attachment functionality.
 * Can be used standalone (file browsing only) or with attachment handler.
 */
export function FilesView({
  connection,
  sessionId,
  onAttachFile,
  attachButtonLabel,
  attachButtonTitle,
}: FilesViewProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null)
  const [attachingFileId, setAttachingFileId] = useState<string | null>(null)

  const files = useFiles({
    connection,
    sessionId,
    enabled: true,
  })

  const handleUpload = async (file: File) => {
    await files.uploadFile(file)
    setShowUpload(false)
  }

  const handleAttachFile = async (file: FileMetadata) => {
    if (!onAttachFile) return  // Guard: no-op if not provided

    setAttachingFileId(file.id)
    try {
      const result = await onAttachFile(file)
      if (result.success) {
        // Success feedback is handled by the parent component via toast
        // File attached successfully
      }
    } finally {
      setAttachingFileId(null)
    }
  }

  const handleFileClick = (file: FileMetadata) => {
    setSelectedFile(file)
    if (file.status === 'new') {
      files.markAsSynced(file.id)
    }
  }

  const handleDownload = (file: FileMetadata) => {
    // Download file using the file metadata
    const url = `/api/v1/files/${file.id}/download`
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">文件</h2>
          {files.hasNewFiles && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
              {files.newFilesCount} 新
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {files.hasNewFiles && (
            <button
              onClick={() => files.markAllSeen()}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              标记已读
            </button>
          )}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            {showUpload ? '取消' : '上传'}
          </button>
        </div>
      </div>

      {/* Upload Area */}
      {showUpload && (
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <FileUploadButton onUpload={handleUpload} />
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {files.isLoading ? (
          <div className="space-y-1 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-5 h-5 rounded bg-zinc-200" />
                <div className="flex-1 space-y-1.5">
                  <div className={`h-4 rounded bg-zinc-200 ${
                    i % 3 === 0 ? 'w-2/3' : i % 3 === 1 ? 'w-1/2' : 'w-3/5'
                  }`} />
                  <div className="h-3 w-16 rounded bg-zinc-200" />
                </div>
              </div>
            ))}
          </div>
        ) : files.error ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-center px-4 max-w-md">
              <svg
                className="w-12 h-12 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
              >
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-600">加载文件失败</p>
                <p className="text-xs text-gray-500 mt-2">{files.error.message}</p>
              </div>
              <button
                onClick={() => files.refetch()}
                className="mt-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        ) : files.files.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <svg
                className="w-12 h-12 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
              >
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-sm text-gray-500">暂无文件</p>
              <p className="text-xs text-gray-400">点击上传按钮添加课件、音频等资料</p>
            </div>
          </div>
        ) : (
          <div className="py-1">
            {files.files.map((file) => {
              const IconComponent = getFileIcon(file.mimeType)
              const iconColor = getFileColor(file.mimeType)
              const isAttaching = attachingFileId === file.id
              const isSelected = selectedFile?.id === file.id

              return (
                <div
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    <IconComponent size={20} weight="regular" className={iconColor} />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filename}
                      </p>
                      {file.status === 'new' && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded">
                          新
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatBytes(file.size)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Download Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(file)
                      }}
                      className="p-1.5 text-gray-600 hover:text-blue-600 rounded transition-colors"
                      title="下载"
                    >
                      <DownloadSimple size={16} weight="regular" />
                    </button>

                    {/* Attach Button - Only show if onAttachFile is provided */}
                    {onAttachFile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAttachFile(file)
                        }}
                        disabled={isAttaching}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={attachButtonTitle || "附加文件"}
                      >
                        <Paperclip size={14} weight="regular" />
                        {isAttaching ? '附加中...' : (attachButtonLabel || '附加')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default FilesView
