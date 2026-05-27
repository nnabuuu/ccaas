import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CoursePreviewModal from './CoursePreviewModal'

// Mock the project files API — the modal fetches manifest on open.
// Each test sets up readFile's resolved/rejected value explicitly so
// we control whether we exercise the loading / ready / error branch.
vi.mock('../../api/projects', () => ({
  readFile: vi.fn(),
}))

import { readFile } from '../../api/projects'
const mockReadFile = vi.mocked(readFile)

const VALID_MANIFEST = JSON.stringify({
  id: 'p1',
  title: 'Sample Lesson',
  subject: 'Math',
  gradeLevel: '7',
  lessonType: 'interactive',
  readingSteps: [
    { id: 's1', idx: 0, label: 'Warm-up', duration: 5, strategy: 'Discuss' },
    { id: 's2', idx: 1, label: 'Practice', duration: 10 },
  ],
})

describe('CoursePreviewModal', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
  })

  describe('open / closed', () => {
    it('renders nothing when open=false', () => {
      const { container } = render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={false}
          onClose={vi.fn()}
        />,
      )
      expect(container).toBeEmptyDOMElement()
    })

    it('renders the dialog when open=true', () => {
      mockReadFile.mockResolvedValueOnce({ content: VALID_MANIFEST })
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={vi.fn()}
        />,
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })
  })

  describe('manifest loading', () => {
    it('shows loading state while manifest fetch is in flight', () => {
      mockReadFile.mockReturnValueOnce(new Promise(() => {})) // pending forever
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={vi.fn()}
        />,
      )
      expect(screen.getByText(/加载课程数据/)).toBeInTheDocument()
    })

    it('renders manifest meta + step list after fetch resolves', async () => {
      mockReadFile.mockResolvedValueOnce({ content: VALID_MANIFEST })
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={vi.fn()}
        />,
      )
      // Wait for the manifest's title to appear — proxy for "loaded
      // state rendered".
      expect(await screen.findByText('Sample Lesson')).toBeInTheDocument()
      expect(screen.getByText('Warm-up')).toBeInTheDocument()
      expect(screen.getByText('Practice')).toBeInTheDocument()
      // Total duration line: 15 分钟 · 2 个 step
      expect(screen.getByText(/15 分钟 · 2 个 step/)).toBeInTheDocument()
    })

    it('shows error state when fetch rejects', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('network down'))
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={vi.fn()}
        />,
      )
      expect(await screen.findByText('network down')).toBeInTheDocument()
    })

    it('shows the empty-steps placeholder when manifest has no steps', async () => {
      const empty = JSON.stringify({ ...JSON.parse(VALID_MANIFEST), readingSteps: [] })
      mockReadFile.mockResolvedValueOnce({ content: empty })
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={vi.fn()}
        />,
      )
      expect(await screen.findByText(/课程尚无 step/)).toBeInTheDocument()
    })

    it('surfaces JSON parse error', async () => {
      mockReadFile.mockResolvedValueOnce({ content: '{not json' })
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={vi.fn()}
        />,
      )
      // The exact message depends on JSON.parse — assert the prefix.
      expect(
        await screen.findByText(/JSON/, { exact: false }),
      ).toBeInTheDocument()
    })
  })

  describe('close behavior', () => {
    it('closes on ESC keydown', async () => {
      const onClose = vi.fn()
      mockReadFile.mockResolvedValueOnce({ content: VALID_MANIFEST })
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={onClose}
        />,
      )
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes on × button click', async () => {
      const onClose = vi.fn()
      mockReadFile.mockResolvedValueOnce({ content: VALID_MANIFEST })
      render(
        <CoursePreviewModal
          projectId="p1"
          projectTitle="Sample"
          open={true}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByLabelText('关闭预览'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // ── Backdrop close logic — 4 mousedown/mouseup combinations.
    // This is the area that had 3 review-caught bugs; tests below
    // lock all four directions to prevent regression.
    describe('backdrop close (4-way matrix)', () => {
      const renderOpen = (onClose = vi.fn()) => {
        mockReadFile.mockResolvedValueOnce({ content: VALID_MANIFEST })
        const utils = render(
          <CoursePreviewModal
            projectId="p1"
            projectTitle="Sample"
            open={true}
            onClose={onClose}
          />,
        )
        const backdrop = screen.getByRole('dialog')
        // The inner panel is the modal's first child (the visible
        // white card). Use the close button to locate it reliably.
        const panel = screen.getByLabelText('关闭预览').closest(
          'div.flex.flex-col',
        )
        if (!panel) throw new Error('panel not found')
        return { ...utils, onClose, backdrop, panel }
      }

      it('closes when mousedown + mouseup BOTH land on backdrop', () => {
        const { onClose, backdrop } = renderOpen()
        fireEvent.mouseDown(backdrop, { target: backdrop })
        fireEvent.mouseUp(backdrop, { target: backdrop })
        expect(onClose).toHaveBeenCalledTimes(1)
      })

      it('does NOT close when mousedown on body, mouseup on backdrop (text-select drag)', () => {
        const { onClose, backdrop, panel } = renderOpen()
        // Simulate selecting text inside the body and releasing on
        // the backdrop — would dismiss mid-selection in the original
        // bug.
        fireEvent.mouseDown(panel)
        fireEvent.mouseUp(backdrop, { target: backdrop })
        expect(onClose).not.toHaveBeenCalled()
      })

      it('does NOT close when mousedown on backdrop, mouseup on body (drag inward)', () => {
        const { onClose, backdrop, panel } = renderOpen()
        // The bug pattern that survived the first MED-2 fix: user
        // presses on backdrop then drags onto body and releases.
        // Should NOT dismiss — both endpoints must land on backdrop.
        fireEvent.mouseDown(backdrop, { target: backdrop })
        fireEvent.mouseUp(panel)
        expect(onClose).not.toHaveBeenCalled()
      })

      it('does NOT close on plain body click (no drag)', () => {
        const { onClose, panel } = renderOpen()
        fireEvent.mouseDown(panel)
        fireEvent.mouseUp(panel)
        expect(onClose).not.toHaveBeenCalled()
      })
    })
  })
})
