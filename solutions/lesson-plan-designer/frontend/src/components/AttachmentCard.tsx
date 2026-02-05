import type { LessonPlanAttachment } from '../types'

interface AttachmentCardProps {
  attachment: LessonPlanAttachment
  onRemove?: (id: string) => void
}

/**
 * Get icon for file type
 */
function getFileIcon(fileType: string): string {
  switch (fileType) {
    case 'audio':
      return '🎵'
    case 'ppt':
      return '📊'
    case 'pdf':
      return '📄'
    case 'script':
      return '📝'
    default:
      return '📎'
  }
}

/**
 * Get color scheme for file type
 */
function getFileTypeColor(fileType: string): {
  bg: string
  text: string
  border: string
} {
  switch (fileType) {
    case 'audio':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
    case 'ppt':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' }
    case 'pdf':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    case 'script':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
  }
}

/**
 * Format file size in human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format date in Chinese format
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get file type label in Chinese
 */
function getFileTypeLabel(fileType: string): string {
  switch (fileType) {
    case 'audio':
      return '音频'
    case 'ppt':
      return 'PPT'
    case 'pdf':
      return 'PDF'
    case 'script':
      return '讲稿'
    default:
      return '其他'
  }
}

/**
 * AttachmentCard component
 *
 * Displays a file attachment with metadata and action buttons.
 */
export function AttachmentCard({ attachment, onRemove }: AttachmentCardProps) {
  const icon = getFileIcon(attachment.fileType)
  const colors = getFileTypeColor(attachment.fileType)
  const formattedSize = formatBytes(attachment.size)
  const formattedDate = formatDate(attachment.uploadedAt)
  const fileTypeLabel = getFileTypeLabel(attachment.fileType)

  return (
    <div
      className={`flex items-start gap-3 p-4 border rounded-lg hover:shadow-md transition-all group ${colors.border} bg-white`}
    >
      {/* File icon */}
      <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg ${colors.bg}`}>
        <span className="text-2xl" role="img" aria-label={fileTypeLabel}>
          {icon}
        </span>
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        {/* File name */}
        <h4 className="font-medium text-gray-900 truncate">{attachment.fileName}</h4>

        {/* File metadata */}
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
            {fileTypeLabel}
          </span>
          <span>•</span>
          <span>{formattedSize}</span>
          <span>•</span>
          <span>{formattedDate}</span>
        </div>

        {/* Description */}
        {attachment.description && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            {attachment.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Download button */}
        <a
          href={attachment.downloadUrl}
          download={attachment.fileName}
          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5 text-sm font-medium"
          title="下载文件"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          下载
        </a>

        {/* Delete button (optional) */}
        {onRemove && (
          <button
            onClick={() => onRemove(attachment.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
            title="删除附件"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default AttachmentCard
