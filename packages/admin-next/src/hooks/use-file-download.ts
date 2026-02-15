import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

interface UseFileDownloadOptions {
  sessionId: string
}

interface UseFileDownloadResult {
  downloading: boolean
  error: Error | null
  downloadFile: (filePath: string, filename: string) => Promise<void>
}

/**
 * Hook for downloading files from session workspace
 *
 * @param options - Session ID
 * @returns Download function, loading state, and error
 *
 * @example
 * ```tsx
 * const { downloadFile, downloading, error } = useFileDownload({
 *   sessionId: 'sess_123'
 * })
 *
 * // Download a file
 * await downloadFile('src/index.ts', 'index.ts')
 * ```
 */
export function useFileDownload(options: UseFileDownloadOptions): UseFileDownloadResult {
  const { sessionId } = options
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const downloadFile = useCallback(
    async (filePath: string, filename: string) => {
      setDownloading(true)
      setError(null)

      try {
        // Fetch file as blob
        const response = await apiClient.get(`/admin/sessions/${sessionId}/workspace/${encodeURIComponent(filePath)}`, {
          responseType: 'blob',
        })

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()

        // Cleanup
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } catch (err) {
        const error = err as Error
        setError(error)
        throw error
      } finally {
        setDownloading(false)
      }
    },
    [sessionId]
  )

  return {
    downloading,
    error,
    downloadFile,
  }
}
