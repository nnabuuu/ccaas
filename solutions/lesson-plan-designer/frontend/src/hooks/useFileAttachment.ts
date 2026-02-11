import { useState } from 'react'
import type { FileMetadata } from '@ccaas/react-sdk'

/**
 * Hook for attaching uploaded files to lesson plans
 *
 * Bridges CCAAS file system → lesson plan attachments
 */
export function useFileAttachment(lessonPlanId: string) {
  const [isAttaching, setIsAttaching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Infer lesson plan file type from MIME type
   */
  const inferFileType = (mimeType: string | null): 'audio' | 'ppt' | 'pdf' | 'script' | 'other' => {
    if (!mimeType) return 'other'

    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt'
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') return 'script'

    return 'other'
  }

  /**
   * Attach a file from CCAAS file system to the lesson plan
   */
  const attachFile = async (file: FileMetadata) => {
    setIsAttaching(true)
    setError(null)

    try {
      // Map FileMetadata to LessonPlanAttachment
      const attachment = {
        fileId: file.id,
        fileName: file.filename,
        fileType: inferFileType(file.mimeType),
        mimeType: file.mimeType || 'application/octet-stream',
        size: file.size,
        description: '',
      }

      // POST to lesson plan attachments endpoint (direct fetch)
      const response = await fetch(`/api/lesson-plans/${lessonPlanId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(attachment),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `Failed to add attachment: ${file.filename}`)
      }

      // Mark file as synced (clear "new" badge)
      try {
        await fetch(`/api/v1/files/${file.id}/mark-synced`, {
          method: 'POST',
        })
      } catch (err) {
        // Non-critical: badge won't clear but attachment succeeded
        console.warn('Failed to mark file as synced:', err)
      }

      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`附加文件失败: ${errorMessage}`)
      console.error('Attach file error:', err)
      return { success: false, error: errorMessage }
    } finally {
      setIsAttaching(false)
    }
  }

  return {
    attachFile,
    isAttaching,
    error,
  }
}
