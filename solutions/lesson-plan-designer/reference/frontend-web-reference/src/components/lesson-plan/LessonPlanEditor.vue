<script setup lang="ts">
/**
 * LessonPlanEditor - Main lesson plan editing component with inline section editing
 *
 * Provides per-section edit mode with save/cancel buttons, or full create mode.
 * Supports navigation via outline panel and scroll spy for active section tracking.
 *
 * @example
 * <LessonPlanEditor />
 * <LessonPlanEditor :isCreateMode="true" @save="handleSave" @cancel="handleCancel" />
 */
import { computed, ref, onMounted, onUnmounted, inject, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useLessonPlanStore } from '../../stores/domain/lessonPlanStore'
import { useSectionEditor } from '../../composables/useSectionEditor'
import { useScrollSpy } from '../../composables/useScrollSpy'
import { useNavigationRegistry } from '../../composables/useNavigationRegistry'
import { useAiGenerate, isGeneratableSection, type GeneratableSectionName } from '../../composables/useAiGenerate'
import { useDraftPersistence } from '../../composables/useDraftPersistence'
import { formStateSynchronizer } from '../../agent/form-state-synchronizer'
import OutlinePanel from './OutlinePanel.vue'
import StandardsDisplay from './StandardsDisplay.vue'
import MarkdownSection from './MarkdownSection.vue'
import TextbookAnalysisEditor from './TextbookAnalysisEditor.vue'
import LearningObjectivesEditor from './LearningObjectivesEditor.vue'
import PreparationTasksEditor from './PreparationTasksEditor.vue'
import LearningTasksEditor from './LearningTasksEditor.vue'
import HomeworkAssessmentEditor from './HomeworkAssessmentEditor.vue'
import CourseRequirementsEditor from './CourseRequirementsEditor.vue'
import type { LearningObjective, LearningTask, PreparationTask, HomeworkTask } from '@/types'
import type { TextbookAnalysisValue } from '@/types/lesson-plan'
import { isTextbookAnalysisValue } from '@/types/lesson-plan'
import { gradeToStage } from '@/utils/gradeStageMapping'

// Section value types
interface CourseRequirementsValue {
  contentIds: number[]
  academicIds: number[]
}

interface HomeworkAssessmentValue {
  homeworkTasks: HomeworkTask[]
  learningObjectives: LearningObjective[]
}

const props = defineProps({
  isCreateMode: { type: Boolean, default: false },
  hideActionBar: { type: Boolean, default: false },
  hidePerSectionActions: { type: Boolean, default: false }
})

// Should show per-section save/cancel buttons? (Not in create mode, not when explicitly hidden)
const showPerSectionSaveCancel = computed(() => {
  return !props.isCreateMode && !props.hidePerSectionActions
})

// Should show per-section edit button? (Always show except in create mode)
const showPerSectionEditButton = computed(() => {
  return !props.isCreateMode
})

const emit = defineEmits(['save', 'cancel'])

const router = useRouter()
const route = useRoute()
const store = useLessonPlanStore()
const editor = useSectionEditor(store)
const { registerTarget, unregisterTarget } = useNavigationRegistry()
const { generating, generatingSection, generateSection, isGenerating } = useAiGenerate()

// Check if connected to agent
const isAgentConnected = inject('agentConnected', ref(false))

// Draft persistence
const lessonPlanId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : undefined
})
const {
  hasDraft,
  saveDraftDebounced,
  loadDraft,
  clearDraft,
  getTimeSinceLastSave,
  cleanupOldDrafts,
} = useDraftPersistence(lessonPlanId)

// Track if we have AI-generated unsaved content
const hasUnsavedAiContent = ref(false)

// Watch for draft changes and auto-save
watch(() => store.sectionDrafts, (drafts) => {
  if (Object.keys(drafts).length > 0) {
    saveDraftDebounced(drafts)
  }
}, { deep: true })

// Sidebar navigation
const outlineItems = [
  { id: 'courseRequirements', label: '1. 课程要求' },
  { id: 'textbookAnalysis', label: '2. 教材分析' },
  { id: 'learningObjectives', label: '3. 学习目标' },
  { id: 'studentAnalysis', label: '4. 学情分析' },
  { id: 'preClassPreparation', label: '5. 课前准备' },
  { id: 'learningProcess', label: '6. 学习过程' },
  { id: 'homeworkAssessment', label: '7. 作业检测' },
  { id: 'courseware', label: '8. 课件' },
  { id: 'resources', label: '9. 资源' }
]
const sectionIds = outlineItems.map(item => item.id)
const { activeSection, setActiveSection } = useScrollSpy(sectionIds)

