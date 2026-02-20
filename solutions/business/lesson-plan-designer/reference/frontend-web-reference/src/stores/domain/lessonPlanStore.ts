/**
 * Lesson Plan Store
 *
 * Manages lesson plan state including CRUD operations and section-based editing.
 * Supports draft-based editing where sections can be edited independently.
 * Maps to LessonPlanController.
 *
 * State:
 * - lessonPlan: Current lesson plan object
 * - loading/saving: Operation states
 * - editingSections: Set of section IDs being edited
 * - sectionDrafts: Draft content for each editing section
 * - isCreateMode: Whether in create (all sections editable) mode
 *
 * Mutation Patterns:
 * - fetchLessonPlan: pessimistic (wait for server)
 * - createLessonPlan: hybrid (pending state, then update)
 * - updateLessonPlan: hybrid (pending state, then update)
 * - updateField: optimistic (local first, then sync)
 * - saveSection: hybrid (pending state per section)
 * - saveAllSections: hybrid (pending state, then update)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { lessonPlanApi, curriculumStandardApi } from '../../api/index'
import { useSchoolStore } from './schoolStore'
import { parseLessonPlanContent, serializeLessonPlanContent, getDefaultContent, type LessonPlanContent } from '../../composables/useLessonPlanParser'
import { gradeToStage } from '@/utils/gradeStageMapping'
import type { LessonPlan, CurriculumStandard, LessonPlanCreateRequest, LessonPlanUpdateRequest } from '@/types'

interface Requirement {
  id: number
  label: string
  description: string
  type: 'content' | 'academic'
}

interface ApiError {
  response?: {
    status?: number
    data?: {
      msg?: string
    }
  }
  message?: string
}

type SectionId = 'courseRequirements' | 'textbookAnalysis' | 'learningObjectives' | 'studentAnalysis' | 'preClassPreparation' | 'learningProcess' | 'homeworkAssessment' | 'courseware' | 'resources'

type SectionDataKey = 'courseRequirements' | 'textbookAnalysis' | 'learningObjectives' | 'studentAnalysis' | 'preClassPreparation' | 'learningTasks' | 'homeworkTasks' | 'courseware' | 'resources'

export const useLessonPlanStore = defineStore('lessonPlan', () => {
  // State
  const lessonPlan = ref<LessonPlan | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // Edit state
  const editingSections = ref<Set<string>>(new Set())
  const savingSections = ref<Set<string>>(new Set())
  const sectionDrafts = ref<Record<string, unknown>>({})

  // Create mode state
  const isCreateMode = ref(false)

  // AI editing mode state
  const aiEditingMode = ref(false)
  const aiCurrentSection = ref<string | null>(null)
  const aiCompletedSections = ref<Set<string>>(new Set())
  const aiPendingSections = ref<Set<string>>(new Set()) // Sections planned for AI generation

  // Curriculum standards for linking
  const allStandards = ref<CurriculumStandard[]>([])

  // Computed: parsed content from JSON
  const parsedContent = computed((): LessonPlanContent => {
    return parseLessonPlanContent(lessonPlan.value) as LessonPlanContent
  })

  // Computed: check if any section has unsaved changes
  const isDirty = computed(() => {
    return Object.keys(sectionDrafts.value).length > 0
  })

  // Computed: available requirements for display (from selected standards)
  const availableRequirements = computed((): Requirement[] => {
    const contentIds = parsedContent.value.courseRequirements.contentIds || []
    const academicIds = parsedContent.value.courseRequirements.academicIds || []

    const requirements: Requirement[] = []

    allStandards.value
      .filter(s => contentIds.includes(s.id!))
      .forEach(s => {
        requirements.push({
          id: s.id!,
          label: s.title || s.level3 || s.content || '',
          description: s.description || s.level1 || '',
          type: 'content'
        })
      })

    allStandards.value
      .filter(s => academicIds.includes(s.id!))
      .forEach(s => {
        requirements.push({
          id: s.id!,
          label: s.title || s.level3 || s.content || '',
          description: s.description || s.level1 || '',
          type: 'academic'
        })
      })

    return requirements
  })

  // Map section IDs to their data keys in parsedContent
  const sectionDataKeys: Record<SectionId, SectionDataKey> = {
    courseRequirements: 'courseRequirements',
    textbookAnalysis: 'textbookAnalysis',
    learningObjectives: 'learningObjectives',
    studentAnalysis: 'studentAnalysis',
    preClassPreparation: 'preClassPreparation',
    learningProcess: 'learningTasks',
    homeworkAssessment: 'homeworkTasks',
    courseware: 'courseware',
    resources: 'resources'
  }

  /**
   * Fetch lesson plan by ID
   * @pattern pessimistic - Waits for server response before updating state
   * @param id - Lesson plan ID
   */
  async function fetchLessonPlan(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await lessonPlanApi.getById(id)
      lessonPlan.value = response.data
    } catch (err) {
      console.error('Failed to fetch lesson plan:', err)
      error.value = (err as ApiError).response?.status === 404
        ? '教案不存在'
        : '加载失败：' + ((err as Error).message || '未知错误')
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch curriculum standards for linking
   * @pattern pessimistic - Waits for server response
   */
  async function fetchStandards(): Promise<void> {
    try {
      // Use current lesson plan's subject and stage for filtering
      const subject = lessonPlan.value?.subject
      const stage = gradeToStage(lessonPlan.value?.gradeLevel)

      const params: { pageSize: number; subject?: string; stage?: string } = { pageSize: 500 }
      if (subject) params.subject = subject
      if (stage) params.stage = stage

      const response = await curriculumStandardApi.getList(params)
      allStandards.value = response.rows || []
    } catch (err) {
      console.error('Failed to fetch standards:', err)
    }
  }

  /**
   * Create a new lesson plan
   * @pattern hybrid - Shows saving state, updates on success
   * @param data - Lesson plan data
   * @returns Created lesson plan
   */
  async function createLessonPlan(data: LessonPlanCreateRequest): Promise<LessonPlan> {
    saving.value = true
    error.value = null
    try {
      const response = await lessonPlanApi.create(data)
      lessonPlan.value = (response.data || response) as LessonPlan
      return lessonPlan.value
    } catch (err) {
      console.error('Failed to create lesson plan:', err)
      error.value = '创建失败：' + ((err as Error).message || '未知错误')
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Update existing lesson plan
   * @pattern hybrid - Shows saving state, refreshes on success
   * @param data - Lesson plan data with id
   */
  async function updateLessonPlan(data: LessonPlanUpdateRequest): Promise<void> {
    saving.value = true
    error.value = null
    try {
      await lessonPlanApi.update(data)
      // Refresh
      await fetchLessonPlan(data.id!)
    } catch (err) {
      console.error('Failed to update lesson plan:', err)
      error.value = '更新失败：' + ((err as Error).message || '未知错误')
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Delete lesson plan
   * @pattern pessimistic - Waits for server confirmation
   * @param id - Lesson plan ID
   */
  async function deleteLessonPlan(id: number): Promise<void> {
    try {
      await lessonPlanApi.delete(id)
    } catch (err) {
      console.error('Failed to delete lesson plan:', err)
      throw err
    }
  }

  /**
   * Update a single field (Tier 1 inline edit)
   * @pattern optimistic - Updates local state immediately, syncs to server
   * @param field - Field name
   * @param value - New value
   */
  async function updateField(field: string, value: unknown): Promise<void> {
    if (!lessonPlan.value?.id) {
      throw new Error('No lesson plan loaded')
    }
    try {
      await lessonPlanApi.update({
        id: lessonPlan.value.id,
        [field]: value
      } as LessonPlanUpdateRequest)
      // Update local state immediately (optimistic)
      ;(lessonPlan.value as Record<string, unknown>)[field] = value
    } catch (err) {
      console.error(`Failed to update ${field}:`, err)
      throw err
    }
  }

  /**
   * Initialize empty lesson plan for create mode
   * @pattern optimistic - Local state only
   * @param defaults - Default values
   * @param createMode - Whether to enter create mode
   */
  function initEmpty(defaults: Partial<LessonPlan> = {}, createMode = false): void {
    lessonPlan.value = {
      id: undefined,
      lessonPlanCode: '',
      title: '',
      subject: defaults.subject || '',
      gradeLevel: defaults.gradeLevel || undefined,
      durationMinutes: defaults.durationMinutes || 45,
      objectives: '',
      content: JSON.stringify(getDefaultContent()),
      schoolId: defaults.schoolId || undefined,
      status: 'DRAFT',
      ...defaults
    } as LessonPlan
    editingSections.value = new Set()
    sectionDrafts.value = {}
    savingSections.value = new Set()
    error.value = null
    isCreateMode.value = false

    if (createMode) {
      enterCreateMode()
    }
  }

  /**
   * Enter create mode - all sections become editable
   * @pattern optimistic - Local state only
   */
  function enterCreateMode(): void {
    isCreateMode.value = true
    const allSectionIds = Object.keys(sectionDataKeys) as SectionId[]

    // Initialize drafts for all sections
    allSectionIds.forEach(sectionId => {
      const dataKey = sectionDataKeys[sectionId]
      sectionDrafts.value[sectionId] = JSON.parse(JSON.stringify(parsedContent.value[dataKey]))
    })

    // Mark all sections as editing
    editingSections.value = new Set(allSectionIds)
  }

  /**
   * Save all sections at once (for create mode)
   * @pattern hybrid - Shows saving state, updates on success
   * @returns Created/updated lesson plan
   */
  async function saveAllSections(): Promise<LessonPlan> {
    saving.value = true
    error.value = null

    try {
      // Build content from all drafts
      const content: Record<string, unknown> = {}
      Object.entries(sectionDataKeys).forEach(([sectionId, dataKey]) => {
        content[dataKey] = sectionDrafts.value[sectionId] ?? parsedContent.value[dataKey]
      })

      // Fallback: 如果教案没有 schoolId，使用当前选中的学校
      const schoolStore = useSchoolStore()
      const schoolId = lessonPlan.value!.schoolId || schoolStore.currentSchoolId
      if (!schoolId) {
        throw new Error('请先在顶部导航栏选择学校')
      }

      const payload: LessonPlanCreateRequest | LessonPlanUpdateRequest = {
        lessonPlanCode: lessonPlan.value!.lessonPlanCode,
        title: lessonPlan.value!.title,
        subject: lessonPlan.value!.subject,
        gradeLevel: lessonPlan.value!.gradeLevel,
        durationMinutes: lessonPlan.value!.durationMinutes,
        objectives: lessonPlan.value!.objectives,
        content: serializeLessonPlanContent(content as unknown as LessonPlanContent),
        schoolId,
        status: lessonPlan.value!.status
      }

      let result: LessonPlan
      if (lessonPlan.value!.id) {
        // Update existing
        (payload as LessonPlanUpdateRequest).id = lessonPlan.value!.id
        await lessonPlanApi.update(payload as LessonPlanUpdateRequest)
        await fetchLessonPlan(lessonPlan.value!.id)
        result = lessonPlan.value!
      } else {
        // Create new
        const response = await lessonPlanApi.create(payload as LessonPlanCreateRequest)
        result = (response.data || response) as LessonPlan
        lessonPlan.value = result
      }

      // Clear drafts and exit create mode
      sectionDrafts.value = {}
      editingSections.value = new Set()
      isCreateMode.value = false

      return result
    } catch (err) {
      console.error('Failed to save all sections:', err)
      error.value = '保存失败：' + ((err as Error).message || '未知错误')
      throw err
    } finally {
      saving.value = false
    }
  }

  // Edit actions
  function isEditing(sectionId: string): boolean {
    return editingSections.value.has(sectionId)
  }

  function isSaving(sectionId: string): boolean {
    return savingSections.value.has(sectionId)
  }

  function startEditing(sectionId: string): void {
    // When any section starts editing, enable editing for ALL sections (global edit mode)
    const allSectionIds = Object.keys(sectionDataKeys)

    allSectionIds.forEach(id => {
      const dataKey = sectionDataKeys[id as SectionId]
      // Only clone if not already in draft
      if (sectionDrafts.value[id] === undefined) {
        sectionDrafts.value[id] = JSON.parse(JSON.stringify(parsedContent.value[dataKey]))
      }
    })

    editingSections.value = new Set(allSectionIds)
  }

  function updateDraft(sectionId: string, value: unknown): void {
    sectionDrafts.value[sectionId] = value
  }

  function cancelEditing(sectionId: string): void {
    editingSections.value = new Set([...editingSections.value].filter(id => id !== sectionId))
    delete sectionDrafts.value[sectionId]
  }

  // Get section value (draft if editing, otherwise from parsed content)
  function getSectionValue(sectionId: string): unknown {
    if (isEditing(sectionId) && sectionDrafts.value[sectionId] !== undefined) {
      return sectionDrafts.value[sectionId]
    }
    const dataKey = sectionDataKeys[sectionId as SectionId]
    return parsedContent.value[dataKey]
  }

  /**
   * Save a single section
   * @pattern hybrid - Shows section saving state, updates on success
   * @param sectionId - Section ID to save
   * @returns Success status
   */
  async function saveSection(sectionId: string): Promise<boolean> {
    const dataKey = sectionDataKeys[sectionId as SectionId]
    savingSections.value = new Set([...savingSections.value, sectionId])

    try {
      // Build updated content by merging edited section into current content
      const currentContent = parsedContent.value
      const updatedContent = {
        ...currentContent,
        [dataKey]: sectionDrafts.value[sectionId]
      }

      // Fallback: 如果教案没有 schoolId，使用当前选中的学校
      const schoolStore = useSchoolStore()
      const schoolId = lessonPlan.value!.schoolId || schoolStore.currentSchoolId
      if (!schoolId) {
        throw new Error('请先在顶部导航栏选择学校')
      }

      // Build the payload
      const payload: LessonPlanUpdateRequest = {
        id: lessonPlan.value!.id,
        lessonPlanCode: lessonPlan.value!.lessonPlanCode,
        title: lessonPlan.value!.title,
        subject: lessonPlan.value!.subject,
        gradeLevel: lessonPlan.value!.gradeLevel,
        durationMinutes: lessonPlan.value!.durationMinutes,
        objectives: lessonPlan.value!.objectives,
        content: serializeLessonPlanContent(updatedContent),
        schoolId,
        status: lessonPlan.value!.status
      }

      await lessonPlanApi.update(payload)

      // Refresh the lesson plan data
      await fetchLessonPlan(lessonPlan.value!.id!)

      // Exit edit mode for this section
      editingSections.value = new Set([...editingSections.value].filter(id => id !== sectionId))
      delete sectionDrafts.value[sectionId]

      return true
    } catch (err) {
      console.error('Failed to save section:', err)
      throw err
    } finally {
      savingSections.value = new Set([...savingSections.value].filter(id => id !== sectionId))
    }
  }

  // Cancel all edits - revert to last saved state (clears drafts but keeps lessonPlan)
  function cancelAllEdits(): void {
    sectionDrafts.value = {}
    editingSections.value = new Set()
    // Note: We don't reset lessonPlan itself, as it contains the last saved state
  }

  // ==========================================================================
  // AI Editing Mode Methods
  // ==========================================================================

  /**
   * Start AI editing mode for specific sections
   * Called when AI begins generating lesson plan content
   * @param sections - Array of section IDs to edit (if empty, defaults to all sections)
   */
  function startAIEditing(sections?: string[]): void {
    console.log('[LessonPlanStore] Starting AI editing mode for sections:', sections || 'all')
    aiEditingMode.value = true
    aiCompletedSections.value = new Set()
    aiCurrentSection.value = null

    // Determine which sections to edit
    const sectionIds = sections && sections.length > 0
      ? sections
      : Object.keys(sectionDataKeys)

    // Track planned sections for overlay display
    aiPendingSections.value = new Set(sectionIds)

    // Initialize drafts for planned sections
    sectionIds.forEach(id => {
      const dataKey = sectionDataKeys[id as SectionId]
      if (dataKey && sectionDrafts.value[id] === undefined) {
        sectionDrafts.value[id] = JSON.parse(JSON.stringify(parsedContent.value[dataKey]))
      }
    })

    // Mark sections as editing
    editingSections.value = new Set(sectionIds)
  }

  /**
   * Update a section from AI generation
   * Automatically enters AI editing mode if not already
   * @param sectionId - The section ID to update (frontend name, e.g., 'learningProcess')
   * @param content - The generated content
   */
  function updateFromAI(sectionId: string, content: unknown): void {
    if (!aiEditingMode.value) {
      startAIEditing([sectionId])
    }

    aiCurrentSection.value = sectionId
    sectionDrafts.value[sectionId] = content

    // BUG FIX: Ensure section is in editingSections so getSectionValue returns draft
    if (!editingSections.value.has(sectionId)) {
      editingSections.value = new Set([...editingSections.value, sectionId])
    }

    // Also add to pending sections if not already there
    if (!aiPendingSections.value.has(sectionId)) {
      aiPendingSections.value = new Set([...aiPendingSections.value, sectionId])
    }

    console.log(`[LessonPlanStore] AI updated section: ${sectionId}`)
  }

  /**
   * Mark a section as completed by AI
   * @param sectionId - The section ID that was completed
   */
  function completeAISection(sectionId: string): void {
    aiCompletedSections.value = new Set([...aiCompletedSections.value, sectionId])
    if (aiCurrentSection.value === sectionId) {
      aiCurrentSection.value = null
    }
    console.log(`[LessonPlanStore] AI completed section: ${sectionId}`)
  }

  /**
   * Finish AI editing mode
   * User can then choose to save or discard the generated content
   */
  function finishAIEditing(): void {
    console.log('[LessonPlanStore] Finishing AI editing mode')
    aiEditingMode.value = false
    aiCurrentSection.value = null
    // Keep aiCompletedSections for display until user saves or discards
  }

  /**
   * Cancel AI editing mode and discard all AI-generated content
   */
  function cancelAIEditing(): void {
    console.log('[LessonPlanStore] Canceling AI editing mode')
    aiEditingMode.value = false
    aiCurrentSection.value = null
    aiCompletedSections.value = new Set()
    aiPendingSections.value = new Set()
    // Discard all drafts
    sectionDrafts.value = {}
    editingSections.value = new Set()
  }

  // Reset store state (for route leave cleanup)
  function reset(): void {
    lessonPlan.value = null
    loading.value = false
    saving.value = false
    error.value = null
    editingSections.value = new Set()
    savingSections.value = new Set()
    sectionDrafts.value = {}
    isCreateMode.value = false
    // Reset AI editing mode state
    aiEditingMode.value = false
    aiCurrentSection.value = null
    aiCompletedSections.value = new Set()
    aiPendingSections.value = new Set()
  }

  return {
    // State
    lessonPlan,
    loading,
    saving,
    error,
    editingSections,
    savingSections,
    sectionDrafts,
    allStandards,
    isCreateMode,

    // AI Editing Mode State
    aiEditingMode,
    aiCurrentSection,
    aiCompletedSections,
    aiPendingSections,

    // Computed
    parsedContent,
    isDirty,
    availableRequirements,

    // Actions
    fetchLessonPlan,
    fetchStandards,
    createLessonPlan,
    updateLessonPlan,
    updateField,
    deleteLessonPlan,
    initEmpty,
    enterCreateMode,
    saveAllSections,

    // Edit actions
    isEditing,
    isSaving,
    startEditing,
    updateDraft,
    cancelEditing,
    getSectionValue,
    saveSection,
    cancelAllEdits,

    // AI Editing Mode Actions
    startAIEditing,
    updateFromAI,
    completeAISection,
    finishAIEditing,
    cancelAIEditing,

    // Cleanup
    reset
  }
})
