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
} from '@ccaas/common'

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
  const [tokenUsage, setTokenUsage] = useState<UseAgentStatusReturn['tokenUsage']>(null)
  const [todoItems, setTodoItems] = useState<EventTodoItem[]>([])
  const [todoStats, setTodoStats] = useState<TodoStats>({ completed: 0, inProgress: 0, pending: 0, total: 0 })

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
  const handleComplete = useCallback(() => {
    setActiveTools(new Map())
    setIsThinking(false)
    setThinkingContent('')
    setTodoItems([])
    setTodoStats({ completed: 0, inProgress: 0, pending: 0, total: 0 })
  }, [])

  useEffect(() => {
    const socket = connection.socket
    if (!socket) return

    const onAgentStatus = (data: AgentStatusEvent) => {
      setAgentStatus(data.status as AgentStatusValue)
      if (data.status === 'complete' || data.status === 'error') {
        handleComplete()
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
        } else {
          updated.delete(payload.toolId)
        }
        return updated
      })
    }

    const onAgentThinking = (data: { payload: AgentThinkingPayload }) => {
      if (data.payload.phase === 'start') {
        setIsThinking(true)
        setThinkingContent('')
      } else if (data.payload.phase === 'delta' && data.payload.content) {
        setThinkingContent(prev => prev + data.payload.content)
      } else if (data.payload.phase === 'end') {
        setIsThinking(false)
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

    return () => {
      socket.off('agent_status', onAgentStatus)
      socket.off('tool_activity', onToolActivity)
      socket.off('agent_thinking', onAgentThinking)
      socket.off('token_usage', onTokenUsage)
      socket.off('todo_update', onTodoUpdate)
    }
  }, [connection.socket, handleComplete])

  return {
    agentStatus,
    isProcessing,
    activeTools,
    isThinking,
    thinkingContent,
    tokenUsage,
    todoItems,
    todoStats,
    currentActivity,
  }
}
