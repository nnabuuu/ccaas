import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ChatVerifyCard from './ChatVerifyCard'
import type { VerifyData, VerifyCheck } from '../../../types/chat-cards'

const check = (
  id: string,
  status: VerifyCheck['status'],
  detail?: string,
): VerifyCheck => ({
  id,
  label: `Check ${id}`,
  desc: `desc for ${id}`,
  status,
  detail,
})

const fixture = (overrides: Partial<VerifyData> = {}): VerifyData => ({
  kind: 'verify',
  title: 'manifest.json 校验',
  target: 'manifest.json',
  schema: 'execution-schema v2.1',
  status: 'done',
  startedAt: '10:32:15',
  completedAt: '10:32:18',
  checks: [check('c1', 'pass')],
  ...overrides,
})

describe('ChatVerifyCard', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering basics', () => {
    it('renders title + target → schema subtitle', () => {
      render(<ChatVerifyCard data={fixture()} />)
      expect(screen.getByText('manifest.json 校验')).toBeInTheDocument()
      expect(
        screen.getByText(/manifest\.json → execution-schema v2\.1/),
      ).toBeInTheDocument()
    })

    it('renders all check rows when status=done', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [
              check('c1', 'pass'),
              check('c2', 'warn'),
              check('c3', 'fail'),
            ],
          })}
        />,
      )
      expect(screen.getByTestId('verify-check-c1')).toBeInTheDocument()
      expect(screen.getByTestId('verify-check-c2')).toBeInTheDocument()
      expect(screen.getByTestId('verify-check-c3')).toBeInTheDocument()
    })

    it('exposes data-card-kind="verify" on root', () => {
      const { container } = render(<ChatVerifyCard data={fixture()} />)
      expect(container.querySelector('[data-card-kind="verify"]')).toBeTruthy()
    })
  })

  describe('status badges + header variant', () => {
    it('done + all pass → green header + pass badge only', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [check('c1', 'pass'), check('c2', 'pass')],
          })}
        />,
      )
      const header = screen.getByRole('button', { expanded: true })
      expect(header.className).toMatch(/bg-green-50/)
      expect(screen.getByLabelText('2 pass')).toBeInTheDocument()
      expect(screen.queryByLabelText(/warn/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/fail/)).not.toBeInTheDocument()
    })

    it('done + any fail → red header + all three badges', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [check('c1', 'pass'), check('c2', 'warn'), check('c3', 'fail')],
          })}
        />,
      )
      const header = screen.getByRole('button', { expanded: true })
      expect(header.className).toMatch(/bg-red-50/)
      expect(screen.getByLabelText('1 pass')).toBeInTheDocument()
      expect(screen.getByLabelText('1 warn')).toBeInTheDocument()
      expect(screen.getByLabelText('1 fail')).toBeInTheDocument()
    })

    it('done + warns only → green header (no fails) + warn badge', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [check('c1', 'pass'), check('c2', 'warn')],
          })}
        />,
      )
      const header = screen.getByRole('button', { expanded: true })
      expect(header.className).toMatch(/bg-green-50/)
      expect(screen.getByLabelText('1 warn')).toBeInTheDocument()
    })
  })

  describe('progressive reveal (status=running)', () => {
    it('starts with 0 checks visible + shows progress count "0/3"', () => {
      vi.useFakeTimers()
      render(
        <ChatVerifyCard
          data={fixture({
            status: 'running',
            completedAt: '',
            checks: [check('c1', 'pass'), check('c2', 'pass'), check('c3', 'pass')],
          })}
        />,
      )
      expect(screen.queryByTestId('verify-check-c1')).not.toBeInTheDocument()
      expect(screen.getByLabelText('0 of 3 checked')).toBeInTheDocument()
      expect(screen.getByTestId('verify-checking-indicator')).toBeInTheDocument()
    })

    it('reveals one check per 350ms tick + hides indicator at completion', () => {
      vi.useFakeTimers()
      render(
        <ChatVerifyCard
          data={fixture({
            status: 'running',
            completedAt: '',
            checks: [check('c1', 'pass'), check('c2', 'pass')],
          })}
        />,
      )

      // Tick 1: progress=1, c1 visible, c2 not yet.
      act(() => {
        vi.advanceTimersByTime(350)
      })
      expect(screen.getByTestId('verify-check-c1')).toBeInTheDocument()
      expect(screen.queryByTestId('verify-check-c2')).not.toBeInTheDocument()

      // Tick 2: progress=2, c2 visible, indicator gone (progress >= total).
      act(() => {
        vi.advanceTimersByTime(350)
      })
      expect(screen.getByTestId('verify-check-c2')).toBeInTheDocument()
      expect(
        screen.queryByTestId('verify-checking-indicator'),
      ).not.toBeInTheDocument()
    })

    it('header shows running variant (blue + pulse) while progress < total', () => {
      vi.useFakeTimers()
      render(
        <ChatVerifyCard
          data={fixture({
            status: 'running',
            completedAt: '',
            checks: [check('c1', 'pass')],
          })}
        />,
      )
      const header = screen.getByRole('button', { expanded: true })
      expect(header.className).toMatch(/bg-blue-50/)
      // Pulse class on the status icon (first w-[18px] span inside header).
      const icon = header.querySelector('.animate-aiBlink')
      expect(icon).toBeTruthy()
    })

    it('done card skips animation — all checks visible immediately', () => {
      // No fake timers — done state shouldn't need them.
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [check('c1', 'pass'), check('c2', 'warn'), check('c3', 'fail')],
          })}
        />,
      )
      expect(screen.getByTestId('verify-check-c1')).toBeInTheDocument()
      expect(screen.getByTestId('verify-check-c2')).toBeInTheDocument()
      expect(screen.getByTestId('verify-check-c3')).toBeInTheDocument()
      expect(
        screen.queryByTestId('verify-checking-indicator'),
      ).not.toBeInTheDocument()
    })

    it('clears interval on unmount (no setInterval leak)', () => {
      // React 18 silently swallows "setState on unmounted" warnings,
      // so a console.error spy wouldn't catch a real leak. Spy on
      // clearInterval directly instead: the useEffect cleanup MUST
      // call it; the count is hard to predict (each progress tick
      // also calls clearInterval when it hits total), so we just
      // assert that at least one clearInterval call happened in the
      // window between setup and unmount.
      vi.useFakeTimers()
      const clearSpy = vi.spyOn(globalThis, 'clearInterval')
      const { unmount } = render(
        <ChatVerifyCard
          data={fixture({
            status: 'running',
            completedAt: '',
            checks: [check('c1', 'pass'), check('c2', 'pass')],
          })}
        />,
      )
      const callsBeforeUnmount = clearSpy.mock.calls.length
      unmount()
      // The unmount itself should trigger the useEffect cleanup,
      // which clears the (still-active) interval.
      expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount)
      clearSpy.mockRestore()
    })
  })

  describe('check detail expand/collapse', () => {
    it('checks with detail show the chevron + are clickable; without detail are inert', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [
              check('c1', 'warn', 'failure detail'),
              check('c2', 'pass'),
            ],
          })}
        />,
      )
      const expandable = screen.getByTestId('verify-check-c1').querySelector('button')
      const inert = screen.getByTestId('verify-check-c2').querySelector('button')
      expect(expandable).not.toBeDisabled()
      expect(inert).toBeDisabled()
    })

    it('clicking a detail-bearing check expands the detail panel', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [check('c1', 'fail', 'something is broken')],
          })}
        />,
      )
      expect(
        screen.queryByTestId('verify-check-c1-detail'),
      ).not.toBeInTheDocument()
      fireEvent.click(
        screen.getByTestId('verify-check-c1').querySelector('button')!,
      )
      expect(screen.getByText('something is broken')).toBeInTheDocument()
    })

    it('only one detail expanded at a time (accordion behavior)', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [
              check('c1', 'warn', 'detail one'),
              check('c2', 'fail', 'detail two'),
            ],
          })}
        />,
      )
      fireEvent.click(
        screen.getByTestId('verify-check-c1').querySelector('button')!,
      )
      expect(screen.getByText('detail one')).toBeInTheDocument()
      fireEvent.click(
        screen.getByTestId('verify-check-c2').querySelector('button')!,
      )
      expect(screen.queryByText('detail one')).not.toBeInTheDocument()
      expect(screen.getByText('detail two')).toBeInTheDocument()
    })

    it('clicking the same check again collapses its detail', () => {
      render(
        <ChatVerifyCard
          data={fixture({ checks: [check('c1', 'fail', 'D')] })}
        />,
      )
      const btn = screen.getByTestId('verify-check-c1').querySelector('button')!
      fireEvent.click(btn)
      expect(screen.getByText('D')).toBeInTheDocument()
      fireEvent.click(btn)
      expect(screen.queryByText('D')).not.toBeInTheDocument()
    })
  })

  describe('done footer', () => {
    it('shows startedAt → completedAt + summary when done', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            startedAt: '10:00:00',
            completedAt: '10:00:05',
            checks: [check('c1', 'pass')],
          })}
        />,
      )
      expect(screen.getByText(/10:00:00 → 10:00:05/)).toBeInTheDocument()
      expect(screen.getByText(/校验通过/)).toBeInTheDocument()
    })

    it('summary mentions warning count when warns > 0', () => {
      render(
        <ChatVerifyCard
          data={fixture({
            checks: [check('c1', 'pass'), check('c2', 'warn')],
          })}
        />,
      )
      expect(screen.getByText(/校验通过, 1 个警告/)).toBeInTheDocument()
    })

    it('summary says 校验失败 when any fail', () => {
      render(
        <ChatVerifyCard
          data={fixture({ checks: [check('c1', 'fail', 'broken')] })}
        />,
      )
      expect(screen.getByText(/校验失败/)).toBeInTheDocument()
    })

    it('no footer summary text when status=running', () => {
      vi.useFakeTimers()
      render(
        <ChatVerifyCard
          data={fixture({
            status: 'running',
            completedAt: '',
            checks: [check('c1', 'pass')],
          })}
        />,
      )
      // The header subtitle also contains "→" (target → schema), so
      // a bare /→/ regex would match. Assert the footer-specific
      // summary strings are absent instead — these only render in
      // the done-state footer.
      expect(screen.queryByText(/校验通过/)).not.toBeInTheDocument()
      expect(screen.queryByText(/校验失败/)).not.toBeInTheDocument()
      expect(screen.queryByText(/校验完成/)).not.toBeInTheDocument()
    })
  })

  describe('collapse / expand', () => {
    it('header toggles aria-expanded + hides checks list', () => {
      render(<ChatVerifyCard data={fixture()} />)
      const header = screen.getByRole('button', { expanded: true })
      fireEvent.click(header)
      expect(header).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByTestId('verify-check-c1')).not.toBeInTheDocument()
    })
  })
})
