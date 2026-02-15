import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { FileTreeNode, WorkspaceTreeResponse } from '@/types/workspace'

interface UseWorkspaceFilesOptions {
  sessionId: string
  enabled?: boolean
}

interface UseWorkspaceFilesResult {
  tree: FileTreeNode[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch workspace file tree from session
 *
 * @param options - Session ID and enabled flag
 * @returns File tree, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { tree, loading, error, refetch } = useWorkspaceFiles({
 *   sessionId: 'sess_123',
 *   enabled: true
 * })
 * ```
 */
export function useWorkspaceFiles(options: UseWorkspaceFilesOptions): UseWorkspaceFilesResult {
  const { sessionId, enabled = true } = options
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchWorkspaceFiles = useCallback(async () => {
    if (!enabled || !sessionId) {
      setTree([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data } = await apiClient.get<WorkspaceTreeResponse>(`/admin/sessions/${sessionId}/workspace`)
      setTree(data.tree || [])
    } catch (err) {
      const error = err as Error
      setError(error)
      setTree([])
    } finally {
      setLoading(false)
    }
  }, [sessionId, enabled])

  useEffect(() => {
    fetchWorkspaceFiles()
  }, [fetchWorkspaceFiles])

  return {
    tree,
    loading,
    error,
    refetch: fetchWorkspaceFiles,
  }
}
