/**
 * SSE session helpers
 *
 * Small utilities shared between SessionsController and MessageWorkerService.
 */

/**
 * Builds the synthetic clientId used for SSE-only sessions.
 * No WebSocket clientId is available, so we use a deterministic prefix.
 */
export function makeSseClientId(sessionId: string): string {
  return `sse:${sessionId}`;
}
