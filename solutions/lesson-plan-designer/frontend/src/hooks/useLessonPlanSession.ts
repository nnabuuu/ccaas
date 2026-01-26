import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import { useLessonPlanSync } from './useLessonPlanSync'
import { api, type SolutionConfig, type CcaasToolEvent } from '../utils/api'
import type {
  LessonPlan,
  Message,
  SyncField,
  TextDeltaEvent,
  OutputUpdateEvent,
  AgentStatusEvent,
  CreateLessonPlanInput,
} from '../types'

const SOCKET_URL = '/' // Use relative URL, proxied by Vite

interface UseLessonPlanSessionOptions {
  planId?: string
  tenantId?: string
  autoConnect?: boolean
}

/**
 * Extract output_update events from write_output tool calls
 * This rebuilds sync buttons from persisted tool events
 */
function extractOutputUpdatesFromToolEvents(
  toolEvents: CcaasToolEvent[]
): Array<{ field: SyncField; value: unknown; preview: string }> {
  const updates: Array<{ field: SyncField; value: unknown; preview: string }> = []

  for (const event of toolEvents) {
    // Look for write_output tool calls
    if (event.toolName === 'write_output' && event.toolInput) {
      const input = event.toolInput as Record<string, unknown>
      const field = input.field as SyncField
      const value = input.value
      const preview = (input.preview as string) || `更新 ${field}`

      if (field && value !== undefined) {
        // Deduplicate by field (keep latest)
        const existingIndex = updates.findIndex((u) => u.field === field)
        if (existingIndex >= 0) {
          updates[existingIndex] = { field, value, preview }
        } else {
          updates.push({ field, value, preview })
        }
      }
    }
  }

  return updates
}

interface UseLessonPlanSessionReturn {
  // Connection state
  connected: boolean
  error: string | null

  // Lesson plan data
  lessonPlan: LessonPlan | null
  loading: boolean
  saving: boolean

  // Chat state
  messages: Message[]
  isProcessing: boolean
  currentStreamContent: string

  // Sync state (from useLessonPlanSync)
  pendingUpdates: Map<SyncField, { field: SyncField; value: unknown; preview: string }>
  modifiedFields: Set<SyncField>

  // Actions
  sendMessage: (content: string) => void
  saveLessonPlan: () => Promise<void>
  createNewPlan: (input: Omit<CreateLessonPlanInput, 'tenantId'>) => Promise<LessonPlan>
  syncToForm: (field: SyncField) => void
  discardUpdate: (field: SyncField) => void
  undoSync: (field: SyncField) => void
  canUndo: (field: SyncField) => boolean
  updateField: <K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => void
  loadPlan: (id: string) => Promise<void>
}

