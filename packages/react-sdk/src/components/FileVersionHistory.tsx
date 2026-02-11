/**
 * FileVersionHistory Component
 *
 * Displays version history timeline with actions (download, compare, rollback).
 * Shows version number, timestamp, uploader, and changelog.
 */

import { useState } from 'react'
import { useFileVersions } from '../hooks/useFileVersions'
import { formatFileSize, formatFileDate } from '../utils/fileIcons'
import type { FileMetadata, FileVersion } from '../types'

export interface FileVersionHistoryProps {
  file: FileMetadata
  onCompare?: (fromVersion: string, toVersion: string) => void
  className?: string
}

export function FileVersionHistory({
  file,
  onCompare,
  className = '',
}: FileVersionHistoryProps) {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [isRollingBack, setIsRollingBack] = useState(false)

  const versions = useFileVersions({
    fileId: file.id,
    enabled: true,
  })

  const handleVersionSelect = (version: string) => {
    if (selectedVersions.includes(version)) {
      setSelectedVersions(selectedVersions.filter((v) => v !== version))
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, version])
    } else {
      // Replace oldest selection
      setSelectedVersions([selectedVersions[1], version])
    }
  }

  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompare) {
      onCompare(selectedVersions[0], selectedVersions[1])
    }
  }

  const handleRollback = async (version: string) => {
    if (!confirm(`Rollback to version ${version}? This will create a new version.`)) {
      return
    }

    try {
      setIsRollingBack(true)
      await versions.rollbackToVersion(version)
      await versions.refetch()
    } catch (err) {
      console.error('Rollback failed:', err)
    } finally {
      setIsRollingBack(false)
    }
  }

  // Loading state
  if (versions.isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading versions...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (versions.error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
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
            Failed to load version history
          </p>
        </div>
      </div>
    )
  }

  // Empty state
  if (versions.versions.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <svg
            className="w-12 h-12 text-slate-300 dark:text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
          >
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No version history yet
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Version History
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {file.filename} · {versions.versions.length} versions
            </p>
          </div>
          {selectedVersions.length === 2 && (
            <button
              onClick={handleCompare}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Compare
            </button>
          )}
        </div>
        {selectedVersions.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {selectedVersions.length === 1
              ? 'Select one more version to compare'
              : `Comparing ${selectedVersions[0]} ↔ ${selectedVersions[1]}`}
          </p>
        )}
      </div>

      {/* Version Timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="space-y-4">
            {versions.versions.map((version, index) => {
              const isLatest = index === 0
              const isSelected = selectedVersions.includes(version.version)

              return (
                <div key={version.id} className="relative">
                  {/* Timeline connector */}
                  {index < versions.versions.length - 1 && (
                    <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                  )}

                  {/* Version Card */}
                  <div
                    className={`
                      relative flex gap-4 p-4 rounded-lg border-2 transition-all duration-200
                      ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }
                      ${onCompare ? 'cursor-pointer' : ''}
                    `}
                    onClick={() => onCompare && handleVersionSelect(version.version)}
                  >
                    {/* Timeline dot */}
                    <div
                      className={`
                        flex-shrink-0 w-6 h-6 rounded-full border-4 flex items-center justify-center
                        ${
                          isLatest
                            ? 'bg-blue-500 border-blue-100 dark:border-blue-900'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }
                      `}
                    >
                      {isLatest && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>

                    {/* Version Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Version {version.version}
                        </h4>
                        {isLatest && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded">
                            Latest
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>{formatFileDate(version.createdAt)}</span>
                        <span>·</span>
                        <span>{formatFileSize(version.size)}</span>
                        <span>·</span>
                        <span className="capitalize">{version.uploadedBy}</span>
                      </div>

                      {version.changelog && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          {version.changelog}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            versions.downloadVersion(version.version)
                          }}
                          className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                          Download
                        </button>
                        {!isLatest && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRollback(version.version)
                            }}
                            disabled={isRollingBack}
                            className="px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors disabled:opacity-50"
                          >
                            {isRollingBack ? 'Rolling back...' : 'Rollback'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
