import { useState, useCallback } from 'react'

export interface PageContext {
  pageType: string
  pageData: Record<string, unknown>
  metadata?: {
    timestamp?: number
    userId?: string
  }
}

/**
 * Hook for managing page context that gets sent with every chat message.
 *
 * This hook provides a way to sync frontend page state with the backend,
 * allowing Claude to read the current page context before responding.
 *
 * @param initialContext - Optional initial context
 * @returns Context state and update functions
 *
 * @example
 * ```tsx
 * const { context, updateContext } = usePageContext()
 *
 * // Update context when lesson plan changes
 * useEffect(() => {
 *   if (lessonPlan) {
 *     updateContext('lesson-plan-editor', {
 *       lessonPlanId: lessonPlan.id,
 *       currentForm: {
 *         title: lessonPlan.title,
 *         subject: lessonPlan.subject,
 *         gradeLevel: lessonPlan.gradeLevel,
 *       },
 *     })
 *   }
 * }, [lessonPlan])
 *
 * // Pass context to chat hook
 * const chat = useAgentChat({ connection, context })
 * ```
 */
export function usePageContext(initialContext?: PageContext) {
  const [context, setContext] = useState<PageContext | null>(initialContext || null)

  const updateContext = useCallback((
    pageType: string,
    pageData: Record<string, unknown>
  ) => {
    setContext({
      pageType,
      pageData,
      metadata: {
        timestamp: Date.now(),
      },
    })
  }, [])

  const clearContext = useCallback(() => {
    setContext(null)
  }, [])

  return { context, updateContext, clearContext }
}
