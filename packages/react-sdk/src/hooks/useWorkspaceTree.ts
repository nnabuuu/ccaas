import { useState, useEffect, useCallback } from 'react'

export interface WorkspaceFileTreeNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  size?: number
  mimeType?: string
  children?: WorkspaceFileTreeNode[]
}

export interface UseWorkspaceTreeOptions {
  serverUrl: string
  sessionId: string
  /** Set to false to skip fetching on mount (default: true) */
  enabled?: boolean
}

export interface UseWorkspaceTreeReturn {
  tree: WorkspaceFileTreeNode[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Fetches the file tree for a session workspace.
 *
 * Calls `GET {serverUrl}/api/v1/sessions/{sessionId}/workspace`.
 * Set `enabled: false` to defer the initial fetch.
 *
 * @example
 * ```tsx
 * const { tree, isLoading, error, refetch } = useWorkspaceTree({
 *   serverUrl: 'http://localhost:3001',
 *   sessionId: 'session-abc',
 * })
 *
 * if (isLoading) return <Spinner />
 * return <FileTree nodes={tree} />
 * ```
 */
export function useWorkspaceTree(options: UseWorkspaceTreeOptions): UseWorkspaceTreeReturn {
  const { serverUrl, sessionId, enabled = true } = options

  const [tree, setTree] = useState<WorkspaceFileTreeNode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchTree = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)

    try {
      const url = `${serverUrl}/api/v1/sessions/${sessionId}/workspace`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch workspace tree: ${response.statusText}`)
      }

      const data: { tree: WorkspaceFileTreeNode[] } = await response.json()
      setTree(data.tree ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setTree([])
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, sessionId, enabled])

  useEffect(() => {
    fetchTree()
  }, [fetchTree])

  return { tree, isLoading, error, refetch: fetchTree }
}