// Show draft recovery banner
const showDraftRecoveryBanner = ref(false)
const recoveryDraftTime = ref('')

// Register navigation targets and form synchronizer for all sections
onMounted(() => {
  sectionIds.forEach(id => {
    registerTarget({
      id: `lessonPlan.${id}`,
      elementId: id,
      route: '/lesson-plan/:id',
      canEdit: true,
      editAction: () => store.startEditing(id)
    })
  })

  // Register form state for AI content synchronization
  // Create a reactive proxy that forwards updates to the store's updateDraft
  const contentFormState = new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'string') {
        return store.getSectionValue(prop)
      }
      return undefined
    },
    set(_target, prop, value) {
      if (typeof prop === 'string') {
        console.log('[LessonPlanEditor] Proxy set called:', prop, 'isEditing:', store.isEditing(prop))
        // Start editing if not already
        if (!store.isEditing(prop)) {
          console.log('[LessonPlanEditor] Starting editing for:', prop)
          store.startEditing(prop)
        }
        console.log('[LessonPlanEditor] Updating draft:', prop, 'value:', JSON.stringify(value).slice(0, 200))
        store.updateDraft(prop, value)
        hasUnsavedAiContent.value = true
        return true
      }
      return false
    }
  })

  formStateSynchronizer.registerForm('lessonPlanContent', contentFormState)

  // Check for existing draft to recover
  const existingDraft = loadDraft()
  if (existingDraft && Object.keys(existingDraft.sections).length > 0) {
    recoveryDraftTime.value = getTimeSinceLastSave()
    showDraftRecoveryBanner.value = true
  }

  // Cleanup old drafts on mount
  cleanupOldDrafts()
})

/**
 * Restore draft content
 */
function restoreDraft() {
  const draft = loadDraft()
  if (draft) {
    // Apply draft sections to store
    Object.entries(draft.sections).forEach(([sectionId, content]) => {
      if (!store.isEditing(sectionId)) {
        store.startEditing(sectionId)
      }
      store.updateDraft(sectionId, content)
    })
    hasUnsavedAiContent.value = true
    showDraftRecoveryBanner.value = false
  }
}

/**
 * Discard draft and hide banner
 */
function discardDraft() {
  clearDraft()
  showDraftRecoveryBanner.value = false
}

/**
 * Handle successful save - clear draft
 */
function onSaveSuccess() {
  clearDraft()
  hasUnsavedAiContent.value = false
}

// Unregister targets and form on unmount
onUnmounted(() => {
  sectionIds.forEach(id => {
    unregisterTarget(`lessonPlan.${id}`)
  })
  formStateSynchronizer.unregisterForm('lessonPlanContent')
})

// Computed from store
const lessonPlan = computed(() => store.lessonPlan)
const stage = computed(() => gradeToStage(lessonPlan.value?.gradeLevel))
const parsedContent = computed(() => store.parsedContent)
const availableRequirements = computed(() => store.availableRequirements)
const saving = computed(() => store.saving)
const storeError = computed(() => store.error)

// Watch for save completion - clear draft when save succeeds
watch(saving, (newVal, oldVal) => {
  // When saving transitions from true to false and there's no error
  if (oldVal === true && newVal === false && !storeError.value) {
    clearDraft()
    hasUnsavedAiContent.value = false
    showDraftRecoveryBanner.value = false
    console.log('[LessonPlanEditor] Save completed, draft cleared')
  }
})

// In create mode, all sections are always "editing"
const effectivelyEditing = (sectionId: string) => {
  return props.isCreateMode || editor.isEditing(sectionId)
}

// Typed section value getters
const getCourseRequirements = (): CourseRequirementsValue => {
  const value = editor.getSectionValue('courseRequirements') as CourseRequirementsValue | null
  return value || { contentIds: [], academicIds: [] }
}

const getTextbookAnalysis = (): TextbookAnalysisValue | string => {
  const value = editor.getSectionValue('textbookAnalysis')
  if (isTextbookAnalysisValue(value)) {
    return value as TextbookAnalysisValue
  }
  // Fallback to string for legacy data
  return (value as string) || ''
}

