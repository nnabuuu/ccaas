import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ExecutionTab from './ExecutionTab'

// Mock the api layer + the DOM-touching helper. The helper mock lets
// us assert what element ExecutionTab's scroll effect resolves to,
// without depending on jsdom's scrollIntoView (which doesn't actually
// scroll anyway).
vi.mock('../../api/projects', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))
vi.mock('../../lib/flash-scroll-target', () => ({
  flashScrollTarget: vi.fn(),
}))

// Stub the heavy children so this spec stays focused on the parent's
// scroll wiring. StepList renders one div per step with the
// data-step-id attribute the parent's selector targets; BlockEditor
// is irrelevant here.
vi.mock('./StepList', () => ({
  default: ({ steps }: { steps: Array<{ id: string; label?: string }> }) => (
    <div>
      {steps.map((s) => (
        <div key={s.id} data-step-id={s.id}>
          {s.label}
        </div>
      ))}
    </div>
  ),
}))
vi.mock('./BlockEditorDrawer', () => ({
  default: () => null,
}))

import { readFile } from '../../api/projects'
import { flashScrollTarget } from '../../lib/flash-scroll-target'
const mockReadFile = vi.mocked(readFile)
const mockFlash = vi.mocked(flashScrollTarget)

const MANIFEST = JSON.stringify({
  id: 'lesson-1',
  title: 'Sample',
  subject: 'Math',
  gradeLevel: '7',
  lessonType: 'interactive',
  readingSteps: [
    { id: 's-1700000001-1', idx: 0, label: 'Step A' },
    { id: 's-1700000001-2', idx: 1, label: 'Step B' },
    { id: 's-1700000001-3', idx: 2, label: 'Step C' },
  ],
})

describe('ExecutionTab — scroll-to-anchor effect', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockFlash.mockReset()
  })

  it('does NOT scroll when scrollAnchor is null', async () => {
    mockReadFile.mockResolvedValueOnce({ content: MANIFEST })
    render(
      <ExecutionTab projectId="p1" scrollAnchor={null} scrollNonce={1} />,
    )
    // Wait for manifest to load + steps to render.
    await waitFor(() => {
      expect(document.querySelector('[data-step-id]')).toBeTruthy()
    })
    expect(mockFlash).not.toHaveBeenCalled()
  })

  it('scrolls to the step matching scrollAnchor once manifest is ready', async () => {
    mockReadFile.mockResolvedValueOnce({ content: MANIFEST })
    render(
      <ExecutionTab
        projectId="p1"
        scrollAnchor="s-1700000001-2"
        scrollNonce={1}
      />,
    )
    await waitFor(() => {
      expect(mockFlash).toHaveBeenCalled()
    })
    const target = mockFlash.mock.calls[0][0] as Element
    expect(target.getAttribute('data-step-id')).toBe('s-1700000001-2')
  })

  it('no-ops when no step matches (deleted-step scenario)', async () => {
    mockReadFile.mockResolvedValueOnce({ content: MANIFEST })
    // Fake timers for deterministic coverage of the rAF + 200ms
    // retry window — wallclock setTimeout(500) is flaky on
    // contended CI. Same pattern AuditReportView.spec uses for its
    // cooldown assertion.
    vi.useFakeTimers()
    render(
      <ExecutionTab
        projectId="p1"
        scrollAnchor="s-does-not-exist"
        scrollNonce={1}
      />,
    )
    await vi.advanceTimersByTimeAsync(250)
    vi.useRealTimers()
    expect(mockFlash).not.toHaveBeenCalled()
  })

  it('re-fires when scrollNonce changes (same anchor, repeat click)', async () => {
    mockReadFile.mockResolvedValueOnce({ content: MANIFEST })
    const { rerender } = render(
      <ExecutionTab
        projectId="p1"
        scrollAnchor="s-1700000001-1"
        scrollNonce={1}
      />,
    )
    await waitFor(() => expect(mockFlash).toHaveBeenCalledTimes(1))

    rerender(
      <ExecutionTab
        projectId="p1"
        scrollAnchor="s-1700000001-1"
        scrollNonce={2}
      />,
    )
    await waitFor(() => expect(mockFlash).toHaveBeenCalledTimes(2))
  })

  it('CSS.escape protects against pathological anchor values', async () => {
    mockReadFile.mockResolvedValueOnce({ content: MANIFEST })
    // An anchor containing characters that would break a raw
    // attribute selector (`"` `]`) must not throw — querySelector
    // either matches (no step has this id) or returns null.
    vi.useFakeTimers()
    render(
      <ExecutionTab
        projectId="p1"
        scrollAnchor={'foo"]/script'}
        scrollNonce={1}
      />,
    )
    await vi.advanceTimersByTimeAsync(250)
    vi.useRealTimers()
    expect(mockFlash).not.toHaveBeenCalled()
  })
})
