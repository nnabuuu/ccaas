<script setup lang="ts">
import { ref, reactive, computed, watch, inject, onMounted, onUnmounted, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { lessonPlanApi } from '../api/index'
import { getDefaultContent } from '../composables/useLessonPlanParser'
import { useSchoolStore } from '../stores/domain/schoolStore'
import toast from '../utils/toast'
import PageContainer from '../components/layout/PageContainer.vue'
import TextbookChapterSelector from '../components/lesson-plan/TextbookChapterSelector.vue'
import type { FormStateSynchronizer } from '@/agent/form-state-synchronizer'

const router = useRouter()
const schoolStore = useSchoolStore()

// Debug mode - inject clientId from AgentListener (it's a Ref<string>)
const agentClientId = inject<Ref<string>>('agentClientId', ref(''))
const showDebugPanel = ref(false)
const debugLoading = ref(false)
const debugResult = ref<string | null>(null)

// =============================================================================
// Agent Form Bridge Registration
// =============================================================================
const registerAgentForm = inject<
  (formId: string, handlers: {
    applyFormData: (data: Record<string, unknown>) => Promise<{
      success: boolean
      errors?: Array<{ field: string; message: string; expected?: string }>
      appliedFields?: string[]
      formState?: Record<string, unknown>
    }>
    getFormState: () => Record<string, unknown>
    submit: () => Promise<{ success: boolean; result?: unknown; error?: string }>
    getDataShape?: () => { fields: Array<{ name: string; type: string; required?: boolean; options?: Array<{ value: unknown; label: string }> }> }
    readonly?: boolean
  }) => void
>('registerAgentForm')

const unregisterAgentForm = inject<(formId: string) => void>('unregisterAgentForm')

// =============================================================================
// FormStateSynchronizer Integration
// =============================================================================
const formStateSynchronizer = inject<FormStateSynchronizer>('formStateSynchronizer')

// Form ID for synchronizer registration
const FORM_ID = 'lesson-plan-create'

// AI-modified field highlighting
const aiModifiedFields = ref<Set<string>>(new Set())
const highlightTimers = new Map<string, ReturnType<typeof setTimeout>>()
const HIGHLIGHT_DURATION = 3000 // 3 seconds

// Check if we're in dev mode
const isDev = import.meta.env.DEV

// Debug: Run wizard auto flow
const runDebugWizardAuto = async () => {
  const clientId = agentClientId.value
  if (!clientId) {
    toast.error('未连接到 Agent 后端，请确保 ChatbotWidget 已加载')
    return
  }

  debugLoading.value = true
  debugResult.value = null

  try {
    const response = await fetch('http://localhost:3001/agent/debug/wizard/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId,
        subject: subject.value,
        grade: gradeLevel.value,
      }),
    })

    const result = await response.json()
    debugResult.value = JSON.stringify(result, null, 2)

    if (result.success) {
      toast.success(result.message || 'Wizard 已启动')
    } else {
      toast.error(result.error?.message || '执行失败')
    }
  } catch (error) {
    debugResult.value = `Error: ${error}`
    toast.error('调用失败：' + (error as Error).message)
  } finally {
    debugLoading.value = false
  }
}

// Debug: Continue to preview after chapter selection
const runDebugPreview = async () => {
  const clientId = agentClientId.value
  if (!clientId) {
    toast.error('未连接到 Agent 后端')
    return
  }

  debugLoading.value = true
  try {
    const response = await fetch('http://localhost:3001/agent/debug/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId,
        action: 'preview',
      }),
    })

    const result = await response.json()
    debugResult.value = JSON.stringify(result, null, 2)
  } catch (error) {
    debugResult.value = `Error: ${error}`
  } finally {
    debugLoading.value = false
  }
}

