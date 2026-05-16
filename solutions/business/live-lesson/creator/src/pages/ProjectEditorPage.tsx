import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import { getProject, publishProject } from '../api/projects'
import type { Project, ProjectFile } from '../types'
import EditorLayout from '../components/layout/EditorLayout'
import AiPanel from '../components/sidebar/AiPanel'
import TabBar from '../components/layout/TabBar'
import FileBrowser from '../components/sidebar/FileBrowser'
import ExecutionTab from '../components/execution/ExecutionTab'

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
        return <ExecutionTab projectId={project.id} />
      case 'plan':
        return (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            教案设计 (coming soon)
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
