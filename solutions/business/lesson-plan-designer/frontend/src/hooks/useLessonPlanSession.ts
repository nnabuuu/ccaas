import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type ToolActivity,
  type TodoItem,
  type TodoStats,
  type ActiveSubAgent,
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  useFiles,
  type Message,
  type UseAgentConnectionReturn,
} from '@kedge-agentic/react-sdk'
import { useLessonPlanSync } from './useLessonPlanSync'
import { useSolutionConfig } from './useSolutionConfig'
import { useLessonPlanCRUD } from './useLessonPlanCRUD'
import { api } from '../utils/api'
import type {
  LessonPlan,
  SyncField,
  CreateLessonPlanInput,
  PendingUpdateWithMeta,
} from '../types'

// IMPORTANT: Must use absolute URL to backend, NOT relative path or empty string
// Vite proxy ONLY works for relative URLs in HTML/CSS, NOT for fetch() or Socket.IO
// See MEMORY.md: "Empty string causes SDK to use current origin (frontend port)"
const SOCKET_URL = 'http://localhost:3001' // Core CCAAS backend

interface UseLessonPlanSessionOptions {
  planId?: string
  tenantId?: string
  autoConnect?: boolean
  enabledSkillSlugs?: string[]
}

/**
 * Normalize MCP tool name by removing prefixes
 * e.g., "mcp__lesson-plan-tools__write_output" -> "write_output"
 * (Currently unused but kept for future use)
 */
// function normalizeToolName(toolName: string | undefined): string {
//   if (!toolName) return ''
//   return toolName
//     .replace(/^mcp__[^_]+__/, '') // Remove mcp__{server}__ prefix
//     .replace(/^mcp__/, '')        // Remove mcp__ prefix
// }

// Note: Token cost calculation moved to SDK (useAgentStatus handles token tracking)

/**
 * Extract output_update events from write_output tool calls
 * This rebuilds sync buttons from persisted tool events
 */

interface UseLessonPlanSessionReturn {
  // Connection state
  connected: boolean
  connection: UseAgentConnectionReturn
  sessionId: string
  error: string | null

  // Lesson plan data
  lessonPlan: LessonPlan | null
  loading: boolean
  saving: boolean

  // Chat state
  messages: Message[]
  isProcessing: boolean  // 向后兼容别名
  isMainProcessing: boolean
  isLoadingHistory: boolean
  hasActiveSubAgents: boolean
  currentStreamContent: string

  // Sync state (from useLessonPlanSync)
  pendingUpdates: Map<SyncField, { field: SyncField; value: unknown; preview: string; synced?: boolean; syncedAt?: Date }>
  modifiedFields: Set<SyncField>
  pendingUpdatesWithMeta: Map<SyncField, import('../types').PendingUpdateWithMeta>

  // Tool activity state
  activeTools: Map<string, ToolActivity>
  isThinking: boolean
  thinkingContent: string
  thinkingStartTime: number | null
  thinkingVerb: string
  tokenUsage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } | null

  // SubAgent tracking
  activeSubAgents: ActiveSubAgent[]

  // Todo state
  todoItems: TodoItem[]
  todoStats: TodoStats | null

  // Files state (NEW)
  newFilesCount: number

  // Actions
  cancelProcessing: () => void
  clearConversation: () => void
  sendMessage: (content: string) => void
  saveLessonPlan: () => Promise<void>
  createNewPlan: (input: CreateLessonPlanInput) => Promise<LessonPlan>
  syncToForm: (field: SyncField) => void
  syncAll: () => Promise<void>
  discardUpdate: (field: SyncField) => void
  undoSync: (field: SyncField) => void
  canUndo: (field: SyncField) => boolean
  updateField: <K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => void
  loadPlan: (id: string) => Promise<void>
}