export function useLessonPlanSession(options: UseLessonPlanSessionOptions = {}): UseLessonPlanSessionReturn {
  const { planId, tenantId = 'lesson-plan-designer', autoConnect = true } = options

  // Socket state
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const sessionIdRef = useRef<string>(`lpd_${uuidv4()}`)
  const clientIdRef = useRef<string | null>(null)

  // Solution config (mcpServers, skillPath from backend)
  const [solutionConfig, setSolutionConfig] = useState<SolutionConfig | null>(null)

  // Lesson plan state
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const currentMessageRef = useRef<Message | null>(null)
  // Ref to track latest stream content for use in socket handlers (avoids stale closure)
  const streamContentRef = useRef('')

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

  // Load solution config on mount
  useEffect(() => {
    api.getSolutionConfig()
      .then((config) => {
        console.log('📋 Solution config loaded:', config)
        setSolutionConfig(config)
      })
      .catch((err) => {
        console.error('Failed to load solution config:', err)
      })
  }, [])

  // Initialize socket connection to CCAAS
  useEffect(() => {
    if (!autoConnect) return

    // Connect to CCAAS WebSocket (proxied via Vite)
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('🔌 Socket connected to CCAAS')
      setConnected(true)
      setError(null)
    })

    socket.on('client_id', (data: { clientId: string }) => {
      console.log('🔑 Received client ID:', data.clientId)
      clientIdRef.current = data.clientId
    })

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected')
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
      setError('连接失败，请检查后端服务是否运行')
    })

    // Handle text streaming
    socket.on('text_delta', (data: TextDeltaEvent) => {
      setCurrentStreamContent(prev => {
        const newContent = prev + data.content
        streamContentRef.current = newContent // Keep ref in sync
        return newContent
      })
    })

    // Handle output updates (sync buttons)
    socket.on('output_update', (data: OutputUpdateEvent) => {
      console.log('📦 Output update received:', data.field, data.preview)

      // Skip if no field
      if (!data.field) {
        console.warn('⚠️ Output update missing field, skipping')
        return
      }

      const preview = data.preview || `更新 ${data.field}`

      addPendingUpdate({
        field: data.field,
        value: data.value,
        preview,
      })

      // Also update current message's output updates (deduplicated by field)
      if (currentMessageRef.current) {
        const update = {
          field: data.field,
          value: data.value,
          preview,
          synced: false,
        }
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            const existingUpdates = lastMsg.outputUpdates || []
            const existingIndex = existingUpdates.findIndex(u => u.field === data.field)

            if (existingIndex >= 0) {
              // Replace existing update for this field
              lastMsg.outputUpdates = existingUpdates.map((u, i) =>
                i === existingIndex ? update : u
              )
            } else {
              // Add new update
              lastMsg.outputUpdates = [...existingUpdates, update]
            }
          }
          return updated
        })
      }
    })

    // Handle agent status
    socket.on('agent_status', async (data: AgentStatusEvent) => {
      console.log('🤖 Agent status:', data.status)

      if (data.status === 'complete' || data.status === 'error') {
        setIsProcessing(false)

        // Finalize current message using ref (avoids stale closure)
        const finalContent = streamContentRef.current
        if (currentMessageRef.current && finalContent) {
          setMessages(prev => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = finalContent
            }
            return updated
          })
        }

        // Reset stream state
        setCurrentStreamContent('')
        streamContentRef.current = ''
        currentMessageRef.current = null

        if (data.status === 'error' && data.error) {
          setError(data.error)
        }

        // On completion, fetch full messages with toolEvents to rebuild sync buttons
        if (data.status === 'complete') {
          try {
            console.log('📥 Fetching messages with toolEvents from REST API...')
            const { messages: ccaasMessages } = await api.getSessionMessages(
              sessionIdRef.current,
              true, // includeToolEvents
            )

            // Process the last assistant message's tool events
            const lastAssistantMsg = ccaasMessages
              .filter((m) => m.role === 'assistant')
              .pop()

            if (lastAssistantMsg?.toolEvents?.length) {
              console.log(`📦 Found ${lastAssistantMsg.toolEvents.length} tool events`)

              // Extract write_output calls
              const outputUpdates = extractOutputUpdatesFromToolEvents(lastAssistantMsg.toolEvents)

              if (outputUpdates.length > 0) {
                console.log(`📝 Extracted ${outputUpdates.length} output updates from tool events`)

                // Update messages with output updates
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastMsg = updated[updated.length - 1]
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.outputUpdates = outputUpdates.map((u) => ({
                      ...u,
                      synced: false,
                    }))
                  }
                  return updated
                })

                // Add to pending updates
                for (const update of outputUpdates) {
                  addPendingUpdate(update)
                }
              }
            }
          } catch (err) {
            console.error('Failed to fetch messages with toolEvents:', err)
          }
        }
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [autoConnect, addPendingUpdate])

  // Update message content when streaming
  useEffect(() => {
    if (currentStreamContent && currentMessageRef.current) {
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = currentStreamContent
        }
        return updated
      })
    }
  }, [currentStreamContent])

  // Load lesson plan
  const loadPlan = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      const plan = await api.getLessonPlan(id)
      setLessonPlan(plan)
      resetSyncState()
    } catch (err) {
      console.error('Failed to load lesson plan:', err)
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [resetSyncState])

  // Load initial plan if planId is provided
  useEffect(() => {
    if (planId) {
      loadPlan(planId)
    }
  }, [planId, loadPlan])

  // Wait for WebSocket reconnection and new clientId
  const waitForReconnection = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current
      if (!socket) {
        reject(new Error('No socket instance'))
        return
      }

      // If already connected and have clientId, resolve immediately
      if (socket.connected && clientIdRef.current) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Reconnection timeout (10s)'))
      }, 10000) // 10 second timeout

      const onClientId = () => {
        // Received new clientId, reconnection complete
        cleanup()
        resolve()
      }

      const cleanup = () => {
        clearTimeout(timeout)
        socket.off('client_id', onClientId)
      }

      // Listen for client_id event (sent after reconnection)
      socket.on('client_id', onClientId)
    })
  }, [])

  // Send chat message via REST API (response streams via WebSocket)
  const sendMessage = useCallback(async (content: string) => {
    if (!connected || !clientIdRef.current || isProcessing) return

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    // Create placeholder for assistant message
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      outputUpdates: [],
    }
    currentMessageRef.current = assistantMessage
    setMessages(prev => [...prev, assistantMessage])

    // Clear stream content
    setCurrentStreamContent('')
    streamContentRef.current = ''
    setIsProcessing(true)

    // Attempt to send message with auto-retry on WebSocket disconnection
    const attemptSend = async (retryCount = 0): Promise<void> => {
      // Build chat payload with latest clientId (may have changed after reconnection)
      const chatPayload: Record<string, unknown> = {
        clientId: clientIdRef.current,
        message: content,
        sessionId: sessionIdRef.current,
        tenantId,
      }

      // Include MCP servers from solution config (if available)
      if (solutionConfig?.mcpServers) {
        chatPayload.mcpServers = solutionConfig.mcpServers
        if (retryCount === 0) {
          console.log('📦 Sending with MCP servers:', Object.keys(solutionConfig.mcpServers))
        }
      }

      // Include skill path from solution config (if available)
      if (solutionConfig?.skillPath) {
        chatPayload.skillPath = solutionConfig.skillPath
        if (retryCount === 0) {
          console.log('📜 Sending with skill path:', solutionConfig.skillPath)
        }
      }

      const response = await fetch(`/api/v1/sessions/${sessionIdRef.current}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Detect WebSocket disconnection error (400 + "not connected")
        if (
          response.status === 400 &&
          errorData.message?.includes('not connected') &&
          retryCount < 2
        ) {
          console.log('⚠️ WebSocket disconnected, waiting for reconnection...')
          await waitForReconnection()
          console.log('✅ Reconnected with new clientId, retrying send...')
          return attemptSend(retryCount + 1)
        }

        throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`)
      }
    }

    // Send via RESTful API: POST /api/v1/sessions/{sessionId}/completion
    try {
      await attemptSend()
    } catch (err) {
      console.error('Failed to send message:', err)
      setError(`发送失败: ${err instanceof Error ? err.message : err}`)
      setIsProcessing(false)
    }
  }, [connected, isProcessing, tenantId, solutionConfig, waitForReconnection])

  // Save lesson plan
  const saveLessonPlan = useCallback(async () => {
    if (!lessonPlan) return

    setSaving(true)
    setError(null)

    try {
      const updated = await api.updateLessonPlan(lessonPlan.id, lessonPlan)
      setLessonPlan(updated)
    } catch (err) {
      console.error('Failed to save lesson plan:', err)
      setError(err instanceof Error ? err.message : '保存失败')
      throw err
    } finally {
      setSaving(false)
    }
  }, [lessonPlan])

  // Create new plan
  const createNewPlan = useCallback(async (input: Omit<CreateLessonPlanInput, 'tenantId'>): Promise<LessonPlan> => {
    setLoading(true)
    setError(null)

    try {
      const plan = await api.createLessonPlan({ tenantId, ...input })
      setLessonPlan(plan)
      resetSyncState()
      setMessages([])
      return plan
    } catch (err) {
      console.error('Failed to create lesson plan:', err)
      setError(err instanceof Error ? err.message : '创建失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [tenantId, resetSyncState])

  // Sync to form
  const syncToForm = useCallback((field: SyncField) => {
    if (!lessonPlan) return
    doSyncToForm(field, lessonPlan, setLessonPlan)

    // Mark as synced in messages
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.outputUpdates) {
          return {
            ...msg,
            outputUpdates: msg.outputUpdates.map(u =>
              u.field === field ? { ...u, synced: true } : u
            ),
          }
        }
        return msg
      })
    })
  }, [lessonPlan, doSyncToForm])

  // Discard update
  const discardUpdate = useCallback((field: SyncField) => {
    removePendingUpdate(field)

    // Remove from messages
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.outputUpdates) {
          return {
            ...msg,
            outputUpdates: msg.outputUpdates.filter(u => u.field !== field),
          }
        }
        return msg
      })
    })
  }, [removePendingUpdate])

  // Undo sync
  const undoSync = useCallback((field: SyncField) => {
    if (!lessonPlan) return
    doUndoSync(field, lessonPlan, setLessonPlan)
  }, [lessonPlan, doUndoSync])

  // Update single field
  const updateField = useCallback(<K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => {
    setLessonPlan(prev => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }, [])

  return {
    // Connection state
    connected,
    error,

    // Lesson plan data
    lessonPlan,
    loading,
    saving,

    // Chat state
    messages,
    isProcessing,
    currentStreamContent,

    // Sync state
    pendingUpdates,
    modifiedFields,

    // Actions
    sendMessage,
    saveLessonPlan,
    createNewPlan,
    syncToForm,
    discardUpdate,
    undoSync,
    canUndo,
    updateField,
    loadPlan,
  }
}

export default useLessonPlanSession
