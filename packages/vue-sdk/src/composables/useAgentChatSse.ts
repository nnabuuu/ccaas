/**
 * useAgentChatSse
 *
 * Full-featured SSE-first chat composable with content blocks, tool activity,
 * output updates, token usage, message history, and cancellation.
 *
 * This is the Vue equivalent of react-sdk's useAgentChat hook.
 * The legacy useSseChat composable is preserved for backward compatibility.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAgentConnection, useAgentChatSse } from '@kedge-agentic/vue-sdk'
 *
 * const connection = useAgentConnection({
 *   serverUrl: 'http://localhost:3001',
 *   solutionId: 'my-solution',
 * })
 *
 * const chat = useAgentChatSse({
 *   connection,
 *   solutionId: 'my-solution',
 *   onOutputUpdate: (update) => outputSync.handleOutputUpdate(update),
 * })
 * </script>
 * ```
 */

import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { SessionEvent, TextDeltaEvent, AgentStatusEvent, OutputUpdateEvent, ToolActivityPayload } from '@kedge-agentic/common'
import type {
  UseAgentConnectionReturn,
  UseSseChatV2Options,
  UseSseChatV2Return,
  ChatSendMessageOptions,
} from '../types/connection'
import type { Message, ContentBlock, ChatToolActivity, OutputUpdate } from '../types/chat'
import { generateId } from '../utils/generateId'
import { parseOutputUpdate } from '../utils/parseOutputUpdate'
import { useSseStream } from './useSseStream'

