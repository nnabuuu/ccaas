import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import { useLessonPlanSync } from './useLessonPlanSync'
import { useSubAgentPolling } from './useSubAgentPolling'
import { api, type SolutionConfig, type CcaasToolEvent } from '../utils/api'
import { parseOutputUpdateEvent } from '../utils/outputUpdateParser'
import type {
  LessonPlan,
  Message,
  MessageTokenUsage,
  SyncField,
  TextDeltaEvent,
  OutputUpdateEvent,
  AgentStatusEvent,
  CreateLessonPlanInput,
  ToolActivityEvent,
  AgentThinkingEvent,
  TokenUsageEvent,
  ExplorationActivityEvent,
  ContentBlock,
  ToolActivity,
  TodoItem,
  TodoStats,
  ActiveSubAgent,
  SubAgentStartedEvent,
  SubAgentCompletedEvent,
} from '../types'

const SOCKET_URL = '/' // Use relative URL, proxied by Vite

interface UseLessonPlanSessionOptions {
  planId?: string
  tenantId?: string
  autoConnect?: boolean
  enabledSkillSlugs?: string[]
}

/**
 * Normalize MCP tool name by removing prefixes
 * e.g., "mcp__lesson-plan-tools__write_output" -> "write_output"
 */
function normalizeToolName(toolName: string | undefined): string {
  if (!toolName) return ''
  return toolName
    .replace(/^mcp__[^_]+__/, '') // Remove mcp__{server}__ prefix
    .replace(/^mcp__/, '')        // Remove mcp__ prefix
}

// Token pricing per million tokens
const MODEL_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'claude-opus-4-5-20251101': { input: 15, output: 75, cached: 1.5 },
  'claude-opus-4.5': { input: 15, output: 75, cached: 1.5 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cached: 0.3 },
  'claude-sonnet-4': { input: 3, output: 15, cached: 0.3 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4, cached: 0.08 },
  'claude-haiku-3.5': { input: 0.8, output: 4, cached: 0.08 },
}

function calculateCost(model: string, input: number, output: number, cached: number): number {
  const defaultPricing = { input: 3, output: 15, cached: 0.3 }
  const direct = MODEL_PRICING[model]
  let pricing: { input: number; output: number; cached: number }
  if (direct) {
    pricing = direct
  } else {
    const base = Object.keys(MODEL_PRICING).find(m => model.toLowerCase().includes(m.toLowerCase().replace(/-\d+$/, '')))
    pricing = (base && MODEL_PRICING[base]) || defaultPricing
  }
  const billable = Math.max(0, input - cached)
  return Math.round(((billable / 1e6) * pricing.input + (cached / 1e6) * pricing.cached + (output / 1e6) * pricing.output) * 1e6) / 1e6
}

