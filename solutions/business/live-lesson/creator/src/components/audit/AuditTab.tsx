import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'
import {
  getAuditReport,
  getAuditState,
  runAudit,
  type AuditRunState,
} from '../../api/audit'
import AuditReportRenderer from './AuditReportRenderer'

/**
 * Review tab content — AI audit panel. Teacher (and eventually agent)
 * triggers an audit manually; backend writes the resulting markdown
 * report to `audit/audit-report.md` and we render it inline.
 *
 * Flow:
 *   mount      → fetchState; if status==='running', kick polling
 *   poll       → every 3s GET /audit until status flips off 'running'
 *   transition → on done, fetch the report markdown
 *   button     → POST /audit/run (returns 'running' state), poll until done
 *
 * Stale-project guard: an `activeProjectId` ref captures the project
 * id at request-start. When fetch responses arrive, we drop them if
 * the user has switched projects in the meantime.
 *
 * v7-rich is out of scope; in the current creator framework this
 * panel lives inside the "Review" tab in the existing TABS array.
 */

interface Props {
  projectId: string
  /** Bumped by parent on file-change SSE; refetches state + report. */
  reloadKey?: number
}

const POLL_INTERVAL_MS = 3_000
// 10 minutes cap. An LLM audit run that goes longer is almost
// certainly stuck — stop polling and let the teacher manually retry.
const POLL_MAX_ATTEMPTS = 200

export default function AuditTab({ projectId, reloadKey = 0 }: Props) {
  const [state, setState] = useState<AuditRunState | null>(null)
  const [report, setReport] = useState<string>('')
  const [loadingState, setLoadingState] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  // Stale-project guard. Updated on prop change so closures captured
  // by in-flight promises can compare before mutating state.
  const activeProjectId = useRef(projectId)
  useEffect(() => {
    activeProjectId.current = projectId
  }, [projectId])

  // Polling timer + attempt counter. Stored in a ref so we can clear
  // without triggering re-renders. `ReturnType<typeof setTimeout>` is
  // portable across browser (number) and Node (Timeout object).
  const poll = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    attempts: number
  }>({
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

  const fetchReport = useCallback(async (pid: string): Promise<void> => {
    setLoadingReport(true)
    try {
      const md = await getAuditReport(pid)
      if (activeProjectId.current !== pid) return
      setReport(md)
    } catch (e) {
      if (activeProjectId.current !== pid) return
      // Report fetch failure isn't fatal — keep showing the existing
      // (possibly empty) report + a small inline notice.
      setError(e instanceof Error ? e.message : '加载报告失败')
    } finally {
      if (activeProjectId.current === pid) setLoadingReport(false)
    }
  }, [])

  const fetchOnce = useCallback(
    async (pid: string): Promise<AuditRunState | null> => {
      try {
        const data = await getAuditState(pid)
        if (activeProjectId.current !== pid) return null
        setState(data)
        setError(null)
        return data
      } catch (e) {
        if (activeProjectId.current !== pid) return null
        setError(e instanceof Error ? e.message : '加载审计状态失败')
        return null
      }
    },
    [],
  )

  // Polling loop while server reports 'running'. Stops on terminal
  // states (done / error / idle) or after max attempts.
  const startPolling = useCallback(() => {
    clearPolling()
    const pid = activeProjectId.current
    const tick = async () => {
      const data = await fetchOnce(pid)
      poll.current.attempts += 1
      if (activeProjectId.current !== pid) {
        clearPolling()
        return
      }
      if (
        data &&
        data.status === 'running' &&
        poll.current.attempts < POLL_MAX_ATTEMPTS
      ) {
        poll.current.timer = setTimeout(tick, POLL_INTERVAL_MS)
      } else {
        clearPolling()
        // Refresh the report when the run terminated successfully.
        if (data?.status === 'done') {
          await fetchReport(pid)
        }
      }
    }
    poll.current.timer = setTimeout(tick, POLL_INTERVAL_MS)
  }, [clearPolling, fetchOnce, fetchReport])

  // Project-change tracker. We want to wipe `report` / `state` on a
  // project switch (those are stale), but NOT on a same-project
  // reloadKey bump (would cause an empty-state flash while the
  // refetch runs).
  const prevProjectId = useRef<string | null>(null)

  // Initial load + on reloadKey bump (parent signaled a file changed).
  useEffect(() => {
    let cancelled = false
    const projectChanged = prevProjectId.current !== projectId
    prevProjectId.current = projectId
    setLoadingState(true)
    setError(null)
    if (projectChanged) {
      // Truly switching projects — wipe the previous one's state.
      setReport('')
      setState(null)
    }
    void fetchOnce(projectId).then((data) => {
      if (cancelled) return
      setLoadingState(false)
      if (data?.status === 'running') {
        startPolling()
      }
      if (data?.status === 'done') {
        void fetchReport(projectId)
      }
    })
    return () => {
      cancelled = true
      clearPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, reloadKey])

  const handleRun = async () => {
    // Read from the ref, not the closed-over prop, so a project switch
    // between render and click doesn't fire the audit against the
    // previous selection. (The ref is kept in sync by the effect above.)
    const pid = activeProjectId.current
    setRunning(true)
    setError(null)
    clearPolling()
    try {
      const next = await runAudit(pid)
      if (activeProjectId.current !== pid) return
      // Backend returns 'running' synchronously. Defensive: if it returns
      // 'idle' (race / unexpected), force pending locally so the button
      // stays disabled-ish and the user knows the click was accepted.
      const adjusted: AuditRunState =
        next.status === 'idle' ? { ...next, status: 'running' } : next
      setState(adjusted)
      if (adjusted.status === 'running') {
        startPolling()
      }
    } catch (e) {
      if (activeProjectId.current !== pid) return
      setError(e instanceof Error ? e.message : '启动审计失败')
    } finally {
      if (activeProjectId.current === pid) setRunning(false)
    }
  }

  if (loadingState) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <Loader2 size={18} className="animate-spin mr-2" />
        加载中…
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Header
          state={state}
          running={running}
          onRun={handleRun}
        />

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {state?.status === 'error' && state.errorMessage && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            <span className="font-semibold">审计失败: </span>
            {state.errorMessage}
          </div>
        )}

        <Body
          state={state}
          report={report}
          loadingReport={loadingReport}
        />
      </div>
    </div>
  )
}

