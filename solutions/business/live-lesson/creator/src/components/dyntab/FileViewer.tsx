import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, FileText } from 'lucide-react'
import { readFile } from '../../api/projects'
import AuditReportRenderer from '../audit/AuditReportRenderer'

/**
 * Generic read-only viewer for any ProjectFile, opened as a dynamic
 * tab. Dispatches by extension + path prefix:
 *
 *   audit/*.md       → AuditReportRenderer (callout directives parsed)
 *   other *.md       → AuditReportRenderer too (degrades to plain markdown
 *                       when no callout directives are present)
 *   *.json           → pretty-printed in a <pre>
 *   *.txt / anything → raw text in a <pre>
 *
 * Editing is out of scope here — Plan / Execution / Skills tabs are the
 * editing surfaces. This is the "look at any project file" surface.
 */

interface Props {
  projectId: string
  filePath: string
}

export default function FileViewer({ projectId, filePath }: Props) {
  const [content, setContent] = useState('')
  const [fileType, setFileType] = useState<string>('txt')
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
      const data = await readFile(pid, filePath)
      if (activeProjectId.current !== pid) return
      setContent(data.content)
      setFileType(data.fileType ?? guessTypeByExt(filePath))
    } catch (e) {
      if (activeProjectId.current !== pid) return
      setError(e instanceof Error ? e.message : '加载文件失败')
    } finally {
      if (activeProjectId.current === pid) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filePath])

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <div className="px-6 py-2 border-b border-gray-200 bg-white flex items-center gap-2 text-xs text-gray-500">
        <FileText size={13} />
        <span className="truncate font-mono">{filePath}</span>
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
        <div className="max-w-4xl mx-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {loading && !content ? (
            <div className="flex items-center gap-2 text-gray-500 py-6">
              <Loader2 size={16} className="animate-spin" />
              加载中…
            </div>
          ) : (
            <Body filePath={filePath} fileType={fileType} content={content} />
          )}
        </div>
      </div>
    </div>
  )
}

function Body({
  filePath,
  fileType,
  content,
}: {
  filePath: string
  fileType: string
  content: string
}) {
  if (fileType === 'md' || filePath.endsWith('.md')) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
        <AuditReportRenderer markdown={content} />
      </div>
    )
  }
  if (fileType === 'json' || filePath.endsWith('.json')) {
    // Pretty-print if valid; otherwise show raw (which preserves the
    // teacher's broken-JSON state so they know what to fix).
    let pretty = content
    try {
      pretty = JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      pretty = content
    }
    return (
      <pre className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap">
        {pretty}
      </pre>
    )
  }
  return (
    <pre className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap">
      {content}
    </pre>
  )
}

function guessTypeByExt(path: string): string {
  const ext = path.split('.').pop() ?? 'txt'
  return ext.toLowerCase()
}
