import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type ToolActivity,
  type TodoItem,
  type TodoStats,
  type ActiveSubAgent,
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  type Message,
} from '@ccaas/react-sdk'
import { useLessonPlanSync } from './useLessonPlanSync'
import { useSubAgentPolling } from './useSubAgentPolling'
import { useSolutionConfig } from './useSolutionConfig'
import { useLessonPlanCRUD } from './useLessonPlanCRUD'
import { useContextSync } from './useContextSync'
import { api } from '../utils/api'
import type {
  LessonPlan,
  SyncField,
  CreateLessonPlanInput,
} from '../types'

const SOCKET_URL = '' // Empty string to avoid protocol-relative URL bug (// prefix)

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
  hasActiveSubAgents: boolean
  currentStreamContent: string

  // Sync state (from useLessonPlanSync)
  pendingUpdates: Map<SyncField, { field: SyncField; value: unknown; preview: string }>
  modifiedFields: Set<SyncField>

  // Tool activity state
  activeTools: Map<string, ToolActivity>
  isThinking: boolean
  thinkingContent: string
  tokenUsage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } | null

  // SubAgent tracking
  activeSubAgents: ActiveSubAgent[]

  // Todo state
  todoItems: TodoItem[]
  todoStats: TodoStats | null

  // Actions
  cancelProcessing: () => void
  sendMessage: (content: string) => void
  saveLessonPlan: () => Promise<void>
  createNewPlan: (input: CreateLessonPlanInput) => Promise<LessonPlan>
  syncToForm: (field: SyncField) => void
  discardUpdate: (field: SyncField) => void
  undoSync: (field: SyncField) => void
  canUndo: (field: SyncField) => boolean
  updateField: <K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => void
  loadPlan: (id: string) => Promise<void>
  syncContext: (lessonPlan: LessonPlan | null) => void
}

export function useLessonPlanSession(options: UseLessonPlanSessionOptions = {}): UseLessonPlanSessionReturn {
  const { planId, tenantId = 'lesson-plan-designer', autoConnect = true, enabledSkillSlugs } = options

  // ===== SDK Connection =====
  const connection = useAgentConnection({
    serverUrl: SOCKET_URL,
    sessionPrefix: 'lpd',
    autoConnect,
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

  // Context sync to backend
  const { syncContext } = useContextSync({
    sessionId: connection.sessionId,
    enabled: connection.connected,
  })

  // Legacy state removed - now using SDK messages directly
  // const [messages, setMessages] = useState<Message[]>([])
  const [currentStreamContent] = useState('') // eslint-disable-line @typescript-eslint/no-unused-vars
  const currentMessageRef = useRef<Message | null>(null)

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

  // ===== SDK Chat =====
  const chat = useAgentChat({
    connection,
    tenantId,
    mcpServers: solutionConfig?.mcpServers,
    skillPath: solutionConfig?.skillPath,
    enabledSkillSlugs,
    onOutputUpdate: (update) => {
      // Bridge SDK output_update to useLessonPlanSync
      addPendingUpdate({
        field: update.field as SyncField,
        value: update.value,
        preview: update.preview,
      })
    },
  })

  // ===== SDK Status =====
  const status = useAgentStatus({ connection })

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

  // Subagent polling as fallback (SDK handles via WebSocket, polling provides verification)
  // Note: SDK's useAgentStatus now manages activeSubAgents, polling kept for reliability
  useSubAgentPolling({
    sessionId: sessionIdRef.current,
    enabled: isMainProcessing || hasActiveSubAgents,
    onUpdate: (polledAgents) => {
      // SDK handles subagent state via WebSocket
      // Polling provides verification but doesn't override SDK state
      if (polledAgents.length === 0 && activeSubAgents.length > 0) {
        console.warn('⚠️ Polling shows no subagents but SDK shows active subagents - WebSocket may be stale')
      }
    },
    onError: (err) => {
      console.error('Sub-agent polling error:', err)
    },
  })

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

  // Create new plan (wrapper around crud.createPlan with sync state reset)
  const createNewPlan = useCallback(async (input: CreateLessonPlanInput): Promise<LessonPlan> => {
    const plan = await crud.createPlan(input)
    resetSyncState()
    chat.clearMessages()  // ← Use SDK's clearMessages
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

    // Note: Synced flag tracking removed - SDK messages are immutable
    // UI can derive synced state from pendingUpdates or modifiedFields if needed
  }, [crud, pendingUpdates, doSyncToForm, sessionIdRef])

  // Discard update
  const discardUpdate = useCallback((field: SyncField) => {
    removePendingUpdate(field)
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


  // Auto-sync context when lesson plan changes (debounced by useContextSync)
  useEffect(() => {
    syncContext(crud.lessonPlan)
  }, [crud.lessonPlan, syncContext])

  return {
    // Connection state
    connected,
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
    hasActiveSubAgents,
    currentStreamContent: chat.currentStreamContent,  // ← Use SDK stream content

    // Sync state
    pendingUpdates,
    modifiedFields,

    // Tool activity state
    activeTools,
    isThinking,
    thinkingContent,
    tokenUsage,

    // SubAgent tracking
    activeSubAgents,

    // Todo state
    todoItems,
    todoStats,

    // Actions
    cancelProcessing,
    sendMessage,
    saveLessonPlan,
    createNewPlan,
    syncToForm,
    discardUpdate,
    undoSync,
    canUndo,
    updateField,
    loadPlan,
    syncContext,
  }
}

export default useLessonPlanSession
