import { useState, useRef, useEffect } from 'react'
import { FolderOpen, FileText, X } from 'lucide-react'
import type { ProjectFile } from '../../types'

interface FileBrowserProps {
  files: ProjectFile[]
}

export default function FileBrowser({ files }: FileBrowserProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
      >
        <FolderOpen size={15} />
        Files
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">Project Files</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {files.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">No files yet</div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <FileText size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate">{file.path}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
