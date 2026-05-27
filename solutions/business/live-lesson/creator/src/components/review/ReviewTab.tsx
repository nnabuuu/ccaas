import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { getLintResult, runLint, type LintResult } from '../../api/lint'
import LintIssueCard from './LintIssueCard'

/**
 * Review tab — surfaces the AI lint result (plan vs execution
 * consistency). On mount and on every reloadKey change, fetch the
 * current cached result. When status is "pending" or "stale", poll
 * every 3s until it settles to "fresh" or "error".
 *
 * "重新运行" button forces a fresh run regardless of cache state
 * (manual override; concurrent clicks are coalesced server-side).
 *
 * Auto-trigger on file save lives in the backend write hooks — the
 * teacher edits plan or manifest, saves, comes back to this tab, and
 * sees fresh issues. No client-side trigger needed.
 */

interface Props {
  projectId: string
  /** Bumping this re-fetches the lint result (parent uses it on file reload). */
  reloadKey?: number
}

const POLL_INTERVAL_MS = 3_000
// Cap polling to avoid running forever if the server gets wedged in
// 'pending'. After ~5 minutes, stop and let the user manually re-run.
const POLL_MAX_ATTEMPTS = 100

export default function ReviewTab({ projectId, reloadKey = 0 }: Props) {
  const [result, setResult] = useState<LintResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  // Tracks the polling timer + attempt count; ref so re-renders don't
  // restart polling unnecessarily.
  const pollState = useRef<{ timer: number | null; attempts: number }>({
    timer: null,
    attempts: 0,
  })

  const clearPolling = useCallback(() => {
    if (pollState.current.timer !== null) {
      window.clearTimeout(pollState.current.timer)
      pollState.current.timer = null
    }
    pollState.current.attempts = 0
  }, [])

  // `activeProjectId` ref tracks the current project across closures —
  // if the user switches projects mid-fetch, the in-flight promise
  // checks this before calling setResult so stale data from project A
  // doesn't overwrite the new state for project B.
  const activeProjectId = useRef(projectId)
  useEffect(() => {
    activeProjectId.current = projectId
  }, [projectId])

  const fetchOnce = useCallback(async (): Promise<LintResult | null> => {
    const pidAtStart = projectId
    try {
      const data = await getLintResult(pidAtStart)
      // Drop the response if the user navigated to a different project
      // while we were awaiting — otherwise we'd render project A's
      // result on project B's tab.
      if (activeProjectId.current !== pidAtStart) return null
      setResult(data)
      setError(null)
      return data
    } catch (e) {
      if (activeProjectId.current !== pidAtStart) return null
      setError(e instanceof Error ? e.message : 'Failed to load lint result')
      return null
    }
  }, [projectId])

  // Poll while server reports pending/stale. Each iteration calls
  // fetchOnce; if the response is terminal (fresh / error / idle), stop.
  const startPolling = useCallback(() => {
    clearPolling()
    const tick = async () => {
      const data = await fetchOnce()
      pollState.current.attempts += 1
      if (
        data &&
        (data.status === 'pending' || data.status === 'stale') &&
        pollState.current.attempts < POLL_MAX_ATTEMPTS
      ) {
        pollState.current.timer = window.setTimeout(tick, POLL_INTERVAL_MS)
      } else {
        clearPolling()
      }
    }
    pollState.current.timer = window.setTimeout(tick, POLL_INTERVAL_MS)
  }, [clearPolling, fetchOnce])

  useEffect(() => {
    setLoading(true)
    fetchOnce().then((data) => {
      setLoading(false)
      if (data && (data.status === 'pending' || data.status === 'stale')) {
        startPolling()
      }
    })
    return () => clearPolling()
  }, [projectId, reloadKey, fetchOnce, startPolling, clearPolling])

  const handleRun = async () => {
    const pidAtStart = projectId
    setRunning(true)
    setError(null)
    clearPolling()
    try {
      const data = await runLint(pidAtStart)
      if (activeProjectId.current !== pidAtStart) return
      // Defensive: if the backend returns `idle` here (race / cache
      // invalidation / unexpected contract), force-show pending so the
      // button stays disabled-ish and the user knows the click was
      // accepted. The cache will catch up on the next poll.
      const next: LintResult =
        data.status === 'idle' ? { ...data, status: 'pending' } : data
      setResult(next)
      if (next.status === 'pending' || next.status === 'stale') {
        startPolling()
      }
    } catch (e) {
      if (activeProjectId.current !== pidAtStart) return
      setError(e instanceof Error ? e.message : 'Failed to run lint')
    } finally {
      if (activeProjectId.current === pidAtStart) {
        setRunning(false)
      }
    }
  }

  if (loading) {
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
          status={result?.status ?? 'idle'}
          generatedAt={result?.generatedAt}
          running={running}
          onRun={handleRun}
        />

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {result?.status === 'error' && result.errorMessage && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            <span className="font-semibold">检查失败: </span>
            {result.errorMessage}
          </div>
        )}

        <IssueList result={result} />
      </div>
    </div>
  )
}

