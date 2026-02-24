/**
 * Per-lessonId session persistence.
 * Maps lessonId → sessionId so users can resume previous lesson sessions.
 *
 * useAgentConnection stores its sessionId under 'ccaas_session_live-lesson' in localStorage.
 * We manage a separate map so each lesson can track its own session independently.
 */

const SESSIONS_KEY = 'live-lesson-sessions'
const SDK_SESSION_KEY = 'ccaas_session_live-lesson'

/** Returns the saved sessionId for a given lessonId, or null if none. */
export function getSavedSession(lessonId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    return map[lessonId] || null
  } catch {
    return null
  }
}

/** Saves sessionId for a lessonId into the per-lesson map. */
export function saveSession(lessonId: string, sessionId: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    map[lessonId] = sessionId
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

/**
 * Writes the saved session for a lessonId into the SDK's localStorage key so
 * useAgentConnection will reuse it. If no saved session exists, clears the SDK
 * key so the SDK doesn't accidentally reuse a stale session from a previous lesson.
 */
export function restoreSessionToSDK(lessonId: string): void {
  const sessionId = getSavedSession(lessonId)
  if (sessionId) {
    localStorage.setItem(SDK_SESSION_KEY, sessionId)
  } else {
    localStorage.removeItem(SDK_SESSION_KEY)
  }
}

/**
 * Clears the saved session for a lessonId and also clears the SDK key,
 * forcing useAgentConnection to create a new session.
 */
export function clearSession(lessonId: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    delete map[lessonId]
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(map))
    localStorage.removeItem(SDK_SESSION_KEY)
  } catch {
    // ignore
  }
}
