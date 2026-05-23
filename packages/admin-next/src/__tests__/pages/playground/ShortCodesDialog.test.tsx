/**
 * ShortCodesDialog tests — admin playground §18 share-link UI.
 *
 * Drives the value paths: button disabled state, listing + minting +
 * deleting codes via the /preview/shortcodes routes, and clipboard
 * fallback when navigator.clipboard isn't available.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShortCodesDialog } from '@/pages/playground/ShortCodesDialog'

const PREVIEW_URL = 'http://preview.test'

interface MockCode {
  code: string
  bundleId: string
  storyName: string
  createdAt: number
  notes?: string
}

function mockFetchOk(json: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(json),
  }) as unknown as Promise<Response>
}

function mockCodes(codes: MockCode[]) {
  return mockFetchOk({ codes })
}

describe('ShortCodesDialog', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('Share Link button is disabled when bundleId / storyName are null', () => {
    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId={null} storyName={null} />)
    const btn = screen.getByRole('button', { name: /Share Link/i })
    expect(btn).toBeDisabled()
  })

  it('Share Link enabled + opens dialog when bundle/story are selected', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockCodes([]))

    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId="quiz" storyName="Default" />)
    const btn = screen.getByRole('button', { name: /Share Link/i })
    expect(btn).not.toBeDisabled()

    fireEvent.click(btn)
    await waitFor(() => {
      // Radix Dialog renders a duplicate "Share Codes" title (visible + a11y
      // SR-only copy) — match the heading specifically.
      expect(screen.getByRole('heading', { name: /Share Codes/i })).toBeInTheDocument()
      expect(screen.getByText(/Mint new short code/i)).toBeInTheDocument()
    })
  })

  it('lists existing codes from /preview/shortcodes', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockCodes([
        { code: 'abc12345', bundleId: 'quiz', storyName: 'Default', createdAt: Date.now(), notes: 'demo' },
      ]),
    )

    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId="quiz" storyName="Default" />)
    fireEvent.click(screen.getByRole('button', { name: /Share Link/i }))

    await waitFor(() => {
      expect(screen.getByText('abc12345')).toBeInTheDocument()
      expect(screen.getByText('demo')).toBeInTheDocument()
    })
  })

  it('mints a random code via POST /preview/shortcodes and refreshes the list', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      // 1. open → initial list
      .mockReturnValueOnce(mockCodes([]))
      // 2. POST create
      .mockReturnValueOnce(mockFetchOk({ code: 'newcode1' }))
      // 3. refresh list
      .mockReturnValueOnce(
        mockCodes([
          { code: 'newcode1', bundleId: 'quiz', storyName: 'Default', createdAt: Date.now() },
        ]),
      )

    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId="quiz" storyName="Default" />)
    fireEvent.click(screen.getByRole('button', { name: /Share Link/i }))
    await waitFor(() => expect(screen.getByText(/No share codes yet/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^Random$/ }))
    await waitFor(() => expect(screen.getByText('newcode1')).toBeInTheDocument())

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    const postCall = calls.find((c) => c[1]?.method === 'POST')
    expect(postCall?.[0]).toBe(`${PREVIEW_URL}/preview/shortcodes`)
    const body = JSON.parse(postCall?.[1]?.body as string)
    expect(body.bundleId).toBe('quiz')
    expect(body.storyName).toBe('Default')
    expect(body.deterministic).toBeUndefined()
  })

  it('Deterministic button passes deterministic:true', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockCodes([]))
      .mockReturnValueOnce(mockFetchOk({ code: 'det12345' }))
      .mockReturnValueOnce(mockCodes([]))

    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId="quiz" storyName="Default" />)
    fireEvent.click(screen.getByRole('button', { name: /Share Link/i }))
    await waitFor(() => expect(screen.getByText(/No share codes yet/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Deterministic/ }))

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const postCall = calls.find((c) => c[1]?.method === 'POST')
      expect(postCall).toBeDefined()
      expect(JSON.parse(postCall![1]!.body as string).deterministic).toBe(true)
    })
  })

  it('surfaces backend errors as a red banner without crashing', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockCodes([]))
      .mockReturnValueOnce(mockFetchOk({ error: 'no such bundle' }, 404))

    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId="quiz" storyName="Default" />)
    fireEvent.click(screen.getByRole('button', { name: /Share Link/i }))
    await waitFor(() => expect(screen.getByText(/No share codes yet/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^Random$/ }))

    await waitFor(() => {
      expect(screen.getByText(/no such bundle/i)).toBeInTheDocument()
    })
  })

  it('Delete sends DELETE /preview/shortcodes/:code and refreshes', async () => {
    const initial: MockCode = { code: 'gone1234', bundleId: 'quiz', storyName: 'Default', createdAt: Date.now() }
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockCodes([initial]))
      // DELETE returns 204 (empty body)
      .mockReturnValueOnce(
        Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) }) as unknown as Promise<Response>,
      )
      .mockReturnValueOnce(mockCodes([]))

    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId="quiz" storyName="Default" />)
    fireEvent.click(screen.getByRole('button', { name: /Share Link/i }))
    await waitFor(() => expect(screen.getByText('gone1234')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const delCall = calls.find((c) => c[1]?.method === 'DELETE')
      expect(delCall?.[0]).toBe(`${PREVIEW_URL}/preview/shortcodes/gone1234`)
    })
    await waitFor(() => expect(screen.queryByText('gone1234')).not.toBeInTheDocument())
  })

  it('Copy URL falls back gracefully when navigator.clipboard is unavailable', async () => {
    const initial: MockCode = { code: 'cant1234', bundleId: 'quiz', storyName: 'Default', createdAt: Date.now() }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockCodes([initial]))

    // Force the clipboard call to throw (non-HTTPS context simulation).
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error('no clipboard'))) },
    })

    render(<ShortCodesDialog previewUrl={PREVIEW_URL} bundleId="quiz" storyName="Default" />)
    fireEvent.click(screen.getByRole('button', { name: /Share Link/i }))
    await waitFor(() => expect(screen.getByText('cant1234')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Copy URL/i }))
    await waitFor(() => {
      expect(screen.getByText(/Clipboard unavailable/i)).toBeInTheDocument()
    })
  })
})
