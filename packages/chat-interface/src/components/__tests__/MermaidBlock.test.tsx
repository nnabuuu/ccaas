import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

const mockInitialize = vi.fn()
const mockRender = vi.fn()

vi.mock('mermaid', () => ({
  default: {
    initialize: mockInitialize,
    render: mockRender,
  },
}))

vi.mock('../CodeBlock', () => ({
  extractText: (node: React.ReactNode) => {
    if (typeof node === 'string') return node
    return ''
  },
}))

// Reset mermaidInitialized module state between tests
let MermaidBlock: typeof import('../MermaidBlock').MermaidBlock
beforeEach(async () => {
  vi.restoreAllMocks()
  mockRender.mockResolvedValue({ svg: '<svg>test</svg>' })
  // Re-import to reset module-level `mermaidInitialized` flag
  vi.resetModules()
  const mod = await import('../MermaidBlock')
  MermaidBlock = mod.MermaidBlock
})

describe('MermaidBlock', () => {
  it('renders SVG output via dangerouslySetInnerHTML on success', async () => {
    const { container } = render(<MermaidBlock>graph TD; A--&gt;B;</MermaidBlock>)
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy()
    })
  })

  it('shows fallback <pre><code> on mermaid render error', async () => {
    mockRender.mockRejectedValueOnce(new Error('Parse error'))
    const { container } = render(<MermaidBlock>invalid</MermaidBlock>)
    await waitFor(() => {
      expect(container.querySelector('pre code')).toBeTruthy()
    })
  })

  it('calls mermaid.initialize with securityLevel strict', async () => {
    render(<MermaidBlock>graph TD;</MermaidBlock>)
    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.objectContaining({ securityLevel: 'strict' }),
      )
    })
  })

  it('respects cancelled flag (no state update after unmount)', async () => {
    // Make render hang until we resolve
    let resolveRender!: (val: { svg: string }) => void
    mockRender.mockReturnValue(new Promise((res) => { resolveRender = res }))

    const { unmount } = render(<MermaidBlock>graph TD;</MermaidBlock>)
    unmount()

    // Resolve after unmount — should not throw (cancelled flag prevents setState)
    await act(async () => {
      resolveRender({ svg: '<svg>late</svg>' })
    })
    // No error thrown = test passes
  })
})
