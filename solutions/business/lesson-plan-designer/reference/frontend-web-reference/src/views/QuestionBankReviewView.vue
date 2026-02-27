<script setup lang="ts">
/**
 * QuestionBankReviewView - Advisor review queue (Review Queue tab)
 *
 * Features:
 * - Permission check for normal:questionbank:review
 * - Display submitted questions from all users
 * - Sorted by submission date (oldest first)
 * - Student name and submission date columns
 * - Approve/Reject actions with rejection reason modal
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestionBankStore } from '@/stores/domain/questionBankStore'
import { useQuestionBank } from '@/composables/useQuestionBank'
import type { QuestionBankItem } from '@/types'

const router = useRouter()
const store = useQuestionBankStore()
const {
  getQuestionTypeLabel,
  getDifficultyLabel,
  getAuthorName,
  formatDate
} = useQuestionBank()

// State
const selectedQuestion = ref<QuestionBankItem | null>(null)
const showReviewModal = ref(false)

// Rejection reason modal state
const showRejectModal = ref(false)
const rejectingQuestion = ref<QuestionBankItem | null>(null)
const rejectionReason = ref('')
const rejectionError = ref('')

// Methods
const loadReviewQueue = async () => {
  try {
    await store.fetchReviewQueue()
  } catch (err) {
    console.error('[QuestionBankReviewView] Failed to load review queue:', err)
  }
}

const handleView = (question: QuestionBankItem) => {
  router.push(`/question/${question.id}`)
}

const openReviewModal = (question: QuestionBankItem) => {
  selectedQuestion.value = question
  showReviewModal.value = true
}

const closeReviewModal = () => {
  selectedQuestion.value = null
  showReviewModal.value = false
}

const handleApprove = async (question: QuestionBankItem) => {
  if (!confirm('确定要通过这道题目吗？')) return
  try {
    await store.approveQuestion(question.id)
    closeReviewModal()
    await loadReviewQueue()
  } catch (err) {
    console.error('[QuestionBankReviewView] Failed to approve question:', err)
    alert('审批失败，请重试')
  }
}

// --- Rejection with reason ---

const openRejectModal = (question: QuestionBankItem) => {
  rejectingQuestion.value = question
  rejectionReason.value = ''
  rejectionError.value = ''
  showRejectModal.value = true
}

const closeRejectModal = () => {
  rejectingQuestion.value = null
  rejectionReason.value = ''
  rejectionError.value = ''
  showRejectModal.value = false
}

const confirmReject = async () => {
  if (!rejectingQuestion.value) return
  if (!rejectionReason.value.trim()) {
    rejectionError.value = '请填写退回原因'
    return
  }
  try {
    await store.rejectQuestion(rejectingQuestion.value.id)
    closeRejectModal()
    closeReviewModal()
    await loadReviewQueue()
  } catch (err) {
    console.error('[QuestionBankReviewView] Failed to reject question:', err)
    rejectionError.value = '操作失败，请重试'
  }
}

// Lifecycle
onMounted(() => {
  loadReviewQueue()
})
</script>

<template>
  <div class="review-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-info">
        <span class="queue-count">待审核 {{ store.reviewQueue.length }} 道题目</span>
        <span class="queue-hint">按提交时间排序，先提交的优先审核</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="store.loading" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="store.reviewQueue.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <p>暂无待审核题目</p>
      <p class="empty-hint">所有题目已审核完毕</p>
    </div>

    <!-- Review Queue List -->
    <div v-else class="review-list">
      <div
        v-for="question in store.reviewQueue"
        :key="question.id"
        class="review-card"
      >
        <div class="review-header">
          <div class="review-meta">
            <span class="question-type">{{ getQuestionTypeLabel(question.questionType) }}</span>
            <span v-if="question.subject" class="question-subject">{{ question.subject }}</span>
            <span v-if="question.gradeLevel" class="question-grade">{{ question.gradeLevel }}年级</span>
          </div>
          <div class="submission-info">
            <span class="author">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {{ getAuthorName(question) }}
            </span>
            <span class="submit-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {{ formatDate(question.updateTime || question.createTime) }}
            </span>
          </div>
        </div>

        <div class="review-body" @click="handleView(question)">
          <h3 class="question-title">{{ question.title || question.content }}</h3>
          <p v-if="question.title && question.content" class="question-content">
            {{ question.content }}
          </p>
        </div>

        <div class="review-footer">
          <div class="question-info">
            <span v-if="question.difficulty" class="info-item">
              难度: {{ getDifficultyLabel(question.difficulty) }}
            </span>
          </div>
          <div class="review-actions">
            <button class="btn btn-outline" @click="handleView(question)">
              查看详情
            </button>
            <button class="btn btn-success" @click="handleApprove(question)">
              通过
            </button>
            <button class="btn btn-warning" @click="openRejectModal(question)">
              需修改
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Review Modal (optional for detailed review) -->
    <div v-if="showReviewModal && selectedQuestion" class="modal-overlay" @click="closeReviewModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>审核题目</h3>
          <button class="modal-close" @click="closeReviewModal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="question-detail">
            <div class="detail-row">
              <span class="detail-label">类型:</span>
              <span>{{ getQuestionTypeLabel(selectedQuestion.questionType) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">科目:</span>
              <span>{{ selectedQuestion.subject || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">年级:</span>
              <span>{{ selectedQuestion.gradeLevel ? selectedQuestion.gradeLevel + '年级' : '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">难度:</span>
              <span>{{ getDifficultyLabel(selectedQuestion.difficulty) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">提交者:</span>
              <span>{{ getAuthorName(selectedQuestion) }}</span>
            </div>
          </div>
          <div class="question-preview">
            <h4>{{ selectedQuestion.title }}</h4>
            <p>{{ selectedQuestion.content }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeReviewModal">取消</button>
          <button class="btn btn-warning" @click="openRejectModal(selectedQuestion)">需修改</button>
          <button class="btn btn-success" @click="handleApprove(selectedQuestion)">通过</button>
        </div>
      </div>
    </div>

    <!-- Rejection Reason Modal -->
    <div v-if="showRejectModal && rejectingQuestion" class="modal-overlay" @click="closeRejectModal">
      <div class="modal-content reject-modal" @click.stop>
        <div class="modal-header">
          <h3>退回题目</h3>
          <button class="modal-close" @click="closeRejectModal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="reject-hint">请填写退回原因，学生将收到通知并根据您的意见进行修改。</p>
          <div class="reject-question-info">
            <span class="reject-question-label">题目：</span>
            <span>{{ rejectingQuestion.title || rejectingQuestion.content }}</span>
          </div>
          <div class="reject-form">
            <label class="reject-label" for="rejectionReason">退回原因 <span class="required">*</span></label>
            <textarea
              id="rejectionReason"
              v-model="rejectionReason"
              class="reject-textarea"
              :class="{ 'has-error': rejectionError }"
              placeholder="请描述需要修改的内容，例如：题目描述不够清晰、选项设置有误、答案解析需要补充等..."
              rows="4"
            />
            <p v-if="rejectionError" class="reject-error">{{ rejectionError }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeRejectModal">取消</button>
          <button class="btn btn-warning" @click="confirmReject">确认退回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-view {
  /* No additional padding - parent layout handles it */
}