export function useLessonPlanSession(options: UseLessonPlanSessionOptions = {}): UseLessonPlanSessionReturn {
  const { planId, tenantId = 'lesson-plan-designer', autoConnect = true, enabledSkillSlugs } = options

  // ===== SDK Connection =====
  const connection = useAgentConnection({
    serverUrl: SOCKET_URL,
    tenantId,
    autoConnect,
    transport: 'sse', // SSE is the default; explicit for clarity
  })

  // Backward compatibility: existing code expects refs
  const socketRef = useRef(connection.socket)
  const sessionIdRef = useRef(connection.sessionId)
  const clientIdRef = useRef(connection.clientId)

  // Update refs when connection changes
  useEffect(() => {
    socketRef.current = connection.socket
    sessionIdRef.current = connection.sessionId
    clientIdRef.current = connection.clientId
  }, [connection.socket, connection.sessionId, connection.clientId])

  // Backward compatibility: alias for connected/error
  const connected = connection.connected
  const [error, setError] = useState<string | null>(connection.error)

  // Solution config (mcpServers, skillPath from backend)
  const { config: solutionConfig } = useSolutionConfig()

  // Lesson plan CRUD operations
  const crud = useLessonPlanCRUD({
    onError: (err) => setError(err),
  })

  // Page context (NEW: replaces useContextSync)
  const { context, updateContext } = usePageContext()

  // Legacy state removed - now using SDK messages directly
  // All message state is managed by SDK hooks

  // Sync state
  const {
    pendingUpdates,
    modifiedFields,
    addPendingUpdate,
    removePendingUpdate,
    syncToForm: doSyncToForm,
    undoSync: doUndoSync,
    canUndo,
    resetSyncState,
  } = useLessonPlanSync()

  // Extended pending updates with metadata (for Global Sync Section)
  const [pendingUpdatesWithMeta, setPendingUpdatesWithMeta] = useState<Map<SyncField, PendingUpdateWithMeta>>(new Map())

  // ===== SDK Chat =====
  const chat = useAgentChat({
    connection,
    tenantId,
    mcpServers: solutionConfig?.mcpServers,
    skillPath: solutionConfig?.skillPath,
    enabledSkillSlugs,
    context,  // NEW: Pass context to send with every message
    onOutputUpdate: (update) => {
      // Bridge SDK output_update to useLessonPlanSync
      addPendingUpdate({
        field: update.field as SyncField,
        value: update.value,
        preview: update.preview,
      })

      // Also add to pendingUpdatesWithMeta (for Global Sync Section)
      const timestamp = Date.now()
      setPendingUpdatesWithMeta(prev => {
        const next = new Map(prev)
        next.set(update.field as SyncField, {
          field: update.field as SyncField,
          value: update.value,
          preview: update.preview,
          roundId: `round-${timestamp}`, // 使用时间戳生成唯一 ID
          timestamp,
        })
        return next
      })
    },
  })

  // ===== SDK Status =====
  const status = useAgentStatus({ connection })

  // ===== SDK Files =====
  const files = useFiles({
    connection,
    sessionId: connection.sessionId,
    enabled: connection.connected,
  })

  // ===== Backward Compatibility Aliases =====
  // Alias SDK functions and status
  const sendMessage = chat.sendMessage
  const cancelProcessing = chat.cancelProcessing

  // Alias status properties (replaces manual event handlers)
  const activeTools = status.activeTools
  const isThinking = status.isThinking
  const thinkingContent = status.thinkingContent
  const tokenUsage = status.tokenUsage
  const todoItems = status.todoItems
  const todoStats = status.todoStats
  const activeSubAgents = status.activeSubAgents

  // Computed state
  const hasActiveSubAgents = activeSubAgents.length > 0
  const isMainProcessing = chat.isProcessing && !hasActiveSubAgents

  // SubAgent tracking is now fully handled by SDK's useAgentStatus via WebSocket
  // Removed useSubAgentPolling - WebSocket provides real-time updates without polling overhead

  // Register event listeners on SDK-managed socket
  useEffect(() => {
    const socket = connection.socket
    if (!socket) return

    // Update error state when connection changes
    setError(connection.error)

    // No manual event listeners to clean up - all handled by SDK
  }, [connection.socket, connection.connected, connection.error])

  // Streaming handled by SDK - no manual updates needed
  // useEffect removed - SDK's useAgentChat handles currentStreamContent automatically

  // Load lesson plan (wrapper around crud.loadPlan with sync state reset)
  const loadPlan = useCallback(async (id: string) => {
    await crud.loadPlan(id)
    resetSyncState()
    setPendingUpdatesWithMeta(new Map())
  }, [crud, resetSyncState])

  // Load initial plan if planId is provided
  useEffect(() => {
    if (planId) {
      loadPlan(planId)
    }
  }, [planId, loadPlan])



  // Save lesson plan (wrapper around crud.savePlan)
  const saveLessonPlan = useCallback(async () => {
    await crud.savePlan()
  }, [crud])

  // Create new plan (wrapper around crud.createPlan with sync state reset + new conversation)
  const createNewPlan = useCallback(async (input: CreateLessonPlanInput): Promise<LessonPlan> => {
    const plan = await crud.createPlan(input)
    resetSyncState()
    setPendingUpdatesWithMeta(new Map())
    chat.clearConversation()  // ← New conversation: clear messages + new sessionId
    return plan
  }, [crud, resetSyncState, chat])

  // Sync to form (uses crud.lessonPlan and crud.setLessonPlan)
  const syncToForm = useCallback(async (field: SyncField) => {
    if (!crud.lessonPlan) return

    // Special handling for attachments: upload files to backend first
    if (field === 'attachments') {
      const update = pendingUpdates.get(field)
      if (!update) return

      const attachmentData = update.value as Array<{
        fileId: string
        fileName: string
        fileType?: string
        mimeType?: string
        size?: number
        description?: string
        _originalPath?: string
      }>

      try {
        // Upload attachments to backend with sessionId
        await api.addAttachments(
          crud.lessonPlan.id,
          attachmentData,
          sessionIdRef.current,
        )

        // After successful upload, sync to form
        doSyncToForm(field, crud.lessonPlan, crud.setLessonPlan)
      } catch (err) {
        console.error('Failed to upload attachments:', err)
        setError(`附件上传失败: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    } else {
      // Other fields: sync directly
      doSyncToForm(field, crud.lessonPlan, crud.setLessonPlan)
    }

    // Update pendingUpdatesWithMeta to mark as synced
    setPendingUpdatesWithMeta(prev => {
      const next = new Map(prev)
      const existing = next.get(field)
      if (existing) {
        next.set(field, { ...existing, synced: true, syncedAt: new Date() })
      }
      return next
    })

    // Note: Synced flag tracking removed - SDK messages are immutable
    // UI can derive synced state from pendingUpdates or modifiedFields if needed
  }, [crud, pendingUpdates, doSyncToForm, sessionIdRef])

  // Sync all pending updates
  const syncAll = useCallback(async () => {
    if (!crud.lessonPlan) return

    const allFields = Array.from(pendingUpdates.keys())
    for (const field of allFields) {
      await syncToForm(field)
    }
  }, [crud.lessonPlan, pendingUpdates, syncToForm])

  // Discard update
  const discardUpdate = useCallback((field: SyncField) => {
    removePendingUpdate(field)
    setPendingUpdatesWithMeta(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
    // Note: SDK messages are immutable - outputUpdates remain in messages
    // UI can filter based on pendingUpdates to hide discarded items if needed
  }, [removePendingUpdate])

  // Undo sync (uses crud.lessonPlan and crud.setLessonPlan)
  const undoSync = useCallback((field: SyncField) => {
    if (!crud.lessonPlan) return
    doUndoSync(field, crud.lessonPlan, crud.setLessonPlan)
  }, [crud, doUndoSync])

  // Update single field (delegates to crud.updateField)
  const updateField = crud.updateField

  // Auto-update context when lesson plan changes (NEW: replaces useContextSync)
  useEffect(() => {
    if (crud.lessonPlan) {
      updateContext('lesson-plan-editor', {
        lessonPlanId: crud.lessonPlan.id,
        currentForm: {
          title: crud.lessonPlan.title,
          subject: crud.lessonPlan.subject,
          gradeLevel: crud.lessonPlan.gradeLevel,
          publisher: crud.lessonPlan.publisher,
          volume: crud.lessonPlan.volume,
          chapterId: crud.lessonPlan.chapterId,
          chapterTitle: crud.lessonPlan.chapterTitle,
          durationMinutes: crud.lessonPlan.durationMinutes,
          objectives: crud.lessonPlan.objectives,
          content: crud.lessonPlan.content,
          assessmentMethods: crud.lessonPlan.assessmentMethods,
          curriculumRequirements: crud.lessonPlan.curriculumRequirements,
          studentAnalysis: crud.lessonPlan.studentAnalysis,
          materialsNeeded: crud.lessonPlan.materialsNeeded,
          teachingMethods: crud.lessonPlan.teachingMethods,
          attachments: crud.lessonPlan.attachments,
          extraProperties: crud.lessonPlan.extraProperties,
        },
      })
    }
  }, [crud.lessonPlan, updateContext])

  return {
    // Connection state
    connected,
    connection,
    sessionId: connection.sessionId,
    error,

    // Lesson plan data (from crud hook)
    lessonPlan: crud.lessonPlan,
    loading: crud.loading,
    saving: crud.loading, // crud.loading handles both load and save

    // Chat state (from SDK)
    messages: chat.messages,  // ← Use SDK messages
    isProcessing: isMainProcessing,  // 向后兼容别名
    isMainProcessing,
    isLoadingHistory: chat.isLoadingHistory,
    hasActiveSubAgents,
    currentStreamContent: chat.currentStreamContent,  // ← Use SDK stream content

    // Sync state
    pendingUpdates,
    modifiedFields,
    pendingUpdatesWithMeta,

    // Tool activity state
    activeTools,
    isThinking,
    thinkingContent,
    thinkingStartTime: status.thinkingStartTime,
    thinkingVerb: status.thinkingVerb,
    tokenUsage,

    // SubAgent tracking
    activeSubAgents,

    // Todo state
    todoItems,
    todoStats,

    // Files state (NEW)
    newFilesCount: files.newFilesCount,

    // Actions
    cancelProcessing,
    clearConversation: chat.clearConversation,
    sendMessage,
    saveLessonPlan,
    createNewPlan,
    syncToForm,
    syncAll,
    discardUpdate,
    undoSync,
    canUndo,
    updateField,
    loadPlan,
  }
}

export default useLessonPlanSession
