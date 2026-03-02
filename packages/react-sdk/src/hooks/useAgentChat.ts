import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  UseAgentChatOptions,
  UseAgentChatReturn,
  SendMessageOptions,
  Message,
  ContentBlock,
  ToolActivity,
  OutputUpdate,
} from '../types'
import type {
  TextDeltaEvent,
  AgentStatusEvent,
  OutputUpdateEvent,
  ToolActivityPayload,
  FrontendEvent,
} from '@kedge-agentic/common'
import { parseOutputUpdate } from '../utils/parseOutputUpdate'
import { ApiError } from '../utils/apiClient'
import type { ResolvedTemplateParams } from '../utils/templateResolver'
import { generateId } from '../utils/generateId'
import { useSseStream } from './useSseStream'

/**
 * Core chat hook: manages messages, text streaming, sendMessage via REST,
 * output_update dispatch, and tool activity inline cards.
 *
 * Extracted from useLessonPlanSession and useProblemSession.
 */
export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const {
    connection,
    tenantId,
    enabledSkillSlugs,
    onOutputUpdate,
    onTokenUsage,
    onToolActivity,
    onThinkingUpdate,
    context,
    sessionTemplate,
    transport = 'sse',
  } = options

  if (transport === 'socket') {
    console.warn(
      '[ccaas] transport: "socket" is deprecated. ' +
      'The /api/v1/sessions/:id/completion endpoint returns 410 Gone. ' +
      'Use transport: "sse" (now the default).',
    )
  }

  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Refs for mutable state in socket handlers (avoids stale closures)
  const streamContentRef = useRef('')
  const contentBlocksRef = useRef<ContentBlock[]>([])
  const currentMessageRef = useRef<Message | null>(null)
  const latestTokenUsageRef = useRef<import('@kedge-agentic/common').TokenUsage | null>(null)

  // Stable ref for onOutputUpdate callback
  const onOutputUpdateRef = useRef(onOutputUpdate)
  onOutputUpdateRef.current = onOutputUpdate

  const onTokenUsageRef = useRef(onTokenUsage)
  onTokenUsageRef.current = onTokenUsage

  const onToolActivityRef = useRef(onToolActivity)
  onToolActivityRef.current = onToolActivity

  const onThinkingUpdateRef = useRef(onThinkingUpdate)
  onThinkingUpdateRef.current = onThinkingUpdate

  // SSE stream support
  const { startStream, abortStream } = useSseStream()

  /**
   * Shared event dispatcher - handles events from both Socket.IO and SSE transports.
   * Extracted to avoid duplication between socket handler and SSE handler.
   */
  const dispatchEvent = useCallback((eventType: string, data: FrontendEvent) => {
    if (eventType === 'text_delta') {
      const ev = data as TextDeltaEvent
      const blocks = contentBlocksRef.current
      const last = blocks[blocks.length - 1]
      if (last && last.type === 'text') {
        last.text += ev.delta
      } else {
        blocks.push({ type: 'text', text: ev.delta })
      }
      const content = blocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('')
      streamContentRef.current = content
      setCurrentStreamContent(content)
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = content
          lastMsg.contentBlocks = [...blocks]
        }
        return updated
      })
    } else if (eventType === 'output_update') {
      const parsed = parseOutputUpdate(data as OutputUpdateEvent)
      if (!parsed) return
      onOutputUpdateRef.current?.(parsed)
      if (currentMessageRef.current) {
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            const existing = lastMsg.outputUpdates || []
            const idx = existing.findIndex(u => u.field === parsed.field)
            if (idx >= 0) {
              lastMsg.outputUpdates = existing.map((u, i) => i === idx ? { ...parsed } : u)
            } else {
              lastMsg.outputUpdates = [...existing, { ...parsed }]
            }
          }
          return updated
        })
      }
    } else if (eventType === 'agent_status') {
      const ev = data as AgentStatusEvent
      if (ev.status === 'complete' || ev.status === 'error' || ev.status === 'cancelled') {
        setIsProcessing(false)
        const finalContent = streamContentRef.current
        if (currentMessageRef.current && finalContent) {
          setMessages(prev => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = finalContent
              lastMsg.isStreaming = false
              lastMsg.tokenUsage = latestTokenUsageRef.current || undefined
            }
            return updated
          })
        } else {
          setMessages(prev => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg?.isStreaming) {
              lastMsg.isStreaming = false
              lastMsg.tokenUsage = latestTokenUsageRef.current || undefined
            }
            return updated
          })
        }
        latestTokenUsageRef.current = null
        setCurrentStreamContent('')
        streamContentRef.current = ''
        currentMessageRef.current = null
      }
    } else if (eventType === 'tool_activity') {
      const payload = (data as any).payload as ToolActivityPayload
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
      const blocks = contentBlocksRef.current
      if (payload.phase === 'start') {
        blocks.push({ type: 'tool', tool: toolActivity })
      } else if (payload.phase === 'end') {
        for (let i = blocks.length - 1; i >= 0; i--) {
          const block = blocks[i]
          if (block && block.type === 'tool' && block.tool.toolId === toolActivity.toolId) {
            blocks[i] = { type: 'tool', tool: toolActivity }
            break
          }
        }
      }
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.contentBlocks = [...blocks]
        }
        return updated
      })
      onToolActivityRef.current?.(toolActivity)
    } else if (eventType === 'agent_thinking') {
      const payload = (data as any).payload as { phase: 'start' | 'delta' | 'end'; content?: string }
      onThinkingUpdateRef.current?.(payload.phase, payload.content)
    } else if (eventType === 'token_usage') {
      const payload = (data as any).payload
      latestTokenUsageRef.current = {
        inputTokens: payload.inputTokens,
        outputTokens: payload.outputTokens,
        cacheReadTokens: payload.cacheReadTokens,
      }
      onTokenUsageRef.current?.(latestTokenUsageRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Register socket event handlers (Socket.IO transport only)
  useEffect(() => {
    if (transport === 'sse') return // SSE mode: skip socket handlers

    const socket = connection.socket
    if (!socket) return

    // Delegate to shared event dispatcher
    const onTextDelta = (data: TextDeltaEvent) => dispatchEvent('text_delta', data as FrontendEvent)
    const onOutputUpdate = (event: OutputUpdateEvent) => dispatchEvent('output_update', event as FrontendEvent)
    const onAgentStatus = (data: AgentStatusEvent) => dispatchEvent('agent_status', data as FrontendEvent)
    const onToolActivity = (data: { payload: ToolActivityPayload }) => dispatchEvent('tool_activity', data as unknown as FrontendEvent)
    const onTokenUsage = (data: { payload: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } }) =>
      dispatchEvent('token_usage', data as unknown as FrontendEvent)

    // Also handle tool_event for write_output (problem-explainer pattern)
    const onToolEvent = (data: { toolName: string; input?: Record<string, unknown>; output?: unknown }) => {
      if (!data.toolName.endsWith('write_output')) return
      if (!onOutputUpdateRef.current) return

      const input = data.input
      if (input && input.field) {
        onOutputUpdateRef.current({
          field: input.field as string,
          value: input.value,
          preview: (input.preview as string) || '',
          timestamp: Date.now(),
        })
        return
      }

      // Fallback: parse from output
      try {
        const output = typeof data.output === 'string' ? JSON.parse(data.output) : data.output
        const source = (output as Record<string, unknown>)?.data as Record<string, unknown> | undefined
        if (source?.field) {
          onOutputUpdateRef.current({
            field: source.field as string,
            value: source.value,
            preview: (source.preview as string) || '',
            timestamp: Date.now(),
          })
        }
      } catch {
        // ignore parse error
      }
    }

    socket.on('text_delta', onTextDelta)
    socket.on('output_update', onOutputUpdate)
    socket.on('tool_event', onToolEvent)
    socket.on('agent_status', onAgentStatus)
    socket.on('tool_activity', onToolActivity)
    socket.on('token_usage', onTokenUsage)

    return () => {
      socket.off('text_delta', onTextDelta)
      socket.off('output_update', onOutputUpdate)
      socket.off('tool_event', onToolEvent)
      socket.off('agent_status', onAgentStatus)
      socket.off('tool_activity', onToolActivity)
      socket.off('token_usage', onTokenUsage)
    }
  }, [connection.socket, transport, dispatchEvent])

  // Auto-load message history on connection
  useEffect(() => {
    if (!connection.connected || !connection.sessionId) return

    const loadMessageHistory = async () => {
      try {
        setIsLoadingHistory(true)
        const response = await fetch(
          `${connection.serverUrl}/api/v1/sessions/${connection.sessionId}/messages?limit=100`,
          { method: 'GET' },
        )
        if (!response.ok) {
          setMessages([])
          return
        }
        const data = await response.json()
        const history = data.messages || []
        setMessages(history)
      } catch {
        // Graceful fallback to empty history
        setMessages([])
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadMessageHistory()
  }, [connection.connected, connection.sessionId, connection.serverUrl])

  // Wait for reconnection (used by sendMessage retry)
  const waitForReconnection = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const socket = connection.socket
      if (!socket) {
        reject(new Error('No socket instance'))
        return
      }

      if (socket.connected && connection.clientId) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Reconnection timeout (10s)'))
      }, 10000)

      const onClientId = () => {
        cleanup()
        resolve()
      }

      const cleanup = () => {
        clearTimeout(timeout)
        socket.off('client_id', onClientId)
      }

      socket.on('client_id', onClientId)
    })
  }, [connection.socket, connection.clientId])

  // Send message via REST API (Socket.IO) or SSE streaming
  const sendMessage = useCallback(async (content: string, sendOptions?: SendMessageOptions) => {
    // SSE mode: only requires sessionId and serverUrl (no socket/clientId needed).
    // No isProcessing guard — the backend message queue handles concurrency.
    if (transport === 'sse') {
      if (!connection.sessionId) return
    } else {
      if (!connection.connected || !connection.clientId || isProcessing) return
    }

    // Notify connection that session is about to be created (POST is imminent).
    // useAgentStatus SSE effect waits for this before opening GET /events.
    connection.markSessionReady()

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])

    // Create assistant placeholder
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      contentBlocks: [],
      outputUpdates: [],
      timestamp: new Date(),
      createdAt: new Date().toISOString(),
      isStreaming: true,
    }
    currentMessageRef.current = assistantMessage
    setMessages(prev => [...prev, assistantMessage])

    // Reset stream state
    setCurrentStreamContent('')
    streamContentRef.current = ''
    contentBlocksRef.current = []
    setIsProcessing(true)

    // ========================================================================
    // Resolve params (template resolution happens server-side)
    // ========================================================================
    const resolvedParams: ResolvedTemplateParams = {}

    if (enabledSkillSlugs && enabledSkillSlugs.length > 0) {
      resolvedParams.enabledSkillSlugs = enabledSkillSlugs
    }

    // Build shared payload (without clientId for SSE)
    const buildPayload = (): Record<string, unknown> => {
      const payload: Record<string, unknown> = {
        message: content,
        tenantId,
      }

      // Always send sessionTemplate to backend for server-side resolution
      if (sessionTemplate) payload.templateName = sessionTemplate

      if (resolvedParams.enabledSkillSlugs?.length) payload.enabledSkillSlugs = resolvedParams.enabledSkillSlugs
      if (resolvedParams.appendSystemPrompt) payload.appendSystemPrompt = resolvedParams.appendSystemPrompt
      if (sendOptions?.attachments?.length) payload.attachments = sendOptions.attachments

      const messageContext = sendOptions?.context || context
      if (messageContext) payload.context = messageContext

      return payload
    }

    if (transport === 'sse') {
      // SSE transport: stream events from response body
      await startStream(
        {
          serverUrl: connection.serverUrl,
          sessionId: connection.sessionId!,
          onEvent: (event) => dispatchEvent(event.type, event),
          onError: (err) => {
            setIsProcessing(false)
            throw err
          },
          onDone: () => {
            // SSE stream closed - ensure processing state is reset
            setIsProcessing(false)
          },
        },
        buildPayload(),
      )
    } else {
      // Socket.IO transport: POST to /completion, events arrive via socket
      const attemptSend = async (retryCount = 0): Promise<void> => {
        const chatPayload: Record<string, unknown> = {
          ...buildPayload(),
          clientId: connection.clientId, // Required for socket.io transport
        }

        const response = await fetch(`${connection.serverUrl}/api/v1/sessions/${connection.sessionId}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatPayload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as Record<string, string>

          // Retry on WebSocket disconnection
          if (response.status === 400 && errorData.message?.includes('not connected') && retryCount < 2) {
            await waitForReconnection()
            return attemptSend(retryCount + 1)
          }

          throw new ApiError(response.status, errorData.message || response.statusText)
        }
      }

      try {
        await attemptSend()
      } catch (err) {
        setIsProcessing(false)
        throw err
      }
    }
  }, [connection.connected, connection.clientId, connection.sessionId, connection.serverUrl, isProcessing, tenantId, enabledSkillSlugs, context, sessionTemplate, waitForReconnection, transport, startStream, dispatchEvent])

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentStreamContent('')
    streamContentRef.current = ''
    contentBlocksRef.current = []
    currentMessageRef.current = null
  }, [])

  const cancelProcessing = useCallback(() => {
    if (!isProcessing) return

    if (transport === 'sse') {
      // SSE mode: abort the stream and call REST cancel endpoint
      abortStream()
      if (connection.sessionId) {
        fetch(`${connection.serverUrl}/api/v1/sessions/${connection.sessionId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {
          // Ignore cancel errors
        })
      }
      setIsProcessing(false)
    } else {
      const socket = connection.socket
      if (!socket) return
      socket.emit('cancel', { sessionId: connection.sessionId })
    }
  }, [connection.socket, connection.sessionId, connection.serverUrl, isProcessing, transport, abortStream])

  const clearConversation = useCallback(() => {
    // Clear local message state
    clearMessages()
    // Start new conversation (clears storage, generates new sessionId, reconnects)
    connection.startNewConversation()
  }, [clearMessages, connection.startNewConversation])

  return {
    messages,
    isProcessing,
    isLoadingHistory,
    currentStreamContent,
    sendMessage,
    clearMessages,
    clearConversation,
    cancelProcessing,
  }
}
