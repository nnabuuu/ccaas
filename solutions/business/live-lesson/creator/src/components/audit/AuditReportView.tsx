import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, FileText, Sparkles, Wand2 } from 'lucide-react'
import { getAuditReport, runAudit } from '../../api/audit'
import AuditReportRenderer from './AuditReportRenderer'

/**
 * Renders one specific audit report inside a dynamic tab.
 *
 * Unlike the prior `AuditTab` (which both triggered runs and showed
 * results), this component is the primary viewer — the top-bar
 * AuditButton also triggers but lives outside the report context.
 * Each opened dynamic tab is anchored to a specific `reportPath`, so
 * old tabs keep showing the run they were opened with even after
 * newer audits land. That's the "multiple audit results" property
 * the user asked for.
 *
 * Header surface (design §2.1):
 *   [✦ AI 生成] <path> [↺ 重新生成] [⟳ 重新加载]
 * - AI 生成 badge: amber pill, signals untrusted LLM output (mirrors
 *   the action://fix button color, which has the same trust contract).
 * - 重新生成: kicks off a new audit run; completion is observed by
 *   the top-bar AuditButton's existing polling, which calls
 *   `onAuditDone(newReportPath)` and opens the new tab. This view
 *   stays anchored to its own (now-historical) report.
 * - 重新加载: re-fetches the same file from disk (different from
 *   re-running — used if an agent rewrote the file out-of-band).
 *
 * Stale-project guard: when the parent swaps to a different project,
 * an in-flight fetch could overwrite the new state. `activeProjectId`
 * ref captures the id at request-start.
 */

interface Props {
  projectId: string
  /** Path of the report file inside the project. */
  reportPath: string
  /** Optional toast for run-trigger failures (e.g. backend 5xx). */
  onRegenError?: (message: string) => void
}

export default function AuditReportView({
  projectId,
  reportPath,
  onRegenError,
}: Props) {
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Brief disabled state for the "重新生成" button so a click can't
  // be re-fired before the backend transitions to running. The
  // top-bar AuditButton's polling owns the long-running visual
  // feedback; we just guard the click.
  const [regenInFlight, setRegenInFlight] = useState(false)
  // Holds the cooldown setTimeout id so we can clear it on unmount —
  // otherwise the timer's setState fires on a stale component if
  // the user closes the audit tab within the cooldown window.
  const regenCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const activeProjectId = useRef(projectId)
  useEffect(() => {
    activeProjectId.current = projectId
  }, [projectId])
  useEffect(() => {
    return () => {
      if (regenCooldownTimer.current !== null) {
        clearTimeout(regenCooldownTimer.current)
        regenCooldownTimer.current = null
      }
    }
  }, [])

  const load = async () => {
    const pid = activeProjectId.current
    setLoading(true)
    setError(null)
    try {
      const md = await getAuditReport(pid, reportPath)
      if (activeProjectId.current !== pid) return
      setReport(md)
    } catch (e) {
      if (activeProjectId.current !== pid) return
      setError(e instanceof Error ? e.message : '加载报告失败')
    } finally {
      if (activeProjectId.current === pid) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, reportPath])

  const handleRegen = async () => {
    if (regenInFlight) return
    const pid = activeProjectId.current
    setRegenInFlight(true)
    try {
      // Fire-and-forget POST; the top-bar AuditButton is polling
      // getAuditState() at the page level and will pick up the
      // 'running' state then the completed reportPath, calling
      // onAuditDone(newPath) which opens a fresh tab. This view
      // stays put as a historical record of the old run.
      await runAudit(pid)
      // Keep the button disabled for one extra poll cycle (~3s) so
      // it doesn't briefly re-enable before the top-bar AuditButton
      // transitions to its busy state. Without this gap, a fast
      // double-click would slip through the local guard (the
      // backend in-flight guard catches it, but UX should not
      // pretend the second click was effective). The timer id is
      // tracked so unmount-cleanup can clear it; without that, a
      // teacher closing the tab within 3.5s would trigger a setState
      // on a stale component (React 18 no-ops but warns).
      if (activeProjectId.current === pid) {
        if (regenCooldownTimer.current !== null) {
          clearTimeout(regenCooldownTimer.current)
        }
        regenCooldownTimer.current = setTimeout(() => {
          regenCooldownTimer.current = null
          if (activeProjectId.current === pid) setRegenInFlight(false)
        }, 3_500)
      }
    } catch (e) {
      if (activeProjectId.current === pid) {
        onRegenError?.(
          e instanceof Error ? e.message : '触发新一轮审计失败',
        )
        setRegenInFlight(false)
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <div className="px-6 py-2 border-b border-gray-200 bg-white flex items-center gap-2 text-xs text-gray-500">
        {/* design §2.1 — "AI 生成" badge. Amber matches the trust
            contract used by action://fix buttons inside the report
            body (both are untrusted LLM output the teacher should
            cross-check). */}
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700"
          title="本报告由 AI 生成, 请人工核对"
          aria-label="AI 生成内容, 请人工核对"
        >
          <Sparkles size={10} aria-hidden="true" />
          AI 生成
        </span>
        <FileText size={13} />
        <span className="truncate font-mono">{reportPath}</span>
        <button
          type="button"
          onClick={handleRegen}
          disabled={regenInFlight}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
          title="重新生成 — 触发新一轮审计, 旧报告保留"
        >
          {regenInFlight ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Wand2 size={12} />
          )}
          重新生成
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
          title="重新加载 — 重读当前文件 (不触发新审计)"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          重新加载
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {loading && !report ? (
            <div className="flex items-center gap-2 text-gray-500 py-6">
              <Loader2 size={16} className="animate-spin" />
              加载中…
            </div>
          ) : !report.trim() ? (
            <div className="px-4 py-10 text-center bg-white border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-500">报告内容为空或文件已删除</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
              <AuditReportRenderer markdown={report} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
