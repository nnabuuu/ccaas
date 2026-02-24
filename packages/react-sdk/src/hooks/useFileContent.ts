import { useState, useEffect, useCallback } from 'react'

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
  filePath: string | null
}

export interface UseFileContentReturn {
  content: string | null
  mimeType: string
  size: number
  filename: string
  isBinary: boolean
  isLoading: boolean
  error: Error | null
}

/**
 * Fetches file content from a session workspace for inline display.
 *
 * Calls `GET {serverUrl}/api/v1/sessions/{sessionId}/workspace/file?path={filePath}`.
 * Pass `filePath: null` to skip the request (useful for lazy loading).
 * Re-fetches automatically when `filePath` changes.
 *
 * @example
 * ```tsx
 * const { content, mimeType, isBinary, isLoading, error } = useFileContent({
 *   serverUrl: 'http://localhost:3001',
 *   sessionId: 'session-abc',
 *   filePath: selectedFile,  // null = no request
 * })
 *
 * if (isLoading) return <Spinner />
 * if (isBinary) return <p>Binary file — cannot display</p>
 * return <pre>{content}</pre>
 * ```
 */
export function useFileContent(options: UseFileContentOptions): UseFileContentReturn {
  const { serverUrl, sessionId, filePath } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<FileContentData | null>(null)

  const fetchContent = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = `${serverUrl}/api/v1/sessions/${sessionId}/workspace/file?path=${encodeURIComponent(path)}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`)
      }

      const result: FileContentData = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, sessionId])

  useEffect(() => {
    if (filePath === null) {
      setData(null)
      setError(null)
      return
    }
    fetchContent(filePath)
  }, [filePath, fetchContent])

  return {
    content: data?.content ?? null,
    mimeType: data?.mimeType ?? '',
    size: data?.size ?? 0,
    filename: data?.filename ?? '',
    isBinary: data?.isBinary ?? false,
    isLoading,
    error,
  }
}
