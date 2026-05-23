/**
 * InspectorPane tests — admin playground's §14 L3 surface.
 *
 * Focuses on the value-bearing paths: empty state, successful data fetch,
 * the L3 build-prompt + rerun-parse flow, and the "L3 not available"
 * graceful-degradation banner (the explicit acceptance criterion from the
 * code review).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InspectorPane } from '@/pages/playground/InspectorPane'

// Monaco's actual editor is heavy + ESM-only — replace with a textarea so
// we can drive the "edit response" flow without booting the WASM worker.
vi.mock('@monaco-editor/react', () => ({
  Editor: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="mock-monaco"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

const PREVIEW_URL = 'http://preview.test'
const SESSION_ID = 'sess_abc12345'

interface InspectorPayload {
  sessionId: string
  gradeHistory: Array<{ timestamp: number; input: unknown; output: unknown; durationMs: number }>
  prompts: Array<{
    callId: string
    systemPrompt: string
    userMessage: string
    response: string
    durationMs: number
    timestamp: number
  }>
  lifecycle: unknown[]
  lifecycleCounts: Record<string, number>
  answerKey: { raw: unknown; sanitized: unknown }
  bundle: { type: string; meta: { title?: string } } | null
}

function inspectorPayload(over: Partial<InspectorPayload> = {}): InspectorPayload {
  return {
    sessionId: SESSION_ID,
    gradeHistory: [],
    prompts: [],
    lifecycle: [],
    lifecycleCounts: {},
    answerKey: { raw: { type: 'quiz' }, sanitized: null },
    bundle: { type: 'quiz', meta: { title: 'Quiz' } },
    ...over,
  }
}

function mockFetchOk(json: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(json),
  }) as unknown as Promise<Response>
}

describe('InspectorPane', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renders the empty state when sessionId is null', () => {
    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={null} refreshTrigger={0} />)
    expect(screen.getByText(/Pick a story/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches /inspector on mount and renders the bundle badge', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchOk(inspectorPayload({ bundle: { type: 'quiz', meta: { title: 'Quiz' } } })),
    )
    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />)
    await waitFor(() => {
      expect(screen.getByText('quiz')).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledWith(`${PREVIEW_URL}/preview/sessions/${SESSION_ID}/inspector`)
  })

  it('renders lifecycle counts as badges', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchOk(inspectorPayload({ lifecycleCounts: { 'grade.start': 3, 'grade.end': 3 } })),
    )
    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />)
    await waitFor(() => {
      expect(screen.getByText(/grade\.start · 3/)).toBeInTheDocument()
      expect(screen.getByText(/grade\.end · 3/)).toBeInTheDocument()
    })
  })

  it('renders an error banner when the inspector fetch fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchOk({ error: 'kaboom' }, 500),
    )
    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />)
    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/i)).toBeInTheDocument()
    })
  })

  it('Build Prompt → returns specs → Monaco editor for response appears', async () => {
    // 1) initial /inspector fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockFetchOk(inspectorPayload()))
    // 2) /build-prompt returns 1 spec
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchOk({
        specs: [{ systemPrompt: 'sys', userMessage: 'usr', options: {} }],
      }),
    )

    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />)
    await waitFor(() => expect(screen.getByText('quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Build Prompt/i }))

    await waitFor(() => {
      expect(screen.getByText(/Prompt 1/i)).toBeInTheDocument()
      expect(screen.getByTestId('mock-monaco')).toBeInTheDocument()
    })
  })

  it('Build Prompt → 400 "L3 not available" → amber banner, no editor', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockFetchOk(inspectorPayload()))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchOk({ error: 'Plugin "x" does not implement buildGradePrompt — L3 not available' }, 400),
    )

    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />)
    await waitFor(() => expect(screen.getByText('quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Build Prompt/i }))

    await waitFor(() => {
      expect(screen.getByText(/L3 not available/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('mock-monaco')).not.toBeInTheDocument()
  })

  it('Build Prompt → empty specs → "zero LLM prompts" hint shown', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockFetchOk(inspectorPayload()))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockFetchOk({ specs: [] }))

    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />)
    await waitFor(() => expect(screen.getByText('quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Build Prompt/i }))

    await waitFor(() => {
      expect(screen.getByText(/zero LLM prompts/i)).toBeInTheDocument()
    })
  })

  it('Rerun Parse posts the edited response and shows the result block', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockFetchOk(inspectorPayload()))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchOk({ specs: [{ systemPrompt: 'sys', userMessage: 'usr' }] }),
    )
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchOk({ ok: true, result: { total: 87, byDimension: { q0: true } } }),
    )

    render(<InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />)
    await waitFor(() => expect(screen.getByText('quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Build Prompt/i }))
    await waitFor(() => expect(screen.getByTestId('mock-monaco')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Rerun Parse/i }))
    await waitFor(() => {
      expect(screen.getByText(/Rerun result/i)).toBeInTheDocument()
      // Result JSON is rendered; loosely match the total field
      expect(screen.getByText(/"total": 87/)).toBeInTheDocument()
    })

    // Verify the rerun-parse POST body carries the edited (default-seeded) responses
    const lastCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    expect(lastCall?.[0]).toBe(`${PREVIEW_URL}/preview/sessions/${SESSION_ID}/rerun-parse`)
    expect(lastCall?.[1]?.method).toBe('POST')
  })

  it('refreshTrigger bump re-fetches /inspector', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(mockFetchOk(inspectorPayload()))
    const { rerender } = render(
      <InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={0} />,
    )
    await waitFor(() => expect(screen.getByText('quiz')).toBeInTheDocument())

    rerender(
      <InspectorPane previewUrl={PREVIEW_URL} sessionId={SESSION_ID} refreshTrigger={1} />,
    )
    await waitFor(() => {
      // Two fetches now: one mount, one refresh trigger.
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
          String(c[0]).endsWith('/inspector'),
        ),
      ).toHaveLength(2)
    })
  })
})