const getLearningObjectives = (): LearningObjective[] => {
  return (editor.getSectionValue('learningObjectives') as LearningObjective[]) || []
}

const getStudentAnalysis = (): string => {
  return (editor.getSectionValue('studentAnalysis') as string) || ''
}

const getPreClassPreparation = (): PreparationTask[] => {
  return (editor.getSectionValue('preClassPreparation') as PreparationTask[]) || []
}

const getLearningProcess = (): LearningTask[] => {
  return (editor.getSectionValue('learningProcess') as LearningTask[]) || []
}

const getHomeworkAssessment = (): HomeworkTask[] => {
  const value = editor.getSectionValue('homeworkAssessment') as HomeworkAssessmentValue | HomeworkTask[] | null
  // Handle both formats: old {homeworkTasks: [...]} and direct HomeworkTask[]
  if (Array.isArray(value)) {
    return value
  }
  return value?.homeworkTasks || []
}

const getCourseware = (): string => {
  return (editor.getSectionValue('courseware') as string) || ''
}

const getResources = (): string => {
  return (editor.getSectionValue('resources') as string) || ''
}

// Track if we should auto-open modal when entering edit mode from empty state click
const shouldAutoOpenModal = ref(false)

const handleEmptyClick = () => {
  shouldAutoOpenModal.value = true
  editor.startEdit('courseRequirements')
}

// Reset the flag after CourseRequirementsEditor is rendered
const resetAutoOpenFlag = () => {
  shouldAutoOpenModal.value = false
}

// Handle create mode save
const handleSave = () => {
  emit('save')
}

// Handle create mode cancel
const handleCancel = () => {
  emit('cancel')
}

// Edit icon SVG path
const editIconPath = `
  M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7
  M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z
`

// AI generate icon (sparkle)
const aiIconPath = `M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z`

/**
 * Handle AI generation for a section
 */
async function handleAiGenerate(sectionId: string) {
  if (!isGeneratableSection(sectionId)) return

  // Start editing mode first so content can be populated
  if (!editor.isEditing(sectionId)) {
    editor.startEdit(sectionId)
  }

  await generateSection(sectionId as GeneratableSectionName)
}

/**
 * Check if AI button should be shown for a section
 */
function showAiButton(sectionId: string): boolean {
  return isGeneratableSection(sectionId) && isAgentConnected.value
}
</script>

