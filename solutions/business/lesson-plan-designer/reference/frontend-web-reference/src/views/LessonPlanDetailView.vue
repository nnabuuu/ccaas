<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onBeforeUnmount, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLessonPlanStore } from '../stores/domain/lessonPlanStore'
import { useNavigationStore } from '../stores/core/uiStore'
import { LessonPlanEditor } from '../components/lesson-plan'
import AIEditingOverlay from '../components/agent/AIEditingOverlay.vue'
import { BaseModal } from '../components/layout'
import toast from '../utils/toast'
import {
  InlineEditText,
  InlineEditNumber,
  InlineEditSelect
} from '../components/inline-edit'
import TextbookChapterSelector from '../components/lesson-plan/TextbookChapterSelector.vue'
import { lessonPlanApi } from '../api/index'
import type { TextbookChapter } from '../types'
import { formStateSynchronizer } from '../agent/form-state-synchronizer'

// Grade level options
const gradeLevelOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}年级`
}))

// Subject options
const subjectOptions = [
  { value: '语文', label: '语文' },
  { value: '数学', label: '数学' },
  { value: '英语', label: '英语' },
  { value: '物理', label: '物理' },
  { value: '化学', label: '化学' },
  { value: '生物', label: '生物' },
  { value: '历史', label: '历史' },
  { value: '地理', label: '地理' },
  { value: '政治', label: '政治' },
  { value: '音乐', label: '音乐' },
  { value: '美术', label: '美术' },
  { value: '体育', label: '体育' },
  { value: '科学', label: '科学' },
  { value: '信息技术', label: '信息技术' },
  { value: '道德与法治', label: '道德与法治' },
  { value: '其他', label: '其他' }
]

const HEADER_OFFSET = 120

const route = useRoute()
const router = useRouter()
const store = useLessonPlanStore()
const navigationStore = useNavigationStore()

// Overflow menu state
const showOverflowMenu = ref(false)

// Textbook chapter association state
const showChapterSelector = ref(false)

// Confirm modal state
const confirmAction = ref<{ type: 'delete' | 'cancel_edits' } | null>(null)

// Use textbookChapters from integrated API response (no separate fetch needed)
const textbookChapters = computed(() => lessonPlan.value?.textbookChapters || [])

// AI progress state from AgentListener (via Socket.io output_update events)
const aiOutputGenerating = inject<{ value: boolean }>('aiOutputGenerating', ref(false))
const aiOutputProgress = inject<{ value: { totalSteps: number; completedSteps: number; currentStep: string; percentage: number } }>('aiOutputProgress', ref({
  totalSteps: 0,
  completedSteps: 0,
  currentStep: '',
  percentage: 0
}))

// Manual sync state (fallback when Socket.io fails)
const agentSessionId = inject<{ value: string }>('agentSessionId', ref(''))
const isSyncingManually = ref(false)

// Debug mode
const showDebugPanel = ref(false)

// Computed from store
const lessonPlan = computed(() => store.lessonPlan)
const loading = computed(() => store.loading)
const saving = computed(() => store.saving)
const error = computed(() => store.error)
const lessonPlanId = computed(() => Number(route.params.id))
const isDirty = computed(() => store.isDirty)

// Sidebar navigation section IDs
const sectionIds = [
  'courseRequirements', 'textbookAnalysis', 'learningObjectives',
  'studentAnalysis', 'preClassPreparation', 'learningProcess',
  'homeworkAssessment', 'courseware', 'resources'
]

// Toggle overflow menu
const toggleOverflowMenu = () => {
  showOverflowMenu.value = !showOverflowMenu.value
}

// Close overflow menu when clicking outside
const closeOverflowMenu = () => {
  showOverflowMenu.value = false
}

const handleDelete = async () => {
  confirmAction.value = { type: 'delete' }
}

const handleBack = () => router.push('/lesson-plan')

// Handler for inline field updates
const handleFieldUpdate = async (field: string, value: string | number | null) => {
  try {
    await store.updateField(field, value)
  } catch (err) {
    throw err // Re-throw to let inline edit component handle the error
  }
}

// Global save all changes
const handleSaveAll = async () => {
  try {
    await store.saveAllSections()
    toast.success('保存成功')
  } catch (err) {
    toast.error('保存失败：' + ((err as Error).message || '未知错误'))
  }
}

// Global cancel all changes
const handleCancelAll = () => {
  confirmAction.value = { type: 'cancel_edits' }
}

const executeConfirmAction = async () => {
  if (!confirmAction.value) return
  const actionType = confirmAction.value.type
  confirmAction.value = null
  if (actionType === 'delete') {
    try {
      await store.deleteLessonPlan(lessonPlanId.value)
      toast.success('删除成功')
      router.push('/lesson-plan')
    } catch (err) {
      toast.error('删除失败：' + ((err as Error).message || '未知错误'))
    }
  } else if (actionType === 'cancel_edits') {
    store.cancelAllEdits()
    toast.info('已取消更改')
  }
}

// Textbook chapter functions
const handleChaptersConfirm = async (data: { chapterId: number | null; subject: string; grade: number }) => {
  try {
    // Update association table via API
    const chapterIds = data.chapterId !== null ? [data.chapterId] : []
    await lessonPlanApi.setTextbookChapters(lessonPlanId.value, chapterIds)

    // Refresh lesson plan from store (API now returns textbookChapters by default)
    await store.fetchLessonPlan(lessonPlanId.value)
    showChapterSelector.value = false
    toast.success('教材章节已更新')
  } catch (err) {
    toast.error('更新教材章节失败')
    console.error('Failed to update textbook chapters:', err)
  }
}

// Get the first chapter ID for single-select mode (or null if none)
const firstChapterId = computed(() => textbookChapters.value.length > 0 ? textbookChapters.value[0].id : null)

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    const elementPosition = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: elementPosition - HEADER_OFFSET,
      behavior: 'instant'
    })
  }
}

// Debug: Inject mock textbookAnalysis content
const handleDebugInjectContent = async () => {
  const mockTextbookAnalysis = {
    coursePosition: {
      title: "教学内容的地位和作用",
      content: "两位数的加减法是小学数学数与代数领域的核心内容，在整个数学课程体系中占据重要地位。本节课承接二年级20以内数的加减法，是学生从简单数学运算向复杂计算过渡的关键环节。"
    },
    keyPointsAnalysis: {
      title: "教学重点和难点分析",
      content: "**教学重点：**\n1. 掌握两位数加减法的计算方法和算理\n2. 理解进位加法和退位减法的算法原理\n\n**教学难点：**\n1. **进位加法的理解**：特别是个位相加满十进一的概念和操作"
    },
    logicalStructure: {
      title: "教材内容的逻辑结构和知识关联",
      content: "**知识结构层次：**\n- 第一层次：基础概念巩固\n- 第二层次：算法学习\n- 第三层次：应用拓展"
    },
    teachingStrategies: {
      title: "教学策略建议",
      content: "1. 直观操作策略\n2. 算法多样化策略\n3. 循序渐进策略"
    }
  }

  console.log('[Debug] Injecting mock textbookAnalysis content')
  store.updateFromAI('textbookAnalysis', mockTextbookAnalysis)
  store.completeAISection('textbookAnalysis')
  toast.success('[Debug] 已注入教材分析内容')
}

// Debug: Fetch real output from backend and inject
const handleDebugFetchAndInject = async () => {
  try {
    // Fetch the latest session output
    const response = await fetch('http://localhost:3001/agent/output/latest')
    const result = await response.json()

    if (result.success && result.data) {
      console.log('[Debug] Fetched output data:', result.data)

      // Inject each section found
      for (const [sectionId, content] of Object.entries(result.data)) {
        store.updateFromAI(sectionId, content)
        store.completeAISection(sectionId)
      }
      toast.success(`[Debug] 已注入 ${Object.keys(result.data).length} 个模块`)
    } else {
      toast.error('[Debug] 无数据: ' + (result.error || 'empty'))
    }
  } catch (err) {
    console.error('[Debug] Fetch failed:', err)
    toast.error('[Debug] 获取失败')
  }
}

// Manual sync handler (fallback when Socket.io fails)
const handleManualSync = async () => {
  if (isSyncingManually.value) return
  isSyncingManually.value = true

  try {
    const sessionId = agentSessionId.value || 'default'
    const response = await fetch(`http://localhost:3001/agent/output/data?sessionId=${sessionId}`)
    const result = await response.json()

    if (result.success && result.data) {
      // Apply data using same field mapping as AgentListener's handleOutputUpdate
      const fieldMappings: Record<string, string> = {
        courseRequirements: 'courseRequirements',
        textbookAnalysis: 'textbookAnalysis',
        studentAnalysis: 'studentAnalysis',
        learningObjectives: 'learningObjectives',
        preClassPreparation: 'preClassPreparation',
        learningProcess: 'learningProcess',
        homeworkAssessment: 'homeworkAssessment',
      }

      const formData: Record<string, unknown> = {}
      for (const [outputField, formField] of Object.entries(fieldMappings)) {
        if (result.data[outputField] !== undefined) {
          formData[formField] = result.data[outputField]
        }
      }

      if (Object.keys(formData).length > 0) {
        formStateSynchronizer.updateFields('lessonPlanContent', formData, 'manual')
        toast.success('同步成功')
      } else {
        toast.info('暂无新内容')
      }
    } else {
      toast.error(result.error || '同步失败')
    }
  } catch (err) {
    console.error('[LessonPlanDetailView] Manual sync failed:', err)
    toast.error('同步失败，请检查网络连接')
  } finally {
    isSyncingManually.value = false
  }
}

