<script setup lang="ts">
/**
 * QuestionReviewModal - Modal for reviewing a submitted question
 *
 * Features:
 * - Full question display
 * - Linked curriculum standards display
 * - Metadata/characteristics display
 * - Approve/Reject action buttons
 */
import { computed } from 'vue'
import type { QuestionBankItem } from '@/types'

interface Props {
  visible: boolean
  question: QuestionBankItem
  loading?: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'approve', questionId: number): void
  (e: 'reject', questionId: number): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

// Computed
const parsedOptions = computed<string[]>(() => {
  if (!props.question.options) return []
  try {
    return JSON.parse(props.question.options)
  } catch {
    return []
  }
})

const isChoiceQuestion = computed(() =>
  ['single_choice', 'multiple_choice'].includes(props.question.questionType)
)

// Methods
const getQuestionTypeLabel = (type: QuestionBankItem['questionType']) => {
  const typeMap: Record<string, string> = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    true_false: '判断题',
    fill_blank: '填空题',
    essay: '问答题'
  }
  return typeMap[type] || type
}

const getDifficultyLabel = (difficulty?: number) => {
  const labels = ['', '很简单', '简单', '中等', '较难', '困难']
  return labels[difficulty || 3] || '中等'
}

const handleClose = () => {
  emit('close')
}

const handleApprove = () => {
  emit('approve', props.question.id)
}

const handleReject = () => {
  if (confirm('确定要退回这道题目吗？学生需要修改后重新提交。')) {
    emit('reject', props.question.id)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-content">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-left">
              <span class="question-type-badge">{{ getQuestionTypeLabel(question.questionType) }}</span>
              <h2 class="modal-title">{{ question.title }}</h2>
            </div>
            <button class="btn-close" @click="handleClose">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Question Meta -->
            <div class="meta-bar">
              <span v-if="question.subject" class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                {{ question.subject }}
              </span>
              <span v-if="question.gradeLevel" class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                </svg>
                {{ question.gradeLevel }}年级
              </span>
              <span v-if="question.difficulty" class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                {{ getDifficultyLabel(question.difficulty) }}
              </span>
              <span v-if="question.createBy" class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                {{ question.createBy }}
              </span>
            </div>

            <!-- Question Content -->
            <section class="content-section">
              <h3 class="section-title">题目内容</h3>
              <div class="question-text">{{ question.content }}</div>
            </section>

            <!-- Options -->
            <section v-if="isChoiceQuestion && parsedOptions.length > 0" class="content-section">
              <h3 class="section-title">选项</h3>
              <div class="options-list">
                <div
                  v-for="(option, index) in parsedOptions"
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

            <!-- Answer (for non-choice questions) -->
            <section v-if="!isChoiceQuestion && question.answer" class="content-section">
              <h3 class="section-title">答案</h3>
              <div class="answer-text">{{ question.answer }}</div>
            </section>

            <!-- Explanation -->
            <section v-if="question.explanation" class="content-section">
              <h3 class="section-title">解析</h3>
              <div class="explanation-text">{{ question.explanation }}</div>
            </section>

            <!-- Tags -->
            <section v-if="question.tags" class="content-section">
              <h3 class="section-title">标签</h3>
              <div class="tags-list">
                <span
                  v-for="tag in question.tags.split(',')"
                  :key="tag"
                  class="tag"
                >
                  {{ tag.trim() }}
                </span>
              </div>
            </section>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn btn-outline" @click="handleClose">
              取消
            </button>
            <button
              class="btn btn-danger"
              :disabled="loading"
              @click="handleReject"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              退回修改
            </button>
            <button
              class="btn btn-success"
              :disabled="loading"
              @click="handleApprove"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              通过审核
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
}

.modal-content {
  background: var(--white, #ffffff);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 700px;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid var(--gray-200, #e5e7eb);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-type-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary, #3b82f6);
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  align-self: flex-start;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0;
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--gray-400, #9ca3af);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-close:hover {
  color: var(--gray-600, #4b5563);
  background: var(--gray-100, #f3f4f6);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: var(--gray-50, #f9fafb);
  border-radius: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gray-600, #4b5563);
}

.meta-item svg {
  color: var(--gray-400, #9ca3af);
}

.content-section {
  margin-bottom: 24px;
}

.content-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-500, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
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

.answer-text,
.explanation-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--gray-700, #374151);
  white-space: pre-wrap;
  padding: 12px 16px;
  background: var(--gray-50, #f9fafb);
  border-radius: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-block;
  padding: 4px 10px;
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-600, #4b5563);
  font-size: 13px;
  border-radius: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--gray-200, #e5e7eb);
  background: var(--gray-50, #f9fafb);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  color: var(--gray-700, #374151);
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--gray-300, #d1d5db);
}

.btn-success {
  background: #22c55e;
  border: 1px solid #22c55e;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #16a34a;
  border-color: #16a34a;
}

.btn-danger {
  background: #ef4444;
  border: 1px solid #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}

/* Animation */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

@media (max-width: 640px) {
  .modal-content {
    max-width: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .modal-footer {
    flex-direction: column;
  }

  .modal-footer .btn {
    width: 100%;
  }
}
</style>
