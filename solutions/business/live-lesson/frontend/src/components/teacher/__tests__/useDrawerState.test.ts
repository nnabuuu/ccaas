import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

let mockParams: URLSearchParams
let mockSetParams: ReturnType<typeof vi.fn>

vi.mock('react', () => ({
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockParams, mockSetParams] as const,
}))

import { useDrawerState } from '../useDrawerState'

// Helper: simulate setSearchParams(prev => { …mutate prev… ; return prev })
function applyUpdate(updater: (p: URLSearchParams) => URLSearchParams) {
  const p = new URLSearchParams(mockParams)
  updater(p)
  mockParams = p
}

beforeEach(() => {
  mockParams = new URLSearchParams()
  mockSetParams = vi.fn((updater: (p: URLSearchParams) => URLSearchParams) => {
    applyUpdate(updater)
  })
})

// ── observeParams ──

describe('observeParams', () => {
  it('returns null when no observe/step params', () => {
    const { observeParams } = useDrawerState()
    expect(observeParams).toBeNull()
  })

  it('returns null when observe type is invalid', () => {
    mockParams = new URLSearchParams('observe=bogus&step=2')
    const { observeParams } = useDrawerState()
    expect(observeParams).toBeNull()
  })

  it('returns null when step is missing', () => {
    mockParams = new URLSearchParams('observe=mc')
    const { observeParams } = useDrawerState()
    expect(observeParams).toBeNull()
  })

  it.each(['mc', 'evidence', 'map', 'discuss', 'matrix'] as const)(
    'parses valid type "%s" with step',
    (type) => {
      mockParams = new URLSearchParams(`observe=${type}&step=3`)
      const { observeParams } = useDrawerState()
      expect(observeParams).toEqual({ type, step: 3 })
    },
  )
})

// ── summary drawer ──

describe('summary drawer', () => {
  it('summaryOpen is false by default', () => {
    expect(useDrawerState().summaryOpen).toBe(false)
  })

  it('summaryOpen is true when param is "open"', () => {
    mockParams = new URLSearchParams('summary=open')
    expect(useDrawerState().summaryOpen).toBe(true)
  })

  it('openSummary sets summary=open', () => {
    useDrawerState().openSummary()
    expect(mockSetParams).toHaveBeenCalledOnce()
    expect(mockParams.get('summary')).toBe('open')
  })

  it('closeSummary deletes summary param', () => {
    mockParams = new URLSearchParams('summary=open')
    useDrawerState().closeSummary()
    expect(mockParams.has('summary')).toBe(false)
  })
})

// ── discuss drawer ──

describe('discuss drawer', () => {
  it('discussDrawerOpen is false by default', () => {
    expect(useDrawerState().discussDrawerOpen).toBe(false)
  })

  it('discussDrawerOpen is true when param is "open"', () => {
    mockParams = new URLSearchParams('discuss-drawer=open')
    expect(useDrawerState().discussDrawerOpen).toBe(true)
  })

  it('openDiscussDrawer sets discuss-drawer=open', () => {
    useDrawerState().openDiscussDrawer()
    expect(mockParams.get('discuss-drawer')).toBe('open')
  })

  it('closeDiscussDrawer deletes the param', () => {
    mockParams = new URLSearchParams('discuss-drawer=open')
    useDrawerState().closeDiscussDrawer()
    expect(mockParams.has('discuss-drawer')).toBe(false)
  })
})

// ── status drawer ──

describe('status drawer', () => {
  it('statusDrawerOpen is false by default', () => {
    expect(useDrawerState().statusDrawerOpen).toBe(false)
  })

  it('statusDrawerOpen is true when param is "open"', () => {
    mockParams = new URLSearchParams('status-drawer=open')
    expect(useDrawerState().statusDrawerOpen).toBe(true)
  })

  it('openStatusDrawer sets status-drawer=open', () => {
    useDrawerState().openStatusDrawer()
    expect(mockParams.get('status-drawer')).toBe('open')
  })

  it('closeStatusDrawer deletes the param', () => {
    mockParams = new URLSearchParams('status-drawer=open')
    useDrawerState().closeStatusDrawer()
    expect(mockParams.has('status-drawer')).toBe(false)
  })
})

// ── observe open/close ──

describe('openObserve / closeObserve', () => {
  it('openObserve sets observe + step params', () => {
    useDrawerState().openObserve('mc', 2)
    expect(mockParams.get('observe')).toBe('mc')
    expect(mockParams.get('step')).toBe('2')
  })

  it('openObserve ignores invalid type', () => {
    useDrawerState().openObserve('invalid', 1)
    expect(mockSetParams).not.toHaveBeenCalled()
    expect(mockParams.has('observe')).toBe(false)
  })

  it('closeObserve removes observe + step', () => {
    mockParams = new URLSearchParams('observe=mc&step=2')
    useDrawerState().closeObserve()
    expect(mockParams.has('observe')).toBe(false)
    expect(mockParams.has('step')).toBe(false)
  })
})

// ── multiple drawers ──

describe('independence', () => {
  it('opening one drawer does not affect others', () => {
    mockParams = new URLSearchParams('summary=open')
    useDrawerState().openDiscussDrawer()
    // summary should still be present (only discuss-drawer added)
    expect(mockParams.get('summary')).toBe('open')
    expect(mockParams.get('discuss-drawer')).toBe('open')
  })

  it('closing one drawer preserves other params', () => {
    mockParams = new URLSearchParams('summary=open&discuss-drawer=open&observe=mc&step=1')
    useDrawerState().closeSummary()
    expect(mockParams.has('summary')).toBe(false)
    expect(mockParams.get('discuss-drawer')).toBe('open')
    expect(mockParams.get('observe')).toBe('mc')
  })
})
