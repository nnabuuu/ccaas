import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  UseAgentStatusOptions,
  UseAgentStatusReturn,
  AgentStatusValue,
  ToolActivity,
  TodoStats,
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
} from '@ccaas/common'
import { getThinkingVerb, THINKING_VERBS } from '../utils/thinkingVerbs'

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

  // Reset state when agent completes
  // Note: Don't clear todoItems and activeSubAgents immediately
  // They will be managed by individual event handlers and useTaskTracking
  const handleComplete = useCallback(() => {
    setActiveTools(new Map())
    setIsThinking(false)
    setThinkingContent('')
    setTodoStats({ completed: 0, inProgress: 0, pending: 0, total: 0 })
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

    const onSubAgentStarted = (data: SubAgentStartedEvent) => {
      const agent = data.payload
      setActiveSubAgents(prev => {
        // Check if already exists
        const exists = prev.some(a => a.subAgentId === agent.subAgentId)
        if (exists) return prev
        return [...prev, agent]
      })
    }

    const onSubAgentCompleted = (data: SubAgentCompletedEvent) => {
      const { subAgentId, status } = data.payload
      setActiveSubAgents(prev =>
        prev.map(agent =>
          agent.subAgentId === subAgentId
            ? { ...agent, status: status as 'completed' | 'failed' }
            : agent
        )
      )

      // Remove completed/failed agents after 3 seconds
      setTimeout(() => {
        setActiveSubAgents(prev =>
          prev.filter(agent => agent.subAgentId !== subAgentId)
        )
      }, 3000)
    }

    socket.on('agent_status', onAgentStatus)
    socket.on('tool_activity', onToolActivity)
    socket.on('agent_thinking', onAgentThinking)
    socket.on('token_usage', onTokenUsage)
    socket.on('todo_update', onTodoUpdate)
    socket.on('subagent_started', onSubAgentStarted)
    socket.on('subagent_completed', onSubAgentCompleted)

    return () => {
      socket.off('agent_status', onAgentStatus)
      socket.off('tool_activity', onToolActivity)
      socket.off('agent_thinking', onAgentThinking)
      socket.off('token_usage', onTokenUsage)
      socket.off('todo_update', onTodoUpdate)
      socket.off('subagent_started', onSubAgentStarted)
      socket.off('subagent_completed', onSubAgentCompleted)
    }
  }, [connection.socket, handleComplete])

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
    currentActivity,
  }
}
