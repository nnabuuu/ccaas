import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AuditReportView from './AuditReportView'

vi.mock('../../api/audit', () => ({
  getAuditReport: vi.fn(),
  runAudit: vi.fn(),
}))

// AuditReportRenderer pulls in remark-parse + a chunk of mdast types;
// stub it so this spec stays focused on AuditReportView's header
// behavior (badge, regen, reload) rather than the markdown renderer.
vi.mock('./AuditReportRenderer', () => ({
  default: ({ markdown }: { markdown: string }) => (
    <div data-testid="report-body">{markdown}</div>
  ),
}))

import { getAuditReport, runAudit } from '../../api/audit'
const mockGetAuditReport = vi.mocked(getAuditReport)
const mockRunAudit = vi.mocked(runAudit)

describe('AuditReportView', () => {
  beforeEach(() => {
    mockGetAuditReport.mockReset()
    mockRunAudit.mockReset()
  })
  afterEach(() => {
    // Restore real timers in case a test opted into fake ones.
    vi.useRealTimers()
  })

  describe('header surface', () => {
    it('renders the AI 生成 badge with sr-readable aria-label', async () => {
      mockGetAuditReport.mockResolvedValueOnce('# 概述\nbody')
      render(<AuditReportView projectId="p1" reportPath="audit/r.md" />)
      const badge = await screen.findByLabelText('AI 生成内容, 请人工核对')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('AI 生成')
    })

    it('shows the report file path', async () => {
      mockGetAuditReport.mockResolvedValueOnce('# x')
      render(<AuditReportView projectId="p1" reportPath="audit/2026.md" />)
      expect(await screen.findByText('audit/2026.md')).toBeInTheDocument()
    })

    it('renders both 重新生成 and 重新加载 buttons (distinct actions)', async () => {
      mockGetAuditReport.mockResolvedValueOnce('# x')
      render(<AuditReportView projectId="p1" reportPath="audit/r.md" />)
      // Both buttons exist with their distinct labels.
      expect(await screen.findByText('重新生成')).toBeInTheDocument()
      expect(screen.getByText('重新加载')).toBeInTheDocument()
    })
  })

  describe('重新生成 cooldown', () => {
    it('calls runAudit when 重新生成 clicked', async () => {
      mockGetAuditReport.mockResolvedValueOnce('# x')
      mockRunAudit.mockResolvedValueOnce({
        projectId: 'p1',
        status: 'running',
      })
      render(<AuditReportView projectId="p1" reportPath="audit/r.md" />)
      const btn = await screen.findByText('重新生成')
      fireEvent.click(btn.closest('button')!)
      expect(mockRunAudit).toHaveBeenCalledWith('p1')
    })

    it('disables the button immediately after click then re-enables after the cooldown', async () => {
      mockGetAuditReport.mockResolvedValueOnce('# x')
      mockRunAudit.mockResolvedValueOnce({
        projectId: 'p1',
        status: 'running',
      })
      render(<AuditReportView projectId="p1" reportPath="audit/r.md" />)
      const btn = (await screen.findByText('重新生成')).closest('button')!
      expect(btn).not.toBeDisabled()

      // Switch to fake timers AFTER the initial render-mount cycle,
      // so testing-library's `findByText` (which polls via
      // setTimeout) doesn't get blocked. Now we can advance the
      // cooldown timer deterministically.
      vi.useFakeTimers()
      fireEvent.click(btn)
      // The click handler synchronously sets regenInFlight=true, but
      // the React render to apply that state runs on a microtask.
      // advanceTimersByTime(0) + a microtask tick flushes both.
      await vi.advanceTimersByTimeAsync(0)
      expect(btn).toBeDisabled()

      // Cooldown is 3.5s. Advance past it; the timer callback fires
      // and re-enables the button. Switch back to real timers so
      // waitFor's internal polling works for the final assertion.
      await vi.advanceTimersByTimeAsync(4_000)
      vi.useRealTimers()
      await waitFor(() => expect(btn).not.toBeDisabled())
    })

    it('re-enables immediately on runAudit error (no cooldown)', async () => {
      mockGetAuditReport.mockResolvedValueOnce('# x')
      mockRunAudit.mockRejectedValueOnce(new Error('backend down'))
      const onErr = vi.fn()
      render(
        <AuditReportView
          projectId="p1"
          reportPath="audit/r.md"
          onRegenError={onErr}
        />,
      )
      const btn = (await screen.findByText('重新生成')).closest('button')!
      fireEvent.click(btn)
      await waitFor(() => expect(onErr).toHaveBeenCalledWith('backend down'))
      // Error path resets regenInFlight without cooldown.
      await waitFor(() => expect(btn).not.toBeDisabled())
    })
  })

  describe('cooldown timer cleanup', () => {
    it('does not setState after unmount (no warning + no leak)', async () => {
      mockGetAuditReport.mockResolvedValueOnce('# x')
      mockRunAudit.mockResolvedValueOnce({
        projectId: 'p1',
        status: 'running',
      })
      const { unmount } = render(
        <AuditReportView projectId="p1" reportPath="audit/r.md" />,
      )
      const btn = (await screen.findByText('重新生成')).closest('button')!

      vi.useFakeTimers()
      fireEvent.click(btn)
      await vi.advanceTimersByTimeAsync(0)
      expect(btn).toBeDisabled()

      // Unmount within the 3.5s cooldown. The cleanup effect should
      // clear the pending setTimeout; if it didn't, the timer would
      // fire setState on a stale ref and React 18 would log a
      // warning to console.error.
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      unmount()
      await vi.advanceTimersByTimeAsync(4_000)
      expect(errSpy).not.toHaveBeenCalled()
      errSpy.mockRestore()
    })
  })
})
