import { ref, onMounted, type Ref } from 'vue'

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
  tree: Ref<WorkspaceFileTreeNode[]>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  refetch: () => Promise<void>
}

/**
 * Fetches the file tree for a session workspace.
 *
 * Calls `GET {serverUrl}/api/v1/sessions/{sessionId}/workspace`.
 * Set `enabled: false` to defer the initial fetch.
 *
 * @example
 * ```vue
 * <script setup>
 * const { tree, isLoading, error, refetch } = useWorkspaceTree({
 *   serverUrl: 'http://localhost:3001',
 *   sessionId: 'session-abc',
 * })
 * </script>
 * ```
 */
export function useWorkspaceTree(options: UseWorkspaceTreeOptions): UseWorkspaceTreeReturn {
  const { serverUrl, sessionId, enabled = true } = options

  const tree = ref<WorkspaceFileTreeNode[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const fetchTree = async () => {
    if (!enabled) return

    isLoading.value = true
    error.value = null

    try {
      const url = `${serverUrl}/api/v1/sessions/${sessionId}/workspace`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch workspace tree: ${response.statusText}`)
      }

      const data: { tree: WorkspaceFileTreeNode[] } = await response.json()
      tree.value = data.tree ?? []
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      tree.value = []
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    fetchTree()
  })

  return { tree, isLoading, error, refetch: fetchTree }
}
