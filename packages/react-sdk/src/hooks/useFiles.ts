import { useState, useEffect, useCallback, useRef } from 'react'
import type { UseFilesOptions, UseFilesReturn, FileMetadata } from '../types'

/**
 * Manages files for a session with real-time updates and badge state.
 *
 * Features:
 * - Fetches file list on mount
 * - Real-time updates via Socket.io (file.created, file.modified events)
 * - Badge state (newFilesCount, hasNewFiles)
 * - CRUD operations (upload, download, delete, markAsSynced)
 *
 * Usage:
 * ```tsx
 * const files = useFiles({ connection, sessionId })
 *
 * // Upload file
 * await files.uploadFile(file, 'images/')
 *
 * // Download file
 * await files.downloadFile(fileId)
 *
 * // Mark as synced (clear badge)
 * await files.markAsSynced(fileId)
 * ```
 */
export function useFiles(options: UseFilesOptions): UseFilesReturn {
  const { connection, sessionId, enabled = true } = options
  const { socket, serverUrl } = connection

  const [files, setFiles] = useState<FileMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [newFilesCount, setNewFilesCount] = useState(0)

  // Fetch files from API
  const fetchFiles = useCallback(async () => {
    if (!enabled) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`${serverUrl}/api/v1/files/session/${sessionId}/tree`)
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`)
      }

      const data = await response.json()

      // Flatten tree structure to get all files
      const flattenFiles = (nodes: any[]): FileMetadata[] => {
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

      // Backend returns { tree: FileTreeNode[] }, not direct array
      // Ensure we have an array to flatten
      const treeData = data?.tree || data || []
      const fileList = flattenFiles(Array.isArray(treeData) ? treeData : [])
      setFiles(fileList)

      // Update new files count
      const newCount = fileList.filter(f => f.status === 'new').length
      setNewFilesCount(newCount)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, sessionId, enabled])

  // Upload file
  const uploadFile = useCallback(async (file: File, targetPath?: string): Promise<FileMetadata> => {
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
    setFiles(prev => [...prev, metadata])
    setNewFilesCount(prev => prev + 1)

    return metadata
  }, [serverUrl, sessionId])

  // Download file
  const downloadFile = useCallback(async (fileId: string): Promise<void> => {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}/download`)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`)
    }

    const blob = await response.blob()
    const file = files.find(f => f.id === fileId)
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
  }, [serverUrl, files])

  // Delete file
  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`)
    }

    // Remove from local state
    setFiles(prev => prev.filter(f => f.id !== fileId))
    setNewFilesCount(prev => {
      const file = files.find(f => f.id === fileId)
      return file?.status === 'new' ? prev - 1 : prev
    })
  }, [serverUrl, files])

  // Mark file as synced
  const markAsSynced = useCallback(async (fileId: string): Promise<void> => {
    const response = await fetch(`${serverUrl}/api/v1/files/${fileId}/sync`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Mark synced failed: ${response.statusText}`)
    }

    // Update local state
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, status: 'synced' as const } : f
    ))
    setNewFilesCount(prev => Math.max(0, prev - 1))
  }, [serverUrl])

  // Mark all files as seen (clear badge)
  const markAllSeen = useCallback(async (): Promise<void> => {
    const response = await fetch(`${serverUrl}/api/v1/files/session/${sessionId}/mark-seen`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Mark all seen failed: ${response.statusText}`)
    }

    // Update local state
    setFiles(prev => prev.map(f => ({ ...f, status: 'synced' as const })))
    setNewFilesCount(0)
  }, [serverUrl, sessionId])

  // Fetch files on mount
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // Real-time updates via Socket.io
  useEffect(() => {
    if (!socket || !enabled) return

    const handleFileCreated = (data: any) => {
      if (data.sessionId !== sessionId) return

      // Refetch to get updated file list
      fetchFiles()
    }

    const handleFileModified = (data: any) => {
      if (data.sessionId !== sessionId) return

      // Refetch to get updated file list
      fetchFiles()
    }

    socket.on('file.created', handleFileCreated)
    socket.on('file.modified', handleFileModified)

    return () => {
      socket.off('file.created', handleFileCreated)
      socket.off('file.modified', handleFileModified)
    }
  }, [socket, sessionId, enabled, fetchFiles])

  return {
    files,
    isLoading,
    error,
    newFilesCount,
    hasNewFiles: newFilesCount > 0,
    uploadFile,
    downloadFile,
    deleteFile,
    markAsSynced,
    markAllSeen,
    refetch: fetchFiles,
  }
}
