/**
 * Generate a unique ID using crypto.randomUUID() or fallback to timestamp + random
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
