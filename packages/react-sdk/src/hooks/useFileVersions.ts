import { useState, useEffect, useCallback } from 'react'
import type { UseFileVersionsOptions, UseFileVersionsReturn, FileVersion } from '../types'

/**
 * Manages version history for a file.
 *
 * Features:
 * - Fetches version history
 * - Create version snapshots
 * - Rollback to previous versions
 * - Compare versions
 * - Download version content
 *
 * Usage:
 * ```tsx
 * const versions = useFileVersions({ fileId })
 *
 * // Create version
 * await versions.createVersion('Added new feature')
 *
 * // Rollback
 * await versions.rollbackToVersion('1.0.0')
 *
 * // Compare
 * const diff = await versions.compareVersions('1.0.0', '1.0.1')
 * ```
 */
export function useFileVersions(options: UseFileVersionsOptions): UseFileVersionsReturn {
  const { fileId, enabled = true } = options

  const [versions, setVersions] = useState<FileVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Determine server URL from window location
  const serverUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : ''

  // Fetch versions from API
  const fetchVersions = useCallback(async () => {
    if (!enabled || !fileId) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`${serverUrl}/api/v1/files/${fileId}/versions`)
      if (!response.ok) {
        throw new Error(`Failed to fetch versions: ${response.statusText}`)
      }

      const data = await response.json()

      const versionList: FileVersion[] = data.map((v: any) => ({
        id: v.id,
        fileId: v.fileId,
        version: v.version,
        contentHash: v.contentHash,
        size: v.size,
        mimeType: v.mimeType,
        changelog: v.changelog,
        uploadedBy: v.uploadedBy,
        createdAt: new Date(v.createdAt),
      }))

      setVersions(versionList)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, fileId, enabled])

  // Create version
  const createVersion = useCallback(async (changelog?: string): Promise<FileVersion> => {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bumpType: 'patch',
        changelog,
      }),
    })

    if (!response.ok) {
      throw new Error(`Create version failed: ${response.statusText}`)
    }

    const data = await response.json()

    const newVersion: FileVersion = {
      id: data.id,
      fileId: data.fileId,
      version: data.version,
      contentHash: data.contentHash,
      size: data.size,
      mimeType: data.mimeType,
      changelog: data.changelog,
      uploadedBy: data.uploadedBy,
      createdAt: new Date(data.createdAt),
    }

    // Add to local state
    setVersions(prev => [newVersion, ...prev])

    return newVersion
  }, [serverUrl, fileId])

  // Rollback to version
  const rollbackToVersion = useCallback(async (version: string): Promise<void> => {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetVersion: version,
      }),
    })

    if (!response.ok) {
      throw new Error(`Rollback failed: ${response.statusText}`)
    }

    // Refetch versions to get the new rollback version
    await fetchVersions()
  }, [serverUrl, fileId, fetchVersions])

  // Compare versions
  const compareVersions = useCallback(async (from: string, to: string) => {
    const response = await fetch(
      `${serverUrl}/api/v1/files/${fileId}/versions/compare?from=${from}&to=${to}`
    )

    if (!response.ok) {
      throw new Error(`Compare failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      from: {
        id: data.from.id,
        fileId: data.from.fileId,
        version: data.from.version,
        contentHash: data.from.contentHash,
        size: data.from.size,
        mimeType: data.from.mimeType,
        changelog: data.from.changelog,
        uploadedBy: data.from.uploadedBy,
        createdAt: new Date(data.from.createdAt),
      },
      to: {
        id: data.to.id,
        fileId: data.to.fileId,
        version: data.to.version,
        contentHash: data.to.contentHash,
        size: data.to.size,
        mimeType: data.to.mimeType,
        changelog: data.to.changelog,
        uploadedBy: data.to.uploadedBy,
        createdAt: new Date(data.to.createdAt),
      },
      sizeDiff: data.sizeDiff,
      hashChanged: data.hashChanged,
    }
  }, [serverUrl, fileId])

  // Download version
  const downloadVersion = useCallback(async (version: string): Promise<void> => {
    const response = await fetch(
      `${serverUrl}/api/v1/files/${fileId}/versions/${version}/download`
    )

    if (!response.ok) {
      throw new Error(`Download version failed: ${response.statusText}`)
    }

    const blob = await response.blob()

    // Get filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition')
    const filenameMatch = disposition?.match(/filename="(.+)"/)
    const filename = filenameMatch ? filenameMatch[1] : `file-${version}`

    // Create download link
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, [serverUrl, fileId])

  // Fetch versions on mount
  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  return {
    versions,
    isLoading,
    error,
    createVersion,
    rollbackToVersion,
    compareVersions,
    downloadVersion,
    refetch: fetchVersions,
  }
}
