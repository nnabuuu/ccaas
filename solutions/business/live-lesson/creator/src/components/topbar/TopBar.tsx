import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, MoreHorizontal, Upload } from 'lucide-react'
import type { Project, ProjectFile } from '../../types'
import FilesPopover from './FilesPopover'
import AuditButton from './AuditButton'

/**
 * Project-level top bar — design §1.2:
 *   ← projects | title | status | sse-dot | 📁 files | ◇ 审计 | ⋯ more | ↑ 发布
 *
 * Project-level operations (files, audit, more, publish) live HERE,
 * not in the tab bar. Tab bar below is for content workspaces
 * (plan / execution / skills) + dynamic tabs.
 *
 * The ⋯ menu is placeholder for v7-rich's "version history / export /
 * project settings / collaborate" items (design §3.2). Click currently
 * shows a coming-soon hint.
 */

interface Props {
  project: Project
  files: ProjectFile[]
  isConnected: boolean
  sseError: string | null
  publishing: boolean
  publishMsg: string | null
  publishOk: boolean
  onBack: () => void
  onPublish: () => void
  onPickFile: (path: string) => void
  onAuditDone: (reportPath: string) => void
  onAuditError?: (message: string) => void
}

export default function TopBar({
  project,
  files,
  isConnected,
  sseError,
  publishing,
  publishMsg,
  publishOk,
  onBack,
  onPublish,
  onPickFile,
  onAuditDone,
  onAuditError,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
      <button
        onClick={onBack}
        className="p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
        aria-label="返回项目列表"
      >
        <ArrowLeft size={18} />
      </button>
      <h1 className="text-sm font-semibold text-gray-900 truncate">{project.title}</h1>
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          project.status === 'published'
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        {project.status === 'published' ? '已发布' : '草稿'}
      </span>
      {publishMsg && (
        <span className={`text-xs ${publishOk ? 'text-green-600' : 'text-red-500'}`}>
          {publishMsg}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {/* SSE connection indicator — green when subscribed to agent-runtime
            changes, gray when not. Hover for the error message if any. */}
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${
            isConnected ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={
            isConnected ? '已连接到 agent-runtime 实时变更' : (sseError ?? '未连接')
          }
        />
        <FilesPopover files={files} onPickFile={onPickFile} />
        <AuditButton
          projectId={project.id}
          onAuditDone={onAuditDone}
          onAuditError={onAuditError}
        />
        <MorePlaceholder open={moreOpen} setOpen={setMoreOpen} />
        <button
          onClick={onPublish}
          disabled={publishing}
          className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          <Upload size={14} />
          {publishing ? '发布中…' : '发布'}
        </button>
      </div>
    </header>
  )
}

// design §3.2 placeholder. Real items: version history, export,
// project settings, collaborate. All "待设计" — render as disabled
// list so users see what's coming.
function MorePlaceholder({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (b: boolean) => void
}) {
  // Click-outside to close (matches FilesPopover's pattern). Doing
  // this instead of onMouseLeave keeps keyboard + touch users able to
  // dismiss the popover.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, setOpen])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center px-2 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
        aria-label="更多操作"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            更多操作 (待设计)
          </div>
          {['版本历史', '导出', '项目设置', '协作'].map((label) => (
            <div
              key={label}
              className="px-3 py-1.5 text-sm text-gray-400 cursor-not-allowed"
              title="coming soon"
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
