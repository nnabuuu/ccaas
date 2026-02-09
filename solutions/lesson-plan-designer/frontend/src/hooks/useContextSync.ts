import { useState, useCallback, useRef, useEffect } from 'react'
import type { LessonPlan } from '../types'

export interface UseContextSyncOptions {
  sessionId: string
  enabled?: boolean
  debounceMs?: number
  onError?: (error: string) => void
}

export interface UseContextSyncReturn {
  syncContext: (plan: LessonPlan | null) => void
  isSyncing: boolean
}

/**
 * Hook for syncing lesson plan context to CCAAS backend
 * Debounced to avoid excessive API calls
 */
export function useContextSync(
  options: UseContextSyncOptions
): UseContextSyncReturn {
  const { sessionId, enabled = true, debounceMs = 500, onError } = options
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const syncContext = useCallback((plan: LessonPlan | null) => {
    if (!plan || !enabled) return

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce sync
    timeoutRef.current = setTimeout(async () => {
      setIsSyncing(true)
      try {
        const response = await fetch(`/api/v1/sessions/${sessionId}/context`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonPlanId: plan.id,
            currentForm: {
              title: plan.title,
              subject: plan.subject,
              gradeLevel: plan.gradeLevel,
              durationMinutes: plan.durationMinutes,
              lessonPlanCode: plan.lessonPlanCode,
              publisher: plan.publisher,
              volume: plan.volume,
              chapterId: plan.chapterId,
              chapterTitle: plan.chapterTitle,
              objectives: plan.objectives,
              content: plan.content,
              teachingMethods: plan.teachingMethods,
              materialsNeeded: plan.materialsNeeded,
              assessmentMethods: plan.assessmentMethods,
              curriculumRequirements: plan.curriculumRequirements,
              studentAnalysis: plan.studentAnalysis,
              extraProperties: plan.extraProperties,
              status: plan.status,
            },
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (err) {
        const message = `Context 同步失败: ${err instanceof Error ? err.message : String(err)}`
        onError?.(message)
      } finally {
        setIsSyncing(false)
      }
    }, debounceMs)
  }, [sessionId, enabled, debounceMs, onError])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { syncContext, isSyncing }
}
