import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, FileText } from 'lucide-react'
import { getAuditReport } from '../../api/audit'
import AuditReportRenderer from './AuditReportRenderer'

/**
 * Renders one specific audit report inside a dynamic tab.
 *
 * Unlike the prior `AuditTab` (which both triggered runs and showed
 * results), this component is purely a viewer — the trigger lives in
 * the top-bar AuditButton. Each opened dynamic tab is anchored to a
 * specific `reportPath`, so old tabs keep showing the run they were
 * opened with even after newer audits land. That's the "multiple
 * audit results" property the user asked for.
 *
 * Stale-project guard: when the parent swaps to a different project,
 * an in-flight fetch could overwrite the new state. `activeProjectId`
 * ref captures the id at request-start.
 */

interface Props {
  projectId: string
  /** Path of the report file inside the project. */
  reportPath: string
}

export default function AuditReportView({ projectId, reportPath }: Props) {
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeProjectId = useRef(projectId)
  useEffect(() => {
    activeProjectId.current = projectId
  }, [projectId])

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

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <div className="px-6 py-2 border-b border-gray-200 bg-white flex items-center gap-2 text-xs text-gray-500">
        <FileText size={13} />
        <span className="truncate font-mono">{reportPath}</span>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
          title="重新加载"
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