.view-header {
  margin-bottom: 20px;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.queue-count {
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-900, #111827);
}

.queue-hint {
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-card {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.review-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--gray-50, #f9fafb);
  border-bottom: 1px solid var(--gray-100, #f3f4f6);
}

.review-meta {
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

.submission-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.author,
.submit-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--gray-500, #6b7280);
}

.review-body {
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

.review-footer {
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

.review-actions {
  display: flex;
  gap: 8px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
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
  border-color: var(--gray-300, #d1d5db);
  background: var(--gray-50, #f9fafb);
}

.btn-success {
  background: #22c55e;
  border: 1px solid #22c55e;
  color: white;
}

.btn-success:hover {
  background: #16a34a;
  border-color: #16a34a;
}

.btn-warning {
  background: #f59e0b;
  border: 1px solid #f59e0b;
  color: white;
}

.btn-warning:hover {
  background: #d97706;
  border-color: #d97706;
}

/* Modal */
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
  background: var(--white, #ffffff);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--gray-200, #e5e7eb);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900, #111827);
}

.modal-close {
  padding: 4px;
  background: none;
  border: none;
  color: var(--gray-400, #9ca3af);
  cursor: pointer;
}

.modal-close:hover {
  color: var(--gray-600, #4b5563);
}

.modal-body {
  padding: 20px;
}

.question-detail {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.detail-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.detail-label {
  color: var(--gray-500, #6b7280);
}

.question-preview {
  padding: 16px;
  background: var(--gray-50, #f9fafb);
  border-radius: 8px;
}

.question-preview h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.question-preview p {
  margin: 0;
  font-size: 14px;
  color: var(--gray-600, #4b5563);
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--gray-200, #e5e7eb);
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
  color: #22c55e;
}

.empty-state p {
  font-size: 16px;
  margin: 0;
}

.empty-hint {
  font-size: 14px !important;
  color: var(--gray-400, #9ca3af) !important;
}

/* Rejection Reason Modal */
.reject-modal {
  max-width: 500px;
}

.reject-hint {
  font-size: 14px;
  color: var(--gray-600, #4b5563);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.reject-question-info {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  background: var(--gray-50, #f9fafb);
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--gray-700, #374151);
  line-height: 1.4;
}

.reject-question-label {
  color: var(--gray-500, #6b7280);
  flex-shrink: 0;
}

.reject-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reject-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700, #374151);
}

.reject-label .required {
  color: #ef4444;
}

.reject-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 8px;
  font-size: 14px;
  color: var(--gray-900, #111827);
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color 0.15s;
}

.reject-textarea:focus {
  outline: none;
  border-color: var(--primary, #3b82f6);
}

.reject-textarea.has-error {
  border-color: #ef4444;
}

.reject-error {
  font-size: 13px;
  color: #ef4444;
  margin: 0;
}

@media (max-width: 640px) {
  .review-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .submission-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .review-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .review-actions {
    flex-direction: column;
  }

  .review-actions .btn {
    width: 100%;
  }

  .question-detail {
    grid-template-columns: 1fr;
  }
}
</style>
