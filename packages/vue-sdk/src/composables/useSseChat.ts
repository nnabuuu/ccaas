/**
 * useSseChat Composable
 *
 * Vue composable for HTTP Streaming (SSE) transport.
 * Alternative to useAgentChat which requires Socket.IO.
 *
 * Uses POST /api/v1/sessions/:id/messages → text/event-stream
 * No WebSocket connection required.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useSseChat } from '@kedge-agentic/vue-sdk'
 *
 * const {
 *   messages,
 *   isProcessing,
 *   sendMessage,
 *   cancelProcessing,
 * } = useSseChat({
 *   serverUrl: 'http://localhost:3001',
 *   sessionId: 'my-session',
 *   tenantId: 'my-tenant',
 * })
 * </script>
 * ```
 */

import { ref, readonly } from 'vue'
import type { Ref, DeepReadonly } from 'vue'

export interface SseChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  timestamp: Date
}

export interface UseSseChatOptions {
  serverUrl: string
  sessionId: string
  tenantId: string
  mcpServers?: Record<string, { command: string; args: string[]; env?: Record<string, string> }>
  enabledSkillSlugs?: string[]
  skillPath?: string
  appendSystemPrompt?: string
  onEvent?: (eventType: string, data: Record<string, unknown>) => void
}

export interface UseSseChatReturn {
  messages: DeepReadonly<Ref<SseChatMessage[]>>
  isProcessing: DeepReadonly<Ref<boolean>>
  currentStreamContent: DeepReadonly<Ref<string>>
  sendMessage: (content: string, options?: { context?: Record<string, unknown> }) => Promise<void>
  cancelProcessing: () => void
  clearMessages: () => void
}

/**
 * Generate a simple random ID
 */
function generateId(): string {
  return Math.random().toString(36).slice(2)
}

/**
 * SSE envelope from StreamRegistryService
 */
interface SseEnvelope {
  seq: number
  sessionId: string
  timestamp: string
  event: { type: string; [key: string]: unknown }
}

/**
 * Parse SSE data lines into event envelopes
 */
function parseSseChunk(text: string): SseEnvelope[] {
  const result: SseEnvelope[] = []
  const events = text.split('\n\n')
  for (const event of events) {
    const lines = event.split('\n')
    let data = ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        data = line.slice(6)
      }
    }
    if (data) {
      try {
        result.push(JSON.parse(data))
      } catch {
        // ignore malformed
      }
    }
  }
  return result
}

export function useSseChat(options: UseSseChatOptions): UseSseChatReturn {
  const messages = ref<SseChatMessage[]>([])
  const isProcessing = ref(false)
  const currentStreamContent = ref('')

  let abortController: AbortController | null = null
  let lastSeq = 0

  const clearMessages = () => {
    messages.value = []
    currentStreamContent.value = ''
  }

  const cancelProcessing = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    // Send REST cancel
    fetch(`${options.serverUrl}/api/v1/sessions/${options.sessionId}/cancel`, {
      method: 'POST',
    }).catch(() => {/* ignore */})
    isProcessing.value = false
  }

  const sendMessage = async (
    content: string,
    sendOptions?: { context?: Record<string, unknown> },
  ): Promise<void> => {
    if (isProcessing.value) return

    // Add user message
    const userMsg: SseChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    messages.value = [...messages.value, userMsg]

    // Add assistant placeholder
    const assistantMsg: SseChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date(),
    }
    messages.value = [...messages.value, assistantMsg]
    currentStreamContent.value = ''
    isProcessing.value = true

    const controller = new AbortController()
    abortController = controller

    try {
      const payload: Record<string, unknown> = {
        message: content,
        tenantId: options.tenantId,
      }
      if (options.mcpServers) payload.mcpServers = options.mcpServers
      if (options.enabledSkillSlugs?.length) payload.enabledSkillSlugs = options.enabledSkillSlugs
      if (options.skillPath) payload.skillPath = options.skillPath
      if (options.appendSystemPrompt) payload.appendSystemPrompt = options.appendSystemPrompt
      if (sendOptions?.context) payload.context = sendOptions.context
      if (lastSeq > 0) payload.afterSeq = lastSeq

      const response = await fetch(
        `${options.serverUrl}/api/v1/sessions/${options.sessionId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      )

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamText = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.trim()) continue
          const envelopes = parseSseChunk(part + '\n\n')
          for (const envelope of envelopes) {
            lastSeq = Math.max(lastSeq, envelope.seq)
            const event = envelope.event
            options.onEvent?.(event.type, event as Record<string, unknown>)

            if (event.type === 'text_delta') {
              streamText += (event.delta as string) || ''
              currentStreamContent.value = streamText
              // Update last assistant message
              const idx = messages.value.length - 1
              if (idx >= 0 && messages.value[idx].role === 'assistant') {
                messages.value = messages.value.map((m, i) =>
                  i === idx ? { ...m, content: streamText } : m,
                )
              }
            } else if (event.type === 'agent_status') {
              const status = event.status as string
              if (status === 'complete' || status === 'error' || status === 'cancelled') {
                // Finalize
                const idx = messages.value.length - 1
                if (idx >= 0 && messages.value[idx].role === 'assistant') {
                  messages.value = messages.value.map((m, i) =>
                    i === idx ? { ...m, content: streamText, isStreaming: false } : m,
                  )
                }
                isProcessing.value = false
                currentStreamContent.value = ''
              }
            } else if (event.type === 'done') {
              // SSE stream closed
              const idx = messages.value.length - 1
              if (idx >= 0 && messages.value[idx].role === 'assistant') {
                messages.value = messages.value.map((m, i) =>
                  i === idx ? { ...m, isStreaming: false } : m,
                )
              }
              isProcessing.value = false
              currentStreamContent.value = ''
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      const idx = messages.value.length - 1
      if (idx >= 0 && messages.value[idx].role === 'assistant') {
        messages.value = messages.value.map((m, i) =>
          i === idx ? { ...m, isStreaming: false } : m,
        )
      }
      isProcessing.value = false
      currentStreamContent.value = ''
    } finally {
      abortController = null
    }
  }

  return {
    messages: readonly(messages),
    isProcessing: readonly(isProcessing),
    currentStreamContent: readonly(currentStreamContent),
    sendMessage,
    cancelProcessing,
    clearMessages,
  }
}
