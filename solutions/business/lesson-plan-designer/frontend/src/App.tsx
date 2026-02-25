import { useState, useEffect, useCallback, useMemo } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import { useLessonPlanSession } from './hooks/useLessonPlanSession'
import { useScrollSpy } from './hooks/useScrollSpy'
import { useSectionEditor } from './hooks/useSectionEditor'
import { useSkills } from './hooks/useSkills'
import { useChatLayout } from './hooks/useChatLayout'
import Header from './components/Header'
import OutlinePanel from './components/OutlinePanel'
import LessonPlanContent, { OUTLINE_ITEMS } from './components/LessonPlanContent'
import ChatPanel from './components/ChatPanel'
import ChatLayoutControls from './components/ChatLayoutControls'
import CollapsedChatTab from './components/CollapsedChatTab'
import CreateLessonPlanDialog from './components/CreateLessonPlanDialog'
import SkillEditorModal from './components/SkillEditorModal'
import { api } from './utils/api'
import type { Skill } from './types'

const TENANT_ID = 'lesson-plan-designer'

/** Chat section (controls + panel + token bar) shared across all layout modes */
function ChatSection({
  mode,
  isCollapsed,
  onModeChange,
  onToggleCollapse,
  chatPanelProps,
  tokenUsage,
}: {
  mode: ReturnType<typeof useChatLayout>['mode']
  isCollapsed: boolean
  onModeChange: (m: typeof mode) => void
  onToggleCollapse: () => void
  chatPanelProps: Record<string, unknown>
  tokenUsage: { sessionInputTokens?: number; inputTokens: number; sessionOutputTokens?: number; outputTokens: number; model?: string } | null
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatLayoutControls
        mode={mode}
        isCollapsed={isCollapsed}
        onModeChange={onModeChange}
        onToggleCollapse={onToggleCollapse}
      />
      <div className="flex-1 overflow-hidden">
        <ChatPanel {...(chatPanelProps as any)} />
      </div>
      {tokenUsage && (
        <div className="px-4 py-1.5 bg-gray-100 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between flex-shrink-0">
          <span>
            Tokens: {tokenUsage.sessionInputTokens?.toLocaleString() ?? tokenUsage.inputTokens.toLocaleString()} in / {tokenUsage.sessionOutputTokens?.toLocaleString() ?? tokenUsage.outputTokens.toLocaleString()} out
          </span>
          {tokenUsage.model && (
            <span className="text-gray-400">{tokenUsage.model}</span>
          )}
        </div>
      )}
    </div>
  )
}

