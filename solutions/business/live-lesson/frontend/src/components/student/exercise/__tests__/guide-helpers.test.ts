import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  readGuideSeen,
  markGuideSeen,
  aiChatStorageKey,
  readChatMessages,
  writeChatMessages,
} from '../guide-helpers'

/* ═══ localStorage mock ═══ */

let store: Record<string, string>
let origStorage: Storage

beforeEach(() => {
  store = {}
  origStorage = globalThis.localStorage
  const mock: Storage = {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v }),
    removeItem: vi.fn((k: string) => { delete store[k] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true, configurable: true })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: origStorage, writable: true, configurable: true })
})

/* ═══ readGuideSeen ═══ */

describe('readGuideSeen', () => {
  it('returns false when key does not exist', () => {
    expect(readGuideSeen('guide-seen-map')).toBe(false)
  })

  it('returns true when key exists', () => {
    store['guide-seen-map'] = '1'
    expect(readGuideSeen('guide-seen-map')).toBe(true)
  })

  it('returns true for any truthy value', () => {
    store['guide-seen-se'] = 'yes'
    expect(readGuideSeen('guide-seen-se')).toBe(true)
  })

  it('returns false when localStorage throws', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readGuideSeen('guide-seen-map')).toBe(false)
  })
})

/* ═══ markGuideSeen ═══ */

describe('markGuideSeen', () => {
  it('writes "1" to localStorage', () => {
    markGuideSeen('guide-seen-matrix')
    expect(store['guide-seen-matrix']).toBe('1')
  })

  it('does not throw when localStorage.setItem throws', () => {
    ;(localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => markGuideSeen('guide-seen-map')).not.toThrow()
  })

  it('marks all four guide keys independently', () => {
    markGuideSeen('guide-seen-se')
    markGuideSeen('guide-seen-discuss')
    markGuideSeen('guide-seen-map')
    markGuideSeen('guide-seen-matrix')
    expect(readGuideSeen('guide-seen-se')).toBe(true)
    expect(readGuideSeen('guide-seen-discuss')).toBe(true)
    expect(readGuideSeen('guide-seen-map')).toBe(true)
    expect(readGuideSeen('guide-seen-matrix')).toBe(true)
  })
})

/* ═══ aiChatStorageKey ═══ */

describe('aiChatStorageKey', () => {
  it('includes sessionCode and taskId', () => {
    expect(aiChatStorageKey('HX3KM7', 3)).toBe('ai-chat-HX3KM7-3')
  })

  it('uses "local" when sessionCode is null', () => {
    expect(aiChatStorageKey(null, 1)).toBe('ai-chat-local-1')
  })

  it('different sessions produce different keys', () => {
    const k1 = aiChatStorageKey('AAA', 1)
    const k2 = aiChatStorageKey('BBB', 1)
    expect(k1).not.toBe(k2)
  })

  it('different tasks produce different keys', () => {
    const k1 = aiChatStorageKey('AAA', 1)
    const k2 = aiChatStorageKey('AAA', 2)
    expect(k1).not.toBe(k2)
  })
})

/* ═══ readChatMessages ═══ */

describe('readChatMessages', () => {
  it('returns [] when key does not exist', () => {
    expect(readChatMessages('ai-chat-X-1')).toEqual([])
  })

  it('parses stored JSON array', () => {
    const msgs = [{ t: 'q', x: 'hi' }, { t: 'a', x: 'hello' }]
    store['ai-chat-X-1'] = JSON.stringify(msgs)
    expect(readChatMessages('ai-chat-X-1')).toEqual(msgs)
  })

  it('returns [] on corrupt JSON', () => {
    store['ai-chat-X-1'] = '{broken'
    expect(readChatMessages('ai-chat-X-1')).toEqual([])
  })

  it('returns [] when localStorage throws', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readChatMessages('ai-chat-X-1')).toEqual([])
  })
})

/* ═══ writeChatMessages ═══ */

describe('writeChatMessages', () => {
  it('serializes messages to localStorage', () => {
    const msgs = [{ t: 'q', x: 'test' }]
    writeChatMessages('ai-chat-X-1', msgs)
    expect(store['ai-chat-X-1']).toBe(JSON.stringify(msgs))
  })

  it('does not throw on quota error', () => {
    ;(localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeChatMessages('ai-chat-X-1', [{ t: 'q', x: 'hi' }])).not.toThrow()
  })

  it('overwrites previous value', () => {
    writeChatMessages('k', [{ a: 1 }])
    writeChatMessages('k', [{ a: 2 }])
    expect(readChatMessages('k')).toEqual([{ a: 2 }])
  })
})
