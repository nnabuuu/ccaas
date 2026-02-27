import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { UseFilePreviewOptions, UseFilePreviewReturn, FilePreviewData } from '../types/files'

/**
 * Manages file preview with client-side caching.
 *
 * Features:
 * - Fetches file preview (text UTF-8 or image Base64)
 * - Client-side caching (5-minute stale time)
 * - Supports maxBytes limit (default: 100KB)
 *
 * @example
 * ```vue
 * <script setup>
 * const preview = useFilePreview({
 *   serverUrl: 'http://localhost:3001',
 *   fileId: 'file-abc',
 * })
 *
 * // Check loading state
 * // preview.isLoading.value
 *
 * // Display based on encoding
 * // if (preview.preview.value?.encoding === 'base64') -> <img>
 * // else -> <pre>
 * </script>
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
  const { serverUrl, fileId, maxBytes = 100 * 1024, enabled = true } = options

  const preview = ref<FilePreviewData | null>(null) as Ref<FilePreviewData | null>
  const isLoading = ref(true)
  const error = ref<Error | null>(null)

  // Track if composable is still active (not unmounted)
  let isActive = true

  // Fetch preview from API
  async function fetchPreview(): Promise<void> {
    if (!enabled || !fileId) return

    // Check cache first
    const cacheKey = `${fileId}-${maxBytes}`
    const cached = previewCache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      preview.value = cached.data
      isLoading.value = false
      return
    }

    try {
      isLoading.value = true
      error.value = null

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

      // Only update state if still active
      if (isActive) {
        preview.value = previewData

        // Cache the result
        previewCache.set(cacheKey, {
          data: previewData,
          timestamp: now,
        })
      }
    } catch (err) {
      if (isActive) {
        error.value = err as Error
      }
    } finally {
      if (isActive) {
        isLoading.value = false
      }
    }
  }

  // Fetch preview on mount
  onMounted(() => {
    fetchPreview()
  })

  // Cleanup: mark as inactive
  onUnmounted(() => {
    isActive = false
  })

  return {
    preview,
    isLoading,
    error,
    refetch: fetchPreview,
  }
}

/**
 * Clear preview cache (useful for testing or when file is updated).
 *
 * @param fileId - If provided, clears cache entries for this specific file.
 *   Otherwise clears the entire cache.
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
