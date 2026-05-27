import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProject, publishProject } from '../api/projects'
import type { Project, ProjectFile } from '../types'
import EditorLayout from '../components/layout/EditorLayout'
import AiPanel from '../components/sidebar/AiPanel'
import TabBar, {
  type DynamicTabItem,
  type WorkspaceTab,
} from '../components/layout/TabBar'
import ExecutionTab from '../components/execution/ExecutionTab'
import PlanTab from '../components/plan/PlanTab'
import AuditReportView from '../components/audit/AuditReportView'
import FileViewer from '../components/dyntab/FileViewer'
import TopBar from '../components/topbar/TopBar'
import ProjectChangeNotice from '../components/ProjectChangeNotice'
import { useProjectChanges } from '../hooks/useProjectChanges'
import {
  ChatBridgeContext,
  type ChatBridge,
} from '../contexts/ChatBridgeContext'
import {
  closeDynamic,
  dynamicTabId,
  initialState,
  openDynamic,
  selectDynamic,
  selectWorkspace,
  type DynamicTab,
  type TabsState,
  type WorkspaceTabKey,
} from '../lib/dynamic-tabs'

/**
 * Project editor — v7-rich layout (design `creator-v7-rich-design-doc.md`):
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ TopBar · 项目级 (← title status 📁 ◇ ⋯ 发布)             │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ TabBar · 工作区 (教案/执行/Skills) + 动态 tabs (audit/file) │
 *   ├──────────┬──────────────────────────────────────────────┤
 *   │ AiPanel  │ Tab content                                  │
 *   └──────────┴──────────────────────────────────────────────┘
 *
 * Workspace tabs are fixed; dynamic tabs accumulate on demand (each
 * Audit run produces a new tab; the Files popover can open any project
 * file as a viewer tab). Multiple audit tabs is the load-bearing case
 * — each one points at a unique `audit/<timestamp>.md` path so old
 * runs stay readable after new ones land.
 */

const WORKSPACE_TABS: readonly WorkspaceTab[] = [
  { key: 'plan', label: '教案设计', dotColor: 'bg-teal-500' },
  { key: 'execution', label: '执行设计', dotColor: 'bg-blue-500' },
  { key: 'skills', label: 'Skills', dotColor: 'bg-purple-500' },
] as const