onMounted(async () => {
  // API now returns textbookChapters and curriculumStandards by default
  await store.fetchLessonPlan(lessonPlanId.value)
  store.fetchStandards()

  // Note: Real-time AI content updates are handled by AgentListener via Socket.io
  // The output_update event triggers formStateSynchronizer.updateFields()

  // Check for nav query param (AI-driven navigation)
  const navTarget = route.query.nav as string | undefined
  if (navTarget) {
    await nextTick()
    // Wait for components to register their targets
    setTimeout(() => {
      navigationStore.navigate(navTarget, {
        highlight: true,
        autoEdit: route.query.edit === 'true'
      })
      // Clear the nav query param after triggering
      router.replace({ query: { ...route.query, nav: undefined, edit: undefined } })
    }, 200)
  }
  // Check if we should scroll to a specific section (from edit view)
  else {
    const targetSection = route.query.section as string | undefined
    if (targetSection && sectionIds.includes(targetSection)) {
      await nextTick()
      setTimeout(() => scrollToSection(targetSection), 100)
    } else {
      window.scrollTo(0, 0)
    }
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  store.reset()
})
</script>

<template>
  <div class="lesson-plan-page">
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <router-link to="/home">首页</router-link>
      <span class="separator">&gt;</span>
      <router-link to="/lesson-plan">教案</router-link>
      <span class="separator">&gt;</span>
      <span class="current">详情</span>
    </div>

    <!-- AI Generation Progress Banner -->
    <div v-if="aiOutputGenerating.value" class="ai-progress-banner">
      <div class="ai-progress-content">
        <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10" />
        </svg>
        <span class="ai-progress-text">
          AI 正在生成内容...
          <template v-if="aiOutputProgress.value.currentStep">
            {{ aiOutputProgress.value.currentStep }}
          </template>
        </span>
        <button
          class="sync-button"
          @click="handleManualSync"
          :disabled="isSyncingManually"
          title="手动同步内容"
        >
          <svg v-if="!isSyncingManually" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <svg v-else class="sync-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10" />
          </svg>
        </button>
        <span class="ai-progress-percent">
          {{ aiOutputProgress.value.percentage }}%
        </span>
      </div>
      <div class="ai-progress-bar">
        <div class="ai-progress-fill" :style="{ width: aiOutputProgress.value.percentage + '%' }"></div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{{ error }}</p>
      <button class="btn-primary" @click="handleBack">返回列表</button>
    </div>

    <!-- Content -->
    <template v-else-if="lessonPlan">
      <!-- Header: Back arrow + Title + Status + Edit state + Overflow menu -->
      <div :class="['lesson-header', { editing: isDirty }]">
        <div class="header-left">
          <button class="back-button" @click="handleBack" title="返回列表" aria-label="返回列表">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="header-title-area">
            <div class="title-row">
              <InlineEditText
                :model-value="lessonPlan.title || ''"
                variant="title"
                placeholder="输入教案名称"
                @save="(value) => handleFieldUpdate('title', value)"
              />
              <span v-if="isDirty" class="editing-badge">编辑中</span>
            </div>
            <div class="lesson-meta">
              <InlineEditSelect
                :model-value="lessonPlan.gradeLevel"
                :options="gradeLevelOptions"
                placeholder="选择年级"
                @save="(value) => handleFieldUpdate('gradeLevel', Number(value))"
              />
              <span class="meta-separator">·</span>
              <InlineEditSelect
                :model-value="lessonPlan.subject"
                :options="subjectOptions"
                placeholder="选择学科"
                @save="(value) => handleFieldUpdate('subject', value)"
              />
              <span class="meta-separator">·</span>
              <InlineEditNumber
                :model-value="lessonPlan.durationMinutes || 45"
                :min="1"
                :max="600"
                suffix="分钟"
                placeholder="时长"
                @save="(value) => handleFieldUpdate('durationMinutes', value)"
              />
              <span class="meta-separator">·</span>
              <span :class="['status-tag', lessonPlan.status === 'PUBLISHED' ? 'published' : 'draft']">
                {{ lessonPlan.status === 'PUBLISHED' ? '已发布' : '草稿' }}
              </span>
            </div>
            <!-- Textbook Chapter Row (single selection) -->
            <div class="textbook-chapters-row">
              <span class="chapters-label">教材章节：</span>
              <template v-if="textbookChapters.length > 0">
                <span class="chapter-title">{{ textbookChapters[0].title }}</span>
                <button class="chapters-edit-btn" @click="showChapterSelector = true">修改</button>
              </template>
              <template v-else>
                <button class="chapters-add-btn" @click="showChapterSelector = true">+ 关联教材章节</button>
              </template>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <!-- Save status indicator -->
          <span v-if="saving" class="save-status saving">
            <svg class="save-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10" />
            </svg>
            保存中...
          </span>
          <span v-else-if="isDirty" class="save-status unsaved">有未保存修改</span>
          <span v-else class="save-status saved">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            已保存
          </span>
          <!-- Global Save/Cancel when editing -->
          <template v-if="isDirty">
            <button class="btn-secondary" @click="handleCancelAll">取消</button>
            <button class="btn-primary" @click="handleSaveAll" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </template>
          <!-- Overflow Menu -->
          <div class="overflow-menu-container" @click.stop>
            <button class="overflow-button" @click="toggleOverflowMenu" title="更多操作" aria-label="更多操作">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            <div v-if="showOverflowMenu" class="overflow-dropdown" @click="closeOverflowMenu">
              <button class="dropdown-item danger" @click="handleDelete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Click outside to close overflow menu -->
      <div v-if="showOverflowMenu" class="overflow-backdrop" @click="closeOverflowMenu"></div>

      <!-- Editor Component -->
      <LessonPlanEditor :hide-per-section-actions="true" />

      <!-- Textbook Chapter Selector Modal -->
      <TextbookChapterSelector
        v-model:visible="showChapterSelector"
        :initial-chapter-id="firstChapterId"
        :initial-subject="lessonPlan.subject"
        :initial-grade="lessonPlan.gradeLevel"
        @confirm="handleChaptersConfirm"
      />
    </template>

    <!-- Confirm Modal -->
    <BaseModal
      :visible="!!confirmAction"
      :title="confirmAction?.type === 'delete' ? '确认删除' : '确认取消'"
      size="sm"
      @close="confirmAction = null"
    >
      <p v-if="confirmAction?.type === 'delete'">确定要删除这个教案吗？此操作不可撤销。</p>
      <p v-else-if="confirmAction?.type === 'cancel_edits'">确定要取消所有未保存的更改吗？</p>
      <template #footer>
        <button class="btn-secondary" @click="confirmAction = null">取消</button>
        <button
          :class="confirmAction?.type === 'delete' ? 'btn-primary' : 'btn-primary'"
          :style="confirmAction?.type === 'delete' ? 'background: #ef4444; border-color: #ef4444;' : ''"
          @click="executeConfirmAction"
        >
          {{ confirmAction?.type === 'delete' ? '确认删除' : '确认取消' }}
        </button>
      </template>
    </BaseModal>

    <!-- AI Editing Mode Overlay (shows when AI is generating content) -->
    <AIEditingOverlay />

    <!-- Debug Panel (toggle with keyboard shortcut or button) -->
    <div class="debug-toggle" @click="showDebugPanel = !showDebugPanel">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </div>

    <div v-if="showDebugPanel" class="debug-panel">
      <div class="debug-header">
        <span>Debug Panel</span>
        <button @click="showDebugPanel = false">&times;</button>
      </div>
      <div class="debug-content">
        <button class="debug-btn" @click="handleDebugInjectContent">
          Inject Mock 教材分析
        </button>
        <button class="debug-btn" @click="handleDebugFetchAndInject">
          Fetch & Inject Latest Output
        </button>
        <div class="debug-info">
          <p>AI Editing Mode: {{ store.aiEditingMode ? 'ON' : 'OFF' }}</p>
          <p>Current Section: {{ store.aiCurrentSection || 'none' }}</p>
          <p>Pending Sections: {{ store.aiPendingSections?.size || 0 }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lesson-plan-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 24px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

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

/* AI Generation Progress Banner */
.ai-progress-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px -1px rgba(102, 126, 234, 0.25);
}

.ai-progress-content {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ai-progress-content .spinner {
  animation: spin 1s linear infinite;
  color: white;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ai-progress-text {
  color: white;
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

.ai-progress-percent {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
}

.sync-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.sync-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.sync-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.sync-button .sync-spinner {
  animation: spin 1s linear infinite;
}

.ai-progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.ai-progress-fill {
  height: 100%;
  background: white;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px;
  color: #6b7280;
  gap: 16px;
}

.error-state svg {
  color: #ef4444;
}

.error-state p {
  font-size: 16px;
  color: #374151;
}

.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: sticky;
  top: 0;
  z-index: 50;
  background: #f8fafc;
  margin: -24px -24px 24px -24px;
  padding: 24px 24px 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  transition: background-color 0.2s;
}

.lesson-header.editing {
  background: #eff6ff;
  border-bottom-color: #bfdbfe;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 1;
  margin-right: 24px;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: white;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.back-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.header-title-area {
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.lesson-title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.editing-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
}

.lesson-meta {
  display: flex;
  gap: 8px;
  font-size: 14px;
  color: #64748b;
  align-items: center;
  flex-wrap: wrap;
}

.meta-separator {
  color: #9ca3af;
}

.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.draft {
  background: #f3f4f6;
  color: #6b7280;
}

.status-tag.published {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.save-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  white-space: nowrap;
}

.save-status.saved {
  color: #16a34a;
  background: #f0fdf4;
}

.save-status.unsaved {
  color: #d97706;
  background: #fffbeb;
}

.save-status.saving {
  color: #2563eb;
  background: #eff6ff;
}

.save-spinner {
  animation: spin 1s linear infinite;
}

/* Overflow Menu Styles */
.overflow-menu-container {
  position: relative;
}

.overflow-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: white;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.overflow-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.overflow-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  min-width: 160px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
  padding: 8px;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: none;
  color: #334155;
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.15s;
  text-align: left;
}

.dropdown-item:hover {
  background: #f1f5f9;
}

.dropdown-item svg {
  color: #64748b;
  flex-shrink: 0;
}

.dropdown-item.danger {
  color: #dc2626;
}

.dropdown-item.danger:hover {
  background: #fef2f2;
}

.dropdown-item.danger svg {
  color: #dc2626;
}

.overflow-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.btn-primary {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 10px 24px;
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
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 10px 24px;
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

/* Textbook chapters row styles */
.textbook-chapters-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 14px;
  flex-wrap: wrap;
}

.chapters-label {
  color: #64748b;
}

.chapters-loading {
  color: #9ca3af;
}

.chapters-count {
  background: #dbeafe;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.chapter-title {
  color: #334155;
  font-weight: 500;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapters-edit-btn,
.chapters-add-btn {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.chapters-edit-btn:hover,
.chapters-add-btn:hover {
  text-decoration: underline;
  background: rgba(37, 99, 235, 0.05);
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

@media (max-width: 768px) {
  .lesson-header {
    flex-direction: column;
    gap: 16px;
  }

  .header-left {
    margin-right: 0;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

/* Debug Panel */
.debug-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: #1f2937;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.debug-toggle:hover {
  background: #374151;
}

.debug-panel {
  position: fixed;
  bottom: 70px;
  right: 20px;
  width: 300px;
  background: #1f2937;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  color: white;
  font-size: 14px;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #374151;
  font-weight: 600;
}

.debug-header button {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 20px;
  cursor: pointer;
}

.debug-header button:hover {
  color: white;
}

.debug-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.debug-btn {
  background: #3b82f6;
  border: none;
  color: white;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.debug-btn:hover {
  background: #2563eb;
}

.debug-info {
  background: #374151;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
}

.debug-info p {
  margin: 0 0 4px 0;
  color: #9ca3af;
}

.debug-info p:last-child {
  margin-bottom: 0;
}
</style>
