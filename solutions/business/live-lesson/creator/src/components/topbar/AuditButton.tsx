import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import {
  getAuditState,
  runAudit,
  type AuditRunState,
} from '../../api/audit'

/**
 * Top-bar 审计 button. Click → POST /audit/run + poll until done →
 * fires `onAuditDone(reportPath)` so the parent can open the new
 * report as a dynamic tab.
 *
 * State on mount: GET /audit once to recover any in-flight or last-
 * known status. If status is 'running' when we mount, attach polling
 * so a refresh during an active audit still tracks completion.
 *
 * Multi-tab semantics (per design + user expectation): each click
 * starts a NEW backend run (which writes a fresh timestamped file) +
 * each completion calls `onAuditDone` with the new path. Parent is
 * responsible for opening as many dynamic tabs as `onAuditDone` is
 * called.
 */

interface Props {
  projectId: string
  /** True when an audit-report dynamic tab is the active tab — design
   *  §6.1 "done" state: button gets a green highlight so the teacher
   *  can visually associate the report they're reading with the
   *  button that produced it. */
  viewingAuditReport?: boolean
  /** Fires when an audit run completes with a fresh report. */
  onAuditDone: (reportPath: string) => void
  /** Fires when an audit run fails — parent can show a toast. */
  onAuditError?: (message: string) => void
}

const POLL_INTERVAL_MS = 3_000
// 200 × 3s ≈ 10 minutes. LLM audits should never exceed this; stop
// polling rather than hammer the server.
const POLL_MAX_ATTEMPTS = 200

export default function AuditButton({
  projectId,
  viewingAuditReport = false,
  onAuditDone,
  onAuditError,
}: Props) {
  const [state, setState] = useState<AuditRunState | null>(null)
  const [running, setRunning] = useState(false)
  // Tracks the most recently observed reportPath so we don't fire
  // onAuditDone twice for the same path (e.g. on mount + poll race).
  const lastReportedPath = useRef<string | null>(null)
  const activeProjectId = useRef(projectId)
  useEffect(() => {
    activeProjectId.current = projectId
  }, [projectId])

  const poll = useRef<{ timer: ReturnType<typeof setTimeout> | null; attempts: number }>({
    timer: null,
    attempts: 0,
  })

  const clearPolling = useCallback(() => {
    if (poll.current.timer !== null) {
      clearTimeout(poll.current.timer)
      poll.current.timer = null
    }
    poll.current.attempts = 0
  }, [])

  const startPolling = useCallback(() => {
    clearPolling()
    const pid = activeProjectId.current
    const tick = async () => {
      try {
        const data = await getAuditState(pid)
        if (activeProjectId.current !== pid) {
          clearPolling()
          return
        }
        setState(data)
        poll.current.attempts += 1
        if (
          data.status === 'running' &&
          poll.current.attempts < POLL_MAX_ATTEMPTS
        ) {
          poll.current.timer = setTimeout(tick, POLL_INTERVAL_MS)
          return
        }
        clearPolling()
        if (data.status === 'done' && data.reportPath) {
          // Guard: only fire onAuditDone for a path we haven't already
          // surfaced. Without this, mount-time polling could replay an
          // already-open tab.
          if (lastReportedPath.current !== data.reportPath) {
            lastReportedPath.current = data.reportPath
            onAuditDone(data.reportPath)
          }
        } else if (data.status === 'error' && data.errorMessage) {
          onAuditError?.(data.errorMessage)
        }
      } catch {
        clearPolling()
      }
    }
    poll.current.timer = setTimeout(tick, POLL_INTERVAL_MS)
  }, [clearPolling, onAuditDone, onAuditError])

  // Initial state load. Polls if mid-run; never auto-fires onAuditDone
  // for the existing reportPath so a refresh doesn't reopen old tabs.
  //
  // Contract for the deps list (eslint-disable below): only re-runs on
  // projectId. `startPolling` is recreated each render but reading it
  // here would loop; callers must wrap onAuditDone / onAuditError in
  // useCallback so the closure stays stable.
  useEffect(() => {
    let cancelled = false
    // Reset last-reported snapshot for the new project; otherwise a
    // path from project A could mask a brand-new fetch on project B.
    lastReportedPath.current = null
    void getAuditState(projectId).then((data) => {
      if (cancelled) return
      setState(data)
      // Snapshot last-known reportPath so completion polling can detect
      // a TRUE new path (vs already-shown previous run).
      lastReportedPath.current = data.reportPath ?? null
      if (data.status === 'running') {
        startPolling()
      }
    }).catch(() => {
      /* tolerate — button still works for fresh runs */
    })
    return () => {
      cancelled = true
      clearPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const handleClick = async () => {
    const pid = activeProjectId.current
    setRunning(true)
    try {
      const next = await runAudit(pid)
      if (activeProjectId.current !== pid) return
      // Defensive: backend should return 'running'; if it ever returns
      // 'idle' (race / unexpected), still kick the polling so the UI
      // doesn't hang in indeterminate state.
      setState({ ...next, status: next.status === 'idle' ? 'running' : next.status })
      startPolling()
    } catch (e) {
      onAuditError?.(e instanceof Error ? e.message : '启动审计失败')
    } finally {
      if (activeProjectId.current === pid) setRunning(false)
    }
  }

  const status = state?.status ?? 'idle'
  const isBusy = running || status === 'running'
  const isError = status === 'error'
  // design §6.1 "done" highlight: only when an audit report is the
  // active tab AND we aren't currently running/erroring. Priority:
  // running > error > viewingAuditReport > idle.
  const isViewingDone = !isBusy && !isError && viewingAuditReport

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy}
      title={
        isBusy
          ? '审计中…'
          : isError
            ? `上次失败: ${state?.errorMessage ?? '未知错误'} · 点击重试`
            : isViewingDone
              ? '正在查看审计报告 · 点击重新生成'
              : '生成审计报告'
      }
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded ${
        isError
          ? 'text-red-600 hover:bg-red-50'
          : isBusy
            ? 'text-blue-600 bg-blue-50 cursor-not-allowed'
            : isViewingDone
              ? 'text-green-700 bg-green-50 hover:bg-green-100'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {isBusy ? (
        <Loader2 size={15} className="animate-spin" />
      ) : isError ? (
        <AlertCircle size={15} />
      ) : (
        <Sparkles size={15} />
      )}
      {isBusy ? '审计中' : '审计'}
    </button>
  )
}
