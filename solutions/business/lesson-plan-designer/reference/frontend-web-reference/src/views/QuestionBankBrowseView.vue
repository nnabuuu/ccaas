<script setup lang="ts">
/**
 * QuestionBankBrowseView - Browse all approved questions
 *
 * Features:
 * - Display only approved questions (approvalStatus = 'approved')
 * - Integrate with curriculum tree filter from parent layout
 * - Question cards with content preview, subject, grade, difficulty, author
 * - View detail action
 */
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRouter } from 'vue-router'
import { questionBankApi } from '../api/index'
import type { QuestionBankItem } from '@/types'
import { useQuestionBank, SUBJECT_OPTIONS, DIFFICULTY_OPTIONS } from '@/composables/useQuestionBank'
import type { CurriculumFilter } from '@/composables/useQuestionBank'

const router = useRouter()
const { getQuestionTypeLabel, getDifficultyStars, getAuthorName } = useQuestionBank()

// Inject curriculum filter from parent layout
const curriculumFilter = inject<CurriculumFilter>('curriculumFilter')

// Props from parent (passed via router-view)
const props = defineProps<{
  curriculumId?: number | null
}>()

// State
const questions = ref<QuestionBankItem[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)

// Filters
const selectedSubject = ref('')
const selectedDifficulty = ref('')
const sortBy = ref('latest')

const subjectOptions = SUBJECT_OPTIONS
const difficultyOptions = DIFFICULTY_OPTIONS

// Computed
const activeCurriculumId = computed(() => {
  return props.curriculumId ?? curriculumFilter?.selectedCurriculumId?.value ?? null
})

// Methods
const fetchQuestions = async () => {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      approvalStatus: 'approved'
    }
    if (selectedSubject.value) params.subject = selectedSubject.value
    if (selectedDifficulty.value) params.difficulty = parseInt(selectedDifficulty.value)
    if (activeCurriculumId.value) params.curriculumId = activeCurriculumId.value

    // Sorting
    if (sortBy.value === 'latest') {
      params.orderBy = 'createTime'
      params.orderDirection = 'desc'
    } else if (sortBy.value === 'difficulty') {
      params.orderBy = 'difficulty'
      params.orderDirection = 'asc'
    }

    const response = await questionBankApi.getList(params)
    totalCount.value = response.total || 0
    questions.value = response.rows || []
  } catch (error) {
    console.error('[QuestionBankBrowseView] Failed to fetch questions:', error)
    questions.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

const handleView = (question: QuestionBankItem) => {
  router.push(`/question/${question.id}`)
}

// Watchers
watch([selectedSubject, selectedDifficulty, sortBy], () => {
  pageNum.value = 1
  fetchQuestions()
})

watch(activeCurriculumId, () => {
  pageNum.value = 1
  fetchQuestions()
})

// Lifecycle
onMounted(() => {
  fetchQuestions()
})
</script>

<template>
  <div class="browse-view">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <select v-model="selectedSubject" class="filter-select">
          <option v-for="opt in subjectOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="selectedDifficulty" class="filter-select">
          <option v-for="opt in difficultyOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="sort-group">
        <span class="sort-label">排序:</span>
        <button
          :class="['sort-btn', { active: sortBy === 'latest' }]"
          @click="sortBy = 'latest'"
        >
          最新
        </button>
        <button
          :class="['sort-btn', { active: sortBy === 'difficulty' }]"
          @click="sortBy = 'difficulty'"
        >
          难度
        </button>
      </div>
    </div>

    <!-- Result Count -->
    <div class="result-info">
      <span class="result-count">共 {{ totalCount }} 道题目</span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="questions.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <p>暂无题目</p>
      <p class="empty-hint">调整筛选条件试试</p>
    </div>

    <!-- Questions List -->
    <div v-else class="questions-list">
      <div
        v-for="question in questions"
        :key="question.id"
        class="question-card"
        @click="handleView(question)"
      >
        <div class="question-header">
          <div class="question-meta">
            <span class="question-type">{{ getQuestionTypeLabel(question.questionType) }}</span>
            <span v-if="question.subject" class="question-subject">{{ question.subject }}</span>
            <span v-if="question.gradeLevel" class="question-grade">{{ question.gradeLevel }}年级</span>
          </div>
          <div class="question-author">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>{{ getAuthorName(question) }}</span>
          </div>
        </div>

        <div class="question-body">
          <h3 class="question-title">{{ question.title || question.content }}</h3>
          <p v-if="question.title && question.content" class="question-content">
            {{ question.content }}
          </p>
        </div>

        <div class="question-footer">
          <div class="difficulty-display">
            <span class="difficulty-label">难度</span>
            <div class="difficulty-stars">
              <span
                v-for="i in 5"
                :key="i"
                :class="['star', { filled: i <= getDifficultyStars(question.difficulty) }]"
              >
                ★
              </span>
            </div>
          </div>
          <button class="view-btn" @click.stop="handleView(question)">
            查看详情
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browse-view {
  /* No additional padding - parent layout handles it */
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 6px;
  font-size: 14px;
  color: var(--gray-700, #374151);
  background: var(--white, #ffffff);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary, #3b82f6);
}

.sort-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-label {
  font-size: 14px;
  color: var(--gray-500, #6b7280);
}

.sort-btn {
  padding: 6px 12px;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--gray-500, #6b7280);
  cursor: pointer;
  transition: color 0.15s;
}

.sort-btn:hover {
  color: var(--gray-700, #374151);
}

.sort-btn.active {
  color: var(--primary, #3b82f6);
  font-weight: 500;
}

.result-info {
  margin-bottom: 16px;
}

.result-count {
  font-size: 14px;
  color: var(--gray-500, #6b7280);
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.question-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: var(--gray-300, #d1d5db);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.question-type {
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary, #3b82f6);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.question-subject,
.question-grade {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.question-author {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.question-body {
  margin-bottom: 16px;
}

.question-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0 0 8px 0;
  line-height: 1.4;
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
}

.difficulty-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.difficulty-label {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.difficulty-stars {
  display: flex;
}

.star {
  color: var(--gray-300, #d1d5db);
  font-size: 14px;
}

.star.filled {
  color: #f59e0b;
}

.view-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  color: var(--gray-600, #4b5563);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.view-btn:hover {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
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
  gap: 12px;
}

.empty-state svg {
  color: var(--gray-300, #d1d5db);
}

.empty-state p {
  font-size: 16px;
  margin: 0;
}

.empty-hint {
  font-size: 14px !important;
  color: var(--gray-400, #9ca3af) !important;
}

@media (max-width: 640px) {
  .filter-bar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .filter-group {
    flex-wrap: wrap;
  }

  .question-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .question-footer {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .view-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
