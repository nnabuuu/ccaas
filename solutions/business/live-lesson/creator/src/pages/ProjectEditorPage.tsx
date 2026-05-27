import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { EMPTY_SIGNAL, type ScrollSignal } from '../lib/scroll-anchor'

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
  // Scroll-to-anchor signal for whichever workspace tab is becoming
  // active. Set by chatBridge.switchToWorkspace; consumed by
  // ExecutionTab / PlanTab via the `scrollAnchor` + `scrollNonce`
  // props. Nonce-on-every-dispatch lets a repeat click of the same
  // nav link re-trigger the scroll (otherwise the child useEffect's
  // deps wouldn't change).
  //
  // Cross-tab stale-anchor safety: the signal is global to the page,
  // not scoped per workspace. If a tab swap (e.g. manual click on
  // tab bar) re-mounts a tab while the signal still holds an anchor
  // intended for the OTHER tab, that tab's effect fires with the
  // wrong-namespace anchor. Today both consumers are safe by
  // querySelector miss: a stepId like "s-1700-3" won't match any
  // `[data-req-id]` on plan side, and a reqId like "r-1.2.3" won't
  // match any `[data-step-id]` on execution side. The symptom is a
  // silent no-op. If a future tab uses a less distinct id-space,
  // scope the signal per WorkspaceTabKey.
  const [scrollSignal, setScrollSignal] = useState<ScrollSignal>(EMPTY_SIGNAL)
  // Monotonic counter for scrollSignal nonces. Avoids Date.now()'s
  // wall-clock fragility — NTP slew or DST adjustments could produce
  // a non-increasing timestamp, which React would then treat as
  // "unchanged" and skip the child effect re-run.
  const scrollNonceRef = useRef(0)

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
    // Drop any unconsumed bridge message. Without this, a "让 AI 修复"
    // click on project A that triggered a setState but hadn't yet been
    // consumed by AiPanel (e.g. because chat was mid-stream) would fire
    // into project B's chat session on next mount. Cross-project leak.
    setPendingChatMessage(null)
    // Same rationale for the scroll signal — a pending step-N anchor
    // on project A would otherwise try to scroll project B's tab.
    setScrollSignal(EMPTY_SIGNAL)
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
      switchToWorkspace(key, anchor) {
        setTabs((s) => selectWorkspace(s, key))
        // Set the scroll signal *after* selectWorkspace so the
        // about-to-mount tab sees the anchor on its first render. The
        // monotonic counter (vs Date.now()) means repeat clicks of
        // the same anchor always produce a fresh dep change in the
        // child useEffect, regardless of system clock behavior.
        scrollNonceRef.current += 1
        setScrollSignal({
          anchor: anchor ?? null,
          nonce: scrollNonceRef.current,
        })
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
        return (
          <ExecutionTab
            projectId={project.id}
            reloadKey={reloadKey}
            scrollAnchor={scrollSignal.anchor}
            scrollNonce={scrollSignal.nonce}
          />
        )
      case 'plan':
        return (
          <div className="flex-1 overflow-y-auto">
            <PlanTab
              projectId={project.id}
              scrollAnchor={scrollSignal.anchor}
              scrollNonce={scrollSignal.nonce}
            />
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
