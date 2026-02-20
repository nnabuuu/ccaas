/**
 * useSseStream
 *
 * Low-level hook for reading SSE (Server-Sent Events) from the backend.
 * Used by useAgentChat when transport='sse'.
 *
 * Handles:
 * - ReadableStream parsing of SSE events
 * - Exponential backoff reconnection
 * - Sequence-based event replay on reconnect
 */

import { useRef, useCallback } from 'react'
import type { FrontendEvent } from '@kedge-agentic/common'

/**
 * SSE envelope wrapping a frontend event (matches StreamRegistryService format)
 */
interface SseEnvelope {
  seq: number
  sessionId: string
  timestamp: string
  event: FrontendEvent
}

export interface SseStreamOptions {
  serverUrl: string
  sessionId: string
  onEvent: (event: FrontendEvent) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

/**
 * Parse SSE text format into data payloads
 * SSE format: "id: N\ndata: {...}\n\n"
 */
function parseSseChunk(chunk: string): SseEnvelope[] {
  const envelopes: SseEnvelope[] = []
  // Split by double newline (SSE event separator)
  const events = chunk.split('\n\n')
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
        const envelope = JSON.parse(data) as SseEnvelope
        envelopes.push(envelope)
      } catch {
        // ignore malformed
      }
    }
  }
  return envelopes
}

/**
 * Hook providing a function to start an SSE message stream
 * Returns { startStream } which initiates a streaming POST request
 */
export function useSseStream() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSeqRef = useRef<number>(0)

  /**
   * Start an SSE stream for a message send
   */
  const startStream = useCallback(async (
    options: SseStreamOptions,
    payload: Record<string, unknown>,
    retryCount = 0,
  ): Promise<void> => {
    const { serverUrl, sessionId, onEvent, onError, onDone } = options

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    const maxRetries = 3
    const baseDelayMs = 1000

    try {
      const requestBody = {
        ...payload,
        // Include last seen sequence for reconnection replay
        ...(retryCount > 0 && lastSeqRef.current > 0
          ? { afterSeq: lastSeqRef.current }
          : {}),
      }

      const response = await fetch(
        `${serverUrl}/api/v1/sessions/${sessionId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, string>
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body for SSE stream')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Process any remaining buffer
          if (buffer) {
            const envelopes = parseSseChunk(buffer)
            for (const envelope of envelopes) {
              lastSeqRef.current = Math.max(lastSeqRef.current, envelope.seq)
              onEvent(envelope.event)
            }
          }
          onDone?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events (separated by \n\n)
        const parts = buffer.split('\n\n')
        // Keep the last incomplete part in the buffer
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.trim()) continue
          const envelopes = parseSseChunk(part + '\n\n')
          for (const envelope of envelopes) {
            lastSeqRef.current = Math.max(lastSeqRef.current, envelope.seq)
            // Check if this is a 'done' event (stream complete)
            if ((envelope.event as any).type === 'done') {
              onDone?.()
              return
            }
            onEvent(envelope.event)
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Intentional abort - not an error
        return
      }

      const error = err instanceof Error ? err : new Error(String(err))

      // Retry with exponential backoff
      if (retryCount < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        return startStream(options, payload, retryCount + 1)
      }

      onError?.(error)
    }
  }, [])

  /**
   * Abort the current stream
   */
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    lastSeqRef.current = 0
  }, [])

  return { startStream, abortStream }
}
