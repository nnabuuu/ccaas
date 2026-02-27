import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'
import type { UseFileVersionsOptions, UseFileVersionsReturn, FileVersion } from '../types/files'

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
 * @example
 * ```vue
 * <script setup>
 * const versions = useFileVersions({ connection, fileId: 'file-abc' })
 *
 * // Create version
 * await versions.createVersion('Added new feature')
 *
 * // Rollback
 * await versions.rollbackToVersion('1.0.0')
 *
 * // Compare
 * const diff = await versions.compareVersions('1.0.0', '1.0.1')
 * </script>
 * ```
 */
export function useFileVersions(options: UseFileVersionsOptions): UseFileVersionsReturn {
  const { connection, fileId, enabled = true } = options

  const versions = ref<FileVersion[]>([]) as Ref<FileVersion[]>
  const isLoading = ref(true)
  const error = ref<Error | null>(null)

  // Use explicit serverUrl from connection
  const serverUrl = connection.serverUrl || ''

  // Fetch versions from API
  async function fetchVersions(): Promise<void> {
    if (!enabled || !fileId) return

    try {
      isLoading.value = true
      error.value = null

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

      // Sort by createdAt descending (newest first)
      versionList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      versions.value = versionList
    } catch (err) {
      error.value = err as Error
    } finally {
      isLoading.value = false
    }
  }

  // Create version
  async function createVersion(changelog?: string): Promise<FileVersion> {
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

    // Add to local state (newest first)
    versions.value = [newVersion, ...versions.value]

    return newVersion
  }

  // Rollback to version
  async function rollbackToVersion(version: string): Promise<void> {
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
  }

  // Compare versions
  async function compareVersions(from: string, to: string): Promise<{
    from: FileVersion
    to: FileVersion
    sizeDiff: number
    hashChanged: boolean
  }> {
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
  }

  // Download version
  async function downloadVersion(version: string): Promise<void> {
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
  }

  // Fetch versions on mount
  onMounted(() => {
    fetchVersions()
  })

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
