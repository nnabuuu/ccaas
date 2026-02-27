/**
 * Per-lessonId session persistence.
 * Maps lessonId → sessionId so users can resume previous lesson sessions.
 *
 * Session ID is passed explicitly via URL query param (?session=xxx) and the
 * SDK's `sessionId` option — no localStorage bridging needed. This store is
 * only used by CourseSelectionPage to check whether a "continue" button should
 * be shown.
 */

const SESSIONS_KEY = 'live-lesson-sessions'

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
 * Clears the saved session for a lessonId.
 */
export function clearSession(lessonId: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    delete map[lessonId]
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}
