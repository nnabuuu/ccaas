/**
 * Shared helpers for exercise guide "seen" persistence.
 *
 * Each guide button pulses until the student opens it once.
 * The "seen" flag is stored in localStorage per device.
 */

/** Read whether a guide has been seen. Returns false if localStorage is unavailable. */
export function readGuideSeen(key: string): boolean {
  try {
    return !!localStorage.getItem(key)
  } catch {
    return false
  }
}

/** Mark a guide as seen. No-op if localStorage is unavailable. */
export function markGuideSeen(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch { /* quota or security error — ignore */ }
}

/** Build storage key for AI chat persistence. Includes sessionCode + taskId for isolation. */
export function aiChatStorageKey(sessionCode: string | null | undefined, taskId: number): string {
  return `ai-chat-${sessionCode || 'local'}-${taskId}`
}

/** Safely read chat messages from localStorage. Returns [] on any error. */
export function readChatMessages<T>(storageKey: string): T[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved)
    return []
  } catch {
    return []
  }
}

/** Safely write chat messages to localStorage. No-op on error. */
export function writeChatMessages<T>(storageKey: string, msgs: T[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(msgs))
  } catch { /* quota — ignore */ }
}
