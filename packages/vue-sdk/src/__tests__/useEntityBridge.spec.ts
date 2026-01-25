/**
 * Tests for useEntityBridge composable
 *
 * Tests field mapping, section state management, and integration
 * with useAgentChat for output_update event handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import { useEntityBridge } from '../composables/useEntityBridge'
import type { EntityBridgeConfig, EntityOutputUpdateEvent } from '../types/entity-bridge'
import type { UseAgentChatReturn } from '../composables/useAgentChat'

// Create mock useAgentChat return value
function createMockChat(): UseAgentChatReturn {
  const eventHandlers: Record<string, Function[]> = {}

  return {
    isConnected: computed(() => true),
    connectionStatus: ref({ status: 'connected' as const, reconnectAttempts: 0 }) as any,
    sessionId: ref('mock-session') as any,
    clientId: ref('mock-client') as any,
    hasPendingResult: ref(false) as any,
    pendingResultTruncated: ref(false) as any,
    pendingResultContext: ref(null) as any,
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    cancel: vi.fn(),
    reconnectSession: vi.fn().mockResolvedValue({ success: true }),
    applyPendingResult: vi.fn(() => []),
    notifyNavigatedAway: vi.fn(),
    markContextForPending: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = []
      }
      eventHandlers[event].push(handler)
      return () => {
        const index = eventHandlers[event].indexOf(handler)
        if (index > -1) {
          eventHandlers[event].splice(index, 1)
        }
      }
    }),
    off: vi.fn((event: string, handler: Function) => {
      if (eventHandlers[event]) {
        const index = eventHandlers[event].indexOf(handler)
        if (index > -1) {
          eventHandlers[event].splice(index, 1)
        }
      }
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
  }
}

describe('useEntityBridge', () => {
  const sections = ['textbookAnalysis', 'studentAnalysis', 'learningObjectives']
  const fieldMapping = {
    textbook_analysis: 'textbookAnalysis',
    student_analysis: 'studentAnalysis',
    learning_objectives: 'learningObjectives',
  }

  let mockChat: UseAgentChatReturn
  let updateSectionMock: ReturnType<typeof vi.fn>
  let saveToBackendMock: ReturnType<typeof vi.fn<[], Promise<void>>>
  let config: EntityBridgeConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockChat = createMockChat()
    updateSectionMock = vi.fn()
    saveToBackendMock = vi.fn<[], Promise<void>>().mockResolvedValue(undefined)

    config = {
      chat: mockChat,
      sections,
      fieldMapping,
      updateSection: updateSectionMock,
      saveToBackend: saveToBackendMock,
      debug: false,
    }
  })

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const bridge = useEntityBridge(config)

      expect(bridge.aiEditingMode.value).toBe(false)
      expect(bridge.currentSection.value).toBeNull()
      expect(bridge.isDirty.value).toBe(false)
      expect(bridge.isSaving.value).toBe(false)
    })

    it('should have progress at 0 initially', () => {
      const bridge = useEntityBridge(config)

      expect(bridge.progress.value).toBe(0)
    })

    it('should expose chat instance', () => {
      const bridge = useEntityBridge(config)

      expect(bridge.chat).toBe(mockChat)
    })
  })

  describe('handleOutputUpdate - field mapping', () => {
    it('should map backend field names to frontend section IDs', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Textbook analysis content',
      })

      expect(updateSectionMock).toHaveBeenCalledWith('textbookAnalysis', 'Textbook analysis content')
    })

    it('should prefer data over content when both are present', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'old content',
        data: { richContent: 'new data' },
      })

      expect(updateSectionMock).toHaveBeenCalledWith('textbookAnalysis', { richContent: 'new data' })
    })

    it('should ignore unknown fields', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'unknown_field',
        content: 'Some content',
      })

      expect(updateSectionMock).not.toHaveBeenCalled()
    })

    it('should ignore fields not in sections config', () => {
      const limitedConfig = {
        ...config,
        sections: ['textbookAnalysis'], // Only one section
      }

      const bridge = useEntityBridge(limitedConfig)

      // student_analysis maps to studentAnalysis, but it's not in sections
      bridge.handleOutputUpdate({
        field: 'student_analysis',
        content: 'Some content',
      })

      expect(updateSectionMock).not.toHaveBeenCalled()
    })
  })

  describe('section states', () => {
    it('should transition section to streaming on first update', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.sectionStates.value.textbookAnalysis?.status).toBe('streaming')
    })

    it('should transition section to completed when isFinal is true', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Final content',
        isFinal: true,
      })

      expect(bridge.sectionStates.value.textbookAnalysis?.status).toBe('completed')
    })

    it('should update currentSection when handling update', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'student_analysis',
        content: 'Content',
      })

      expect(bridge.currentSection.value).toBe('studentAnalysis')
    })

    it('should set isDirty to true after update', () => {
      const bridge = useEntityBridge(config)

      expect(bridge.isDirty.value).toBe(false)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.isDirty.value).toBe(true)
    })
  })

  describe('AI editing mode', () => {
    it('should auto-enable aiEditingMode on first update', () => {
      const bridge = useEntityBridge(config)

      expect(bridge.aiEditingMode.value).toBe(false)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.aiEditingMode.value).toBe(true)
    })

    it('startAIEditing should enable editing mode', () => {
      const bridge = useEntityBridge(config)

      bridge.startAIEditing()

      expect(bridge.aiEditingMode.value).toBe(true)
    })

    it('startAIEditing should set all sections to pending', () => {
      const bridge = useEntityBridge(config)

      bridge.startAIEditing()

      expect(bridge.sectionStates.value.textbookAnalysis?.status).toBe('pending')
      expect(bridge.sectionStates.value.studentAnalysis?.status).toBe('pending')
      expect(bridge.sectionStates.value.learningObjectives?.status).toBe('pending')
    })

    it('stopAIEditing should disable editing mode', () => {
      const bridge = useEntityBridge(config)

      bridge.startAIEditing()
      bridge.stopAIEditing()

      expect(bridge.aiEditingMode.value).toBe(false)
    })
  })

  describe('progress calculation', () => {
    it('should calculate progress based on completed sections', () => {
      const bridge = useEntityBridge(config)

      bridge.startAIEditing()
      expect(bridge.progress.value).toBe(0)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
        isFinal: true,
      })

      expect(bridge.progress.value).toBe(33) // 1/3

      bridge.handleOutputUpdate({
        field: 'student_analysis',
        content: 'Content',
        isFinal: true,
      })

      expect(bridge.progress.value).toBe(67) // 2/3

      bridge.handleOutputUpdate({
        field: 'learning_objectives',
        content: 'Content',
        isFinal: true,
      })

      expect(bridge.progress.value).toBe(100)
    })
  })

  describe('saveAll', () => {
    it('should call saveToBackend callback', async () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      await bridge.saveAll()

      expect(saveToBackendMock).toHaveBeenCalled()
    })

    it('should set isSaving during save', async () => {
      let resolveSave: () => void
      saveToBackendMock.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve
          })
      )

      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      const savePromise = bridge.saveAll()

      expect(bridge.isSaving.value).toBe(true)

      resolveSave!()
      await savePromise

      expect(bridge.isSaving.value).toBe(false)
    })

    it('should set isDirty to false after successful save', async () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.isDirty.value).toBe(true)

      await bridge.saveAll()

      expect(bridge.isDirty.value).toBe(false)
    })

    it('should not call saveToBackend if not dirty', async () => {
      const bridge = useEntityBridge(config)

      await bridge.saveAll()

      expect(saveToBackendMock).not.toHaveBeenCalled()
    })

    it('should throw error if save fails', async () => {
      saveToBackendMock.mockRejectedValueOnce(new Error('Save failed'))

      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      await expect(bridge.saveAll()).rejects.toThrow('Save failed')
    })
  })

  describe('discardAll', () => {
    it('should reset aiEditingMode to false', () => {
      const bridge = useEntityBridge(config)

      bridge.startAIEditing()
      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      bridge.discardAll()

      expect(bridge.aiEditingMode.value).toBe(false)
    })

    it('should reset isDirty to false', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.isDirty.value).toBe(true)

      bridge.discardAll()

      expect(bridge.isDirty.value).toBe(false)
    })

    it('should reset currentSection to null', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.currentSection.value).toBe('textbookAnalysis')

      bridge.discardAll()

      expect(bridge.currentSection.value).toBeNull()
    })

    it('should reset section states to idle', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
        isFinal: true,
      })

      expect(bridge.sectionStates.value.textbookAnalysis?.status).toBe('completed')

      bridge.discardAll()

      expect(bridge.sectionStates.value.textbookAnalysis?.status).toBe('idle')
    })
  })

  describe('helper methods', () => {
    it('isSectionEditing should return true for current section', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.isSectionEditing('textbookAnalysis')).toBe(true)
      expect(bridge.isSectionEditing('studentAnalysis')).toBe(false)
    })

    it('isSectionCompleted should return true for completed sections', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
        isFinal: true,
      })

      expect(bridge.isSectionCompleted('textbookAnalysis')).toBe(true)
      expect(bridge.isSectionCompleted('studentAnalysis')).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
        isFinal: true,
      })

      bridge.reset()

      expect(bridge.aiEditingMode.value).toBe(false)
      expect(bridge.currentSection.value).toBeNull()
      expect(bridge.isDirty.value).toBe(false)
      expect(bridge.isSaving.value).toBe(false)
      expect(bridge.sectionStates.value.textbookAnalysis?.status).toBe('idle')
    })
  })

  describe('callbacks', () => {
    it('should call onStart when AI editing starts', () => {
      const onStart = vi.fn()
      const bridge = useEntityBridge({ ...config, onStart })

      bridge.startAIEditing()

      expect(onStart).toHaveBeenCalled()
    })

    it('should call onComplete when all sections are completed', () => {
      const onComplete = vi.fn()
      const bridge = useEntityBridge({ ...config, onComplete })

      bridge.startAIEditing()

      bridge.handleOutputUpdate({ field: 'textbook_analysis', content: 'C', isFinal: true })
      expect(onComplete).not.toHaveBeenCalled()

      bridge.handleOutputUpdate({ field: 'student_analysis', content: 'C', isFinal: true })
      expect(onComplete).not.toHaveBeenCalled()

      bridge.handleOutputUpdate({ field: 'learning_objectives', content: 'C', isFinal: true })
      expect(onComplete).toHaveBeenCalled()
    })

    it('should call onError when updateSection throws', () => {
      const onError = vi.fn()
      updateSectionMock.mockImplementation(() => {
        throw new Error('Update failed')
      })

      const bridge = useEntityBridge({ ...config, onError })

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe('error handling', () => {
    it('should set section status to error when updateSection fails', () => {
      updateSectionMock.mockImplementation(() => {
        throw new Error('Update failed')
      })

      const bridge = useEntityBridge(config)

      bridge.handleOutputUpdate({
        field: 'textbook_analysis',
        content: 'Content',
      })

      expect(bridge.sectionStates.value.textbookAnalysis?.status).toBe('error')
      expect(bridge.sectionStates.value.textbookAnalysis?.error).toBe('Update failed')
    })
  })
})
