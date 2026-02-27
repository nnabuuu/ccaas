/**
 * @kedge-agentic/vue-sdk
 *
 * Vue composables and utilities for integrating with Claude-Code-as-a-Service backend.
 *
 * @example
 * ```vue
 * <script setup>
 * import {
 *   useAgentState,
 *   useFormBridge,
 *   useAIEditing,
 *   usePlanMode
 * } from '@kedge-agentic/vue-sdk'
 *
 * // Access centralized agent state
 * const { isProcessing, currentToolName, todoItems } = useAgentState()
 *
 * // Register a form with the agent
 * const { isActive } = useFormBridge({
 *   formId: 'my-form',
 *   getFormState: () => ({ ...form }),
 *   applyFormData: async (data) => {
 *     Object.assign(form, data)
 *     return { success: true }
 *   }
 * })
 *
 * // Use AI editing mode in a store
 * const { aiEditingMode, startAIEditing, updateFromAI } = useAIEditing({
 *   allSections: ['intro', 'body', 'conclusion'],
 *   onSectionUpdate: (id, content) => sections[id] = content
 * })
 *
 * // Handle plan proposals
 * const { pendingProposal, confirm, reject } = usePlanMode()
 * </script>
 * ```
 */

// Types
export * from './types'

// Composables
export * from './composables'

// Services
export * from './services'

// Symbols (injection keys)
export * from './symbols'

// Utils
export * from './utils'

// Components
export * from './components'
