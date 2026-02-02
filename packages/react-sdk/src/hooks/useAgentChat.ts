import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  UseAgentChatOptions,
  UseAgentChatReturn,
  SendMessageOptions,
  Message,
  ContentBlock,
  ToolActivity,
  OutputUpdate,
  SolutionConfig,
} from '../types'
import type {
  TextDeltaEvent,
  AgentStatusEvent,
  OutputUpdateEvent,
  ToolActivityPayload,
} from '@ccaas/shared'
import { parseOutputUpdate } from '../utils/parseOutputUpdate'
import { ApiError } from '../utils/apiClient'

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

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
    mcpServers,
    skillPath,
    enabledSkillSlugs,
    onOutputUpdate,
    solutionConfigEndpoint,
  } = options

  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStreamContent, setCurrentStreamContent] = useState('')

  // Refs for mutable state in socket handlers (avoids stale closures)
  const streamContentRef = useRef('')
  const contentBlocksRef = useRef<ContentBlock[]>([])
  const currentMessageRef = useRef<Message | null>(null)

  // Solution config (loaded from endpoint if provided)
  const solutionConfigRef = useRef<SolutionConfig | null>(null)

  // Stable ref for onOutputUpdate callback
  const onOutputUpdateRef = useRef(onOutputUpdate)
  onOutputUpdateRef.current = onOutputUpdate

  // Load solution config on mount
  useEffect(() => {
    if (!solutionConfigEndpoint) return

    const loadConfig = async () => {
      try {
        const response = await fetch(solutionConfigEndpoint)
        if (response.ok) {
          solutionConfigRef.current = await response.json()
        }
      } catch {
        // Non-critical, continue without config
      }
    }
    loadConfig()
  }, [solutionConfigEndpoint])

  // Register socket event handlers
  useEffect(() => {
    const socket = connection.socket
    if (!socket) return

    // Text streaming
    const onTextDelta = (data: TextDeltaEvent) => {
      const blocks = contentBlocksRef.current
      const last = blocks[blocks.length - 1]
      if (last && last.type === 'text') {
        last.text += data.text
      } else {
        blocks.push({ type: 'text', text: data.text })
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
    }

    // Output updates
    const onOutputUpdate = (event: OutputUpdateEvent) => {
      const parsed = parseOutputUpdate(event)
      if (!parsed) return

      onOutputUpdateRef.current?.(parsed)

      // Attach to current assistant message
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
    }

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

    // Agent status (for finalizing messages)
    const onAgentStatus = (data: AgentStatusEvent) => {
      if (data.status === 'complete' || data.status === 'error' || data.status === 'cancelled') {
        setIsProcessing(false)

        // Finalize current message
        const finalContent = streamContentRef.current
        if (currentMessageRef.current && finalContent) {
          setMessages(prev => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = finalContent
              lastMsg.isStreaming = false
            }
            return updated
          })
        } else {
          // Mark streaming as false even without content
          setMessages(prev => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg?.isStreaming) {
              lastMsg.isStreaming = false
            }
            return updated
          })
        }

        // Reset stream state
        setCurrentStreamContent('')
        streamContentRef.current = ''
        currentMessageRef.current = null
      }
    }

    // Tool activity (inline tool cards)
    const onToolActivity = (data: { payload: ToolActivityPayload }) => {
      const payload = data.payload

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
    }

    socket.on('text_delta', onTextDelta)
    socket.on('output_update', onOutputUpdate)
    socket.on('tool_event', onToolEvent)
    socket.on('agent_status', onAgentStatus)
    socket.on('tool_activity', onToolActivity)

    return () => {
      socket.off('text_delta', onTextDelta)
      socket.off('output_update', onOutputUpdate)
      socket.off('tool_event', onToolEvent)
      socket.off('agent_status', onAgentStatus)
      socket.off('tool_activity', onToolActivity)
    }
  }, [connection.socket])

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

  // Send message via REST API
  const sendMessage = useCallback(async (content: string, sendOptions?: SendMessageOptions) => {
    if (!connection.connected || !connection.clientId || isProcessing) return

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

    const attemptSend = async (retryCount = 0): Promise<void> => {
      const chatPayload: Record<string, unknown> = {
        clientId: connection.clientId,
        message: content,
        tenantId,
      }

      // MCP servers from options or solution config
      const servers = mcpServers || solutionConfigRef.current?.mcpServers
      if (servers) {
        chatPayload.mcpServers = servers
      }

      // Skill path from options or solution config
      const path = skillPath !== undefined ? skillPath : solutionConfigRef.current?.skillPath
      if (path) {
        chatPayload.skillPath = path
      }

      if (enabledSkillSlugs && enabledSkillSlugs.length > 0) {
        chatPayload.enabledSkillSlugs = enabledSkillSlugs
      }

      if (sendOptions?.attachments && sendOptions.attachments.length > 0) {
        chatPayload.attachments = sendOptions.attachments
      }

      const response = await fetch(`/api/v1/sessions/${connection.sessionId}/completion`, {
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
  }, [connection.connected, connection.clientId, connection.sessionId, isProcessing, tenantId, mcpServers, skillPath, enabledSkillSlugs, waitForReconnection])

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentStreamContent('')
    streamContentRef.current = ''
    contentBlocksRef.current = []
    currentMessageRef.current = null
  }, [])

  const cancelProcessing = useCallback(() => {
    const socket = connection.socket
    if (!socket || !isProcessing) return
    socket.emit('cancel', { sessionId: connection.sessionId })
  }, [connection.socket, connection.sessionId, isProcessing])

  return {
    messages,
    isProcessing,
    currentStreamContent,
    sendMessage,
    clearMessages,
    cancelProcessing,
  }
}
