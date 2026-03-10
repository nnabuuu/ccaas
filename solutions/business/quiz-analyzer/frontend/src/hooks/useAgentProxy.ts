/**
 * useAgentProxy — SSE streaming hook that goes through quiz-analyzer backend
 * instead of connecting directly to CCAAS Core.
 *
 * Replaces: useAgentConnection + useAgentChat + useAgentStatus (react-sdk)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { APP_CONFIG } from '../lib/constants'
import { parseSseStream } from '../utils/sseParser'
import type {
  AgentStatusEvent,
  ToolActivityEvent,
} from '../utils/sseParser'

// Compatible with react-sdk Message shape so consumers don't need changes
export interface ProxyMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  contentBlocks?: ContentBlock[]
  isStreaming?: boolean
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolBlock {
  type: 'tool'
  tool: ToolActivity
}

export type ContentBlock = TextBlock | ToolBlock

export interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  timestamp: Date
  duration?: number
  success?: boolean
  description?: string
  toolInput?: unknown
  toolOutput?: unknown
  toolError?: string
  agentType?: string
  nestingLevel?: number
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
}

export interface OutputUpdate {
  field: string
  value: unknown
  page?: string
}

export interface UseAgentProxyOptions {
  /** Which backend endpoint to call */
  endpoint: 'analyze' | 'teach' | 'student' | 'kp-match'
  /** Callback for output_update events */
  onOutputUpdate?: (update: OutputUpdate) => void
  /** Callback for token_usage events */
  onTokenUsage?: (usage: TokenUsage) => void
  /** Callback for tool_activity events */
  onToolActivity?: (activity: ToolActivity) => void
  /** Callback for thinking events */
  onThinkingUpdate?: (phase: 'start' | 'delta' | 'end', content?: string) => void
}

export interface UseAgentProxyReturn {
  messages: ProxyMessage[]
  isProcessing: boolean
  sessionId: string
  activeTools: Map<string, ToolActivity>
  isThinking: boolean
  thinkingContent: string
  tokenUsage: TokenUsage | null
  sendMessage: (content: string, context?: Record<string, unknown>) => void
  clearConversation: () => void
  cancelProcessing: () => void
  /** Whether the connection is considered "ready" (always true for HTTP-based proxy) */
  connected: boolean
  error: string | null
}

function generateId(): string {
  return `msg_${crypto.randomUUID()}`
}

function generateSessionId(endpoint: string): string {
  const prefixes: Record<string, string> = {
    'analyze': 'qae',
    'teach': 'tch',
    'student': 'stu',
    'kp-match': 'kpm',
  }
  const prefix = prefixes[endpoint] ?? 'ses'
  return `${prefix}-${crypto.randomUUID()}`
}

