import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import { getProject, publishProject } from '../api/projects'
import type { Project, ProjectFile } from '../types'
import EditorLayout from '../components/layout/EditorLayout'
import AiPanel from '../components/sidebar/AiPanel'
import TabBar from '../components/layout/TabBar'
import FileBrowser from '../components/sidebar/FileBrowser'
import ExecutionTab from '../components/execution/ExecutionTab'
import PlanTab from '../components/plan/PlanTab'
import ProjectChangeNotice from '../components/ProjectChangeNotice'
import { useProjectChanges } from '../hooks/useProjectChanges'

const TABS = [
  { key: 'plan', label: '教案设计', dotColor: 'bg-teal-500' },
  { key: 'execution', label: '执行设计', dotColor: 'bg-blue-500' },
  { key: 'skills', label: 'Skills', dotColor: 'bg-purple-500' },
  { key: 'review', label: 'Review', dotColor: 'bg-amber-500' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('execution')
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [publishOk, setPublishOk] = useState(false)
  // agent-runtime SSE subscription: surfaces agent-side edits so the
  // operator knows when the agent has touched the same project. The hook
  // hits a relative `/api/projects/:id/changes` on the live-lesson
  // backend; the backend proxies through to ccaas using its tenant
  // CCAAS_API_KEY env var. Browser never holds a ccaas key — see the
  // hook's header for the design rationale.
  // Dismissed notices are tracked locally; `reloadKey` bumps force the
  // active tab to re-fetch from disk.
  const { events, isConnected, error: sseError } = useProjectChanges(id ?? null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [reloadKey, setReloadKey] = useState(0)
  // Reset the dismissed set whenever the operator opens a different project
  // — stale keys for project A would otherwise accumulate forever.
  useEffect(() => {
    setDismissed(new Set())
  }, [id])
  // Map of active tab → the file path it's currently editing. Used to
  // decide whether the [Reload] button is shown on a given notice.
  const currentlyEditingPath = useMemo(() => {
    if (activeTab === 'execution') return 'execution/manifest.json'
    if (activeTab === 'plan') return 'plan/lesson-plan.md'
    return null
  }, [activeTab])
  const handleDismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])
  const handleReload = useCallback((path: string) => {
    // Only the active tab's path is reloaded; other tabs would re-fetch
    // on their next mount anyway. Tabs that share state across mounts
    // (none today) would need their own reload signal.
    if (path === currentlyEditingPath) {
      setReloadKey((k) => k + 1)
      // Also clear the matching notice so the banner doesn't linger.
      // Key must match `eventKey()` in ProjectChangeNotice (includes actor).
      setDismissed((prev) => {
        const next = new Set(prev)
        for (const e of events) {
          if (e.path === path) next.add(`${e.at}|${e.path}|${e.kind}|${e.actor ?? ''}`)
        }
        return next
      })
    }
  }, [currentlyEditingPath, events])

  const fetchProject = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const data = await getProject(id)
      setProject(data)
      setFiles(data.files)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const handlePublish = async () => {
    if (!id) return
    try {
      setPublishing(true)
      setPublishMsg(null)
      setPublishOk(false)
      const { lessonId } = await publishProject(id)
      setPublishMsg(`Published as lesson: ${lessonId}`)
      setPublishOk(true)
      setProject((p) => p ? { ...p, status: 'published' } : p)
      setTimeout(() => setPublishMsg(null), 3000)
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : 'Publish failed')
      setPublishOk(false)
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Project not found'}</p>
          <button
            onClick={() => navigate('/projects')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back to projects
          </button>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'execution':
        return <ExecutionTab projectId={project.id} reloadKey={reloadKey} />
      case 'plan':
        return (
          <div className="flex-1 overflow-y-auto">
            <PlanTab projectId={project.id} />
          </div>
        )
      case 'skills':
        return (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Skills (coming soon)
          </div>
        )
      case 'review':
        return (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Review (coming soon)
          </div>
        )
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header bar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => navigate('/projects')}
          className="p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-semibold text-gray-900 truncate">{project.title}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          project.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {project.status === 'published' ? '已发布' : '草稿'}
        </span>
        {publishMsg && (
          <span className={`text-xs ${publishOk ? 'text-green-600' : 'text-red-500'}`}>
            {publishMsg}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* SSE connection indicator — green when subscribed to agent-runtime
              changes for this project, gray when not (e.g., ccaas not running
              or env var unset). Hover for the error message if any. */}
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
            title={isConnected ? 'Live agent-edit notifications connected' : (sseError ?? 'Disconnected')}
          />
          <FileBrowser files={files} />
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            <Upload size={14} />
            {publishing ? '发布中...' : '发布'}
          </button>
        </div>
      </header>

      {/* Agent-edit notices (Phase 2a). Only renders when there are
          un-dismissed agent-side events; otherwise self-hides. */}
      <ProjectChangeNotice
        events={events}
        currentlyEditingPath={currentlyEditingPath}
        onReload={handleReload}
        onDismiss={handleDismiss}
        dismissed={dismissed}
      />

      {/* Main area */}
      <EditorLayout
        left={<AiPanel project={project} />}
        right={
          <div className="flex flex-col h-full">
            <TabBar tabs={TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as TabKey)} />
            <div className="flex-1 overflow-auto">{renderTabContent()}</div>
          </div>
        }
      />
    </div>
  )
}
