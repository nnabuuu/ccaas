import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type {
  UseAgentStatusOptions,
  UseAgentStatusReturn,
  AgentStatusValue,
  ToolActivity,
  TodoStats,
  JobInfo,
} from '../types'
import type {
  AgentStatusEvent,
  ToolActivityPayload,
  AgentThinkingPayload,
  TokenUsagePayload,
  TodoUpdatePayload,
  EventTodoItem,
  ActiveSubAgent,
  SubAgentStartedEvent,
  SubAgentCompletedEvent,
  JobUpdateEvent,
} from '@kedge-agentic/common'
import { getThinkingVerb, THINKING_VERBS } from '../utils/thinkingVerbs'
import { buildAuthHeaders } from '../utils/authHeaders'

/**
 * Tracks agent status, tool activity, thinking state, and token usage.
 *
 * Listens to socket events: agent_status, tool_activity, agent_thinking, token_usage.
 * Extracted from both solution session hooks.
 */
export function useAgentStatus(options: UseAgentStatusOptions): UseAgentStatusReturn {
  const { connection } = options

  const [agentStatus, setAgentStatus] = useState<AgentStatusValue>('idle')
  const [activeTools, setActiveTools] = useState<Map<string, ToolActivity>>(new Map())
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingContent, setThinkingContent] = useState('')
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null)
  const [thinkingVerb, setThinkingVerb] = useState<string>('思考')
  const [tokenUsage, setTokenUsage] = useState<UseAgentStatusReturn['tokenUsage']>(null)
  const [todoItems, setTodoItems] = useState<EventTodoItem[]>([])
  const [todoStats, setTodoStats] = useState<TodoStats>({ completed: 0, inProgress: 0, pending: 0, total: 0 })
  const [activeSubAgents, setActiveSubAgents] = useState<ActiveSubAgent[]>([])
  const [jobs, setJobs] = useState<JobInfo[]>([])

  const isProcessing = agentStatus === 'thinking' || agentStatus === 'running' ||
    agentStatus === 'exploring' || agentStatus === 'executing'

  // Computed: prioritized activity string
  const currentActivity = useMemo(() => {
    const activeTodo = todoItems.find(t => t.status === 'in_progress')
    if (activeTodo?.activeForm) return activeTodo.activeForm

    const firstTool = activeTools.values().next().value
    if (firstTool?.description) return firstTool.description

    if (isThinking) return 'Thinking…'
    return ''
  }, [todoItems, activeTools, isThinking])

  // Track pending setTimeout IDs so we can cancel them on unmount
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      pendingTimeoutsRef.current.forEach(clearTimeout)
      pendingTimeoutsRef.current.clear()
    }
  }, [])

  // Reset state when agent completes
  // Note: Don't clear todoItems and activeSubAgents immediately
  // They will be managed by individual event handlers and useTaskTracking
  const handleComplete = useCallback(() => {
    setActiveTools(new Map())
    setIsThinking(false)
    setThinkingContent('')
    setTodoStats({ completed: 0, inProgress: 0, pending: 0, total: 0 })
  }, [])

  // Shared subagent event handlers — used by both socket and SSE effects
  const onSubAgentStarted = useCallback((data: SubAgentStartedEvent) => {
    const agent = data.payload
    setActiveSubAgents(prev => {
      const exists = prev.some(a => a.subAgentId === agent.subAgentId)
      if (exists) return prev
      return [...prev, agent]
    })
  }, [])

  const onSubAgentCompleted = useCallback((data: SubAgentCompletedEvent) => {
    const { subAgentId, status } = data.payload
    setActiveSubAgents(prev =>
      prev.map(agent =>
        agent.subAgentId === subAgentId
          ? { ...agent, status: status as 'completed' | 'failed' }
          : agent
      )
    )
    // Remove completed/failed agents after 3 seconds.
    // Track the timeout so it can be cancelled if the component unmounts first.
    const timeoutId = setTimeout(() => {
      setActiveSubAgents(prev =>
        prev.filter(agent => agent.subAgentId !== subAgentId)
      )
      pendingTimeoutsRef.current.delete(timeoutId)
    }, 3000)
    pendingTimeoutsRef.current.add(timeoutId)
  }, [])

  // Job update handler — shared by socket and SSE effects
  const onJobUpdate = useCallback((data: JobUpdateEvent) => {
    setJobs(prev => {
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
      const idx = prev.findIndex(j => j.id === data.jobId)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = job
        return updated
      }
      return [...prev, job]
    })
  }, [])

  useEffect(() => {
    const socket = connection.socket
    if (!socket) return

    const onAgentStatus = (data: AgentStatusEvent) => {
      const { status, context } = data
      setAgentStatus(status as AgentStatusValue)

      if (status === 'complete') {
        // CRITICAL: Process backend snapshot before clearing
        // This ensures useTaskTracking can capture completed tasks into history
        const snapshot = context?.activeSubAgents
        if (snapshot && snapshot.length > 0) {
          // Update activeSubAgents with final snapshot from backend
          setActiveSubAgents(prev => {
            // Merge snapshot with current state, deduplicate by subAgentId
            const merged = [...prev]
            snapshot.forEach((sa: ActiveSubAgent) => {
              const existing = merged.findIndex(a => a.subAgentId === sa.subAgentId)
              if (existing >= 0) {
                // Update existing with final status
                merged[existing] = { ...sa, status: sa.status || 'completed' }
              } else {
                // Add new task from snapshot
                merged.push({ ...sa, status: sa.status || 'completed' })
              }
            })
            return merged
          })

          // Give React time to render and useTaskTracking to capture
          // This prevents the race condition where tasks are cleared before history capture
          setTimeout(() => {
            handleComplete()
            // Clear after useTaskTracking has captured to history
            setActiveSubAgents([])
            setTodoItems([])
          }, 100)
        } else {
          // No active tasks, clear immediately
          handleComplete()
          setActiveSubAgents([])
          setTodoItems([])
        }
      } else if (status === 'error') {
        // On error, clear immediately
        handleComplete()
        setActiveSubAgents([])
        setTodoItems([])
      }
    }

    const onToolActivity = (data: { payload: ToolActivityPayload }) => {
      const payload = data.payload

      setActiveTools(prev => {
        const updated = new Map(prev)
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
          // Record end time instead of immediately deleting
          updated.set(payload.toolId, {
            toolName: payload.toolName,
            toolId: payload.toolId,
            phase: payload.phase,
            timestamp: new Date(),
            description: payload.description,
            toolInput: payload.toolInput,
            agentType: payload.agentType,
            nestingLevel: payload.nestingLevel,
            endTime: Date.now(),  // Record when tool ended
          })
        } else {
          // For other phases (progress), update in place
          const existing = updated.get(payload.toolId)
          if (existing) {
            updated.set(payload.toolId, {
              ...existing,
              phase: payload.phase,
              description: payload.description,
            })
          }
        }
        return updated
      })
    }

    const onAgentThinking = (data: { payload: AgentThinkingPayload }) => {
      if (data.payload.phase === 'start') {
        setIsThinking(true)
        setThinkingContent('')

        // 记录开始时间和随机选择初始动词
        const startTime = Date.now()
        setThinkingStartTime(startTime)
        setThinkingVerb(getThinkingVerb(0))  // 初始阶段动词

      } else if (data.payload.phase === 'delta' && data.payload.content) {
        setThinkingContent(prev => prev + data.payload.content)

      } else if (data.payload.phase === 'end') {
        // 保留 thinking 状态 3 秒，让用户看到最终的思考时长
        setTimeout(() => {
          setIsThinking(false)
          setThinkingStartTime(null)
        }, 3000)
      }
    }

    const onTokenUsage = (data: { payload: TokenUsagePayload }) => {
      setTokenUsage({
        inputTokens: data.payload.inputTokens,
        outputTokens: data.payload.outputTokens,
        cacheReadTokens: data.payload.cachedInputTokens,
      })
    }

    const onTodoUpdate = (data: { payload: TodoUpdatePayload }) => {
      setTodoItems(data.payload.todos)
      setTodoStats({
        completed: data.payload.completed,
        inProgress: data.payload.inProgress,
        pending: data.payload.pending,
        total: data.payload.total,
      })
    }

    socket.on('agent_status', onAgentStatus)
    socket.on('tool_activity', onToolActivity)
    socket.on('agent_thinking', onAgentThinking)
    socket.on('token_usage', onTokenUsage)
    socket.on('todo_update', onTodoUpdate)
    socket.on('subagent_started', onSubAgentStarted)
    socket.on('subagent_completed', onSubAgentCompleted)
    socket.on('job_update', onJobUpdate)

    return () => {
      socket.off('agent_status', onAgentStatus)
      socket.off('tool_activity', onToolActivity)
      socket.off('agent_thinking', onAgentThinking)
      socket.off('token_usage', onTokenUsage)
      socket.off('todo_update', onTodoUpdate)
      socket.off('subagent_started', onSubAgentStarted)
      socket.off('subagent_completed', onSubAgentCompleted)
      socket.off('job_update', onJobUpdate)
    }
  }, [connection.socket, handleComplete, onSubAgentStarted, onSubAgentCompleted, onJobUpdate])

  // SSE mode — subscribe to GET /events push channel for subagent lifecycle events.
  // In SSE mode, connection.socket is null (Socket.IO is not initialized).
  // The push channel stays open across turns, so background task completions
  // that fire after the per-turn stream closes are still delivered here.
  useEffect(() => {
    if (connection.socket) return  // Socket mode: handled by the effect above
    if (!connection.serverUrl || !connection.sessionId || !connection.sessionReady) return

    const controller = new AbortController()
    let retryCount = 0
    const MAX_RETRIES = 10

    const connect = async () => {
      let buffer = ''  // Reset buffer on each connection attempt to avoid stale partial frames
      try {
        const response = await fetch(
          `${connection.serverUrl}/api/v1/sessions/${connection.sessionId}/events`,
          { signal: controller.signal, headers: { Accept: 'text/event-stream', ...buildAuthHeaders(connection.apiKey) } }
        )
        if (response.status === 404) {
          // Session is created lazily on first chat message.
          // Retry until the session exists or component unmounts.
          if (!controller.signal.aborted && retryCount < MAX_RETRIES) {
            retryCount++
            setTimeout(connect, 3000)
          }
          return
        }
        if (!response.ok || !response.body) return

        retryCount = 0  // Reset retry count on successful connection
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
          // Exponential backoff: 3s, 6s, 12s … capped at 30s
          const delay = Math.min(3000 * Math.pow(2, retryCount - 1), 30000)
          setTimeout(connect, delay)
        }
      }
    }

    connect()
    return () => controller.abort()
  }, [connection.socket, connection.serverUrl, connection.sessionId, connection.sessionReady, onSubAgentStarted, onSubAgentCompleted, onJobUpdate])

  // Fetch persisted jobs on session ready (for re-entry)
  useEffect(() => {
    if (!connection.serverUrl || !connection.sessionId || !connection.sessionReady) return

    fetch(`${connection.serverUrl}/api/v1/jobs?sessionId=${connection.sessionId}`, {
      headers: { ...buildAuthHeaders(connection.apiKey) },
    })
      .then(res => res.json())
      .then(result => {
        if (result.data?.length) {
          setJobs(result.data.map((j: any) => ({
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
          })))
        }
      })
      .catch(() => {}) // silent fail
  }, [connection.serverUrl, connection.sessionId, connection.sessionReady])

  // Update thinking verb when duration crosses phase thresholds (30s, 90s)
  // This implements the "smart verb selection based on duration" feature
  useEffect(() => {
    if (!isThinking || !thinkingStartTime) return

    const checkThreshold = () => {
      const elapsed = Date.now() - thinkingStartTime
      const seconds = elapsed / 1000

      // Only update when crossing thresholds to avoid unnecessary state changes
      if (seconds >= 90) {
        setThinkingVerb(prev => {
          // Don't change if already using a deep verb
          if (THINKING_VERBS.deep.includes(prev)) return prev
          return getThinkingVerb(elapsed)
        })
      } else if (seconds >= 30) {
        setThinkingVerb(prev => {
          // Don't change if already using moderate or deep verb
          if (THINKING_VERBS.moderate.includes(prev) || THINKING_VERBS.deep.includes(prev)) return prev
          return getThinkingVerb(elapsed)
        })
      }
    }

    // Check every 5 seconds
    const timer = setInterval(checkThreshold, 5000)
    return () => clearInterval(timer)
  }, [isThinking, thinkingStartTime])

  // Cleanup ended tools after 2 seconds
  // This allows users to see tool activity descriptions before they disappear
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      setActiveTools(prev => {
        const updated = new Map(prev)
        const now = Date.now()

        for (const [toolId, tool] of updated.entries()) {
          // Remove tools that ended more than 2 seconds ago
          if (tool.phase === 'end' && tool.endTime && (now - tool.endTime > 2000)) {
            updated.delete(toolId)
          }
        }

        // Only update state if we actually removed something
        return updated.size === prev.size ? prev : updated
      })
    }, 1000)  // Check every second

    return () => clearInterval(cleanupTimer)
  }, [])

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