// Debug: Submit to create lesson plan
const runDebugSubmit = async () => {
  const clientId = agentClientId.value
  if (!clientId) {
    toast.error('未连接到 Agent 后端')
    return
  }

  debugLoading.value = true
  try {
    const response = await fetch('http://localhost:3001/agent/debug/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId,
        action: 'submit',
      }),
    })

    const result = await response.json()
    debugResult.value = JSON.stringify(result, null, 2)

    if (result.lessonPlanId) {
      toast.success(`教案创建成功！ID: ${result.lessonPlanId}`)
    }
  } catch (error) {
    debugResult.value = `Error: ${error}`
  } finally {
    debugLoading.value = false
  }
}

// Form state - using reactive object for FormStateSynchronizer compatibility
const formState = reactive({
  subject: '数学',
  gradeLevel: 3,
  title: '',
  chapterId: null as number | null,
  chapterTitle: null as string | null,
})

// Computed refs for template compatibility (read from formState)
const subject = computed({
  get: () => formState.subject,
  set: (v: string) => { formState.subject = v },
})
const gradeLevel = computed({
  get: () => formState.gradeLevel,
  set: (v: number) => { formState.gradeLevel = v },
})
const title = computed({
  get: () => formState.title,
  set: (v: string) => { formState.title = v },
})
const selectedChapterId = computed({
  get: () => formState.chapterId,
  set: (v: number | null) => { formState.chapterId = v },
})
const selectedChapterTitle = computed({
  get: () => formState.chapterTitle,
  set: (v: string | null) => { formState.chapterTitle = v },
})

const creating = ref(false)

// Textbook chapter association state (single selection)
const showChapterSelector = ref(false)
const chaptersLocked = ref(false) // When true, subject/grade derived from chapter

// Get schoolId from global store
const schoolId = computed(() => schoolStore.currentSchoolId)

// Available options
const subjects = [
  { value: '语文', label: '语文' },
  { value: '数学', label: '数学' },
  { value: '英语', label: '英语' },
  { value: '物理', label: '物理' },
  { value: '化学', label: '化学' },
  { value: '生物', label: '生物' },
  { value: '历史', label: '历史' },
  { value: '地理', label: '地理' },
  { value: '信息科技', label: '信息科技' },
  { value: '道德与法治', label: '道德与法治' },
  { value: '科学', label: '科学' },
  { value: '音乐', label: '音乐' },
  { value: '美术', label: '美术' },
  { value: '体育', label: '体育' }
]

const grades = [
  { value: 1, label: '一年级' },
  { value: 2, label: '二年级' },
  { value: 3, label: '三年级' },
  { value: 4, label: '四年级' },
  { value: 5, label: '五年级' },
  { value: 6, label: '六年级' },
  { value: 7, label: '七年级' },
  { value: 8, label: '八年级' },
  { value: 9, label: '九年级' }
]

