import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, FileText, X } from 'lucide-react'
import type { ProjectFile } from '../../types'

/**
 * Top-bar file picker. Click 📁 → dropdown groups project files by
 * top-level folder; click a file → fires `onPickFile(path)` so the
 * parent can open it as a dynamic tab.
 *
 * Grouping convention (matches the project's folder layout):
 *   plan/      —— 教案设计相关
 *   execution/ —— 执行设计相关
 *   audit/     —— 审计报告 (timestamped history)
 *   skills/    —— 连接器
 *   (其他根目录文件归 "other")
 *
 * No tree expand/collapse for MVP — flat grouped list. Audit reports
 * accumulate so we sort newest-first within their group (path is
 * lexically sortable per the backend's timestamp format).
 */

interface Props {
  files: ProjectFile[]
  /** Called with the file's path when a file is clicked. Parent decides
   * what to do (typically: open in a dynamic tab). */
  onPickFile: (path: string) => void
}

const GROUP_ORDER = ['plan', 'execution', 'audit', 'skills'] as const
const GROUP_LABELS: Record<string, string> = {
  plan: '教案设计',
  execution: '执行设计',
  audit: '审计报告',
  skills: 'Skills',
  other: '其他',
}

interface FileGroup {
  key: string
  label: string
  files: ProjectFile[]
}

function groupFiles(files: ProjectFile[]): FileGroup[] {
  const byGroup = new Map<string, ProjectFile[]>()
  for (const f of files) {
    const top = f.path.split('/')[0]
    const key = (GROUP_ORDER as readonly string[]).includes(top) ? top : 'other'
    const arr = byGroup.get(key) ?? []
    arr.push(f)
    byGroup.set(key, arr)
  }
  // Sort: within each group, alphabetical by path EXCEPT audit/ which
  // we reverse-sort so newest timestamped reports appear first.
  for (const [k, arr] of byGroup) {
    arr.sort((a, b) =>
      k === 'audit' ? b.path.localeCompare(a.path) : a.path.localeCompare(b.path),
    )
  }
  const out: FileGroup[] = []
  for (const k of [...GROUP_ORDER, 'other']) {
    const arr = byGroup.get(k)
    if (arr && arr.length) {
      out.push({ key: k, label: GROUP_LABELS[k] ?? k, files: arr })
    }
  }
  return out
}

export default function FilesPopover({ files, onPickFile }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => groupFiles(files), [files])

  // Click-outside-to-close. Same pattern as the existing FileBrowser.
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const pick = (path: string) => {
    onPickFile(path)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
        title="项目文件"
      >
        <FolderOpen size={15} />
        文件
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">项目文件</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {groups.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">无文件</div>
            ) : (
              groups.map((g) => (
                <div key={g.key} className="mb-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {g.label}
                  </div>
                  {g.files.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => pick(f.path)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <span className="truncate" title={f.path}>
                        {f.path.slice(g.key === 'other' ? 0 : g.key.length + 1) || f.path}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
