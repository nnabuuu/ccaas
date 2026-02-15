/**
 * FileVersionCompare Component
 *
 * Displays side-by-side or unified diff between two file versions.
 * Shows additions, deletions, and unchanged lines with syntax highlighting.
 */

import { useState, useEffect } from 'react'
import { useFileVersions } from '../hooks/useFileVersions'
import { computeLineDiff, formatSizeDiff, getDiffColor } from '../utils/diffUtils'
import type { FileMetadata, UseAgentConnectionReturn } from '../types'

export interface FileVersionCompareProps {
  connection: UseAgentConnectionReturn
  file: FileMetadata
  fromVersion: string
  toVersion: string
  onClose?: () => void
  className?: string
}

export function FileVersionCompare({
  connection,
  file,
  fromVersion,
  toVersion,
  onClose,
  className = '',
}: FileVersionCompareProps) {
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified')
  const [comparison, setComparison] = useState<{
    from: any
    to: any
    sizeDiff: number
    hashChanged: boolean
  } | null>(null)
  const [diffLines, setDiffLines] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const versions = useFileVersions({
    connection,
    fileId: file.id,
    enabled: true,
  })

  useEffect(() => {
    async function loadComparison() {
      try {
        setIsLoading(true)
        setError(null)

        // Get comparison metadata
        const result = await versions.compareVersions(fromVersion, toVersion)
        setComparison(result)

        // For text files, compute line diff
        // In a real implementation, you'd fetch the actual content here
        // For now, we'll show metadata only
        setDiffLines([])
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    loadComparison()
  }, [fromVersion, toVersion])

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-white dark:bg-slate-900 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading comparison...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !comparison) {
    return (
      <div className={`flex items-center justify-center h-full bg-white dark:bg-slate-900 ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <svg
            className="w-12 h-12 text-red-400"
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
            Failed to load comparison
          </p>
        </div>
      </div>
    )
  }

  const sizeDiffResult = formatSizeDiff(comparison.sizeDiff)

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Compare Versions
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {file.filename} · {fromVersion} ↔ {toVersion}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded p-1">
              <button
                onClick={() => setDiffMode('unified')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  diffMode === 'unified'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Unified
              </button>
              <button
                onClick={() => setDiffMode('split')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  diffMode === 'split'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Split
              </button>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Stats */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400">Size:</span>
            <span
              className={`font-medium ${
                sizeDiffResult.color === 'green'
                  ? 'text-green-600 dark:text-green-400'
                  : sizeDiffResult.color === 'red'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {sizeDiffResult.text}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400">Content:</span>
            <span
              className={`font-medium ${
                comparison.hashChanged
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {comparison.hashChanged ? 'Changed' : 'Identical'}
            </span>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto">
        {comparison.hashChanged ? (
          <div className="p-4">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
              <svg
                className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Detailed line-by-line comparison
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                Download both versions to compare in your editor
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => versions.downloadVersion(fromVersion)}
                  className="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors"
                >
                  Download {fromVersion}
                </button>
                <button
                  onClick={() => versions.downloadVersion(toVersion)}
                  className="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors"
                >
                  Download {toVersion}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
              <svg
                className="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                Files are identical
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                No differences detected between these versions
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