function createEmptyTokenUsageAcc(): MessageTokenUsage {
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimatedCostUsd: 0, model: '', requestCount: 0 }
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
    // Look for write_output tool calls (handle both plain and MCP-prefixed names)
    const normalizedName = normalizeToolName(event.toolName)
    if (normalizedName === 'write_output' && event.toolInput) {
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
  isProcessing: boolean  // 向后兼容别名
  isMainProcessing: boolean
  hasActiveSubAgents: boolean
  currentStreamContent: string

  // Sync state (from useLessonPlanSync)
  pendingUpdates: Map<SyncField, { field: SyncField; value: unknown; preview: string }>
  modifiedFields: Set<SyncField>

  // Tool activity state
  activeTools: Map<string, ToolActivityEvent>
  isThinking: boolean
  thinkingContent: string
  tokenUsage: TokenUsageEvent | null

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

  // Socket state
  const [connected, setConnected] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
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
  const [isMainProcessing, setIsMainProcessing] = useState(false)
  const [hasActiveSubAgents, setHasActiveSubAgents] = useState(false)
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const currentMessageRef = useRef<Message | null>(null)
  // Ref to track latest stream content for use in socket handlers (avoids stale closure)
  const streamContentRef = useRef('')
  // Ref to track content blocks (text + tool cards)
  const contentBlocksRef = useRef<ContentBlock[]>([])
  // Ref to accumulate token usage across multiple API calls within a single message
  const tokenUsageAccRef = useRef<MessageTokenUsage>(createEmptyTokenUsageAcc())

  // Tool activity state
  const [activeTools, setActiveTools] = useState<Map<string, ToolActivityEvent>>(new Map())
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingContent, setThinkingContent] = useState('')
  const [tokenUsage, setTokenUsage] = useState<TokenUsageEvent | null>(null)

  // SubAgent tracking state
  const [activeSubAgents, setActiveSubAgents] = useState<ActiveSubAgent[]>([])

  // Todo state
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])
  const [todoStats, setTodoStats] = useState<TodoStats | null>(null)

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

  // Merge polling data with WebSocket events
  // Prefer WebSocket timing, use polling as verification
  const mergeSubAgentData = useCallback((polledAgents: ActiveSubAgent[]) => {
    setActiveSubAgents(prev => {
      // Update hasActiveSubAgents based on polling data
      setHasActiveSubAgents(polledAgents.length > 0)

      // If WebSocket recently updated (within 5s), trust it
      const now = Date.now()
      const hasRecentUpdate = prev.some(agent => {
        const startedMs = new Date(agent.startedAt).getTime()
        return now - startedMs < 5000
      })

      if (hasRecentUpdate && socketConnected) {
        // WebSocket is working, ignore polling
        return prev
      }

      // WebSocket is stale or disconnected, use polling data
      return polledAgents
    })
  }, [socketConnected])

  // Adaptive polling as fallback when WebSocket unreliable
  useSubAgentPolling({
    sessionId: sessionIdRef.current,
    enabled: isMainProcessing || hasActiveSubAgents,
    onUpdate: mergeSubAgentData,
    onError: (err) => {
      console.error('Sub-agent polling error:', err)
    },
  })

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
      setSocketConnected(true)
      setError(null)
    })

    socket.on('client_id', (data: { clientId: string }) => {
      console.log('🔑 Received client ID:', data.clientId)
      clientIdRef.current = data.clientId
    })

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected')
      setConnected(false)
      setSocketConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
      setError('连接失败，请检查后端服务是否运行')
    })

    // Handle text streaming
    socket.on('text_delta', (data: TextDeltaEvent) => {
      // Accumulate into content blocks
      const blocks = contentBlocksRef.current
      const last = blocks[blocks.length - 1]
      if (last && last.type === 'text') {
        last.text += data.text
      } else {
        blocks.push({ type: 'text', text: data.text })
      }

      // Derive content string for backward compatibility
      const content = blocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('')

      streamContentRef.current = content

      setCurrentStreamContent(content)

      // Update message with contentBlocks
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = content
          lastMsg.contentBlocks = [...blocks]
        }
        return updated
      })
    })

    // Handle output updates (sync buttons)
    // Backend sends nested structure: { payload: { data: { field, value, preview } } }
    socket.on('output_update', (event: OutputUpdateEvent) => {
      const parsed = parseOutputUpdateEvent(event)

      console.log('📦 Output update received:', parsed?.field, parsed?.preview)

      // Skip if parsing failed (no field found)
      if (!parsed) {
        console.warn('⚠️ Output update missing field, skipping. Raw event:', event)
        return
      }

      addPendingUpdate({
        field: parsed.field,
        value: parsed.value,
        preview: parsed.preview,
      })

      // Also update current message's output updates (deduplicated by field)
      if (currentMessageRef.current) {
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            const existingUpdates = lastMsg.outputUpdates || []
            const existingIndex = existingUpdates.findIndex(u => u.field === parsed.field)

            if (existingIndex >= 0) {
              // Replace existing update for this field
              lastMsg.outputUpdates = existingUpdates.map((u, i) =>
                i === existingIndex ? { ...parsed } : u
              )
            } else {
              // Add new update
              lastMsg.outputUpdates = [...existingUpdates, { ...parsed }]
            }
          }
          return updated
        })
      }
    })

    // Handle agent status
    socket.on('agent_status', async (data: AgentStatusEvent & { context?: { activeSubAgents?: ActiveSubAgent[] } }) => {
      console.log('🤖 Agent status:', data.status)

      // Update active subagents if provided
      if (data.context?.activeSubAgents) {
        setActiveSubAgents(data.context.activeSubAgents)
      }

      if (data.status === 'complete' || data.status === 'error' || data.status === 'cancelled') {
        setIsMainProcessing(false)

        // Snapshot accumulated token usage for this message
        const messageUsage = tokenUsageAccRef.current.requestCount > 0
          ? { ...tokenUsageAccRef.current }
          : undefined
        // Reset accumulator for next message
        tokenUsageAccRef.current = createEmptyTokenUsageAcc()

        // Finalize current message: attach content + token usage
        const finalContent = streamContentRef.current
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            if (finalContent) lastMsg.content = finalContent
            if (messageUsage) lastMsg.tokenUsage = messageUsage
          }
          return updated
        })

        // Reset stream state
        setCurrentStreamContent('')
        streamContentRef.current = ''
        currentMessageRef.current = null

        // Clear active tools, thinking, and todo state
        setActiveTools(new Map())
        setIsThinking(false)
        setThinkingContent('')
        setTodoItems([])
        setTodoStats(null)

        if (data.status === 'error') {
          const errorMsg = data.error || `处理失败 (退出码: ${data.exitCode ?? 'unknown'})`
          setError(errorMsg)
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

                // Update messages with output updates — merge with existing synced state
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastMsg = updated[updated.length - 1]
                  if (lastMsg && lastMsg.role === 'assistant') {
                    const existing = lastMsg.outputUpdates || []
                    // Build lookup of already-synced fields
                    const syncedFields = new Map<string, { synced?: boolean; syncedAt?: Date }>()
                    for (const u of existing) {
                      if (u.synced) {
                        syncedFields.set(u.field, { synced: u.synced, syncedAt: u.syncedAt })
                      }
                    }
                    // Merge: preserve synced state for fields that were already synced
                    lastMsg.outputUpdates = outputUpdates.map((u) => {
                      const prev = syncedFields.get(u.field)
                      return prev
                        ? { ...u, synced: prev.synced, syncedAt: prev.syncedAt }
                        : { ...u, synced: false }
                    })
                  }
                  return updated
                })

                // Add to pending updates (Map.set is idempotent, won't create duplicates)
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

    // Handle tool activity
    socket.on('tool_activity', (data: { payload: ToolActivityEvent }) => {
      console.log('🔧 Tool:', data.payload.toolName, data.payload.phase, data.payload.description)
      const payload = data.payload

      // Update active tools indicator
      setActiveTools(prev => {
        const updated = new Map(prev)
        if (payload.phase === 'start') {
          updated.set(payload.toolId, payload)
        } else {
          updated.delete(payload.toolId)
        }
        return updated
      })

      // Create ToolActivity for inline rendering
      const toolActivity: ToolActivity = {
        toolName: payload.toolName,
        toolId: payload.toolId,
        phase: payload.phase,
        timestamp: new Date(),
        duration: payload.duration,
        success: payload.success,
        description: payload.description,
        toolInput: payload.toolInput,
        toolOutput: payload.toolOutput,
        agentType: payload.agentType,
        nestingLevel: payload.nestingLevel,
      }

      // Update content blocks
      const blocks = contentBlocksRef.current
      if (payload.phase === 'start') {
        blocks.push({ type: 'tool', tool: toolActivity })
      } else if (payload.phase === 'end') {
        // Find matching ToolBlock by toolId and update in place
        for (let i = blocks.length - 1; i >= 0; i--) {
          const block = blocks[i]
          if (block && block.type === 'tool' && block.tool.toolId === toolActivity.toolId) {
            blocks[i] = { type: 'tool', tool: toolActivity }
            break
          }
        }
      }

      // Update message with contentBlocks
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.contentBlocks = [...blocks]
        }
        return updated
      })
    })

    // Handle agent thinking
    socket.on('agent_thinking', (data: { payload: AgentThinkingEvent }) => {
      console.log('🧠 Thinking:', data.payload.phase)

      if (data.payload.phase === 'start') {
        setIsThinking(true)
        setThinkingContent('')
      } else if (data.payload.phase === 'delta' && data.payload.content) {
        setThinkingContent(prev => prev + data.payload.content)
      } else if (data.payload.phase === 'end') {
        setIsThinking(false)
      }
    })

    // Handle token usage - accumulate per message
    socket.on('token_usage', (data: { payload: TokenUsageEvent }) => {
      console.log('📊 Tokens:', data.payload.inputTokens, 'in /', data.payload.outputTokens, 'out')
      setTokenUsage(data.payload)

      // Accumulate for per-message usage
      const acc = tokenUsageAccRef.current
      acc.inputTokens += data.payload.inputTokens
      acc.outputTokens += data.payload.outputTokens
      acc.cachedInputTokens += (data.payload.cachedInputTokens || 0)
      acc.model = data.payload.model || acc.model
      acc.requestCount += 1
      acc.estimatedCostUsd = calculateCost(acc.model, acc.inputTokens, acc.outputTokens, acc.cachedInputTokens)
    })

    // Handle todo updates
    socket.on('todo_update', (data: { payload: { todos: TodoItem[]; completed: number; inProgress: number; pending: number; total: number } }) => {
      setTodoItems(data.payload.todos)
      setTodoStats({
        completed: data.payload.completed,
        inProgress: data.payload.inProgress,
        pending: data.payload.pending,
        total: data.payload.total,
      })
    })

    // Handle exploration activity
    socket.on('exploration_activity', (data: { payload: ExplorationActivityEvent }) => {
      console.log('🔍 Explore:', data.payload.action, data.payload.target)
    })

    // Handle subagent lifecycle events
    socket.on('subagent_started', (data: SubAgentStartedEvent) => {
      console.log('🤖 SubAgent started:', data.payload.agentType, data.payload.description)
      setActiveSubAgents(prev => [...prev, data.payload])

      // 标记有活跃 SubAgent
      setHasActiveSubAgents(true)

      // 主 Claude 已经返回（启动了后台任务）
      setIsMainProcessing(false)
    })

    socket.on('subagent_completed', (data: SubAgentCompletedEvent) => {
      console.log('✅ SubAgent completed:', data.payload.subAgentId, data.payload.status)
      setActiveSubAgents(prev => {
        const updated = prev.filter(agent => agent.subAgentId !== data.payload.subAgentId)

        // 如果没有活跃 SubAgent 了
        if (updated.length === 0) {
          setHasActiveSubAgents(false)
        }

        return updated
      })
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
    if (!connected || !clientIdRef.current || isMainProcessing) return

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
      contentBlocks: [],
      timestamp: new Date(),
      outputUpdates: [],
    }
    currentMessageRef.current = assistantMessage
    setMessages(prev => [...prev, assistantMessage])

    // Clear stream content, content blocks, and token accumulator
    setCurrentStreamContent('')
    streamContentRef.current = ''
    contentBlocksRef.current = []
    tokenUsageAccRef.current = createEmptyTokenUsageAcc()
    setIsMainProcessing(true)

    // Attempt to send message with auto-retry on WebSocket disconnection
    const attemptSend = async (retryCount = 0): Promise<void> => {
      // Build chat payload with latest clientId (may have changed after reconnection)
      // Note: sessionId is already in the URL path, not in the body
      const chatPayload: Record<string, unknown> = {
        clientId: clientIdRef.current,
        message: content,
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

      // Include enabled skill slugs (for tenant skill filtering)
      if (enabledSkillSlugs && enabledSkillSlugs.length > 0) {
        chatPayload.enabledSkillSlugs = enabledSkillSlugs
        if (retryCount === 0) {
          console.log('🔧 Sending with enabled skills:', enabledSkillSlugs)
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
      setIsMainProcessing(false)
    }
  }, [connected, isMainProcessing, tenantId, solutionConfig, enabledSkillSlugs, waitForReconnection])

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
  const createNewPlan = useCallback(async (input: CreateLessonPlanInput): Promise<LessonPlan> => {
    setLoading(true)
    setError(null)

    try {
      const plan = await api.createLessonPlan(input)
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
  }, [resetSyncState])

  // Sync to form
  const syncToForm = useCallback(async (field: SyncField) => {
    if (!lessonPlan) return

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
          lessonPlan.id,
          attachmentData,
          sessionIdRef.current,
        )

        // After successful upload, sync to form
        doSyncToForm(field, lessonPlan, setLessonPlan)
      } catch (err) {
        console.error('Failed to upload attachments:', err)
        setError(`附件上传失败: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    } else {
      // Other fields: sync directly
      doSyncToForm(field, lessonPlan, setLessonPlan)
    }

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
  }, [lessonPlan, pendingUpdates, doSyncToForm, sessionIdRef])

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

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !isMainProcessing) return
    socket.emit('cancel', { sessionId: sessionIdRef.current })
  }, [isMainProcessing])

  // Sync context to backend (for Claude Code to read current form state)
  const syncContext = useCallback(async (plan: LessonPlan | null) => {
    if (!plan) return

    try {
      const response = await fetch(`/api/v1/sessions/${sessionIdRef.current}/context`, {
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
        console.error('Failed to sync context:', response.status)
      }
    } catch (err) {
      console.error('Failed to sync context:', err)
    }
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
    isProcessing: isMainProcessing,  // 向后兼容别名
    isMainProcessing,
    hasActiveSubAgents,
    currentStreamContent,

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
