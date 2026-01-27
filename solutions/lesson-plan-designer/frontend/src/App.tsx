import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLessonPlanSession } from './hooks/useLessonPlanSession'
import { useScrollSpy } from './hooks/useScrollSpy'
import { useSectionEditor } from './hooks/useSectionEditor'
import { useSkills } from './hooks/useSkills'
import Header from './components/Header'
import OutlinePanel from './components/OutlinePanel'
import LessonPlanContent, { OUTLINE_ITEMS } from './components/LessonPlanContent'
import ChatPanel from './components/ChatPanel'
import SkillsPanel from './components/SkillsPanel'
import CreateLessonPlanDialog from './components/CreateLessonPlanDialog'
import SkillEditorModal from './components/SkillEditorModal'
import { api } from './utils/api'
import type { Skill } from './types'

const TENANT_ID = 'lesson-plan-designer'

function App() {
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [skillSaving, setSkillSaving] = useState(false)

  // Skills hook (must be before session hook to provide enabledSkillSlugs)
  const {
    skills,
    loading: skillsLoading,
    error: skillsError,
    searchQuery,
    setSearchQuery,
    filteredSkills,
    toggleSkill,
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
    error,
    lessonPlan,
    loading,
    saving,
    messages,
    isProcessing,
    modifiedFields,
    activeTools,
    isThinking,
    thinkingContent,
    tokenUsage,
    sendMessage,
    saveLessonPlan,
    createNewPlan,
    syncToForm,
    discardUpdate,
    undoSync,
    canUndo,
    updateField,
    syncContext,
  } = useLessonPlanSession({
    tenantId: TENANT_ID,
    enabledSkillSlugs,
  })

  // Debounced context sync - sync form state to backend for Claude Code to read
  const contextSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (!lessonPlan) return

    // Clear previous timeout
    if (contextSyncTimeoutRef.current) {
      clearTimeout(contextSyncTimeoutRef.current)
    }

    // Debounce: sync after 500ms of no changes
    contextSyncTimeoutRef.current = setTimeout(() => {
      syncContext(lessonPlan)
    }, 500)

    return () => {
      if (contextSyncTimeoutRef.current) {
        clearTimeout(contextSyncTimeoutRef.current)
      }
    }
  }, [lessonPlan, syncContext])

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
    } catch {
      // Error is already handled in the hook
    }
  }

  // Create new lesson plan
  const handleCreateNew = async (data: {
    title: string
    subject: string
    gradeLevel: string
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
      objectives: '帮我设计本课的教学目标',
      activities: '帮我设计教学活动',
      assessment: '帮我设计评估方案',
      differentiation: '帮我设计差异化教学策略',
    }
    const prompt = sectionPrompts[sectionId]
    if (prompt) {
      sendMessage(prompt)
    }
  }, [sendMessage])

  // Handle skill edit - open modal
  const handleEditSkill = useCallback((skill: Skill) => {
    setEditingSkill(skill)
  }, [])

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

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">加载中...</p>
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

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Outline (200px) */}
        <div className="w-[200px] flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden">
          <OutlinePanel
            items={[...OUTLINE_ITEMS]}
            activeSection={activeSection}
            onSelect={handleOutlineSelect}
            title="目录"
          />
        </div>

        {/* Center Panel - Content (flex-1) */}
        <main className="flex-1 bg-gray-50 overflow-hidden">
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
        </main>

        {/* Right Panel - Chat + Skills (400px) */}
        <aside className="w-[400px] flex-shrink-0 flex flex-col bg-gray-50 border-l border-gray-200 overflow-hidden">
          {/* Chat Panel */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                messages={messages}
                isProcessing={isProcessing}
                connected={connected}
                activeTools={activeTools}
                isThinking={isThinking}
                thinkingContent={thinkingContent}
                onSendMessage={sendMessage}
                onSync={syncToForm}
                onDiscard={discardUpdate}
              />
            </div>
            {/* Token Usage Status Bar */}
            {tokenUsage && (
              <div className="px-4 py-1.5 bg-gray-100 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                <span>
                  Tokens: {tokenUsage.sessionInputTokens?.toLocaleString() ?? tokenUsage.inputTokens.toLocaleString()} in / {tokenUsage.sessionOutputTokens?.toLocaleString() ?? tokenUsage.outputTokens.toLocaleString()} out
                </span>
                {tokenUsage.model && (
                  <span className="text-gray-400">{tokenUsage.model}</span>
                )}
              </div>
            )}
          </div>

          {/* Skills Panel */}
          <SkillsPanel
            skills={filteredSkills}
            loading={skillsLoading}
            error={skillsError}
            searchQuery={searchQuery}
            enabledSkillIds={enabledSkillIds}
            onSearchChange={setSearchQuery}
            onToggleSkill={toggleSkill}
            onEditSkill={handleEditSkill}
          />
        </aside>
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
    </div>
  )
}

export default App