export default function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabs, setTabs] = useState<TabsState>(initialState)
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [publishOk, setPublishOk] = useState(false)
  // Chat-bridge injection target: when set, AiPanel will auto-send +
  // call onPendingConsumed to clear. Driven by the "让 AI 修复"
  // buttons inside the audit report renderer.
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(
    null,
  )

  // agent-runtime SSE subscription (unchanged from prior layout — top
  // bar surfaces the connection state via a dot).
  const { events, isConnected, error: sseError } = useProjectChanges(id ?? null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setDismissed(new Set())
    // Switching projects resets the dynamic-tab list — keeping audit
    // tabs from project A visible on project B would be confusing.
    setTabs(initialState())
  }, [id])

  // Which file path the currently-active tab is editing (so a file-
  // change notice can prompt a reload of just that tab).
  const currentlyEditingPath = useMemo(() => {
    if (tabs.activeWorkspace === 'execution') return 'execution/manifest.json'
    if (tabs.activeWorkspace === 'plan') return 'plan/lesson-plan.md'
    // Dynamic tabs (audit / file viewer) have their own reload buttons.
    return null
  }, [tabs.activeWorkspace, tabs.activeDynamic])

  const handleDismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])

  const handleReload = useCallback(
    (path: string) => {
      if (path === currentlyEditingPath) {
        setReloadKey((k) => k + 1)
        setDismissed((prev) => {
          const next = new Set(prev)
          for (const e of events) {
            if (e.path === path) {
              next.add(`${e.at}|${e.path}|${e.kind}|${e.actor ?? ''}`)
            }
          }
          return next
        })
      }
    },
    [currentlyEditingPath, events],
  )

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
    void fetchProject()
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
      setProject((p) => (p ? { ...p, status: 'published' } : p))
      setTimeout(() => setPublishMsg(null), 3000)
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : 'Publish failed')
      setPublishOk(false)
    } finally {
      setPublishing(false)
    }
  }

  // ── Dynamic tab handlers ──

  const handleAuditDone = useCallback((reportPath: string) => {
    // Each audit run produces a fresh timestamped reportPath → each
    // gets its own tab. Title is the trailing time portion of the
    // timestamp for a recognizable, compact label.
    const m = reportPath.match(/T(\d{2}-\d{2}-\d{2})/)
    const title = `审计 ${m ? m[1].replace(/-/g, ':') : ''}`
    const tab: DynamicTab = {
      id: dynamicTabId(),
      kind: 'audit-report',
      reportPath,
      title: title.trim() || '审计',
      openedAt: Date.now(),
    }
    setTabs((s) => openDynamic(s, tab))
    // Refresh project files so the new audit report appears in the
    // Files popover (background — not blocking).
    void fetchProject()
  }, [fetchProject])

  const handlePickFile = useCallback((filePath: string) => {
    const tab: DynamicTab = {
      id: dynamicTabId(),
      kind: 'file-viewer',
      filePath,
      title: filePath.split('/').slice(-1)[0] || filePath,
      openedAt: Date.now(),
    }
    setTabs((s) => openDynamic(s, tab))
  }, [])

  // Convert internal DynamicTab[] into the TabBar's display shape.
  const dynamicTabItems: DynamicTabItem[] = useMemo(
    () => tabs.dynamic.map((t) => ({ id: t.id, label: t.title, kind: t.kind })),
    [tabs.dynamic],
  )

  // Chat-bridge wiring. Keep the bridge identity stable across renders
  // so context consumers don't churn; the callbacks read fresh state
  // via the setState updaters.
  const chatBridge: ChatBridge = useMemo(
    () => ({
      sendMessage(text) {
        setPendingChatMessage(text)
      },
      switchToWorkspace(key, _anchor) {
        setTabs((s) => selectWorkspace(s, key))
        // _anchor (e.g. step id) is accepted but not yet acted on —
        // scroll-to-anchor needs each workspace tab to expose an
        // imperative "scrollTo" API, which is a follow-up.
      },
    }),
    [],
  )

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

  // Resolve the currently-active dynamic tab once for the render
  // switch below.
  const activeDyn = tabs.activeDynamic
    ? tabs.dynamic.find((t) => t.id === tabs.activeDynamic) ?? null
    : null

  const renderTabContent = () => {
    if (activeDyn) {
      if (activeDyn.kind === 'audit-report') {
        return (
          <AuditReportView
            projectId={project.id}
            reportPath={activeDyn.reportPath}
          />
        )
      }
      return (
        <FileViewer projectId={project.id} filePath={activeDyn.filePath} />
      )
    }
    switch (tabs.activeWorkspace) {
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
      default:
        return null
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <TopBar
        project={project}
        files={files}
        isConnected={isConnected}
        sseError={sseError}
        publishing={publishing}
        publishMsg={publishMsg}
        publishOk={publishOk}
        onBack={() => navigate('/projects')}
        onPublish={handlePublish}
        onPickFile={handlePickFile}
        onAuditDone={handleAuditDone}
      />

      <ProjectChangeNotice
        events={events}
        currentlyEditingPath={currentlyEditingPath}
        onReload={handleReload}
        onDismiss={handleDismiss}
        dismissed={dismissed}
      />

      <ChatBridgeContext.Provider value={chatBridge}>
        <EditorLayout
          left={
            <AiPanel
              project={project}
              pendingMessage={pendingChatMessage}
              onPendingConsumed={() => setPendingChatMessage(null)}
            />
          }
          right={
            <div className="flex flex-col h-full">
              <TabBar
                workspaceTabs={WORKSPACE_TABS}
                activeWorkspace={tabs.activeWorkspace}
                dynamicTabs={dynamicTabItems}
                activeDynamic={tabs.activeDynamic}
                onSelectWorkspace={(k) =>
                  setTabs((s) => selectWorkspace(s, k as WorkspaceTabKey))
                }
                onSelectDynamic={(idArg) =>
                  setTabs((s) => selectDynamic(s, idArg))
                }
                onCloseDynamic={(idArg) =>
                  setTabs((s) => closeDynamic(s, idArg))
                }
              />
              <div className="flex-1 overflow-auto">{renderTabContent()}</div>
            </div>
          }
        />
      </ChatBridgeContext.Provider>
    </div>
  )
}
