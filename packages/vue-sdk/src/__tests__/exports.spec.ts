/**
 * Tests for package exports
 * Ensures all expected exports are available
 */
import { describe, it, expect } from 'vitest'

describe('Package Exports', () => {
  describe('composables', () => {
    it('should export all composables', async () => {
      const module = await import('../composables')

      // Legacy composables
      expect(module.useAgentState).toBeDefined()
      expect(module.useFormBridge).toBeDefined()
      expect(module.useAIEditing).toBeDefined()
      expect(module.usePlanMode).toBeDefined()
      expect(module.useTodoProgress).toBeDefined()
      expect(module.useToolActivity).toBeDefined()
      expect(module.useThinking).toBeDefined()
      expect(module.useExploration).toBeDefined()
      expect(module.useTokenUsage).toBeDefined()
      expect(module.useAgentChat).toBeDefined()
      expect(module.useSseChat).toBeDefined()
      expect(module.useEntityBridge).toBeDefined()
      expect(module.useOutputSync).toBeDefined()
      expect(module.useSkills).toBeDefined()
      expect(module.useFileContent).toBeDefined()
      expect(module.useWorkspaceTree).toBeDefined()

      // SSE-first composables (newly exported)
      expect(module.useAgentConnection).toBeDefined()
      expect(module.useAgentChatSse).toBeDefined()
      expect(module.useSseStream).toBeDefined()
      expect(module.useAgentStatus).toBeDefined()
      expect(module.usePageContext).toBeDefined()
      expect(module.useFiles).toBeDefined()
      expect(module.useFileVersions).toBeDefined()
      expect(module.useFilePreview).toBeDefined()
      expect(module.useTaskTracking).toBeDefined()
      expect(module.useMessageSplitter).toBeDefined()
      expect(module.useChatLayout).toBeDefined()
      expect(module.useQueueStatus).toBeDefined()
      expect(module.useTurns).toBeDefined()
    })
  })

  describe('services', () => {
    it('should export FormStateSynchronizer', async () => {
      const module = await import('../services')

      expect(module.FormStateSynchronizer).toBeDefined()
      expect(module.getFormStateSynchronizer).toBeDefined()
      expect(module.createFormStateSynchronizer).toBeDefined()
    })

    it('getFormStateSynchronizer should return singleton', async () => {
      const { getFormStateSynchronizer } = await import('../services')

      const instance1 = getFormStateSynchronizer()
      const instance2 = getFormStateSynchronizer()

      expect(instance1).toBe(instance2)
    })

    it('createFormStateSynchronizer should return new instance', async () => {
      const { createFormStateSynchronizer } = await import('../services')

      const instance1 = createFormStateSynchronizer()
      const instance2 = createFormStateSynchronizer()

      expect(instance1).not.toBe(instance2)
    })
  })

  describe('symbols', () => {
    it('should export connection symbols', async () => {
      const module = await import('../symbols')

      expect(module.AgentClientIdKey).toBeDefined()
      expect(module.AgentSessionIdKey).toBeDefined()
      expect(module.AgentConnectedKey).toBeDefined()
    })

    it('should export state symbols', async () => {
      const module = await import('../symbols')

      expect(module.IsAgentProcessingKey).toBeDefined()
      expect(module.CurrentToolNameKey).toBeDefined()
      expect(module.CurrentSkillNameKey).toBeDefined()
      expect(module.TodoItemsKey).toBeDefined()
      expect(module.SubagentTodosKey).toBeDefined()
    })

    it('should export plan mode symbols', async () => {
      const module = await import('../symbols')

      expect(module.PendingPlanProposalKey).toBeDefined()
      expect(module.ConfirmPlanProposalKey).toBeDefined()
      expect(module.RejectPlanProposalKey).toBeDefined()
    })

    it('should export form bridge symbols', async () => {
      const module = await import('../symbols')

      expect(module.RegisterAgentFormKey).toBeDefined()
      expect(module.UnregisterAgentFormKey).toBeDefined()
      expect(module.ActiveFormIdKey).toBeDefined()
    })

    it('should export output generation symbols', async () => {
      const module = await import('../symbols')

      expect(module.AIOutputGeneratingKey).toBeDefined()
      expect(module.AIOutputProgressKey).toBeDefined()
    })

    it('symbols should be unique (excluding aliases)', async () => {
      const module = await import('../symbols')

      const symbols = Object.values(module).filter(
        (v) => typeof v === 'symbol'
      )

      const uniqueSymbols = new Set(symbols)
      // Note: There are 2 aliases (AIOutputGeneratingKey -> AiOutputGeneratingKey,
      // AIOutputProgressKey -> AiOutputProgressKey) so unique count is 2 less
      expect(uniqueSymbols.size).toBeGreaterThan(0)
      // All non-alias symbols should be unique
      expect(symbols.length - uniqueSymbols.size).toBeLessThanOrEqual(2) // Max 2 aliases
    })
  })

  describe('types', () => {
    it('should export connection types', async () => {
      // Types are compile-time only, we just verify the module loads
      const module = await import('../types')
      expect(module).toBeDefined()
    })
  })

  describe('utils', () => {
    it('should export field mapping utilities', async () => {
      const module = await import('../utils')

      expect(module.mapFieldsToFrontend).toBeDefined()
      expect(module.mapFieldsToBackend).toBeDefined()
      expect(module.toFrontendField).toBeDefined()
      expect(module.toBackendField).toBeDefined()
      expect(module.FIELD_MAPPINGS).toBeDefined()
      expect(module.REVERSE_FIELD_MAPPINGS).toBeDefined()
      expect(module.ALL_LESSON_PLAN_FIELDS).toBeDefined()
    })

    it('should export validation utilities', async () => {
      const module = await import('../utils')

      expect(module.safeValidateOutputUpdateEvent).toBeDefined()
    })
  })

  describe('components', () => {
    it('should export all 30 Vue SFC components', async () => {
      const module = await import('../components')

      // Chat core (10)
      expect(module.ChatPanel).toBeDefined()
      expect(module.MessageBubble).toBeDefined()
      expect(module.AssistantMessageGroup).toBeDefined()
      expect(module.AgentActivityLine).toBeDefined()
      expect(module.ThinkingIndicator).toBeDefined()
      expect(module.ToolActivityIndicator).toBeDefined()
      expect(module.InlineToolCard).toBeDefined()
      expect(module.SubAgentCard).toBeDefined()
      expect(module.QuickActions).toBeDefined()
      expect(module.TokenBadge).toBeDefined()

      // Output sync (3)
      expect(module.OutputUpdateCard).toBeDefined()
      expect(module.DefaultSyncButton).toBeDefined()
      expect(module.SyncCardPanel).toBeDefined()

      // Layout (3)
      expect(module.ChatSection).toBeDefined()
      expect(module.ChatLayoutControls).toBeDefined()
      expect(module.CollapsedChatTab).toBeDefined()

      // File management (9)
      expect(module.FilePanel).toBeDefined()
      expect(module.FileList).toBeDefined()
      expect(module.FileListItem).toBeDefined()
      expect(module.FilePreview).toBeDefined()
      expect(module.FileImagePreview).toBeDefined()
      expect(module.FileTextPreview).toBeDefined()
      expect(module.FileUploadButton).toBeDefined()
      expect(module.FileVersionHistory).toBeDefined()
      expect(module.FileVersionCompare).toBeDefined()

      // Tasks & queue (5)
      expect(module.TasksView).toBeDefined()
      expect(module.TasksHeader).toBeDefined()
      expect(module.TasksList).toBeDefined()
      expect(module.UnifiedTaskCard).toBeDefined()
      expect(module.QueueStatusIndicator).toBeDefined()
    })
  })

  describe('main entry point', () => {
    it('should export everything from index', async () => {
      const module = await import('../index')

      // Composables
      expect(module.useAgentState).toBeDefined()
      expect(module.useFormBridge).toBeDefined()
      expect(module.useAgentConnection).toBeDefined()
      expect(module.useAgentChatSse).toBeDefined()
      expect(module.useAgentStatus).toBeDefined()
      expect(module.useFiles).toBeDefined()
      expect(module.useTaskTracking).toBeDefined()
      expect(module.useMessageSplitter).toBeDefined()

      // Components
      expect(module.ChatPanel).toBeDefined()
      expect(module.MessageBubble).toBeDefined()
      expect(module.FilePanel).toBeDefined()
      expect(module.TasksView).toBeDefined()

      // Services
      expect(module.FormStateSynchronizer).toBeDefined()
      expect(module.getFormStateSynchronizer).toBeDefined()

      // Symbols
      expect(module.IsAgentProcessingKey).toBeDefined()
      expect(module.TodoItemsKey).toBeDefined()

      // Utils
      expect(module.FIELD_MAPPINGS).toBeDefined()
    })
  })
})
