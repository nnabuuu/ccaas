<script setup lang="ts">
/**
 * QuestionBankMyView - Student's question management (My Questions tab)
 *
 * Features:
 * - Status sub-tabs (all, draft, submitted, approved, needs_revision)
 * - Integrate with curriculum tree filter from parent layout
 * - Create/Edit/Submit actions
 * - Preserved from MyQuestionsView
 */
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestionBankStore } from '@/stores/domain/questionBankStore'
import type { QuestionBankItem, ApprovalStatus } from '@/types'
import { useQuestionBank, STATUS_TABS } from '@/composables/useQuestionBank'
import type { CurriculumFilter } from '@/composables/useQuestionBank'
import { BaseModal } from '@/components/layout'

const router = useRouter()
const store = useQuestionBankStore()
const {
  getStatusInfo,
  getQuestionTypeLabel,
  getDifficultyLabel,
  canEdit,
  canSubmit,
  canDelete
} = useQuestionBank()

// Inject curriculum filter from parent layout
const curriculumFilter = inject<CurriculumFilter>('curriculumFilter')

// Props from parent (passed via router-view)
const props = defineProps<{
  curriculumId?: number | null
}>()

// State
const activeTab = ref<ApprovalStatus | 'all'>('all')
const searchKeyword = ref('')

// Confirm modal state
const confirmAction = ref<{ type: 'delete'; question: QuestionBankItem } | null>(null)

// Status tabs
const statusTabs = STATUS_TABS

// Computed
const activeCurriculumId = computed(() => {
  return props.curriculumId ?? curriculumFilter?.selectedCurriculumId?.value ?? null
})

const filteredQuestions = computed(() => {
  let questions = store.myQuestions

  // Filter by status tab
  if (activeTab.value !== 'all') {
    questions = questions.filter(q => q.approvalStatus === activeTab.value)
  }

  // Filter by curriculum (if selected)
  // Note: This requires the question to have curriculumStandardIds or similar field
  // For now, we'll skip this as the backend handles filtering

  // Filter by search keyword
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase()
    questions = questions.filter(q =>
      (q.title?.toLowerCase().includes(keyword)) ||
      (q.content?.toLowerCase().includes(keyword))
    )
  }

  return questions
})

const tabCounts = computed(() => {
  const counts: Record<string, number> = { all: store.myQuestions.length }
  for (const q of store.myQuestions) {
    const status = q.approvalStatus || 'draft'
    counts[status] = (counts[status] || 0) + 1
  }
  return counts
})

// Methods
const loadQuestions = async () => {
  try {
    await store.fetchMyQuestions()
  } catch (err) {
    console.error('[QuestionBankMyView] Failed to load questions:', err)
  }
}

const handleCreate = () => {
  router.push('/question/create')
}

const handleEdit = (question: QuestionBankItem) => {
  router.push(`/question/edit/${question.id}`)
}

const handleView = (question: QuestionBankItem) => {
  router.push(`/question/${question.id}`)
}

const handleSubmit = async (question: QuestionBankItem) => {
  try {
    await store.submitForReview(question.id)
  } catch (err) {
    console.error('[QuestionBankMyView] Failed to submit question:', err)
  }
}

const handleDelete = (question: QuestionBankItem) => {
  confirmAction.value = { type: 'delete', question }
}

const executeConfirmAction = async () => {
  if (!confirmAction.value) return
  const { question } = confirmAction.value
  confirmAction.value = null
  try {
    await store.remove(question.id)
    await loadQuestions()
  } catch (err) {
    console.error('[QuestionBankMyView] Failed to delete question:', err)
  }
}

// Lifecycle
onMounted(() => {
  loadQuestions()
})

// Reload when curriculum filter changes
watch(activeCurriculumId, () => {
  // If backend supports curriculum filtering, we can pass it here
  loadQuestions()
})
</script>

