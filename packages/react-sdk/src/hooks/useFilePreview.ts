import { useState, useEffect, useCallback, useRef } from 'react'
import type { UseFilePreviewOptions, UseFilePreviewReturn, FilePreviewData } from '../types'

/**
 * Manages file preview with caching.
 *
 * Features:
 * - Fetches file preview (text UTF-8 or image Base64)
 * - Client-side caching (5 min stale time)
 * - Supports maxBytes limit (default: 100KB)
 *
 * Usage:
 * ```tsx
 * const preview = useFilePreviewData({ fileId })
 *
 * if (preview.isLoading) return <Spinner />
 * if (preview.error) return <Error />
 *
 * if (preview.preview?.encoding === 'base64') {
 *   return <img src={`data:${preview.preview.mimeType};base64,${preview.preview.content}`} />
 * } else {
 *   return <pre>{preview.preview?.content}</pre>
 * }
 * ```
 */

// Simple in-memory cache
interface CacheEntry {
  data: FilePreviewData
  timestamp: number
}

const previewCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useFilePreview(options: UseFilePreviewOptions): UseFilePreviewReturn {
  const { fileId, maxBytes = 100 * 1024, enabled = true } = options

  const [preview, setPreview] = useState<FilePreviewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Track if component is mounted
  const isMountedRef = useRef(true)

  // Determine server URL from window location
  const serverUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : ''

  // Fetch preview from API
  const fetchPreview = useCallback(async () => {
    if (!enabled || !fileId) return

    // Check cache first
    const cacheKey = `${fileId}-${maxBytes}`
    const cached = previewCache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      setPreview(cached.data)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(
        `${serverUrl}/api/v1/files/${fileId}/preview?maxBytes=${maxBytes}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch preview: ${response.statusText}`)
      }

      const data = await response.json()

      const previewData: FilePreviewData = {
        content: data.content,
        truncated: data.truncated,
        encoding: data.encoding,
        mimeType: data.mimeType,
        size: data.size,
      }

      // Only update state if still mounted
      if (isMountedRef.current) {
        setPreview(previewData)

        // Cache the result
        previewCache.set(cacheKey, {
          data: previewData,
          timestamp: now,
        })
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error)
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [serverUrl, fileId, maxBytes, enabled])

  // Fetch preview on mount
  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  // Cleanup: mark as unmounted
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    preview,
    isLoading,
    error,
    refetch: fetchPreview,
  }
}

/**
 * Clear preview cache (useful for testing or when file is updated)
 */
export function clearPreviewCache(fileId?: string): void {
  if (fileId) {
    // Clear specific file
    for (const key of previewCache.keys()) {
      if (key.startsWith(fileId)) {
        previewCache.delete(key)
      }
    }
  } else {
    // Clear all
    previewCache.clear()
  }
}