function App() {
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showSaveToast, setShowSaveToast] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [skillSaving, setSkillSaving] = useState(false)

  // Chat layout hook
  const {
    mode: layoutMode,
    setMode: setLayoutMode,
    isCollapsed,
    setCollapsed,
    overlayWidth,
    isResizing,
    overlayResizeProps,
  } = useChatLayout()

  // Panel ref for side-by-side mode
  const chatPanelRef = usePanelRef()

  // Skills hook (must be before session hook to provide enabledSkillSlugs)
  const {
    skills,
    enabledSkillIds,
    refresh: refreshSkills,
  } = useSkills(TENANT_ID)

  // Convert enabled skill IDs to slugs for the session hook
  const enabledSkillSlugs = useMemo(() => {
    return skills
      .filter(s => enabledSkillIds.has(s.id))
      .map(s => s.slug)
  }, [skills, enabledSkillIds])

  // Lesson plan session hook
  const {
    connected,
    connection,
    sessionId,
    error,
    lessonPlan,
    loading,
    saving,
    messages,
    isProcessing,
    isMainProcessing,
    hasActiveSubAgents,
    pendingUpdates,
    pendingUpdatesWithMeta,
    modifiedFields,
    activeTools,
    isThinking,
    thinkingContent,
    thinkingStartTime,
    thinkingVerb,
    tokenUsage,
    todoItems,
    todoStats,
    activeSubAgents,
    newFilesCount,
    isLoadingHistory,
    cancelProcessing,
    clearConversation,
    sendMessage,
    saveLessonPlan,
    createNewPlan,
    syncToForm,
    syncAll,
    discardUpdate,
    undoSync,
    canUndo,
    updateField,
  } = useLessonPlanSession({
    tenantId: TENANT_ID,
    enabledSkillSlugs,
  })

  // Context sync is now handled automatically in useLessonPlanSession hook
  // (via usePageContext + useAgentChat)

  // Section IDs for scroll spy
  const sectionIds = useMemo(() => OUTLINE_ITEMS.map(item => item.id), [])

  // Scroll spy hook
  const { activeSection, scrollToSection } = useScrollSpy(sectionIds)

  // Section editor hook
  const {
    editingSections,
    startEdit,
    cancelEdit,
    saveEdit,
    isSaving,
  } = useSectionEditor({
    onSave: async () => {
      // Save the entire lesson plan when a section is saved
      await saveLessonPlan()
      setHasUnsavedChanges(false)
    },
  })

  // Track unsaved changes
  useEffect(() => {
    if (lessonPlan) {
      setHasUnsavedChanges(true)
    }
  }, [lessonPlan])

  // Handle outline item click
  const handleOutlineSelect = useCallback((sectionId: string) => {
    scrollToSection(sectionId)
  }, [scrollToSection])

  // Reset unsaved changes flag after save
  const handleSave = async () => {
    try {
      await saveLessonPlan()
      setHasUnsavedChanges(false)
      setShowSaveToast(true)
      setTimeout(() => setShowSaveToast(false), 2000)
    } catch {
      // Error is already handled in the hook
    }
  }

  // Create new lesson plan
  const handleCreateNew = async (data: {
    title: string
    subject: string
    gradeLevel: number
    durationMinutes: number
    lessonPlanCode?: string
    publisher?: string
    volume?: string
    chapterId?: number
    chapterTitle?: string
  }) => {
    setIsCreating(true)
    try {
      await createNewPlan(data)
      setShowNewDialog(false)
      setHasUnsavedChanges(false)
    } catch {
      // Error is already handled in the hook
    } finally {
      setIsCreating(false)
    }
  }

  // Handle AI assist for a section
  const handleAiAssist = useCallback((sectionId: string) => {
    const sectionPrompts: Record<string, string> = {
      basic: '帮我完善这个课程的基本信息',
      curriculumRequirements: '帮我编写课程要求',
      objectives: '帮我设计本课的学习目标',
      studentAnalysis: '帮我编写学情分析',
      materialsNeeded: '帮我列出课前准备内容',
      content: '帮我设计学习过程',
      assessmentMethods: '帮我设计作业检测方案',
      teachingMethods: '帮我设计教学方法',
      extraProperties: '帮我补充其他教学属性',
    }
    const prompt = sectionPrompts[sectionId]
    if (prompt) {
      sendMessage(prompt)
    }
  }, [sendMessage])

  // Handle skill editor close
  const handleCloseSkillEditor = useCallback(() => {
    setEditingSkill(null)
  }, [])

  // Handle skill save
  const handleSaveSkill = useCallback(async (skillId: string, content: string) => {
    setSkillSaving(true)
    try {
      await api.updateSkill(skillId, { content })
      await refreshSkills()
      setEditingSkill(null)
    } finally {
      setSkillSaving(false)
    }
  }, [refreshSkills])

  // Create savingSections set from isSaving function
  const savingSections = useMemo(() => {
    const set = new Set<string>()
    sectionIds.forEach(id => {
      if (isSaving(id)) set.add(id)
    })
    return set
  }, [sectionIds, isSaving])

  // Chat panel props (shared across all modes)
  const chatPanelProps = useMemo(() => ({
    messages,
    isProcessing,
    isMainProcessing,
    hasActiveSubAgents,
    connected,
    connection,
    sessionId,
    lessonPlanId: lessonPlan?.id,
    activeTools,
    isThinking,
    thinkingContent,
    thinkingStartTime,
    thinkingVerb,
    todoItems,
    todoStats,
    activeSubAgents,
    tokenUsage,
    pendingUpdates,
    pendingUpdatesWithMeta,
    modifiedFields,
    newFilesCount,
    isLoadingHistory,
    onSendMessage: sendMessage,
    onSync: syncToForm,
    onSyncAll: syncAll,
    onDiscard: discardUpdate,
    onCancel: cancelProcessing,
    onClearConversation: clearConversation,
  }), [messages, isProcessing, isMainProcessing, hasActiveSubAgents, connected, connection, sessionId, lessonPlan?.id, activeTools, isThinking, thinkingContent, thinkingStartTime, thinkingVerb, todoItems, todoStats, activeSubAgents, tokenUsage, pendingUpdates, pendingUpdatesWithMeta, modifiedFields, newFilesCount, isLoadingHistory, sendMessage, syncToForm, syncAll, discardUpdate, cancelProcessing, clearConversation])

  // Collapse/expand handlers
  const handleToggleCollapse = useCallback(() => {
    if (layoutMode === 'side-by-side') {
      if (isCollapsed) {
        chatPanelRef.current?.expand()
      } else {
        chatPanelRef.current?.collapse()
      }
    } else {
      setCollapsed(!isCollapsed)
    }
  }, [layoutMode, isCollapsed, setCollapsed])

  const handleModeChange = useCallback((newMode: typeof layoutMode) => {
    setLayoutMode(newMode)
    // If we were collapsed in side-by-side and switching away, ensure panel state is clean
    if (layoutMode === 'side-by-side' && isCollapsed) {
      setCollapsed(false)
    }
  }, [setLayoutMode, layoutMode, isCollapsed, setCollapsed])

  // Show loading state with skeleton
  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Skeleton header */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="h-6 w-40 rounded bg-zinc-200" />
            <div className="h-4 w-16 rounded bg-zinc-200" />
          </div>
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-9 w-16 rounded-lg bg-zinc-200" />
            <div className="h-9 w-16 rounded-lg bg-zinc-200" />
          </div>
        </div>
        {/* Skeleton body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Skeleton outline */}
          <div className="w-[200px] flex-shrink-0 bg-white border-r border-gray-200 p-4">
            <div className="space-y-2 animate-pulse">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-zinc-200" />
                  <div className={`h-4 rounded bg-zinc-200 ${
                    i % 3 === 0 ? 'w-1/2' : i % 3 === 1 ? 'w-2/3' : 'w-3/5'
                  }`} />
                </div>
              ))}
            </div>
          </div>
          {/* Skeleton main content */}
          <div className="flex-1 p-6 space-y-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="h-5 w-24 rounded bg-zinc-200" />
                <div className="h-4 w-full rounded bg-zinc-200" />
                <div className="h-4 w-3/4 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show create prompt if no lesson plan
  if (!lessonPlan) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header
          title="AI备课设计器"
          connected={connected}
          saving={false}
          hasChanges={false}
          onSave={() => {}}
          onNew={() => setShowNewDialog(true)}
        />

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              开始您的备课
            </h2>
            <p className="text-gray-600 mb-8">
              创建新的备课方案，AI助手将帮助您设计教学目标、活动和评估方式
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={() => setShowNewDialog(true)}
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              创建备课方案
            </button>
          </div>
        </div>

        {/* Create Lesson Plan Dialog */}
        <CreateLessonPlanDialog
          open={showNewDialog}
          loading={isCreating}
          onClose={() => setShowNewDialog(false)}
          onCreate={handleCreateNew}
        />
      </div>
    )
  }

  // Shared chat section element
  const chatSection = (
    <ChatSection
      mode={layoutMode}
      isCollapsed={isCollapsed}
      onModeChange={handleModeChange}
      onToggleCollapse={handleToggleCollapse}
      chatPanelProps={chatPanelProps}
      tokenUsage={tokenUsage}
    />
  )

  // Lesson plan content element
  const lessonPlanEl = (
    <LessonPlanContent
      lessonPlan={lessonPlan}
      modifiedFields={modifiedFields}
      editingSections={editingSections}
      savingSections={savingSections}
      canUndo={canUndo}
      onUndo={undoSync}
      onChange={updateField}
      onStartEdit={startEdit}
      onSaveEdit={saveEdit}
      onCancelEdit={cancelEdit}
      onAiAssist={handleAiAssist}
    />
  )

  // Outline element
  const outlineEl = (
    <div className="w-[200px] flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden">
      <OutlinePanel
        items={[...OUTLINE_ITEMS]}
        activeSection={activeSection}
        onSelect={handleOutlineSelect}
        title="目录"
      />
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <Header
        title={lessonPlan.title || '未命名备课'}
        connected={connected}
        saving={saving}
        hasChanges={hasUnsavedChanges}
        onSave={handleSave}
        onNew={() => setShowNewDialog(true)}
      />

      {/* Error Banner */}
      {error && (
        <div className="px-6 py-2 bg-red-50 text-red-700 text-sm border-b border-red-200">
          {error}
        </div>
      )}

      {/* Main Content - Layout depends on mode */}
      <div className="flex-1 flex overflow-hidden">
        {/* Outline - always present */}
        {outlineEl}

        {/* === DEFAULT MODE === */}
        {layoutMode === 'default' && (
          <>
            <main className="flex-1 bg-gray-50 overflow-hidden">
              {lessonPlanEl}
            </main>
            <aside className="w-[450px] flex-shrink-0 flex flex-col bg-gray-50 border-l border-gray-200 overflow-hidden">
              {chatSection}
            </aside>
          </>
        )}

        {/* === SIDE-BY-SIDE MODE === */}
        {layoutMode === 'side-by-side' && (
          <>
            <Group orientation="horizontal" id="lesson-plan-sidebyside">
              <Panel id="content" minSize="20%">
                <main className="h-full bg-gray-50 overflow-hidden">
                  {lessonPlanEl}
                </main>
              </Panel>
              <Separator className="w-1.5 bg-gray-200 hover:bg-blue-400 transition-colors" />
              <Panel
                id="chat"
                panelRef={chatPanelRef}
                defaultSize="35%"
                minSize="20%"
                maxSize="60%"
                collapsible
                collapsedSize="0%"
                onResize={(size) => {
                  const collapsed = size.asPercentage === 0
                  setCollapsed(collapsed)
                }}
              >
                {!isCollapsed && (
                  <aside className="h-full flex flex-col bg-gray-50 border-l border-gray-200 overflow-hidden">
                    {chatSection}
                  </aside>
                )}
              </Panel>
            </Group>

            {/* Collapsed tab */}
            {isCollapsed && (
              <div className="relative flex-shrink-0">
                <CollapsedChatTab onClick={() => chatPanelRef.current?.expand()} />
              </div>
            )}
          </>
        )}

        {/* === OVERLAY MODE === */}
        {layoutMode === 'overlay' && (
          <main className="flex-1 relative bg-gray-50 overflow-hidden">
            {lessonPlanEl}

            {!isCollapsed ? (
              <div
                className={`absolute top-0 right-0 bottom-0 flex flex-col bg-gray-50 border-l border-gray-200 shadow-xl z-10 ${isResizing ? 'select-none' : ''}`}
                style={{ width: overlayWidth, minWidth: '450px' }}
              >
                {/* Resize handle on left edge */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/60 transition-colors z-20"
                  {...overlayResizeProps}
                />
                {chatSection}
              </div>
            ) : (
              <CollapsedChatTab onClick={() => setCollapsed(false)} />
            )}
          </main>
        )}
      </div>

      {/* Create Lesson Plan Dialog */}
      <CreateLessonPlanDialog
        open={showNewDialog}
        loading={isCreating}
        hasUnsavedChanges={hasUnsavedChanges}
        onClose={() => setShowNewDialog(false)}
        onCreate={handleCreateNew}
      />

      {/* Skill Editor Modal */}
      <SkillEditorModal
        skill={editingSkill}
        open={editingSkill !== null}
        saving={skillSaving}
        onClose={handleCloseSkillEditor}
        onSave={handleSaveSkill}
      />

      {/* Save Success Toast */}
      {showSaveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-green-600 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          保存成功
        </div>
      )}
    </div>
  )
}

export default App