function Header({
  status,
  generatedAt,
  running,
  onRun,
}: {
  status: LintResult['status']
  generatedAt: string | undefined
  running: boolean
  onRun: () => void
}) {
  const meta = STATUS_META[status]
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-0.5">
          AI 一致性检查
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${meta.bg} ${meta.color}`}>
            {meta.Icon && <meta.Icon size={11} />}
            {meta.label}
          </span>
          {generatedAt && status !== 'idle' && (
            <span className="text-gray-400" title={generatedAt}>
              · {formatRelative(generatedAt)}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? (
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

function IssueList({ result }: { result: LintResult | null }) {
  if (!result || result.status === 'idle') {
    return (
      <EmptyHint title="尚未运行检查" body="点击右上角「运行检查」让 AI 对照教案与执行手册。" />
    )
  }
  if (result.status === 'pending') {
    return (
      <EmptyHint
        title="正在分析…"
        body="AI 正在比对 plan/lesson-plan.md 与 execution/manifest.json, 通常需要几秒到十几秒。"
      />
    )
  }
  if (result.status === 'error') {
    // Error banner already shown above; nothing else to render here.
    return null
  }
  if (result.issues.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-6 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 size={20} className="text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">未发现一致性问题</p>
          <p className="text-xs text-green-700 mt-0.5">
            教案与执行手册彼此对应。继续设计或发布即可。
          </p>
        </div>
      </div>
    )
  }
  // Group by severity so the most urgent issues sit at the top.
  const errors = result.issues.filter((i) => i.severity === 'error')
  const warnings = result.issues.filter((i) => i.severity === 'warning')
  const infos = result.issues.filter((i) => i.severity === 'info')
  return (
    <div className="space-y-4">
      {errors.length > 0 && <IssueGroup label="错误" issues={errors} />}
      {warnings.length > 0 && <IssueGroup label="警告" issues={warnings} />}
      {infos.length > 0 && <IssueGroup label="提示" issues={infos} />}
    </div>
  )
}

function IssueGroup({ label, issues }: { label: string; issues: LintResult['issues'] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label} ({issues.length})
      </h3>
      <div className="space-y-2">
        {issues.map((issue, i) => (
          <LintIssueCard key={i} issue={issue} />
        ))}
      </div>
    </div>
  )
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-10 text-center bg-white border border-gray-200 rounded-lg">
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      <p className="text-xs text-gray-500 max-w-md mx-auto">{body}</p>
    </div>
  )
}

const STATUS_META: Record<
  LintResult['status'],
  { label: string; bg: string; color: string; Icon: typeof CheckCircle2 | null }
> = {
  idle: { label: '未运行', bg: 'bg-gray-100', color: 'text-gray-600', Icon: null },
  pending: { label: '运行中', bg: 'bg-blue-50', color: 'text-blue-700', Icon: Loader2 },
  fresh: { label: '已完成', bg: 'bg-green-50', color: 'text-green-700', Icon: CheckCircle2 },
  stale: {
    label: '已过期 · 自动重跑中',
    bg: 'bg-amber-50',
    color: 'text-amber-700',
    Icon: RefreshCw,
  },
  error: { label: '失败', bg: 'bg-red-50', color: 'text-red-700', Icon: AlertCircle },
}

// Lightweight relative-time formatter — same approach as the project
// list page (no date-fns dep).
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
