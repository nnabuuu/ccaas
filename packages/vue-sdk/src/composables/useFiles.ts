import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { UseFilesOptions, UseFilesReturn, FileMetadata } from '../types/files'

/**
 * Manages files for a session with real-time updates and badge state.
 *
 * Features:
 * - Fetches file list on mount
 * - Real-time updates via Socket.IO (file.created, file.modified events)
 * - Badge state (newFilesCount, hasNewFiles)
 * - CRUD operations (upload, download, delete, markAsSynced)
 *
 * @example
 * ```vue
 * <script setup>
 * const files = useFiles({ connection, sessionId: 'session-abc' })
 *
 * // Upload file
 * await files.uploadFile(file, 'images/')
 *
 * // Download file
 * await files.downloadFile(fileId)
 *
 * // Mark as synced (clear badge)
 * await files.markAsSynced(fileId)
 * </script>
 * ```
 */
export function useFiles(options: UseFilesOptions): UseFilesReturn {
  const { connection, sessionId, enabled = true } = options
  const { socket, serverUrl } = connection

  const files = ref<FileMetadata[]>([]) as Ref<FileMetadata[]>
  const isLoading = ref(true)
  const error = ref<Error | null>(null)
  const newFilesCount = ref(0)
  const hasNewFiles = computed(() => newFilesCount.value > 0)

  /**
   * Flatten tree structure returned by backend into a flat FileMetadata array.
   */
  function flattenFiles(nodes: any[]): FileMetadata[] {
    if (!Array.isArray(nodes)) {
      console.warn('flattenFiles received non-array:', nodes)
      return []
    }

    const result: FileMetadata[] = []
    for (const node of nodes) {
      if (node.type === 'file' && node.fileId) {
        result.push({
          id: node.fileId,
          filename: node.name,
          originalPath: node.path,
          mimeType: node.mimeType || null,
          size: node.size || 0,
          status: node.status || 'synced',
          uploadedBy: node.uploadedBy || 'agent',
          currentVersion: node.currentVersion || '1.0.0',
          lastVersionAt: node.lastVersionAt ? new Date(node.lastVersionAt) : null,
          createdAt: new Date(node.createdAt),
          updatedAt: new Date(node.updatedAt || node.createdAt),
        })
      }
      if (node.children && Array.isArray(node.children)) {
        result.push(...flattenFiles(node.children))
      }
    }
    return result
  }

  // Fetch files from API
  async function fetchFiles(): Promise<void> {
    if (!enabled) return

    try {
      isLoading.value = true
      error.value = null

      const response = await fetch(`${serverUrl}/api/v1/files/session/${sessionId}/tree`)
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`)
      }

      const data = await response.json()

      // Backend returns { tree: FileTreeNode[] }, not direct array
      const treeData = data?.tree || data || []
      const fileList = flattenFiles(Array.isArray(treeData) ? treeData : [])
      files.value = fileList

      // Update new files count
      const newCount = fileList.filter(f => f.status === 'new').length
      newFilesCount.value = newCount
    } catch (err) {
      error.value = err as Error
    } finally {
      isLoading.value = false
    }
  }

  // Upload file
  async function uploadFile(file: File, targetPath?: string): Promise<FileMetadata> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('sessionId', sessionId)
    if (targetPath) {
      formData.append('targetPath', targetPath)
    }

    const response = await fetch(`${serverUrl}/api/v1/files/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const data = await response.json()

    const metadata: FileMetadata = {
      id: data.id,
      filename: data.filename,
      originalPath: data.originalPath,
      mimeType: data.mimeType,
      size: data.size,
      status: data.status,
      uploadedBy: data.uploadedBy,
      currentVersion: data.currentVersion || '1.0.0',
      lastVersionAt: data.lastVersionAt ? new Date(data.lastVersionAt) : null,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt || data.createdAt),
    }

    // Add to local state optimistically
    files.value = [...files.value, metadata]
    newFilesCount.value += 1

    return metadata
  }

  // Download file
  async function downloadFile(fileId: string): Promise<void> {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}/download`)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`)
    }

    const blob = await response.blob()
    const file = files.value.find(f => f.id === fileId)
    const filename = file?.filename || 'download'

    // Create download link
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    // Mark as synced after download
    await markAsSynced(fileId)
  }

  // Delete file
  async function deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`)
    }

    // Check if the deleted file was new before removing
    const deletedFile = files.value.find(f => f.id === fileId)
    files.value = files.value.filter(f => f.id !== fileId)
    if (deletedFile?.status === 'new') {
      newFilesCount.value = Math.max(0, newFilesCount.value - 1)
    }
  }

  // Mark file as synced
  async function markAsSynced(fileId: string): Promise<void> {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}/sync`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Mark synced failed: ${response.statusText}`)
    }

    // Update local state
    files.value = files.value.map(f =>
      f.id === fileId ? { ...f, status: 'synced' as const } : f
    )
    newFilesCount.value = Math.max(0, newFilesCount.value - 1)
  }

  // Mark all files as seen (clear badge)
  async function markAllSeen(): Promise<void> {
    const response = await fetch(`${serverUrl}/api/v1/files/session/${sessionId}/mark-seen`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Mark all seen failed: ${response.statusText}`)
    }

    // Update local state
    files.value = files.value.map(f => ({ ...f, status: 'synced' as const }))
    newFilesCount.value = 0
  }

  // Fetch files on mount
  onMounted(() => {
    fetchFiles()
  })

  // Real-time updates via Socket.IO
  let cleanupSocketListeners: (() => void) | null = null

  function setupSocketListeners() {
    // Clean up any previous listeners
    if (cleanupSocketListeners) {
      cleanupSocketListeners()
      cleanupSocketListeners = null
    }

    const socketInstance = socket.value
    if (!socketInstance || !enabled) return

    const handleFileCreated = (data: any) => {
      if (data.sessionId !== sessionId) return
      fetchFiles()
    }

    const handleFileModified = (data: any) => {
      if (data.sessionId !== sessionId) return
      fetchFiles()
    }

    socketInstance.on('file.created', handleFileCreated)
    socketInstance.on('file.modified', handleFileModified)

    cleanupSocketListeners = () => {
      socketInstance.off('file.created', handleFileCreated)
      socketInstance.off('file.modified', handleFileModified)
    }
  }

  // Watch for socket changes
  watch(socket, () => {
    setupSocketListeners()
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    if (cleanupSocketListeners) {
      cleanupSocketListeners()
      cleanupSocketListeners = null
    }
  })

  return {
    files,
    isLoading,
    error,
    newFilesCount,
    hasNewFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    markAsSynced,
    markAllSeen,
    refetch: fetchFiles,
  }
}