<template>
  <div class="editor-container">
    <!-- Left: Outline Panel -->
    <OutlinePanel
      :items="outlineItems"
      :active-section="activeSection"
      @select="setActiveSection($event)"
    />

    <!-- Center: Main Content -->
    <main class="main-editor">
      <!-- Draft Recovery Banner -->
      <div v-if="showDraftRecoveryBanner" class="draft-recovery-banner">
        <div class="draft-recovery-content">
          <svg class="draft-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          <span class="draft-text">发现未保存的 AI 生成内容（{{ recoveryDraftTime }}）</span>
        </div>
        <div class="draft-recovery-actions">
          <button class="btn-restore" @click="restoreDraft">恢复</button>
          <button class="btn-discard" @click="discardDraft">丢弃</button>
        </div>
      </div>

      <!-- AI Draft Indicator (shown when editing with AI content) -->
      <div v-if="hasUnsavedAiContent && !showDraftRecoveryBanner" class="ai-draft-indicator">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        <span>有未保存的 AI 生成内容</span>
      </div>
      <!-- 课程要求 -->
      <section id="courseRequirements" class="editor-section" :class="{ 'section-editing': effectivelyEditing('courseRequirements') }">
        <div class="section-header">
          <h2 class="section-title">1. 课程要求</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('courseRequirements') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('courseRequirements')" :disabled="editor.isSaving('courseRequirements')">
                {{ editor.isSaving('courseRequirements') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('courseRequirements')" :disabled="editor.isSaving('courseRequirements')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('courseRequirements') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('courseRequirements')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content">
          <!-- Show editor when editing (create mode or inline edit); otherwise show display -->
          <CourseRequirementsEditor
            v-if="effectivelyEditing('courseRequirements')"
            :content-ids="getCourseRequirements().contentIds"
            :academic-ids="getCourseRequirements().academicIds"
            :subject="lessonPlan?.subject || ''"
            :grade-level="lessonPlan?.gradeLevel || 1"
            :auto-open-modal="shouldAutoOpenModal"
            @update:content-ids="editor.updateDraft('courseRequirements', { ...getCourseRequirements(), contentIds: $event })"
            @update:academic-ids="editor.updateDraft('courseRequirements', { ...getCourseRequirements(), academicIds: $event })"
            @vue:mounted="resetAutoOpenFlag"
          />
          <StandardsDisplay
            v-else
            :content-ids="parsedContent.courseRequirements.contentIds"
            :academic-ids="parsedContent.courseRequirements.academicIds"
            :subject="lessonPlan?.subject"
            :stage="stage"
            @click-empty="handleEmptyClick"
          />
        </div>
      </section>

      <!-- 教材分析 -->
      <section id="textbookAnalysis" class="editor-section" :class="{ 'section-editing': effectivelyEditing('textbookAnalysis') }">
        <div class="section-header">
          <h2 class="section-title">2. 教材分析</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('textbookAnalysis') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('textbookAnalysis')" :disabled="editor.isSaving('textbookAnalysis')">
                {{ editor.isSaving('textbookAnalysis') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('textbookAnalysis')" :disabled="editor.isSaving('textbookAnalysis')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('textbookAnalysis') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('textbookAnalysis')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
            <!-- AI Generate Button -->
            <button
              v-if="showAiButton('textbookAnalysis')"
              class="section-ai-btn"
              :class="{ generating: isGenerating('textbookAnalysis') }"
              :disabled="generating"
              @click="handleAiGenerate('textbookAnalysis')"
              title="AI 生成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="aiIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content">
          <TextbookAnalysisEditor
            :model-value="getTextbookAnalysis()"
            :readonly="!effectivelyEditing('textbookAnalysis')"
            @update:model-value="editor.updateDraft('textbookAnalysis', $event)"
          />
        </div>
      </section>

      <!-- 学习目标 -->
      <section id="learningObjectives" class="editor-section" :class="{ 'section-editing': effectivelyEditing('learningObjectives') }">
        <div class="section-header">
          <h2 class="section-title">3. 学习目标</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('learningObjectives') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('learningObjectives')" :disabled="editor.isSaving('learningObjectives')">
                {{ editor.isSaving('learningObjectives') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('learningObjectives')" :disabled="editor.isSaving('learningObjectives')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('learningObjectives') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('learningObjectives')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
            <!-- AI Generate Button -->
            <button
              v-if="showAiButton('learningObjectives')"
              class="section-ai-btn"
              :class="{ generating: isGenerating('learningObjectives') }"
              :disabled="generating"
              @click="handleAiGenerate('learningObjectives')"
              title="AI 生成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="aiIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content">
          <LearningObjectivesEditor
            :model-value="getLearningObjectives()"
            :available-requirements="availableRequirements"
            :readonly="!effectivelyEditing('learningObjectives')"
            @update:model-value="editor.updateDraft('learningObjectives', $event)"
          />
        </div>
      </section>

      <!-- 学情分析 -->
      <section id="studentAnalysis" class="editor-section" :class="{ 'section-editing': effectivelyEditing('studentAnalysis') }">
        <div class="section-header">
          <h2 class="section-title">4. 学情分析</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('studentAnalysis') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('studentAnalysis')" :disabled="editor.isSaving('studentAnalysis')">
                {{ editor.isSaving('studentAnalysis') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('studentAnalysis')" :disabled="editor.isSaving('studentAnalysis')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('studentAnalysis') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('studentAnalysis')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
            <!-- AI Generate Button -->
            <button
              v-if="showAiButton('studentAnalysis')"
              class="section-ai-btn"
              :class="{ generating: isGenerating('studentAnalysis') }"
              :disabled="generating"
              @click="handleAiGenerate('studentAnalysis')"
              title="AI 生成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="aiIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content markdown-preview">
          <MarkdownSection
            :model-value="getStudentAnalysis()"
            :readonly="!effectivelyEditing('studentAnalysis')"
            :hide-title="true"
            @update:model-value="editor.updateDraft('studentAnalysis', $event)"
          />
        </div>
      </section>

      <!-- 课前准备 -->
      <section id="preClassPreparation" class="editor-section" :class="{ 'section-editing': effectivelyEditing('preClassPreparation') }">
        <div class="section-header">
          <h2 class="section-title">5. 课前准备</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('preClassPreparation') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('preClassPreparation')" :disabled="editor.isSaving('preClassPreparation')">
                {{ editor.isSaving('preClassPreparation') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('preClassPreparation')" :disabled="editor.isSaving('preClassPreparation')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('preClassPreparation') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('preClassPreparation')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
            <!-- AI Generate Button -->
            <button
              v-if="showAiButton('preClassPreparation')"
              class="section-ai-btn"
              :class="{ generating: isGenerating('preClassPreparation') }"
              :disabled="generating"
              @click="handleAiGenerate('preClassPreparation')"
              title="AI 生成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="aiIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content">
          <PreparationTasksEditor
            :model-value="getPreClassPreparation()"
            :available-objectives="parsedContent.learningObjectives"
            :readonly="!effectivelyEditing('preClassPreparation')"
            @update:model-value="editor.updateDraft('preClassPreparation', $event)"
          />
        </div>
      </section>

      <!-- 学习过程 -->
      <section id="learningProcess" class="editor-section" :class="{ 'section-editing': effectivelyEditing('learningProcess') }">
        <div class="section-header">
          <h2 class="section-title">6. 学习过程</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('learningProcess') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('learningProcess')" :disabled="editor.isSaving('learningProcess')">
                {{ editor.isSaving('learningProcess') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('learningProcess')" :disabled="editor.isSaving('learningProcess')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('learningProcess') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('learningProcess')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
            <!-- AI Generate Button -->
            <button
              v-if="showAiButton('learningProcess')"
              class="section-ai-btn"
              :class="{ generating: isGenerating('learningProcess') }"
              :disabled="generating"
              @click="handleAiGenerate('learningProcess')"
              title="AI 生成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="aiIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content">
          <LearningTasksEditor
            :model-value="getLearningProcess()"
            :available-requirements="availableRequirements"
            :readonly="!effectivelyEditing('learningProcess')"
            @update:model-value="editor.updateDraft('learningProcess', $event)"
          />
        </div>
      </section>

      <!-- 作业检测 -->
      <section id="homeworkAssessment" class="editor-section" :class="{ 'section-editing': effectivelyEditing('homeworkAssessment') }">
        <div class="section-header">
          <h2 class="section-title">7. 作业检测</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('homeworkAssessment') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('homeworkAssessment')" :disabled="editor.isSaving('homeworkAssessment')">
                {{ editor.isSaving('homeworkAssessment') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('homeworkAssessment')" :disabled="editor.isSaving('homeworkAssessment')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('homeworkAssessment') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('homeworkAssessment')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
            <!-- AI Generate Button -->
            <button
              v-if="showAiButton('homeworkAssessment')"
              class="section-ai-btn"
              :class="{ generating: isGenerating('homeworkAssessment') }"
              :disabled="generating"
              @click="handleAiGenerate('homeworkAssessment')"
              title="AI 生成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="aiIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content">
          <HomeworkAssessmentEditor
            :model-value="getHomeworkAssessment()"
            :available-objectives="parsedContent.learningObjectives"
            :readonly="!effectivelyEditing('homeworkAssessment')"
            @update:model-value="editor.updateDraft('homeworkAssessment', $event)"
          />
        </div>
      </section>

      <!-- 课件 -->
      <section id="courseware" class="editor-section" :class="{ 'section-editing': effectivelyEditing('courseware') }">
        <div class="section-header">
          <h2 class="section-title">8. 课件</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('courseware') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('courseware')" :disabled="editor.isSaving('courseware')">
                {{ editor.isSaving('courseware') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('courseware')" :disabled="editor.isSaving('courseware')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('courseware') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('courseware')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content markdown-preview">
          <MarkdownSection
            :model-value="getCourseware()"
            :readonly="!effectivelyEditing('courseware')"
            :hide-title="true"
            @update:model-value="editor.updateDraft('courseware', $event)"
          />
        </div>
      </section>

      <!-- 资源 -->
      <section id="resources" class="editor-section" :class="{ 'section-editing': effectivelyEditing('resources') }">
        <div class="section-header">
          <h2 class="section-title">9. 资源</h2>
          <div class="section-actions">
            <template v-if="editor.isEditing('resources') && showPerSectionSaveCancel">
              <button class="btn-save" @click="editor.saveEdit('resources')" :disabled="editor.isSaving('resources')">
                {{ editor.isSaving('resources') ? '保存中...' : '保存' }}
              </button>
              <button class="btn-cancel" @click="editor.cancelEdit('resources')" :disabled="editor.isSaving('resources')">取消</button>
            </template>
            <button v-else-if="!editor.isEditing('resources') && showPerSectionEditButton" class="section-edit-btn" @click="editor.startEdit('resources')" title="编辑此部分">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="editIconPath"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="section-content markdown-preview">
          <MarkdownSection
            :model-value="getResources()"
            :readonly="!effectivelyEditing('resources')"
            :hide-title="true"
            @update:model-value="editor.updateDraft('resources', $event)"
          />
        </div>
      </section>

      <!-- Create Mode Action Bar -->
      <div v-if="isCreateMode && !hideActionBar" class="create-action-bar">
        <button class="btn-secondary" @click="handleCancel">取消</button>
        <button class="btn-primary" @click="handleSave" :disabled="saving">
          {{ saving ? '创建中...' : '创建教案' }}
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.editor-container {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
  min-height: calc(100vh - 220px);
}

.main-editor {
  background: white;
  border-radius: 16px;
  padding: 40px;
  border: 1px solid rgba(203, 213, 225, 0.4);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  overflow-y: auto;
}

/* Draft Recovery Banner */
.draft-recovery-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
  border: 1px solid #e9d5ff;
  border-radius: 8px;
  margin-bottom: 24px;
}

.draft-recovery-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.draft-icon {
  color: #a855f7;
}

.draft-text {
  font-size: 14px;
  color: #6b21a8;
  font-weight: 500;
}

.draft-recovery-actions {
  display: flex;
  gap: 8px;
}

.btn-restore {
  padding: 6px 14px;
  background: #a855f7;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-restore:hover {
  background: #9333ea;
}

.btn-discard {
  padding: 6px 14px;
  background: transparent;
  color: #7c3aed;
  border: 1px solid #c4b5fd;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-discard:hover {
  background: #ede9fe;
  border-color: #a78bfa;
}

/* AI Draft Indicator */
.ai-draft-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #faf5ff;
  color: #9333ea;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 16px;
}

.ai-draft-indicator svg {
  animation: sparkle 2s ease-in-out infinite;
}

@keyframes sparkle {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.9);
  }
}

.editor-section {
  margin-bottom: 32px;
  scroll-margin-top: 120px;
}

.editor-section:last-child {
  margin-bottom: 0;
}

/* Section Header with Edit Button */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.section-edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  opacity: 0;
}

.editor-section:hover .section-edit-btn {
  opacity: 1;
}

.section-edit-btn:hover {
  background: #f1f5f9;
  color: #2563eb;
}

/* AI Generate Button */
.section-ai-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #a855f7;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  opacity: 0;
}

.editor-section:hover .section-ai-btn {
  opacity: 1;
}

.section-ai-btn:hover:not(:disabled) {
  background: #faf5ff;
  color: #9333ea;
}

.section-ai-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.section-ai-btn.generating {
  opacity: 1;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Inline Editing Styles */
.section-editing {
  border-left: 3px solid #2563eb;
  background: #fefefe;
  padding-left: 16px;
  margin-left: -19px;
  border-radius: 0 8px 8px 0;
}

.section-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px;
  background: #2563eb;
  color: white;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-save:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover:not(:disabled) {
  background: #e2e8f0;
  color: #334155;
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* When editing, always show section actions */
.section-editing .section-actions {
  opacity: 1;
}

.section-content {
  color: #334155;
  line-height: 1.6;
}

.markdown-preview {
  /* Ensure markdown content displays properly */
}

/* Touch devices: always show edit button and AI button */
@media (hover: none) {
  .section-edit-btn,
  .section-ai-btn {
    opacity: 1;
  }
}

/* Create Mode Action Bar */
.create-action-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #e2e8f0;
  margin: 24px -40px -40px -40px;
  border-radius: 0 0 16px 16px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background: #2563eb;
  color: white;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #334155;
}

@media (max-width: 768px) {
  .editor-container {
    grid-template-columns: 1fr;
  }

  .create-action-bar {
    margin: 24px -20px -20px -20px;
  }
}
</style>