export function useAgentChatSse(options: UseSseChatV2Options): UseSseChatV2Return {
  const {
    connection,
    solutionId,
    enabledSkills,
    onOutputUpdate,
    onTokenUsage,
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

  const messages = ref<Message[]>([])
  const isProcessing = ref(false)
  const currentStreamContent = ref('')
  const isLoadingHistory = ref(false)

  // Mutable state (closures work fine in Vue, no stale closure issue)
  let streamContent = ''
  let contentBlocks: ContentBlock[] = []
  let currentMessage: Message | null = null
  let latestTokenUsage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } | null = null

  // Stable references for callbacks
  let onOutputUpdateCb = onOutputUpdate
  let onTokenUsageCb = onTokenUsage

  // SSE stream support
  const { startStream, abortStream } = useSseStream()

  /**
   * Shared event dispatcher - handles events from both Socket.IO and SSE transports.
   */
  function dispatchEvent(eventType: string, data: SessionEvent) {
    if (eventType === 'text_delta') {
      const ev = data as TextDeltaEvent
      const last = contentBlocks[contentBlocks.length - 1]
      if (last && last.type === 'text') {
        last.text += ev.delta
      } else {
        contentBlocks.push({ type: 'text', text: ev.delta })
      }
      const content = contentBlocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('')
      streamContent = content
      currentStreamContent.value = content
      updateLastAssistantMessage(msg => {
        msg.content = content
        msg.contentBlocks = [...contentBlocks]
      })
    } else if (eventType === 'output_update') {
      const parsed = parseOutputUpdate(data as OutputUpdateEvent)
      if (!parsed) return
      const outputUpdate: OutputUpdate = {
        field: parsed.field,
        value: parsed.value,
        preview: parsed.preview || '',
        timestamp: Date.now(),
      }
      onOutputUpdateCb?.(outputUpdate)
      if (currentMessage) {
        updateLastAssistantMessage(msg => {
          const existing = msg.outputUpdates || []
          const idx = existing.findIndex(u => u.field === outputUpdate.field)
          if (idx >= 0) {
            msg.outputUpdates = existing.map((u, i) => i === idx ? { ...outputUpdate } : u)
          } else {
            msg.outputUpdates = [...existing, { ...outputUpdate }]
          }
        })
      }
    } else if (eventType === 'agent_status') {
      const ev = data as AgentStatusEvent
      if (ev.status === 'complete' || ev.status === 'error' || ev.status === 'cancelled') {
        isProcessing.value = false
        const finalContent = streamContent
        updateLastAssistantMessage(msg => {
          if (finalContent) msg.content = finalContent
          msg.isStreaming = false
          msg.tokenUsage = latestTokenUsage || undefined
        })
        latestTokenUsage = null
        currentStreamContent.value = ''
        streamContent = ''
        currentMessage = null
      }
    } else if (eventType === 'tool_activity') {
      const payload = (data as any).payload as ToolActivityPayload
      const toolActivity: ChatToolActivity = {
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
      if (payload.phase === 'start') {
        contentBlocks.push({ type: 'tool', tool: toolActivity })
      } else if (payload.phase === 'end') {
        for (let i = contentBlocks.length - 1; i >= 0; i--) {
          const block = contentBlocks[i]
          if (block && block.type === 'tool' && block.tool.toolId === toolActivity.toolId) {
            contentBlocks[i] = { type: 'tool', tool: toolActivity }
            break
          }
        }
      }
      updateLastAssistantMessage(msg => {
        msg.contentBlocks = [...contentBlocks]
      })
    } else if (eventType === 'token_usage') {
      const payload = (data as any).payload
      latestTokenUsage = {
        inputTokens: payload.inputTokens,
        outputTokens: payload.outputTokens,
        cacheReadTokens: payload.cacheReadTokens,
      }
      onTokenUsageCb?.(latestTokenUsage)
    }
  }

  /**
   * Helper to immutably update the last assistant message
   */
  function updateLastAssistantMessage(updater: (msg: Message) => void) {
    const updated = [...messages.value]
    const lastMsg = updated[updated.length - 1]
    if (lastMsg && lastMsg.role === 'assistant') {
      updater(lastMsg)
      messages.value = updated
    }
  }

  // Auto-load message history on connection
  watch(
    () => [connection.connected.value, connection.sessionId.value],
    async ([connected, sessionId]) => {
      if (!connected || !sessionId) return

      try {
        isLoadingHistory.value = true
        const response = await fetch(
          `${connection.serverUrl}/api/v1/sessions/${sessionId}/messages?limit=100`,
          { method: 'GET' },
        )
        if (!response.ok) {
          messages.value = []
          return
        }
        const data = await response.json()
        messages.value = data.messages || []
      } catch {
        messages.value = []
      } finally {
        isLoadingHistory.value = false
      }
    },
    { immediate: true },
  )

  // Register socket event handlers (Socket.IO transport only)
  let socketCleanup: (() => void) | null = null

  watch(
    () => connection.socket.value,
    (socket) => {
      // Clean up previous listeners
      socketCleanup?.()
      socketCleanup = null

      if (transport === 'sse' || !socket) return

      const onTextDelta = (data: TextDeltaEvent) => dispatchEvent('text_delta', data as SessionEvent)
      const onOutputUpdateEv = (event: OutputUpdateEvent) => dispatchEvent('output_update', event as SessionEvent)
      const onAgentStatus = (data: AgentStatusEvent) => dispatchEvent('agent_status', data as SessionEvent)
      const onToolActivity = (data: { payload: ToolActivityPayload }) => dispatchEvent('tool_activity', data as unknown as SessionEvent)
      const onTokenUsageEv = (data: { payload: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } }) =>
        dispatchEvent('token_usage', data as unknown as SessionEvent)

      socket.on('text_delta', onTextDelta)
      socket.on('output_update', onOutputUpdateEv)
      socket.on('agent_status', onAgentStatus)
      socket.on('tool_activity', onToolActivity)
      socket.on('token_usage', onTokenUsageEv)

      socketCleanup = () => {
        socket.off('text_delta', onTextDelta)
        socket.off('output_update', onOutputUpdateEv)
        socket.off('agent_status', onAgentStatus)
        socket.off('tool_activity', onToolActivity)
        socket.off('token_usage', onTokenUsageEv)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    socketCleanup?.()
  })

  // Send message
  async function sendMessage(content: string, sendOptions?: ChatSendMessageOptions) {
    if (transport === 'sse') {
      if (!connection.sessionId.value) return
    } else {
      if (!connection.connected.value || !connection.clientId.value || isProcessing.value) return
    }

    // Mark session ready
    connection.markSessionReady()

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      createdAt: new Date().toISOString(),
    }
    messages.value = [...messages.value, userMessage]

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
    currentMessage = assistantMessage
    messages.value = [...messages.value, assistantMessage]

    // Reset stream state
    currentStreamContent.value = ''
    streamContent = ''
    contentBlocks = []
    isProcessing.value = true

    // Build payload
    const payload: Record<string, unknown> = {
      message: content,
      solutionId,
    }
    if (sessionTemplate) payload.templateName = sessionTemplate
    if (enabledSkills?.length) payload.enabledSkills = enabledSkills
    if (sendOptions?.attachments?.length) payload.attachments = sendOptions.attachments
    const messageContext = sendOptions?.context || context
    if (messageContext) payload.context = messageContext

    if (transport === 'sse') {
      await startStream(
        {
          serverUrl: connection.serverUrl,
          sessionId: connection.sessionId.value,
          onEvent: (event) => dispatchEvent(event.type, event),
          onError: () => {
            isProcessing.value = false
          },
          onDone: () => {
            isProcessing.value = false
          },
        },
        payload,
      )
    } else {
      // Socket.IO transport
      try {
        const chatPayload = {
          ...payload,
          clientId: connection.clientId.value,
        }
        const response = await fetch(
          `${connection.serverUrl}/api/v1/sessions/${connection.sessionId.value}/completion`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatPayload),
          },
        )
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch {
        isProcessing.value = false
      }
    }
  }

  function clearMessages() {
    messages.value = []
    currentStreamContent.value = ''
    streamContent = ''
    contentBlocks = []
    currentMessage = null
  }

  function cancelProcessing() {
    if (!isProcessing.value) return

    if (transport === 'sse') {
      abortStream()
      if (connection.sessionId.value) {
        fetch(`${connection.serverUrl}/api/v1/sessions/${connection.sessionId.value}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => { /* ignore */ })
      }
      isProcessing.value = false
    } else {
      const socket = connection.socket.value
      if (!socket) return
      socket.emit('cancel', { sessionId: connection.sessionId.value })
    }
  }

  function clearConversation() {
    clearMessages()
    connection.startNewConversation()
  }

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
