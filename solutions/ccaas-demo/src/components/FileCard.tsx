/**
 * File Card Component
 *
 * Displays a file with download button.
 */

import type { FileInfo } from '../types'

interface FileCardProps {
  file: FileInfo
  onDownload: (file: FileInfo) => void
}

export function FileCard({ file, onDownload }: FileCardProps) {
  const getFileIcon = (type: string): string => {
    if (type.includes('markdown')) return '📄'
    if (type.includes('json')) return '📋'
    if (type.includes('docx')) return '📝'
    return '📎'
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mt-3 animate-slide-in">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{getFileIcon(file.type)}</span>
        <div>
          <p className="font-medium text-gray-900">{file.name}</p>
          <p className="text-sm text-gray-500">{file.size}</p>
        </div>
      </div>
      <button
        onClick={() => onDownload(file)}
        className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
      >
        Download
      </button>
    </div>
  )
}
