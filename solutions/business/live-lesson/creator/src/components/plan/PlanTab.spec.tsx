import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import PlanTab from './PlanTab'

vi.mock('../../api/projects', () => ({
  readFile: vi.fn(),
  HttpError: class HttpError extends Error {
    constructor(public status: number, message: string) {
      super(message)
    }
  },
}))
vi.mock('../../api/teaching-requirements', () => ({
  getRequirement: vi.fn(),
  searchRequirements: vi.fn(),
}))
vi.mock('../../lib/flash-scroll-target', () => ({
  flashScrollTarget: vi.fn(),
}))
// PlanRenderer / PlanEditor are heavy (TipTap, mdast). Stub them with
// a minimal renderer that just emits the data-req-id attributes the
// parent's scroll selector targets.
vi.mock('./PlanRenderer', () => ({
  default: () => (
    <div>
      <span data-req-id="r-1.2.3">chip A</span>
      <span data-req-id="r-2.1.1">chip B</span>
    </div>
  ),
}))
vi.mock('./PlanEditor', () => ({ default: () => null }))
vi.mock('./InterpretationEditorModal', () => ({ default: () => null }))

// lesson-plan-md is a pure helper module the parent uses to
// canonicalize the parsed doc. Stub the bits PlanTab calls.
vi.mock('../../lib/lesson-plan-md', () => ({
  parseLessonPlan: () => ({ blocks: [] }),
  canonicalizeLessonPlan: (doc: unknown) => doc,
  collectReqIds: () => [],
  makeLookup: () => () => ({ stale: false }),
}))

import { readFile } from '../../api/projects'
import { searchRequirements } from '../../api/teaching-requirements'
import { flashScrollTarget } from '../../lib/flash-scroll-target'
const mockReadFile = vi.mocked(readFile)
const mockSearch = vi.mocked(searchRequirements)
const mockFlash = vi.mocked(flashScrollTarget)

describe('PlanTab — scroll-to-anchor effect', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockSearch.mockReset()
    mockFlash.mockReset()
    // Default: empty library. PlanTab fetches L1 entries on mount but
    // we don't need any for these tests.
    mockSearch.mockResolvedValue({ items: [] })
  })

  it('does NOT scroll when scrollAnchor is null', async () => {
    mockReadFile.mockResolvedValueOnce({ content: '# Plan\nbody' })
    render(
      <PlanTab projectId="p1" scrollAnchor={null} scrollNonce={1} />,
    )
    await waitFor(() => {
      expect(document.querySelector('[data-req-id]')).toBeTruthy()
    })
    expect(mockFlash).not.toHaveBeenCalled()
  })

  it('scrolls to the chip matching scrollAnchor once state.phase is ready', async () => {
    mockReadFile.mockResolvedValueOnce({ content: '# Plan' })
    render(
      <PlanTab projectId="p1" scrollAnchor="r-2.1.1" scrollNonce={1} />,
    )
    await waitFor(() => expect(mockFlash).toHaveBeenCalled())
    const target = mockFlash.mock.calls[0][0] as Element
    expect(target.getAttribute('data-req-id')).toBe('r-2.1.1')
  })

  it('no-ops when no chip matches', async () => {
    mockReadFile.mockResolvedValueOnce({ content: '# Plan' })
    // Fake timers for deterministic coverage of rAF + 200ms retry;
    // see AuditReportView.spec for the canonical pattern.
    vi.useFakeTimers()
    render(
      <PlanTab projectId="p1" scrollAnchor="r-missing" scrollNonce={1} />,
    )
    await vi.advanceTimersByTimeAsync(250)
    vi.useRealTimers()
    expect(mockFlash).not.toHaveBeenCalled()
  })

  it('re-fires when scrollNonce changes', async () => {
    mockReadFile.mockResolvedValueOnce({ content: '# Plan' })
    const { rerender } = render(
      <PlanTab projectId="p1" scrollAnchor="r-1.2.3" scrollNonce={1} />,
    )
    await waitFor(() => expect(mockFlash).toHaveBeenCalledTimes(1))

    rerender(
      <PlanTab projectId="p1" scrollAnchor="r-1.2.3" scrollNonce={2} />,
    )
    await waitFor(() => expect(mockFlash).toHaveBeenCalledTimes(2))
  })
})