export function useAgentProxy(options: UseAgentProxyOptions): UseAgentProxyReturn {
  const { endpoint, onOutputUpdate, onTokenUsage, onToolActivity, onThinkingUpdate } = options

  const [messages, setMessages] = useState<ProxyMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionId, setSessionId] = useState(() => generateSessionId(endpoint))
  const [activeTools, setActiveTools] = useState<Map<string, ToolActivity>>(new Map())
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingContent, setThinkingContent] = useState('')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const streamContentRef = useRef('')
  const contentBlocksRef = useRef<ContentBlock[]>([])

  // Stable refs for callbacks
  const onOutputUpdateRef = useRef(onOutputUpdate)
  onOutputUpdateRef.current = onOutputUpdate
  const onTokenUsageRef = useRef(onTokenUsage)
  onTokenUsageRef.current = onTokenUsage
  const onToolActivityRef = useRef(onToolActivity)
  onToolActivityRef.current = onToolActivity
  const onThinkingUpdateRef = useRef(onThinkingUpdate)
  onThinkingUpdateRef.current = onThinkingUpdate

  const sendMessage = useCallback(async (content: string, context?: Record<string, unknown>) => {
    if (isProcessing) return

    setError(null)
    setIsProcessing(true)
    streamContentRef.current = ''
    contentBlocksRef.current = []

    // Add user message
    const userMsg: ProxyMessage = { id: generateId(), role: 'user', content }
    setMessages(prev => [...prev, userMsg])

    // Add assistant placeholder
    const assistantMsg: ProxyMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      contentBlocks: [],
      isStreaming: true,
    }
    setMessages(prev => [...prev, assistantMsg])

    // Reset tool & thinking state
    setActiveTools(new Map())
    setIsThinking(false)
    setThinkingContent('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const body: Record<string, unknown> = {
        message: content,
        sessionId,
      }
      if (context) body.context = context

      const response = await fetch(
        `${APP_CONFIG.QUIZ_BACKEND_URL}/api/v1/agent/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        const errText = await response.text().catch(() => `HTTP ${response.status}`)
        throw new Error(errText)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()

      await parseSseStream(reader, {
        onTextDelta: (delta) => {
          // Track content blocks (same pattern as react-sdk)
          const blocks = contentBlocksRef.current
          const lastBlock = blocks[blocks.length - 1]
          if (lastBlock && lastBlock.type === 'text') {
            lastBlock.text += delta
          } else {
            blocks.push({ type: 'text', text: delta })
          }

          streamContentRef.current += delta
          const accumulated = streamContentRef.current
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant') {
              last.content = accumulated
              last.contentBlocks = [...blocks]
            }
            return updated
          })
        },

        onOutputUpdate: (update) => {
          onOutputUpdateRef.current?.(update)
        },

        onAgentStatus: (statusEvent: AgentStatusEvent) => {
          if (statusEvent.status === 'complete' || statusEvent.status === 'error' || statusEvent.status === 'cancelled') {
            setIsProcessing(false)
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.isStreaming) {
                last.isStreaming = false
              }
              return updated
            })
            if (statusEvent.status === 'error') {
              setError(statusEvent.error || 'Unknown error')
            }
          }
        },

        onToolActivity: (event: ToolActivityEvent) => {
          const activity: ToolActivity = {
            toolName: event.payload.toolName,
            toolId: event.payload.toolId,
            phase: event.payload.phase,
            timestamp: new Date(),
            duration: event.payload.duration,
            success: event.payload.success,
            description: event.payload.description,
            toolInput: event.payload.toolInput,
            toolOutput: event.payload.toolOutput,
            toolError: event.payload.toolError,
            agentType: event.payload.agentType,
            nestingLevel: event.payload.nestingLevel,
          }

          // Track tool blocks in contentBlocks (same as react-sdk)
          const blocks = contentBlocksRef.current
          if (activity.phase === 'start') {
            blocks.push({ type: 'tool', tool: activity })
          } else if (activity.phase === 'end') {
            for (let i = blocks.length - 1; i >= 0; i--) {
              const block = blocks[i]
              if (block && block.type === 'tool' && block.tool.toolId === activity.toolId) {
                blocks[i] = { type: 'tool', tool: activity }
                break
              }
            }
          }

          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant') {
              last.contentBlocks = [...blocks]
            }
            return updated
          })

          setActiveTools(prev => {
            const next = new Map(prev)
            if (activity.phase === 'end') {
              next.delete(activity.toolId)
            } else {
              next.set(activity.toolId, activity)
            }
            return next
          })
          onToolActivityRef.current?.(activity)
        },

        onThinking: (phase, content) => {
          if (phase === 'start') {
            setIsThinking(true)
            setThinkingContent('')
          } else if (phase === 'delta' && content) {
            setThinkingContent(prev => prev + content)
          } else if (phase === 'end') {
            setIsThinking(false)
          }
          onThinkingUpdateRef.current?.(phase, content)
        },

        onTokenUsage: (usage) => {
          setTokenUsage(usage)
          onTokenUsageRef.current?.(usage)
        },

        onDone: () => {
          setIsProcessing(false)
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.isStreaming) {
              last.isStreaming = false
            }
            return updated
          })
        },

        onError: (err) => {
          setIsProcessing(false)
          setError(err.message)
        },
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setIsProcessing(false)
      setError((err as Error).message)
      // Remove the empty assistant placeholder on error
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          return updated.slice(0, -1)
        }
        return updated
      })
    }
  }, [endpoint, sessionId, isProcessing])

  const clearConversation = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setSessionId(generateSessionId(endpoint))
    setActiveTools(new Map())
    setIsThinking(false)
    setThinkingContent('')
    setTokenUsage(null)
    setIsProcessing(false)
    setError(null)
    streamContentRef.current = ''
  }, [endpoint])

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort()
    setIsProcessing(false)
    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.isStreaming) {
        last.isStreaming = false
      }
      return updated
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return {
    messages,
    isProcessing,
    sessionId,
    activeTools,
    isThinking,
    thinkingContent,
    tokenUsage,
    sendMessage,
    clearConversation,
    cancelProcessing,
    connected: true, // HTTP-based, always "connected"
    error,
  }
}