// Generate title if not provided
const generateTitle = () => {
  const date = new Date()
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`
  return `${subject.value}-${gradeLevel.value}年级-${dateStr}-新教案`
}

// Generate lesson plan code
const generateCode = () => 'LP-' + Date.now().toString(36).toUpperCase()

// Handle create
const handleCreate = async () => {
  // Validate school is selected (from global store)
  if (!schoolId.value) {
    toast.error('请先在顶部导航栏选择学校')
    return
  }

  creating.value = true
  try {
    const payload = {
      lessonPlanCode: generateCode(),
      title: title.value.trim() || generateTitle(),
      subject: subject.value,
      gradeLevel: gradeLevel.value,
      durationMinutes: 45,
      objectives: '',
      content: JSON.stringify(getDefaultContent()),
      status: 'DRAFT' as const,
      schoolId: schoolId.value
    }

    const response = await lessonPlanApi.create(payload)
    const responseData = response as { data?: { id: number }; id?: number }
    const result = responseData.data || responseData
    const newId = result.id as number

    // Save textbook chapter association if one was selected
    if (selectedChapterId.value !== null && newId) {
      try {
        await lessonPlanApi.setTextbookChapters(newId, [selectedChapterId.value])
      } catch (chapterError) {
        console.warn('Failed to save textbook chapter association:', chapterError)
        // Don't fail the whole create for this
      }
    }

    toast.success('创建成功')
    router.push(`/lesson-plan/${newId}`)
  } catch (error) {
    console.error('Failed to create lesson plan:', error)
    toast.error('创建失败：' + ((error as Error).message || '未知错误'))
  } finally {
    creating.value = false
  }
}

// Handle cancel
const handleCancel = () => {
  router.push('/lesson-plan')
}

// Handle chapter selection confirmation
// Always emits chapter_selected event - backend decides if wizard is waiting
const handleChaptersConfirm = (data: { chapterId: number | null; chapterTitle: string | null; subject: string; grade: number }) => {
  if (data.chapterId !== null) {
    // Use FormStateSynchronizer for consistent state updates
    if (formStateSynchronizer) {
      formStateSynchronizer.updateFields(FORM_ID, {
        chapterId: data.chapterId,
        chapterTitle: data.chapterTitle,
        subject: data.subject,
        gradeLevel: data.grade,
      }, 'manual')
    } else {
      // Fallback: direct update if synchronizer not available
      formState.chapterId = data.chapterId
      formState.chapterTitle = data.chapterTitle
      formState.subject = data.subject
      formState.gradeLevel = data.grade
    }
    chaptersLocked.value = true

    // Always notify via window event - AgentListener emits chapter_selected via socket
    // Backend checks if wizard is in SELECTING phase before processing
    console.log('[LessonPlanNewView] Chapter selected, notifying agent:', data)
    window.dispatchEvent(new CustomEvent('agent-chapter-confirmed', {
      detail: {
        chapterId: data.chapterId,
        chapterTitle: data.chapterTitle,
        subject: data.subject,
        grade: data.grade,
      }
    }))
  } else {
    // Clear chapter selection
    if (formStateSynchronizer) {
      formStateSynchronizer.updateFields(FORM_ID, {
        chapterId: null,
        chapterTitle: null,
      }, 'manual')
    } else {
      formState.chapterId = null
      formState.chapterTitle = null
    }
    chaptersLocked.value = false
  }

  showChapterSelector.value = false
}

// Clear chapter selection
const clearChapterSelection = () => {
  if (formStateSynchronizer) {
    formStateSynchronizer.updateFields(FORM_ID, {
      chapterId: null,
      chapterTitle: null,
    }, 'manual')
  } else {
    formState.chapterId = null
    formState.chapterTitle = null
  }
  chaptersLocked.value = false
}

// Handle agent-set-chapter event (from AgentListener fill_field command)
const handleAgentSetChapter = (event: CustomEvent<{ chapterId: number; chapterLabel: string }>) => {
  const { chapterId, chapterLabel } = event.detail
  console.log('[LessonPlanNewView] Agent set chapter:', chapterId, chapterLabel)

  // Use FormStateSynchronizer with 'agent' source for consistent tracking
  if (formStateSynchronizer) {
    formStateSynchronizer.updateFields(FORM_ID, {
      chapterId: chapterId,
      chapterTitle: chapterLabel,
    }, 'agent')
  } else {
    formState.chapterId = chapterId
    formState.chapterTitle = chapterLabel
  }
  // Note: We don't lock subject/grade here because agent already set them
}

// Handle agent-open-chapter-selector event (from AgentListener command)
const handleAgentOpenChapterSelector = (event: CustomEvent<{
  initialSubject?: string
  initialGrade?: number
  searchTopic?: string
}>) => {
  const { initialSubject, initialGrade } = event.detail
  console.log('[LessonPlanNewView] Agent opening chapter selector:', event.detail)

  // Set initial values if provided
  if (initialSubject) {
    formState.subject = initialSubject
  }
  if (initialGrade) {
    formState.gradeLevel = initialGrade
  }

  // Open the dialog - no flag needed, backend checks if wizard is waiting
  showChapterSelector.value = true
}

// =============================================================================
// Agent Form Bridge Handlers
// =============================================================================

/**
 * Mark field as AI-modified and trigger highlight
 */
function markFieldModified(fieldName: string) {
  // Clear existing timer if any (handle rapid updates)
  const existingTimer = highlightTimers.get(fieldName)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  // Add to modified set
  aiModifiedFields.value = new Set([...aiModifiedFields.value, fieldName])

  // Set timer to remove highlight
  const timer = setTimeout(() => {
    const newSet = new Set(aiModifiedFields.value)
    newSet.delete(fieldName)
    aiModifiedFields.value = newSet
    highlightTimers.delete(fieldName)
  }, HIGHLIGHT_DURATION)

  highlightTimers.set(fieldName, timer)
}

/**
 * Apply form data from AI agent (2-way sync: clears unset fields)
 * Uses FormStateSynchronizer for consistent state management
 */
async function applyFormData(data: Record<string, unknown>): Promise<{
  success: boolean
  errors?: Array<{ field: string; message: string; expected?: string }>
  appliedFields?: string[]
  formState?: Record<string, unknown>
}> {
  const errors: Array<{ field: string; message: string; expected?: string }> = []
  const appliedFields: string[] = []

  console.log('[LessonPlanNewView] applyFormData called with:', data)

  // Validate data before applying
  if ('subject' in data) {
    const subjectValue = data.subject as string
    const validSubjects = subjects.map(s => s.value)
    if (!validSubjects.includes(subjectValue)) {
      errors.push({
        field: 'subject',
        message: `Invalid subject: ${subjectValue}`,
        expected: validSubjects.join(', ')
      })
    } else {
      appliedFields.push('subject')
    }
  }

  if ('gradeLevel' in data) {
    const gradeValue = data.gradeLevel as number
    if (gradeValue < 1 || gradeValue > 12) {
      errors.push({
        field: 'gradeLevel',
        message: `Grade must be 1-12, got ${gradeValue}`,
        expected: 'number 1-12'
      })
    } else {
      appliedFields.push('gradeLevel')
    }
  }

  if ('title' in data) {
    appliedFields.push('title')
  }

  if ('chapterId' in data) {
    appliedFields.push('chapterId')
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  // Build the update payload with defaults for unset fields (2-way sync)
  const updatePayload: Record<string, unknown> = {
    subject: data.subject ?? '数学',
    gradeLevel: data.gradeLevel ?? 3,
    title: data.title ?? '',
    chapterId: data.chapterId ?? null,
    chapterTitle: data.chapterTitle ?? null,
  }

  // Apply via FormStateSynchronizer for consistent state management
  // The subscription will automatically trigger AI highlighting for 'agent' source
  if (formStateSynchronizer) {
    formStateSynchronizer.updateFields(FORM_ID, updatePayload, 'agent')
  } else {
    // Fallback: direct update
    Object.assign(formState, updatePayload)
    // Manual highlighting for fallback path
    for (const field of appliedFields) {
      markFieldModified(field === 'chapterId' ? 'textbookChapterId' : field)
    }
  }

  // Handle chaptersLocked state (not part of form state)
  if ('chapterId' in data && data.chapterId === null) {
    chaptersLocked.value = false
  }

  return {
    success: true,
    appliedFields,
    formState: getFormState()
  }
}

/**
 * Get current form state
 */
function getFormState(): Record<string, unknown> {
  return {
    subject: formState.subject,
    gradeLevel: formState.gradeLevel,
    title: formState.title,
    chapterId: formState.chapterId,
    chapterTitle: formState.chapterTitle,
    schoolId: schoolId.value
  }
}

/**
 * Submit the form programmatically
 */
async function submitForm(): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    // Validate school
    if (!schoolId.value) {
      return { success: false, error: 'No school selected' }
    }

    creating.value = true

    const payload = {
      lessonPlanCode: generateCode(),
      title: title.value.trim() || generateTitle(),
      subject: subject.value,
      gradeLevel: gradeLevel.value,
      durationMinutes: 45,
      objectives: '',
      content: JSON.stringify(getDefaultContent()),
      status: 'DRAFT' as const,
      schoolId: schoolId.value
    }

    const response = await lessonPlanApi.create(payload)
    const responseData = response as { data?: { id: number }; id?: number }
    const result = responseData.data || responseData
    const newId = result.id as number

    // Save textbook chapter association if one was selected
    if (selectedChapterId.value !== null && newId) {
      try {
        await lessonPlanApi.setTextbookChapters(newId, [selectedChapterId.value])
      } catch (chapterError) {
        console.warn('Failed to save textbook chapter association:', chapterError)
      }
    }

    creating.value = false
    return { success: true, result: { id: newId } }
  } catch (error) {
    creating.value = false
    return { success: false, error: (error as Error).message || 'Unknown error' }
  }
}

/**
 * Get form data shape for AI discovery
 */
function getDataShape() {
  return {
    fields: [
      {
        name: 'subject',
        type: 'string' as const,
        required: true,
        options: subjects.map(s => ({ value: s.value, label: s.label })),
        description: '科目'
      },
      {
        name: 'gradeLevel',
        type: 'number' as const,
        required: true,
        options: grades.map(g => ({ value: g.value, label: g.label })),
        description: '年级 (1-12)'
      },
      {
        name: 'title',
        type: 'string' as const,
        required: false,
        description: '标题 (可选，留空自动生成)'
      },
      {
        name: 'chapterId',
        type: 'number' as const,
        required: false,
        description: '教材章节ID (可选)'
      },
      {
        name: 'chapterTitle',
        type: 'string' as const,
        required: false,
        description: '教材章节标题 (与chapterId一起使用)'
      }
    ]
  }
}

// Subscription cleanup handle
let synchronizerUnsubscribe: (() => void) | null = null

onMounted(() => {
  document.addEventListener('agent-set-chapter', handleAgentSetChapter as EventListener)
  window.addEventListener('agent-open-chapter-selector', handleAgentOpenChapterSelector as EventListener)

  // Register with FormStateSynchronizer
  if (formStateSynchronizer) {
    formStateSynchronizer.registerForm(FORM_ID, formState)
    console.log('[LessonPlanNewView] Registered with FormStateSynchronizer:', FORM_ID)

    // Subscribe to updates from non-manual sources to trigger AI highlighting
    synchronizerUnsubscribe = formStateSynchronizer.onFormUpdatedFor(FORM_ID, (event) => {
      if (event.source === 'a2ui' || event.source === 'agent') {
        markFieldModified(event.field)
        console.log(`[LessonPlanNewView] Field ${event.field} updated by ${event.source}:`, event.value)
      }
    })
  }

  // Register with Agent Form Bridge
  if (registerAgentForm) {
    registerAgentForm('lesson-plan-new', {
      applyFormData,
      getFormState,
      submit: submitForm,
      getDataShape,
      readonly: false
    })
    console.log('[LessonPlanNewView] Registered with Agent Form Bridge')
  }
})

onUnmounted(() => {
  document.removeEventListener('agent-set-chapter', handleAgentSetChapter as EventListener)
  window.removeEventListener('agent-open-chapter-selector', handleAgentOpenChapterSelector as EventListener)

  // Unsubscribe from FormStateSynchronizer updates
  if (synchronizerUnsubscribe) {
    synchronizerUnsubscribe()
    synchronizerUnsubscribe = null
  }

  // Unregister from FormStateSynchronizer
  if (formStateSynchronizer) {
    formStateSynchronizer.unregisterForm(FORM_ID)
  }

  // Unregister from Agent Form Bridge
  if (unregisterAgentForm) {
    unregisterAgentForm('lesson-plan-new')
  }

  // Clear all highlight timers
  for (const timer of highlightTimers.values()) {
    clearTimeout(timer)
  }
  highlightTimers.clear()
})
</script>

<template>
  <PageContainer variant="fluid">
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <router-link to="/home">首页</router-link>
      <span class="separator">&gt;</span>
      <router-link to="/lesson-plan">教案</router-link>
      <span class="separator">&gt;</span>
      <span class="current">新建</span>
    </div>

    <!-- Form Card -->
    <div class="landing-card">
        <h1 class="card-title">创建新教案</h1>
        <p class="card-subtitle">选择科目和年级开始创建，完成后可在详情页继续编辑</p>

        <!-- School info from global store -->
        <div v-if="schoolStore.currentSchool" class="school-info">
          <span class="school-label">当前学校：</span>
          <span class="school-value">{{ schoolStore.currentSchoolName }}</span>
        </div>
        <div v-else class="school-warning">
          请先在顶部导航栏选择学校
        </div>

        <!-- Textbook Chapter Selection (Optional) -->
        <div class="form-group" :class="{ 'ai-modified': aiModifiedFields.has('textbookChapterId') }" data-field-id="textbookChapterId">
          <label class="form-label">关联教材章节 <span class="optional">(可选)</span></label>
          <div
            data-widget="chapter-picker"
            :data-selected-id="selectedChapterId"
            :data-selected-label="selectedChapterTitle"
          >
            <div v-if="selectedChapterId !== null" class="chapter-selection-info">
              <span class="chapter-title selected-chapter-label">{{ selectedChapterTitle }}</span>
              <button type="button" class="btn-link chapter-picker-trigger" @click="showChapterSelector = true">修改</button>
              <button type="button" class="btn-link btn-link-danger" @click="clearChapterSelection">清除</button>
            </div>
            <button v-else type="button" class="btn-outline chapter-picker-trigger" @click="showChapterSelector = true">
              选择教材章节
            </button>
          </div>
          <p v-if="chaptersLocked" class="form-hint">科目和年级已根据所选章节自动设置</p>
        </div>

        <div class="form-group" :class="{ 'ai-modified': aiModifiedFields.has('subject') }" data-field-id="subject">
          <label class="form-label">科目 <span class="required">*</span></label>
          <select v-model="subject" class="form-select" :disabled="chaptersLocked">
            <option v-for="s in subjects" :key="s.value" :value="s.value">
              {{ s.label }}
            </option>
          </select>
        </div>

        <div class="form-group" :class="{ 'ai-modified': aiModifiedFields.has('gradeLevel') }" data-field-id="gradeLevel">
          <label class="form-label">年级 <span class="required">*</span></label>
          <select v-model="gradeLevel" class="form-select" :disabled="chaptersLocked">
            <option v-for="g in grades" :key="g.value" :value="g.value">
              {{ g.label }}
            </option>
          </select>
        </div>

        <div class="form-group" :class="{ 'ai-modified': aiModifiedFields.has('title') }" data-field-id="title">
          <label class="form-label">标题 <span class="optional">(可选)</span></label>
          <input
            v-model="title"
            type="text"
            class="form-input"
            :placeholder="`留空则自动生成，如：${generateTitle()}`"
          />
        </div>

        <div class="form-actions">
          <button class="btn-secondary" @click="handleCancel">取消</button>
          <button class="btn-primary" @click="handleCreate" :disabled="creating || !schoolId">
            {{ creating ? '创建中...' : '开始创建' }}
          </button>
        </div>
    </div>

    <!-- Textbook Chapter Selector Modal -->
    <TextbookChapterSelector
      v-model:visible="showChapterSelector"
      :initial-chapter-id="selectedChapterId"
      :initial-subject="subject"
      :initial-grade="gradeLevel"
      @confirm="handleChaptersConfirm"
    />

    <!-- Debug Panel (dev mode only) -->
    <div v-if="isDev" class="debug-toggle">
      <button class="btn-debug-toggle" @click="showDebugPanel = !showDebugPanel">
        {{ showDebugPanel ? '隐藏' : '调试' }}
      </button>
    </div>

    <div v-if="isDev && showDebugPanel" class="debug-panel">
      <h4>Wizard Debug Panel</h4>
      <p class="debug-info">ClientId: {{ agentClientId || '(未连接)' }}</p>

      <div class="debug-actions">
        <button
          class="btn-debug"
          @click="runDebugWizardAuto"
          :disabled="debugLoading || !agentClientId"
        >
          1. 启动 Wizard (填写+打开选择器)
        </button>

        <button
          class="btn-debug"
          @click="runDebugPreview"
          :disabled="debugLoading || !agentClientId"
        >
          2. 预览 (选择章节后)
        </button>

        <button
          class="btn-debug btn-debug-primary"
          @click="runDebugSubmit"
          :disabled="debugLoading || !agentClientId"
        >
          3. 提交创建
        </button>
      </div>

      <div v-if="debugResult" class="debug-result">
        <pre>{{ debugResult }}</pre>
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 24px;
}

.breadcrumb a {
  color: #6b7280;
  text-decoration: none;
}

.breadcrumb a:hover {
  color: #3b82f6;
}

.breadcrumb .separator {
  color: #9ca3af;
}

.breadcrumb .current {
  color: #1f2937;
}

.landing-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px 0;
  text-align: center;
}

.card-subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 24px 0;
  text-align: center;
}

.school-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 24px;
}

.school-label {
  font-size: 14px;
  color: #64748b;
}

.school-value {
  font-size: 14px;
  font-weight: 500;
  color: #0369a1;
}

.school-warning {
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 14px;
  color: #92400e;
  text-align: center;
}

.form-group {
  margin-bottom: 20px;
}

/* AI-modified field highlighting */
.form-group.ai-modified {
  animation: ai-highlight 3s ease-out;
}

@keyframes ai-highlight {
  0% {
    background-color: rgba(59, 130, 246, 0.2);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
    border-radius: 8px;
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.required {
  color: #ef4444;
}

.optional {
  color: #9ca3af;
  font-weight: 400;
}

.form-select,
.form-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #0f172a;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-input::placeholder {
  color: #94a3b8;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 32px;
}

.btn-primary {
  flex: 1;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 12px 24px;
  background-color: #2563eb;
  color: white;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.btn-primary:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.btn-secondary {
  flex: 1;
  padding: 12px 24px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #334155;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.btn-secondary:hover {
  background-color: #f8fafc;
  border-color: #cbd5e1;
}

/* Textbook chapter selection styles */
.chapter-selection-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.chapter-title {
  font-size: 14px;
  color: #0369a1;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-link {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-link-danger {
  color: #dc2626;
}

.btn-outline {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.btn-outline:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.form-hint {
  font-size: 12px;
  color: #64748b;
  margin: 8px 0 0 0;
}

.form-select:disabled {
  background: #f1f5f9;
  color: #64748b;
  cursor: not-allowed;
}

/* Debug panel styles */
.debug-toggle {
  position: fixed;
  bottom: 20px;
  right: 100px;
  z-index: 1000;
}

.btn-debug-toggle {
  padding: 8px 16px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.btn-debug-toggle:hover {
  background: #4f46e5;
}

.debug-panel {
  position: fixed;
  bottom: 60px;
  right: 100px;
  width: 360px;
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: 12px;
  padding: 16px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  font-size: 13px;
}

.debug-panel h4 {
  margin: 0 0 12px 0;
  color: #f5c2e7;
  font-size: 14px;
}

.debug-info {
  margin: 0 0 12px 0;
  color: #a6adc8;
  font-size: 11px;
  font-family: monospace;
}

.debug-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-debug {
  padding: 10px 16px;
  background: #313244;
  color: #cdd6f4;
  border: 1px solid #45475a;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.btn-debug:hover:not(:disabled) {
  background: #45475a;
}

.btn-debug:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-debug-primary {
  background: #89b4fa;
  color: #1e1e2e;
  border-color: #89b4fa;
}

.btn-debug-primary:hover:not(:disabled) {
  background: #b4befe;
}

.debug-result {
  margin-top: 12px;
  padding: 12px;
  background: #11111b;
  border-radius: 6px;
  max-height: 200px;
  overflow: auto;
}

.debug-result pre {
  margin: 0;
  font-size: 11px;
  font-family: 'Fira Code', 'Monaco', monospace;
  color: #a6e3a1;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #0f172a;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

</style>
