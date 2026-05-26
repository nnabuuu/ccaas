import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Trash2,
  FolderOpen,
  Search,
  ArchiveRestore,
  FileText,
  ArrowUpDown,
} from 'lucide-react'
import {
  listProjects,
  createProject,
  deleteProject,
  restoreProject,
} from '../api/projects'
import type { Project, ProjectListStatus } from '../types'
import CreateProjectModal from '../components/CreateProjectModal'

type SortKey = 'updatedAt' | 'createdAt' | 'title'

const STATUS_STYLES: Record<Project['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<Project['status'], string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

const TAB_LABELS: Record<Exclude<ProjectListStatus, 'all'>, string> = {
  active: '进行中',
  archived: '已归档',
}

const SORT_LABELS: Record<SortKey, string> = {
  updatedAt: '最近编辑',
  createdAt: '最近创建',
  title: '标题 A→Z',
}

// Relative time formatter (intentionally tiny — no date-fns dep). Falls
// back to absolute date for anything older than a week so the badge
// stays meaningful instead of saying "23 days ago".
const RTF = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })
function relativeTime(iso: string): string {
  const date = new Date(iso)
  const diffMs = date.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const absSec = Math.abs(diffSec)
  if (absSec < 60) return RTF.format(diffSec, 'second')
  if (absSec < 3600) return RTF.format(Math.round(diffSec / 60), 'minute')
  if (absSec < 86400) return RTF.format(Math.round(diffSec / 3600), 'hour')
  if (absSec < 604800) return RTF.format(Math.round(diffSec / 86400), 'day')
  return date.toLocaleDateString('zh-CN')
}

function sortProjects(list: Project[], key: SortKey): Project[] {
  const sorted = [...list]
  if (key === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  } else if (key === 'createdAt') {
    sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } else {
    sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  return sorted
}

export default function ProjectListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL is the source of truth for view state so refreshes / back-button
  // / shared links restore the exact same view.
  const rawStatus = searchParams.get('status')
  const status: Exclude<ProjectListStatus, 'all'> =
    rawStatus === 'archived' ? 'archived' : 'active'
  const query = searchParams.get('q') ?? ''
  const rawSort = searchParams.get('sort')
  const sortKey: SortKey =
    rawSort === 'createdAt' || rawSort === 'title' ? rawSort : 'updatedAt'

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listProjects({ status })
      setProjects(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const updateParams = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    // Drop falsy params so the URL stays clean (`?` instead of `?q=`).
    for (const k of Array.from(next.keys())) {
      const v = next.get(k)
      if (!v) next.delete(k)
    }
    setSearchParams(next, { replace: true })
  }

  const handleSetStatus = (next: Exclude<ProjectListStatus, 'all'>) => {
    updateParams((p) => {
      if (next === 'active') p.delete('status')
      else p.set('status', next)
    })
  }

  const handleSetQuery = (next: string) => {
    updateParams((p) => {
      if (next) p.set('q', next)
      else p.delete('q')
    })
  }

  const handleSetSort = (next: SortKey) => {
    updateParams((p) => {
      if (next === 'updatedAt') p.delete('sort')
      else p.set('sort', next)
    })
  }

  const handleCreate = async (data: { title: string; description: string }) => {
    const project = await createProject(data)
    setShowCreateModal(false)
    navigate(`/projects/${project.id}`)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定归档此项目?可在「已归档」页面恢复。')) return
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive project')
    }
  }

  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await restoreProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore project')
    }
  }

  // Client-side filter is fine — list is small (no pagination, no
  // server-side search). Substring match is case-insensitive and
  // works on title only (description is too noisy for quick scan).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? projects.filter((p) => p.title.toLowerCase().includes(q))
      : projects
    return sortProjects(base, sortKey)
  }, [projects, query, sortKey])

  const isArchivedView = status === 'archived'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">课程项目</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            <Plus size={16} />
            新建项目
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Status tabs + search + sort */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex bg-white border border-gray-200 rounded-lg p-1">
            {(['active', 'archived'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleSetStatus(t)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  status === t
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => handleSetQuery(e.target.value)}
                placeholder="搜索标题…"
                className="pl-9 pr-3 py-1.5 w-full sm:w-56 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <ArrowUpDown
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <select
                value={sortKey}
                onChange={(e) => handleSetSort(e.target.value as SortKey)}
                className="pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent appearance-none cursor-pointer"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            isArchivedView={isArchivedView}
            hasQuery={query.trim().length > 0}
            onCreate={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isArchivedView={isArchivedView}
                onOpen={() => navigate(`/projects/${project.id}`)}
                onDelete={(e) => handleDelete(project.id, e)}
                onRestore={(e) => handleRestore(project.id, e)}
              />
            ))}
          </div>
        )}
      </main>

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}

// ── Sub-components ──

function EmptyState({
  isArchivedView,
  hasQuery,
  onCreate,
}: {
  isArchivedView: boolean
  hasQuery: boolean
  onCreate: () => void
}) {
  if (hasQuery) {
    return (
      <div className="text-center py-20">
        <Search size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">没有匹配的项目</p>
      </div>
    )
  }
  if (isArchivedView) {
    return (
      <div className="text-center py-20">
        <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">归档区是空的</p>
      </div>
    )
  }
  return (
    <div className="text-center py-20">
      <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
      <p className="text-gray-500 mb-4">还没有课程项目</p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
      >
        <Plus size={16} />
        创建第一个项目
      </button>
    </div>
  )
}

function ProjectCard({
  project,
  isArchivedView,
  onOpen,
  onDelete,
  onRestore,
}: {
  project: Project
  isArchivedView: boolean
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
  onRestore: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onClick={onOpen}
      className={`bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-gray-300 hover:shadow-sm group ${
        isArchivedView ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 truncate flex-1">
          {project.title}
        </h3>
        {isArchivedView ? (
          <button
            onClick={onRestore}
            className="p-1 text-gray-400 hover:text-green-600 opacity-0 group-hover:opacity-100"
            title="恢复项目"
            aria-label="恢复项目"
          >
            <ArchiveRestore size={14} />
          </button>
        ) : (
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
            title="归档项目"
            aria-label="归档项目"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-3 line-clamp-2 min-h-[2.5rem]">
        {project.description || '暂无描述'}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_STYLES[project.status]}`}
          >
            {STATUS_LABELS[project.status]}
          </span>
          {typeof project.fileCount === 'number' && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
              <FileText size={11} />
              {project.fileCount}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap" title={new Date(project.updatedAt).toLocaleString('zh-CN')}>
          {relativeTime(project.updatedAt)}
        </span>
      </div>
    </div>
  )
}