function Header({
  state,
  running,
  onRun,
}: {
  state: AuditRunState | null
  running: boolean
  onRun: () => void
}) {
  const status = state?.status ?? 'idle'
  const meta = STATUS_META[status]
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-0.5">
          AI 一致性审计
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${meta.bg} ${meta.color}`}
          >
            {meta.Icon && <meta.Icon size={11} className={meta.spin ? 'animate-spin' : ''} />}
            {meta.label}
          </span>
          {state?.lastGeneratedAt && status !== 'idle' && (
            <span className="text-gray-400" title={state.lastGeneratedAt}>
              · {formatRelative(state.lastGeneratedAt)}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={running || status === 'running'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running || status === 'running' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            运行中…
          </>
        ) : status === 'idle' ? (
          <>
            <Play size={14} />
            运行检查
          </>
        ) : (
          <>
            <RefreshCw size={14} />
            重新运行
          </>
        )}
      </button>
    </div>
  )
}

function Body({
  state,
  report,
  loadingReport,
}: {
  state: AuditRunState | null
  report: string
  loadingReport: boolean
}) {
  const status = state?.status ?? 'idle'
  if (status === 'idle') {
    return (
      <EmptyState
        title="尚未运行审计"
        body="点击右上角「运行检查」让 AI 对照教案与执行手册, 生成一份审计报告。"
      />
    )
  }
  if (status === 'running') {
    return (
      <EmptyState
        title="正在分析…"
        body="AI 正在比对 plan/lesson-plan.md 与 execution/manifest.json, 通常需要几秒到十几秒。"
      />
    )
  }
  if (status === 'error') {
    // Error banner already shown above.
    return null
  }
  // status === 'done'
  if (loadingReport) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-6">
        <Loader2 size={16} className="animate-spin" />
        加载报告…
      </div>
    )
  }
  if (!report.trim()) {
    return (
      <EmptyState
        title="审计报告为空"
        body="后端报告了 done 但报告文件为空 — 请点「重新运行」再试一次。"
      />
    )
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
      <AuditReportRenderer markdown={report} />
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-10 text-center bg-white border border-gray-200 rounded-lg">
      <FileText size={24} className="text-gray-300 mx-auto mb-2.5" />
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      <p className="text-xs text-gray-500 max-w-md mx-auto">{body}</p>
    </div>
  )
}

const STATUS_META: Record<
  AuditRunState['status'],
  {
    label: string
    bg: string
    color: string
    Icon: typeof CheckCircle2 | null
    spin?: boolean
  }
> = {
  idle: { label: '未运行', bg: 'bg-gray-100', color: 'text-gray-600', Icon: null },
  running: {
    label: '运行中',
    bg: 'bg-blue-50',
    color: 'text-blue-700',
    Icon: Loader2,
    spin: true,
  },
  done: { label: '已完成', bg: 'bg-green-50', color: 'text-green-700', Icon: CheckCircle2 },
  error: { label: '失败', bg: 'bg-red-50', color: 'text-red-700', Icon: AlertCircle },
}

// Same lightweight relative-time format pattern used elsewhere in the
// creator (no date-fns dep).
const RTF = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })
function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!t || t < 1) return ''
  const diffSec = Math.round((t - Date.now()) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return RTF.format(diffSec, 'second')
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), 'hour')
  return new Date(iso).toLocaleString('zh-CN')
}
