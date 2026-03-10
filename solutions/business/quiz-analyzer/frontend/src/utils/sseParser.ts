/**
 * SSE stream parser for quiz-analyzer proxy endpoints.
 *
 * Parses the same SSE envelope format as CCAAS Core:
 *   id: {seq}
 *   data: {"seq":1,"sessionId":"...","timestamp":"...","event":{...}}
 */

export interface SseEnvelope {
  seq: number
  sessionId: string
  timestamp: string
  event: SseEvent
}

export type SseEvent =
  | TextDeltaEvent
  | OutputUpdateEvent
  | AgentStatusEvent
  | ToolActivityEvent
  | AgentThinkingEvent
  | TokenUsageEvent
  | DoneEvent

export interface TextDeltaEvent {
  type: 'text_delta'
  delta: string
}

export interface OutputUpdateEvent {
  type: 'output_update'
  payload: {
    data?: { field: string; value: unknown; page?: string; success?: boolean }
    field?: string
    value?: unknown
  }
}

export interface AgentStatusEvent {
  type: 'agent_status'
  status: 'complete' | 'error' | 'cancelled'
  error?: string
}

export interface ToolActivityEvent {
  type: 'tool_activity'
  payload: {
    toolName: string
    toolId: string
    phase: 'start' | 'progress' | 'end'
    duration?: number
    success?: boolean
    description?: string
    toolInput?: unknown
    toolOutput?: unknown
    toolError?: string
    agentType?: string
    nestingLevel?: number
  }
  turnId?: string
}

export interface AgentThinkingEvent {
  type: 'agent_thinking'
  payload: {
    phase: 'start' | 'delta' | 'end'
    content?: string
  }
}

export interface TokenUsageEvent {
  type: 'token_usage'
  payload: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
  }
}

export interface DoneEvent {
  type: 'done'
}

export interface SseHandlers {
  onTextDelta: (delta: string) => void
  onOutputUpdate: (update: { field: string; value: unknown; page?: string }) => void
  onAgentStatus: (status: AgentStatusEvent) => void
  onToolActivity: (activity: ToolActivityEvent) => void
  onThinking: (phase: 'start' | 'delta' | 'end', content?: string) => void
  onTokenUsage: (usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number }) => void
  onDone: () => void
  onError: (error: Error) => void
}

/**
 * Parse a raw SSE text chunk into envelopes.
 * SSE format: "id: N\ndata: {...}\n\n"
 */
function parseSseChunk(chunk: string): SseEnvelope[] {
  const envelopes: SseEnvelope[] = []
  const events = chunk.split('\n\n')
  for (const event of events) {
    const lines = event.split('\n')
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6))
      }
    }
    if (dataLines.length > 0) {
      const data = dataLines.join('\n')
      try {
        envelopes.push(JSON.parse(data) as SseEnvelope)
      } catch {
        // ignore malformed
      }
    }
  }
  return envelopes
}

/**
 * Extract output_update field/value from the various payload formats
 * (mirrors react-sdk parseOutputUpdate logic).
 */
function extractOutputUpdate(
  event: OutputUpdateEvent,
): { field: string; value: unknown; page?: string } | null {
  const { payload } = event

  // Format 1: payload.data.field
  const dataField = payload.data
  if (dataField && typeof dataField === 'object' && !Array.isArray(dataField) && dataField.field) {
    if (dataField.success === false) return null
    return { field: dataField.field, value: dataField.value, page: dataField.page }
  }

  // Format 2: payload.field
  if (payload.field) {
    return { field: payload.field as string, value: payload.value }
  }

  return null
}

/**
 * Read an SSE ReadableStream and dispatch events to handlers.
 */
export async function parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: Partial<SseHandlers>,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process remaining buffer
        if (buffer) {
          processChunk(buffer + '\n\n', handlers)
        }
        handlers.onDone?.()
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE events (separated by \n\n)
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        if (!part.trim()) continue
        processChunk(part + '\n\n', handlers)
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)))
  }
}

function processChunk(chunk: string, handlers: Partial<SseHandlers>): void {
  const envelopes = parseSseChunk(chunk)
  for (const envelope of envelopes) {
    dispatchEvent(envelope.event, handlers)
  }
}

function dispatchEvent(event: SseEvent, handlers: Partial<SseHandlers>): void {
  switch (event.type) {
    case 'text_delta':
      handlers.onTextDelta?.(event.delta)
      break

    case 'output_update': {
      const update = extractOutputUpdate(event)
      if (update) handlers.onOutputUpdate?.(update)
      break
    }

    case 'agent_status':
      handlers.onAgentStatus?.(event)
      break

    case 'tool_activity':
      handlers.onToolActivity?.(event)
      break

    case 'agent_thinking':
      handlers.onThinking?.(event.payload.phase, event.payload.content)
      break

    case 'token_usage':
      handlers.onTokenUsage?.(event.payload)
      break

    case 'done':
      handlers.onDone?.()
      break
  }
}
