import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

interface FileContentResult {
  content: string | null
  mimeType: string
  size: number
  filename: string
  isBinary: boolean
}

interface UseFileContentOptions {
  sessionId: string
}

interface UseFileContentResult {
  loading: boolean
  error: Error | null
  data: FileContentResult | null
  fetchContent: (filePath: string) => Promise<void>
  clear: () => void
}

/**
 * Hook for fetching file content from session workspace for inline viewing.
 *
 * Uses GET /admin/sessions/{id}/workspace/file?path=<encoded> endpoint.
 * Returns text content for displayable files, or isBinary=true for binary/large files.
 */
export function useFileContent(options: UseFileContentOptions): UseFileContentResult {
  const { sessionId } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<FileContentResult | null>(null)

  const fetchContent = useCallback(
    async (filePath: string) => {
      setLoading(true)
      setError(null)

      try {
        const response = await apiClient.get<FileContentResult>(
          `/admin/sessions/${sessionId}/workspace/file`,
          { params: { path: filePath } },
        )
        setData(response.data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    },
    [sessionId],
  )

  const clear = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { loading, error, data, fetchContent, clear }
}
