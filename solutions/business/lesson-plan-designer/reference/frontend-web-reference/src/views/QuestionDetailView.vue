<script setup lang="ts">
/**
 * QuestionDetailView - View question details (read-only)
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuestionBankStore } from '@/stores/domain/questionBankStore'
import { useQuestionBank } from '@/composables/useQuestionBank'

const router = useRouter()
const route = useRoute()
const store = useQuestionBankStore()
const {
  getStatusInfo,
  getQuestionTypeLabel,
  getDifficultyLabel,
  parseOptions,
  canEdit: canEditQuestion,
  canSubmit: canSubmitQuestion
} = useQuestionBank()

const notFound = ref(false)

const questionId = computed(() => Number(route.params.id))
const question = computed(() => store.currentItem)
const standards = computed(() => store.currentItemStandards)

const canEdit = computed(() => {
  if (!question.value) return false
  return canEditQuestion(question.value)
})

const canSubmit = computed(() => {
  if (!question.value) return false
  return canSubmitQuestion(question.value)
})

const loadQuestion = async () => {
  try {
    await store.fetchByIdWithStandards(questionId.value)
  } catch (err) {
    console.error('[QuestionDetailView] Failed to load question:', err)
    notFound.value = true
  }
}

const handleBack = () => {
  router.back()
}

const handleEdit = () => {
  router.push(`/question/edit/${questionId.value}`)
}

const handleSubmit = async () => {
  try {
    await store.submitForReview(questionId.value)
    await loadQuestion()
  } catch (err) {
    console.error('[QuestionDetailView] Failed to submit:', err)
  }
}

onMounted(() => {
  loadQuestion()
})
</script>

<template>
  <div class="page-container">
    <!-- Not Found State -->
    <div v-if="notFound" class="not-found">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4"/>
        <path d="M12 16h.01"/>
      </svg>
      <p>题目不存在或已被删除</p>
      <button class="btn btn-primary" @click="router.push('/question-bank/my')">
        返回我的题目
      </button>
    </div>

    <!-- Loading State -->
    <div v-else-if="store.loading && !question" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- Question Detail -->
    <template v-else-if="question">
      <div class="page-header">
        <button class="btn-back" @click="handleBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <path d="m12 19-7-7 7-7"/>
          </svg>
        </button>
        <div class="header-content">
          <div class="header-meta">
            <span :class="['status-badge', getStatusInfo(question.approvalStatus).class]">
              {{ getStatusInfo(question.approvalStatus).label }}
            </span>
            <span class="meta-item">{{ getQuestionTypeLabel(question.questionType) }}</span>
            <span v-if="question.subject" class="meta-item">{{ question.subject }}</span>
            <span v-if="question.gradeLevel" class="meta-item">{{ question.gradeLevel }}年级</span>
          </div>
          <h1 class="page-title">{{ question.title }}</h1>
        </div>
        <div class="header-actions">
          <button v-if="canEdit" class="btn btn-outline" @click="handleEdit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            编辑
          </button>
          <button v-if="canSubmit" class="btn btn-primary" @click="handleSubmit">
            提交审核
          </button>
        </div>
      </div>

      <div class="question-content-card">
        <!-- Question Content -->
        <section class="content-section">
          <h2 class="section-title">题目内容</h2>
          <div class="question-text">{{ question.content }}</div>
        </section>

        <!-- Options (if choice question) -->
        <section v-if="parseOptions(question.options).length > 0" class="content-section">
          <h2 class="section-title">选项</h2>
          <div class="options-list">
            <div
              v-for="(option, index) in parseOptions(question.options)"
              :key="index"
              class="option-item"
              :class="{ correct: question.answer?.includes(String.fromCharCode(65 + index)) }"
            >
              <span class="option-label">{{ String.fromCharCode(65 + index) }}.</span>
              <span class="option-text">{{ option }}</span>
              <svg v-if="question.answer?.includes(String.fromCharCode(65 + index))" class="correct-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
        </section>

        <!-- Answer -->
        <section v-if="question.answer" class="content-section">
          <h2 class="section-title">答案</h2>
          <div class="answer-text">{{ question.answer }}</div>
        </section>

        <!-- Explanation -->
        <section v-if="question.explanation" class="content-section">
          <h2 class="section-title">解析</h2>
          <div class="explanation-text">{{ question.explanation }}</div>
        </section>

        <!-- Metadata -->
        <section class="content-section metadata-section">
          <h2 class="section-title">题目信息</h2>
          <div class="metadata-grid">
            <div class="metadata-item">
              <span class="metadata-label">难度</span>
              <span class="metadata-value">{{ getDifficultyLabel(question.difficulty) }}</span>
            </div>
            <div v-if="question.tags" class="metadata-item">
              <span class="metadata-label">标签</span>
              <span class="metadata-value">{{ question.tags }}</span>
            </div>
            <div v-if="question.createTime" class="metadata-item">
              <span class="metadata-label">创建时间</span>
              <span class="metadata-value">{{ new Date(question.createTime).toLocaleString('zh-CN') }}</span>
            </div>
          </div>
        </section>

        <!-- Curriculum Standards -->
        <section v-if="standards.length > 0" class="content-section">
          <h2 class="section-title">关联课标</h2>
          <div class="standards-list">
            <div v-for="std in standards" :key="std.id" class="standard-item">
              <span class="standard-code">{{ std.standardCode }}</span>
              <span class="standard-desc">{{ std.title || std.description }}</span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px 40px;
  width: 100%;
  max-width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 8px;
  color: var(--gray-600, #4b5563);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn-back:hover {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.header-content {
  flex: 1;
  min-width: 0;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
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

.meta-item {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* Question Content Card */
.question-content-card {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
}

.content-section {
  padding: 20px 24px;
  border-bottom: 1px solid var(--gray-100, #f3f4f6);
}

.content-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-600, #4b5563);
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.question-text {
  font-size: 16px;
  line-height: 1.6;
  color: var(--gray-800, #1f2937);
  white-space: pre-wrap;
}

/* Options */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: var(--gray-50, #f9fafb);
  border-radius: 8px;
  border: 1px solid transparent;
}

.option-item.correct {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

.option-label {
  font-weight: 600;
  color: var(--gray-600, #4b5563);
  min-width: 24px;
}

.option-text {
  flex: 1;
  color: var(--gray-800, #1f2937);
}

.correct-icon {
  color: #22c55e;
  flex-shrink: 0;
}

/* Answer & Explanation */
.answer-text,
.explanation-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--gray-700, #374151);
  white-space: pre-wrap;
}

/* Metadata */
.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metadata-label {
  font-size: 12px;
  color: var(--gray-500, #6b7280);
}

.metadata-value {
  font-size: 14px;
  color: var(--gray-800, #1f2937);
}

/* Standards */
.standards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.standard-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: var(--gray-50, #f9fafb);
  border-radius: 8px;
}

.standard-code {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary, #3b82f6);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.standard-desc {
  font-size: 14px;
  color: var(--gray-700, #374151);
  line-height: 1.4;
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

.btn-outline {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  color: var(--gray-700, #374151);
}

.btn-outline:hover {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
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

/* States */
.loading-state,
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--gray-500, #6b7280);
  gap: 16px;
}

.not-found svg {
  color: var(--gray-300, #d1d5db);
}

.not-found p {
  font-size: 16px;
  margin: 0;
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    flex: 1;
  }

  .metadata-grid {
    grid-template-columns: 1fr;
  }
}
</style>
