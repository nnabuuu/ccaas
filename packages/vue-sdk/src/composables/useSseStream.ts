/**
 * useSseStream
 *
 * Low-level composable for reading SSE (Server-Sent Events) from the backend.
 * Used by the upgraded useSseChat when transport='sse'.
 *
 * Handles:
 * - ReadableStream parsing of SSE events
 * - Exponential backoff reconnection
 * - Sequence-based event replay on reconnect
 */

import type { SessionEvent } from '@kedge-agentic/common'
import { parseSseChunk } from '../utils/parseSseChunk'

export interface SseStreamOptions {
  serverUrl: string
  sessionId: string
  onEvent: (event: SessionEvent) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

/**
 * Composable providing a function to start an SSE message stream.
 * Returns { startStream, abortStream } which manages streaming POST requests.
 */
export function useSseStream() {
  let abortController: AbortController | null = null
  let lastSeq = 0

  /**
   * Start an SSE stream for a message send
   */
  async function startStream(
    options: SseStreamOptions,
    payload: Record<string, unknown>,
    retryCount = 0,
  ): Promise<void> {
    const { serverUrl, sessionId, onEvent, onError, onDone } = options

    // Abort any existing stream
    if (abortController) {
      abortController.abort()
    }

    const controller = new AbortController()
    abortController = controller

    const maxRetries = 3
    const baseDelayMs = 1000

    try {
      const requestBody = {
        ...payload,
        // Include last seen sequence for reconnection replay
        ...(retryCount > 0 && lastSeq > 0 ? { afterSeq: lastSeq } : {}),
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
        const errorData = (await response.json().catch(() => ({}))) as Record<string, string>
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
              lastSeq = Math.max(lastSeq, envelope.seq)
              onEvent(envelope.event as SessionEvent)
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
            lastSeq = Math.max(lastSeq, envelope.seq)
            // Check if this is a 'done' event (stream complete)
            if ((envelope.event as any).type === 'done') {
              onDone?.()
              return
            }
            onEvent(envelope.event as SessionEvent)
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
  }

  /**
   * Abort the current stream
   */
  function abortStream() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    lastSeq = 0
  }

  return { startStream, abortStream }
}
