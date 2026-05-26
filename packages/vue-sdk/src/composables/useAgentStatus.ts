/**
 * useAgentStatus Composable
 *
 * Tracks agent status, tool activity, thinking state, token usage,
 * todo progress, and subagent lifecycle.
 *
 * Listens to Socket.IO events: agent_status, tool_activity, agent_thinking,
 * token_usage, todo_update, subagent_started, subagent_completed.
 *
 * SSE mode: subscribes to GET /api/v1/sessions/:id/events push channel
 * for subagent lifecycle events that arrive between per-turn streams.
 *
 * This is the Vue equivalent of react-sdk's useAgentStatus hook.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAgentConnection, useAgentStatus } from '@kedge-agentic/vue-sdk'
 *
 * const connection = useAgentConnection({
 *   serverUrl: 'http://localhost:3001',
 *   solutionId: 'my-solution',
 * })
 *
 * const {
 *   agentStatus,
 *   isProcessing,
 *   activeTools,
 *   isThinking,
 *   thinkingVerb,
 *   tokenUsage,
 *   todoItems,
 *   todoStats,
 *   activeSubAgents,
 *   currentActivity,
 * } = useAgentStatus({ connection })
 * </script>
 * ```
 */

import { ref, computed, watch, onUnmounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { UseAgentConnectionReturn } from '../types/connection'
import type { ChatToolActivity } from '../types/chat'
import type { TodoStats, JobInfo } from '../types/tasks'
import type {
  ActiveSubAgent,
  EventTodoItem,
  AgentStatusEvent,
  ToolActivityPayload,
  AgentThinkingPayload,
  TokenUsagePayload,
  TodoUpdatePayload,
  SubAgentStartedEvent,
  SubAgentCompletedEvent,
  JobUpdateEvent,
} from '@kedge-agentic/common'
import { getThinkingVerb, THINKING_VERBS } from '../utils/thinkingVerbs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentStatusValue =
  | 'idle'
  | 'thinking'
  | 'running'
  | 'exploring'
  | 'executing'
  | 'complete'
  | 'error'

export interface UseAgentStatusOptions {
  connection: UseAgentConnectionReturn
}

export interface UseAgentStatusReturn {
  agentStatus: Ref<AgentStatusValue>
  isProcessing: ComputedRef<boolean>
  activeTools: Ref<Map<string, ChatToolActivity>>
  isThinking: Ref<boolean>
  thinkingContent: Ref<string>
  thinkingStartTime: Ref<number | null>
  thinkingVerb: Ref<string>
  tokenUsage: Ref<{ inputTokens: number; outputTokens: number; cacheReadTokens?: number } | null>
  todoItems: Ref<EventTodoItem[]>
  todoStats: Ref<TodoStats>
  activeSubAgents: Ref<ActiveSubAgent[]>
  jobs: Ref<JobInfo[]>
  currentActivity: ComputedRef<string>
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useAgentStatus(options: UseAgentStatusOptions): UseAgentStatusReturn {
  const { connection } = options

  // ---- Reactive state ----
  const agentStatus = ref<AgentStatusValue>('idle')
  const activeTools = ref<Map<string, ChatToolActivity>>(new Map())
  const isThinking = ref(false)
  const thinkingContent = ref('')
  const thinkingStartTime = ref<number | null>(null)
  const thinkingVerb = ref<string>('\u601d\u8003') // '思考'
  const tokenUsage = ref<UseAgentStatusReturn['tokenUsage']['value']>(null)
  const todoItems = ref<EventTodoItem[]>([])
  const todoStats = ref<TodoStats>({ completed: 0, inProgress: 0, pending: 0, total: 0 })
  const activeSubAgents = ref<ActiveSubAgent[]>([])
  const jobs = ref<JobInfo[]>([])

  // ---- Computed ----
  const isProcessing = computed(() =>
    agentStatus.value === 'thinking' ||
    agentStatus.value === 'running' ||
    agentStatus.value === 'exploring' ||
    agentStatus.value === 'executing',
  )

  const currentActivity = computed(() => {
    const activeTodo = todoItems.value.find(t => t.status === 'in_progress')
    if (activeTodo?.activeForm) return activeTodo.activeForm

    const firstTool = activeTools.value.values().next().value
    if (firstTool?.description) return firstTool.description

    if (isThinking.value) return 'Thinking\u2026'
    return ''
  })

  // ---- Pending timeouts (for cleanup on unmount) ----
  const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>()

  // ---- Reset state when agent completes ----
  function handleComplete() {
    activeTools.value = new Map()
    isThinking.value = false
    thinkingContent.value = ''
    todoStats.value = { completed: 0, inProgress: 0, pending: 0, total: 0 }
  }

  // ---- Subagent event handlers (shared between socket and SSE) ----
  function onSubAgentStarted(data: SubAgentStartedEvent) {
    const agent = data.payload
    const exists = activeSubAgents.value.some(a => a.subAgentId === agent.subAgentId)
    if (!exists) {
      activeSubAgents.value = [...activeSubAgents.value, agent]
    }
  }

  function onSubAgentCompleted(data: SubAgentCompletedEvent) {
    const { subAgentId, status } = data.payload
    activeSubAgents.value = activeSubAgents.value.map(agent =>
      agent.subAgentId === subAgentId
        ? { ...agent, status: status as 'completed' | 'failed' }
        : agent,
    )
    // Remove completed/failed agents after 3 seconds
    const timeoutId = setTimeout(() => {
      activeSubAgents.value = activeSubAgents.value.filter(
        agent => agent.subAgentId !== subAgentId,
      )
      pendingTimeouts.delete(timeoutId)
    }, 3000)
    pendingTimeouts.add(timeoutId)
  }

  // ---- Job update handler (shared between socket and SSE) ----
  function onJobUpdate(data: JobUpdateEvent) {
    const job: JobInfo = {
      id: data.jobId,
      sessionId: data.sessionId,
      messageId: data.messageId,
      type: data.jobType,
      name: data.name,
      status: data.status,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      progress: data.progress,
      metadata: data.metadata,
      resultFiles: data.resultFiles,
      errorMessage: data.errorMessage,
    }
    const idx = jobs.value.findIndex(j => j.id === data.jobId)
    if (idx >= 0) {
      const updated = [...jobs.value]
      updated[idx] = job
      jobs.value = updated
    } else {
      jobs.value = [...jobs.value, job]
    }
  }

  // ---- Socket event handlers ----
  function onAgentStatus(data: AgentStatusEvent) {
    const { status, context } = data
    agentStatus.value = status as AgentStatusValue

    if (status === 'complete') {
      // Process backend snapshot before clearing so useTaskTracking can capture
      const snapshot = context?.activeSubAgents
      if (snapshot && snapshot.length > 0) {
        const merged = [...activeSubAgents.value]
        snapshot.forEach((sa: ActiveSubAgent) => {
          const existingIdx = merged.findIndex(a => a.subAgentId === sa.subAgentId)
          if (existingIdx >= 0) {
            merged[existingIdx] = { ...sa, status: sa.status || 'completed' }
          } else {
            merged.push({ ...sa, status: sa.status || 'completed' })
          }
        })
        activeSubAgents.value = merged

        // Give Vue time to render and useTaskTracking to capture
        setTimeout(() => {
          handleComplete()
          activeSubAgents.value = []
          todoItems.value = []
        }, 100)
      } else {
        handleComplete()
        activeSubAgents.value = []
        todoItems.value = []
      }
    } else if (status === 'error') {
      handleComplete()
      activeSubAgents.value = []
      todoItems.value = []
    }
  }

  function onToolActivity(data: { payload: ToolActivityPayload }) {
    const payload = data.payload
    const updated = new Map(activeTools.value)

    if (payload.phase === 'start') {
      updated.set(payload.toolId, {
        toolName: payload.toolName,
        toolId: payload.toolId,
        phase: payload.phase,
        timestamp: new Date(),
        description: payload.description,
        toolInput: payload.toolInput,
        agentType: payload.agentType,
        nestingLevel: payload.nestingLevel,
      })
    } else if (payload.phase === 'end') {
      updated.set(payload.toolId, {
        toolName: payload.toolName,
        toolId: payload.toolId,
        phase: payload.phase,
        timestamp: new Date(),
        description: payload.description,
        toolInput: payload.toolInput,
        agentType: payload.agentType,
        nestingLevel: payload.nestingLevel,
        endTime: Date.now(),
      })
    } else {
      // progress phase: update in place
      const existing = updated.get(payload.toolId)
      if (existing) {
        updated.set(payload.toolId, {
          ...existing,
          phase: payload.phase as ChatToolActivity['phase'],
          description: payload.description,
        })
      }
    }

    activeTools.value = updated
  }

  function onAgentThinking(data: { payload: AgentThinkingPayload }) {
    if (data.payload.phase === 'start') {
      isThinking.value = true
      thinkingContent.value = ''
      const startTime = Date.now()
      thinkingStartTime.value = startTime
      thinkingVerb.value = getThinkingVerb(0)
    } else if (data.payload.phase === 'delta' && data.payload.content) {
      thinkingContent.value += data.payload.content
    } else if (data.payload.phase === 'end') {
      // Keep thinking state for 3 seconds so user can see final thinking duration
      setTimeout(() => {
        isThinking.value = false
        thinkingStartTime.value = null
      }, 3000)
    }
  }

  function onTokenUsage(data: { payload: TokenUsagePayload }) {
    tokenUsage.value = {
      inputTokens: data.payload.inputTokens,
      outputTokens: data.payload.outputTokens,
      cacheReadTokens: data.payload.cachedInputTokens,
    }
  }

  function onTodoUpdate(data: { payload: TodoUpdatePayload }) {
    todoItems.value = data.payload.todos
    todoStats.value = {
      completed: data.payload.completed,
      inProgress: data.payload.inProgress,
      pending: data.payload.pending,
      total: data.payload.total,
    }
  }

  // ---- Socket.IO event binding ----
  let socketCleanup: (() => void) | null = null

  function bindSocketEvents() {
    // Clean up previous bindings
    if (socketCleanup) {
      socketCleanup()
      socketCleanup = null
    }

    const socket = connection.socket.value
    if (!socket) return

    socket.on('agent_status', onAgentStatus)
    socket.on('tool_activity', onToolActivity)
    socket.on('agent_thinking', onAgentThinking)
    socket.on('token_usage', onTokenUsage)
    socket.on('todo_update', onTodoUpdate)
    socket.on('subagent_started', onSubAgentStarted)
    socket.on('subagent_completed', onSubAgentCompleted)
    socket.on('job_update', onJobUpdate)

    socketCleanup = () => {
      socket.off('agent_status', onAgentStatus)
      socket.off('tool_activity', onToolActivity)
      socket.off('agent_thinking', onAgentThinking)
      socket.off('token_usage', onTokenUsage)
      socket.off('todo_update', onTodoUpdate)
      socket.off('subagent_started', onSubAgentStarted)
      socket.off('subagent_completed', onSubAgentCompleted)
      socket.off('job_update', onJobUpdate)
    }
  }

  // Watch for socket changes and rebind
  watch(() => connection.socket.value, () => {
    bindSocketEvents()
  }, { immediate: true })

  // ---- SSE push channel for subagent lifecycle events ----
  // In SSE mode, connection.socket is null (Socket.IO is not initialized).
  // The push channel stays open across turns, so background task completions
  // that fire after the per-turn stream closes are still delivered here.
  let sseAbortController: AbortController | null = null

  function connectSsePushChannel() {
    // Socket mode: handled by socket event bindings above
    if (connection.socket.value) return
    if (!connection.serverUrl || !connection.sessionId.value || !connection.sessionReady.value) return

    // Abort any existing SSE connection
    if (sseAbortController) {
      sseAbortController.abort()
    }

    const controller = new AbortController()
    sseAbortController = controller
    let retryCount = 0
    const MAX_RETRIES = 10

    const connect = async () => {
      let buffer = ''
      try {
        const response = await fetch(
          `${connection.serverUrl}/api/v1/sessions/${connection.sessionId.value}/events`,
          { signal: controller.signal, headers: { Accept: 'text/event-stream' } },
        )
        if (response.status === 404) {
          // Session is created lazily on first chat message. Retry until it exists.
          if (!controller.signal.aborted && retryCount < MAX_RETRIES) {
            retryCount++
            setTimeout(connect, 3000)
          }
          return
        }
        if (!response.ok || !response.body) return

        retryCount = 0
        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const chunk of parts) {
            const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
            if (!dataLine) continue
            try {
              const envelope = JSON.parse(dataLine.slice(5).trim())
              const event = envelope.event ?? envelope
              if (event.type === 'subagent_started') onSubAgentStarted(event)
              if (event.type === 'subagent_completed') onSubAgentCompleted(event)
              if (event.type === 'job_update') onJobUpdate(event)
            } catch { /* ignore parse errors */ }
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError' && retryCount < MAX_RETRIES) {
          retryCount++
          const delay = Math.min(3000 * Math.pow(2, retryCount - 1), 30000)
          setTimeout(connect, delay)
        }
      }
    }

    connect()
  }

  // Watch SSE dependencies and reconnect when they change
  watch(
    [
      () => connection.socket.value,
      () => connection.serverUrl,
      () => connection.sessionId.value,
      () => connection.sessionReady.value,
    ],
    () => {
      connectSsePushChannel()
    },
    { immediate: true },
  )

  // ---- Fetch persisted jobs on session ready (for re-entry) ----
  watch(
    [() => connection.serverUrl, () => connection.sessionId.value, () => connection.sessionReady.value],
    ([serverUrl, sessionId, sessionReady]) => {
      if (!serverUrl || !sessionId || !sessionReady) return

      fetch(`${serverUrl}/api/v1/jobs?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(result => {
          if (result.data?.length) {
            const fetched: JobInfo[] = result.data.map((j: any) => ({
              id: j.id,
              sessionId: j.sessionId,
              messageId: j.messageId,
              type: j.type,
              name: j.name,
              status: j.status,
              startedAt: j.startedAt,
              completedAt: j.completedAt,
              progress: j.progress,
              metadata: j.metadata,
              resultFiles: j.resultFiles,
              errorMessage: j.errorMessage,
            }))
            // Merge with existing state to avoid overwriting real-time updates
            const existing = new Map(jobs.value.map(j => [j.id, j]))
            fetched.forEach(j => {
              if (!existing.has(j.id)) {
                existing.set(j.id, j)
              }
            })
            jobs.value = Array.from(existing.values())
          }
        })
        .catch(() => {}) // silent fail
    },
    { immediate: true },
  )

  // ---- Thinking verb update based on duration thresholds (30s, 90s) ----
  let thinkingVerbTimer: ReturnType<typeof setInterval> | null = null

  watch(
    [isThinking, thinkingStartTime],
    ([thinking, startTime]) => {
      if (thinkingVerbTimer) {
        clearInterval(thinkingVerbTimer)
        thinkingVerbTimer = null
      }

      if (!thinking || !startTime) return

      thinkingVerbTimer = setInterval(() => {
        const elapsed = Date.now() - startTime
        const seconds = elapsed / 1000

        if (seconds >= 90) {
          if (!THINKING_VERBS.deep.includes(thinkingVerb.value)) {
            thinkingVerb.value = getThinkingVerb(elapsed)
          }
        } else if (seconds >= 30) {
          if (
            !THINKING_VERBS.moderate.includes(thinkingVerb.value) &&
            !THINKING_VERBS.deep.includes(thinkingVerb.value)
          ) {
            thinkingVerb.value = getThinkingVerb(elapsed)
          }
        }
      }, 5000)
    },
    { immediate: true },
  )

  // ---- Cleanup ended tools after 2 seconds ----
  const toolCleanupTimer = setInterval(() => {
    const prev = activeTools.value
    const updated = new Map(prev)
    const now = Date.now()
    let changed = false

    for (const [toolId, tool] of updated.entries()) {
      if (tool.phase === 'end' && tool.endTime && (now - tool.endTime > 2000)) {
        updated.delete(toolId)
        changed = true
      }
    }

    if (changed) {
      activeTools.value = updated
    }
  }, 1000)

  // ---- Cleanup on unmount ----
  onUnmounted(() => {
    // Socket event cleanup
    if (socketCleanup) {
      socketCleanup()
      socketCleanup = null
    }

    // SSE cleanup
    if (sseAbortController) {
      sseAbortController.abort()
      sseAbortController = null
    }

    // Thinking verb timer
    if (thinkingVerbTimer) {
      clearInterval(thinkingVerbTimer)
      thinkingVerbTimer = null
    }

    // Tool cleanup timer
    clearInterval(toolCleanupTimer)

    // Pending timeouts
    pendingTimeouts.forEach(clearTimeout)
    pendingTimeouts.clear()
  })

  return {
    agentStatus,
    isProcessing,
    activeTools,
    isThinking,
    thinkingContent,
    thinkingStartTime,
    thinkingVerb,
    tokenUsage,
    todoItems,
    todoStats,
    activeSubAgents,
    jobs,
    currentActivity,
  }
}

export default useAgentStatus
