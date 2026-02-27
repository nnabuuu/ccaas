/**
 * usePageContext Composable
 *
 * Manages page context that gets sent with every chat message.
 * Provides a way to sync frontend page state with the backend,
 * allowing the agent to read the current page context before responding.
 *
 * This is the Vue equivalent of react-sdk's usePageContext hook.
 *
 * @example
 * ```vue
 * <script setup>
 * import { watch } from 'vue'
 * import { usePageContext, useAgentChatSse, useAgentConnection } from '@kedge-agentic/vue-sdk'
 *
 * const connection = useAgentConnection({
 *   serverUrl: 'http://localhost:3001',
 *   tenantId: 'my-tenant',
 * })
 *
 * const { context, updateContext, clearContext } = usePageContext()
 *
 * // Update context when lesson plan changes
 * watch(lessonPlan, (plan) => {
 *   if (plan) {
 *     updateContext('lesson-plan-editor', {
 *       lessonPlanId: plan.id,
 *       currentForm: {
 *         title: plan.title,
 *         subject: plan.subject,
 *         gradeLevel: plan.gradeLevel,
 *       },
 *     })
 *   }
 * })
 *
 * // Pass context to chat hook
 * const chat = useAgentChatSse({ connection, tenantId: 'my-tenant', context })
 * </script>
 * ```
 */

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ChatPageContext } from '../types/connection'

export interface UsePageContextReturn {
  /** Current page context, or null if not set */
  context: Ref<ChatPageContext | null>
  /** Update the page context with a new pageType and pageData */
  updateContext: (pageType: string, pageData: Record<string, unknown>) => void
  /** Clear the page context */
  clearContext: () => void
}

export function usePageContext(initialContext?: ChatPageContext): UsePageContextReturn {
  const context = ref<ChatPageContext | null>(initialContext || null)

  function updateContext(pageType: string, pageData: Record<string, unknown>) {
    context.value = {
      pageType,
      pageData,
      metadata: {
        timestamp: Date.now(),
      },
    }
  }

  function clearContext() {
    context.value = null
  }

  return { context, updateContext, clearContext }
}

export default usePageContext
