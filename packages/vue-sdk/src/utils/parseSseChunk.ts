/**
 * SSE envelope wrapping a frontend event (matches StreamRegistryService format)
 */
export interface SseEnvelope {
  seq: number
  sessionId: string
  timestamp: string
  event: { type: string; [key: string]: unknown }
}

/**
 * Parse SSE text format into data payloads.
 * SSE format: "id: N\ndata: {...}\n\n"
 */
export function parseSseChunk(chunk: string): SseEnvelope[] {
  const envelopes: SseEnvelope[] = []
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
