/**
 * FileTextPreview Component
 *
 * Displays text/code file preview with syntax highlighting.
 * Uses simple code formatting with language detection.
 */

import type { FilePreviewData } from '../types'

export interface FileTextPreviewProps {
  preview: FilePreviewData
  filename: string
}

export function FileTextPreview({ preview, filename }: FileTextPreviewProps) {
  // Detect language from filename extension
  const extension = filename.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    css: 'css',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sh: 'bash',
  }
  const language = extension ? languageMap[extension] || 'text' : 'text'

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {filename}
          </span>
          {language !== 'text' && (
            <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
              {language}
            </span>
          )}
        </div>
        {preview.truncated && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Truncated
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm font-mono leading-relaxed text-slate-800 dark:text-slate-200">
          <code>{preview.content}</code>
        </pre>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {preview.content.split('\n').length} lines
          </span>
          <span>
            {preview.size} bytes
          </span>
          {preview.truncated && (
            <span className="text-amber-600 dark:text-amber-400">
              Preview limited to first 100KB
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
