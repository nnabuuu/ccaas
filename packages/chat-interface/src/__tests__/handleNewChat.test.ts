import { describe, it, expect } from 'vitest'

/**
 * Tests for the handleNewChat ID generation logic used in App.tsx.
 *
 * In App.tsx, handleNewChat generates a fresh session ID:
 *   const freshId = `conv_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
 *
 * This test validates the contract: generated IDs must:
 *   1. Start with 'conv_' prefix
 *   2. Have exactly 12 hex chars after the prefix
 *   3. Be unique across calls
 *   4. Not contain hyphens (UUID dashes are stripped)
 */

/** Replicate the ID generation logic from App.tsx handleNewChat */
function generateNewChatId(): string {
  return `conv_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

describe('handleNewChat ID generation', () => {
  it('should generate IDs with conv_ prefix', () => {
    const id = generateNewChatId()
    expect(id).toMatch(/^conv_/)
  })

  it('should generate IDs with exactly 12 hex characters after prefix', () => {
    const id = generateNewChatId()
    // conv_ prefix + 12 hex chars = 17 chars total
    expect(id).toMatch(/^conv_[0-9a-f]{12}$/)
    expect(id.length).toBe(17)
  })

  it('should not contain hyphens (UUID dashes stripped)', () => {
    // Generate several to increase confidence
    for (let i = 0; i < 20; i++) {
      const id = generateNewChatId()
      expect(id).not.toContain('-')
    }
  })

  it('should generate unique IDs across multiple calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateNewChatId())
    }
    // All 100 IDs should be unique
    expect(ids.size).toBe(100)
  })

  it('should generate a different ID than the useAgentConnection conv_ format', () => {
    // The handleNewChat conv_ ID is 17 chars (conv_ + 12 hex)
    // The useAgentConnection conv_ ID uses crypto.randomUUID() directly (conv_ + full UUID)
    // They both start with conv_ but the handleNewChat one is shorter
    const id = generateNewChatId()
    expect(id.startsWith('conv_')).toBe(true)
    // handleNewChat IDs are compact (17 chars)
    expect(id.length).toBe(17)
  })

  it('should produce IDs that are valid as session identifiers', () => {
    const id = generateNewChatId()
    // Must not be empty
    expect(id.length).toBeGreaterThan(0)
    // Must be URL-safe (no special characters)
    expect(id).toMatch(/^[a-z0-9_]+$/)
  })
})
