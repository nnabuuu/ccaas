import { ref, watch, type Ref } from 'vue'

export interface FileContentData {
  content: string | null
  mimeType: string
  size: number
  filename: string
  isBinary: boolean
}

export interface UseFileContentOptions {
  serverUrl: string
  sessionId: string
  /** File path relative to workspace root. Pass null to skip fetching. */
  filePath: Ref<string | null> | string | null
}

export interface UseFileContentReturn {
  content: Ref<string | null>
  mimeType: Ref<string>
  size: Ref<number>
  filename: Ref<string>
  isBinary: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
}

/**
 * Fetches file content from a session workspace for inline display.
 *
 * Calls `GET {serverUrl}/api/v1/sessions/{sessionId}/workspace/file?path={filePath}`.
 * Pass `filePath: null` (or a ref containing null) to skip the request.
 * Re-fetches automatically when `filePath` changes.
 *
 * @example
 * ```vue
 * <script setup>
 * const selectedFile = ref(null)
 * const { content, isBinary, isLoading, error } = useFileContent({
 *   serverUrl: 'http://localhost:3001',
 *   sessionId: 'session-abc',
 *   filePath: selectedFile,
 * })
 * </script>
 * ```
 */
export function useFileContent(options: UseFileContentOptions): UseFileContentReturn {
  const { serverUrl, sessionId, filePath } = options

  const content = ref<string | null>(null)
  const mimeType = ref<string>('')
  const size = ref<number>(0)
  const filename = ref<string>('')
  const isBinary = ref<boolean>(false)
  const isLoading = ref<boolean>(false)
  const error = ref<Error | null>(null)

  const fetchContent = async (path: string | null) => {
    if (path === null) {
      content.value = null
      mimeType.value = ''
      size.value = 0
      filename.value = ''
      isBinary.value = false
      error.value = null
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const url = `${serverUrl}/api/v1/sessions/${sessionId}/workspace/file?path=${encodeURIComponent(path)}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`)
      }

      const data: FileContentData = await response.json()
      content.value = data.content
      mimeType.value = data.mimeType
      size.value = data.size
      filename.value = data.filename
      isBinary.value = data.isBinary
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      content.value = null
    } finally {
      isLoading.value = false
    }
  }

  // Support both plain string/null and Ref<string | null>
  if (filePath && typeof filePath === 'object' && 'value' in filePath) {
    watch(filePath, (path) => fetchContent(path), { immediate: true })
  } else {
    fetchContent(filePath as string | null)
  }

  return { content, mimeType, size, filename, isBinary, isLoading, error }
}
