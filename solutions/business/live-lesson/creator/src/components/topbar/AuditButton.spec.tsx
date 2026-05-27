import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AuditButton from './AuditButton'

vi.mock('../../api/audit', () => ({
  getAuditState: vi.fn(),
  runAudit: vi.fn(),
}))

import { getAuditState, runAudit } from '../../api/audit'
const mockGetAuditState = vi.mocked(getAuditState)
const mockRunAudit = vi.mocked(runAudit)

describe('AuditButton — 4 visual states', () => {
  beforeEach(() => {
    mockGetAuditState.mockReset()
    mockRunAudit.mockReset()
  })

  // Helper: extract the className string for the rendered button so
  // tests can assert on the Tailwind color tokens that encode each
  // visual state.
  const renderAndGetButton = async (props: Partial<{
    viewingAuditReport: boolean
    status: 'idle' | 'running' | 'done' | 'error'
    errorMessage?: string
  }> = {}) => {
    const status = props.status ?? 'idle'
    mockGetAuditState.mockResolvedValueOnce({
      projectId: 'p1',
      status,
      errorMessage: props.errorMessage,
    })
    render(
      <AuditButton
        projectId="p1"
        viewingAuditReport={props.viewingAuditReport ?? false}
        onAuditDone={vi.fn()}
        onAuditError={vi.fn()}
      />,
    )
    // Wait for the mount-time getAuditState() to resolve and the
    // component to settle into its visual state.
    await waitFor(() => {
      // The 审计 button is the only button rendered. It's disabled
      // only in the running state; we look up by role + accessible
      // text/title.
      const btn = screen.getByRole('button')
      expect(btn).toBeInTheDocument()
    })
    return screen.getByRole('button')
  }

  it('idle state — gray hover, Sparkles icon, "审计" label', async () => {
    const btn = await renderAndGetButton({ status: 'idle' })
    expect(btn).toHaveTextContent('审计')
    expect(btn).not.toHaveTextContent('审计中')
    // Idle uses gray text; absence of green/blue/red bg tokens.
    expect(btn.className).toContain('text-gray-600')
    expect(btn.className).not.toContain('bg-green-50')
    expect(btn.className).not.toContain('bg-blue-50')
  })

  it('running state — blue, disabled, "审计中" label, spinner', async () => {
    const btn = await renderAndGetButton({ status: 'running' })
    expect(btn).toHaveTextContent('审计中')
    expect(btn).toBeDisabled()
    expect(btn.className).toContain('bg-blue-50')
    expect(btn.className).toContain('text-blue-600')
  })

  it('error state — red text, AlertCircle icon, click title shows error', async () => {
    const btn = await renderAndGetButton({
      status: 'error',
      errorMessage: 'LLM rate limit',
    })
    expect(btn.className).toContain('text-red-600')
    expect(btn.getAttribute('title')).toContain('LLM rate limit')
  })

  it('viewingAuditReport (done highlight) — green text + bg', async () => {
    const btn = await renderAndGetButton({
      status: 'done',
      viewingAuditReport: true,
    })
    expect(btn.className).toContain('text-green-700')
    expect(btn.className).toContain('bg-green-50')
    expect(btn.getAttribute('title')).toContain('正在查看审计报告')
  })

  describe('state priority — running > error > viewingAuditReport > idle', () => {
    it('running beats viewingAuditReport (still shows running, not green)', async () => {
      const btn = await renderAndGetButton({
        status: 'running',
        viewingAuditReport: true,
      })
      expect(btn.className).toContain('bg-blue-50')
      expect(btn.className).not.toContain('bg-green-50')
      expect(btn).toHaveTextContent('审计中')
    })

    it('error beats viewingAuditReport (still shows red, not green)', async () => {
      const btn = await renderAndGetButton({
        status: 'error',
        errorMessage: 'oops',
        viewingAuditReport: true,
      })
      expect(btn.className).toContain('text-red-600')
      expect(btn.className).not.toContain('bg-green-50')
    })

    it('viewingAuditReport=false + status=done → idle visual (NOT green)', async () => {
      // Done without active audit-report tab is just "completed but
      // I'm looking at something else" — should not highlight.
      const btn = await renderAndGetButton({
        status: 'done',
        viewingAuditReport: false,
      })
      expect(btn.className).toContain('text-gray-600')
      expect(btn.className).not.toContain('bg-green-50')
    })
  })
})