<template>
  <div class="my-view">
    <!-- Header with Create Button -->
    <div class="view-header">
      <div class="header-info">
        <span class="question-count">共 {{ store.myQuestions.length }} 道题目</span>
      </div>
      <button class="btn btn-primary" @click="handleCreate">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        创建题目
      </button>
    </div>

    <!-- Status Sub-Tabs -->
    <div class="status-tabs">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        class="status-tab"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
        <span v-if="tabCounts[tab.value]" class="tab-count">{{ tabCounts[tab.value] }}</span>
      </button>
    </div>

    <!-- Search Bar -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          v-model="searchKeyword"
          type="text"
          class="search-input"
          placeholder="搜索题目..."
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="store.loading" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredQuestions.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="2"/>
        <path d="m9 14 2 2 4-4"/>
      </svg>
      <p v-if="store.myQuestions.length === 0">您还没有创建任何题目</p>
      <p v-else>没有找到匹配的题目</p>
      <button v-if="store.myQuestions.length === 0" class="btn btn-primary" @click="handleCreate">
        创建第一道题目
      </button>
    </div>

    <!-- Questions List -->
    <div v-else class="questions-list">
      <div
        v-for="question in filteredQuestions"
        :key="question.id"
        class="question-card"
      >
        <div class="question-header">
          <div class="question-meta">
            <span :class="['status-badge', getStatusInfo(question.approvalStatus).class]">
              {{ getStatusInfo(question.approvalStatus).label }}
            </span>
            <span class="question-type">{{ getQuestionTypeLabel(question.questionType) }}</span>
            <span v-if="question.subject" class="question-subject">{{ question.subject }}</span>
          </div>
          <div class="question-actions">
            <button
              v-if="canEdit(question)"
              class="btn-icon"
              title="编辑"
              aria-label="编辑"
              @click="handleEdit(question)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              class="btn-icon"
              title="查看"
              aria-label="查看"
              @click="handleView(question)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button
              v-if="canDelete(question)"
              class="btn-icon btn-danger"
              title="删除"
              aria-label="删除"
              @click="handleDelete(question)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="question-body" @click="handleView(question)">
          <h3 class="question-title">{{ question.title || question.content }}</h3>
          <p v-if="question.title && question.content" class="question-content">
            {{ question.content }}
          </p>
        </div>

        <div class="question-footer">
          <div class="question-info">
            <span v-if="question.gradeLevel" class="info-item">
              {{ question.gradeLevel }}年级
            </span>
            <span v-if="question.difficulty" class="info-item">
              难度: {{ getDifficultyLabel(question.difficulty) }}
            </span>
            <span v-if="question.createTime" class="info-item">
              创建于 {{ new Date(question.createTime).toLocaleDateString('zh-CN') }}
            </span>
          </div>
          <div class="question-footer-actions">
            <button
              v-if="canSubmit(question)"
              class="btn btn-primary btn-sm"
              @click.stop="handleSubmit(question)"
            >
              提交审核
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <BaseModal
      :visible="!!confirmAction"
      title="确认删除"
      size="sm"
      @close="confirmAction = null"
    >
      <p>确定要删除这道题目吗？此操作不可撤销。</p>
      <template #footer>
        <button class="btn btn-primary" style="background: #f3f4f6; border-color: #d1d5db; color: #374151;" @click="confirmAction = null">取消</button>
        <button class="btn btn-primary" style="background: #ef4444; border-color: #ef4444;" @click="executeConfirmAction">确认删除</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.my-view {
  /* No additional padding - parent layout handles it */
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.question-count {
  font-size: 14px;
  color: var(--gray-500, #6b7280);
}

/* Status Sub-Tabs */
.status-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.status-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-600, #4b5563);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.status-tab:hover {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.status-tab.active {
  background: var(--primary, #3b82f6);
  border-color: var(--primary, #3b82f6);
  color: white;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 12px;
}

.status-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.2);
}

/* Search Bar */
.search-bar {
  margin-bottom: 20px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--gray-400, #9ca3af);
}

.search-input {
  width: 100%;
  max-width: 400px;
  padding: 10px 12px 10px 40px;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 8px;
  font-size: 14px;
  color: var(--gray-900, #111827);
  transition: border-color 0.15s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary, #3b82f6);
}

/* Questions List */
.questions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.question-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--gray-50, #f9fafb);
  border-bottom: 1px solid var(--gray-100, #f3f4f6);
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.draft {
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-600, #4b5563);
}

.status-badge.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-badge.approved {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-badge.revision {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.question-type,
.question-subject {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.question-actions {
  display: flex;
  gap: 4px;
}

.question-body {
  padding: 16px;
  cursor: pointer;
}

.question-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0 0 8px 0;
}

.question-content {
  font-size: 14px;
  color: var(--gray-600, #4b5563);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.question-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--gray-100, #f3f4f6);
}

.question-info {
  display: flex;
  gap: 16px;
}

.info-item {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.question-footer-actions {
  display: flex;
  gap: 8px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: var(--primary, #3b82f6);
  border: 1px solid var(--primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--gray-400, #9ca3af);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.btn-icon:hover {
  color: var(--gray-600, #4b5563);
  background: var(--gray-100, #f3f4f6);
}

.btn-icon.btn-danger:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--gray-500, #6b7280);
  gap: 16px;
}

.empty-state svg {
  color: var(--gray-300, #d1d5db);
}

.empty-state p {
  font-size: 16px;
  margin: 0;
}

@media (max-width: 640px) {
  .view-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .view-header .btn {
    width: 100%;
  }

  .question-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .question-footer {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .question-footer-actions {
    width: 100%;
  }

  .question-footer-actions .btn {
    flex: 1;
  }
}
</style>
