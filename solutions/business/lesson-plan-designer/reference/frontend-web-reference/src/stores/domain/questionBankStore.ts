/**
 * Question Bank Store
 * Maps to QuestionBankItemController - manages question bank items
 *
 * Mutation Patterns:
 * - fetchList: pessimistic (wait for server)
 * - fetchById: pessimistic (wait for server)
 * - create: hybrid (pending state, then update)
 * - update: hybrid (pending state, then update)
 * - remove: pessimistic (wait for server confirmation)
 *
 * Workflow:
 * - Students: create → submit → (approved | needs_revision → submit)
 * - Advisors: review queue → approve | reject
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { questionBankApi } from '@/api'
import type { QuestionBankItem, PageQuery, ApprovalStatus, CurriculumStandard } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

interface QuestionBankCreateRequest {
  title: string
  content: string
  questionType: QuestionBankItem['questionType']
  subject?: string
  gradeLevel?: number
  difficulty?: number
  options?: string
  answer?: string
  explanation?: string
  tags?: string
  approvalStatus?: ApprovalStatus
}

interface QuestionBankUpdateRequest extends Partial<QuestionBankCreateRequest> {
  id: number
}

export const useQuestionBankStore = defineStore('questionBank', () => {
  // State
  const items = ref<QuestionBankItem[]>([])
  const myQuestions = ref<QuestionBankItem[]>([])
  const reviewQueue = ref<QuestionBankItem[]>([])
  const currentItem = ref<QuestionBankItem | null>(null)
  const currentItemStandards = ref<CurriculumStandard[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)
  const myQuestionsEmpty = computed(() => myQuestions.value.length === 0)
  const reviewQueueEmpty = computed(() => reviewQueue.value.length === 0)

  /**
   * Fetch question bank list
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: PageQuery = {}): Promise<QuestionBankItem[]> {
    loading.value = true
    error.value = null
    try {
      const response = await questionBankApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[questionBankStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load questions'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single question by ID
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchById(id: number): Promise<QuestionBankItem> {
    loading.value = true
    error.value = null
    try {
      const response = await questionBankApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[questionBankStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new question
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function create(data: QuestionBankCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await questionBankApi.create(data)
      await fetchList()
    } catch (err) {
      console.error('[questionBankStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing question
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function update(data: QuestionBankUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await questionBankApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as QuestionBankItem
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as QuestionBankItem
      }
    } catch (err) {
      console.error('[questionBankStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete question(s)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await questionBankApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id))
      if (currentItem.value && idsArray.includes(currentItem.value.id)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[questionBankStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete question'
      throw err
    } finally {
      loading.value = false
    }
  }

  // ========== Student Workflow Actions ==========

  /**
   * Fetch current user's questions
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchMyQuestions(params: { approvalStatus?: ApprovalStatus; pageNum?: number; pageSize?: number } = {}): Promise<QuestionBankItem[]> {
    loading.value = true
    error.value = null
    try {
      const response = await questionBankApi.getMyQuestions(params)
      myQuestions.value = response.rows || []
      return myQuestions.value
    } catch (err) {
      console.error('[questionBankStore] fetchMyQuestions failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load my questions'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Submit question for review
   * @pattern pessimistic - Waits for server confirmation before updating state
   */
  async function submitForReview(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await questionBankApi.submitForReview(id)
      // Update local state
      const updateStatus = (list: QuestionBankItem[]) => {
        const item = list.find(q => q.id === id)
        if (item) item.approvalStatus = 'submitted'
      }
      updateStatus(items.value)
      updateStatus(myQuestions.value)
      if (currentItem.value?.id === id) {
        currentItem.value.approvalStatus = 'submitted'
      }
    } catch (err) {
      console.error('[questionBankStore] submitForReview failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to submit question for review'
      throw err
    } finally {
      loading.value = false
    }
  }

  // ========== Advisor Workflow Actions ==========

  /**
   * Fetch review queue (submitted questions)
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchReviewQueue(params: PageQuery = {}): Promise<QuestionBankItem[]> {
    loading.value = true
    error.value = null
    try {
      const response = await questionBankApi.getReviewQueue(params)
      reviewQueue.value = response.rows || []
      return reviewQueue.value
    } catch (err) {
      console.error('[questionBankStore] fetchReviewQueue failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load review queue'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Approve a question
   * @pattern pessimistic - Waits for server confirmation before updating state
   */
  async function approveQuestion(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await questionBankApi.approve(id)
      // Remove from review queue
      reviewQueue.value = reviewQueue.value.filter(q => q.id !== id)
      // Update status if in other lists
      const updateStatus = (list: QuestionBankItem[]) => {
        const item = list.find(q => q.id === id)
        if (item) item.approvalStatus = 'approved'
      }
      updateStatus(items.value)
      updateStatus(myQuestions.value)
      if (currentItem.value?.id === id) {
        currentItem.value.approvalStatus = 'approved'
      }
    } catch (err) {
      console.error('[questionBankStore] approveQuestion failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to approve question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Reject a question / request revision
   * @pattern pessimistic - Waits for server confirmation before updating state
   */
  async function rejectQuestion(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await questionBankApi.reject(id)
      // Remove from review queue
      reviewQueue.value = reviewQueue.value.filter(q => q.id !== id)
      // Update status if in other lists
      const updateStatus = (list: QuestionBankItem[]) => {
        const item = list.find(q => q.id === id)
        if (item) item.approvalStatus = 'needs_revision'
      }
      updateStatus(items.value)
      updateStatus(myQuestions.value)
      if (currentItem.value?.id === id) {
        currentItem.value.approvalStatus = 'needs_revision'
      }
    } catch (err) {
      console.error('[questionBankStore] rejectQuestion failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to reject question'
      throw err
    } finally {
      loading.value = false
    }
  }

  // ========== Curriculum Standard Actions ==========

  /**
   * Fetch question with curriculum standards
   */
  async function fetchByIdWithStandards(id: number): Promise<{ question: QuestionBankItem; standards: CurriculumStandard[] }> {
    loading.value = true
    error.value = null
    try {
      const response = await questionBankApi.getByIdWithStandards(id)
      currentItem.value = response.data.question
      currentItemStandards.value = response.data.curriculumStandards
      return { question: currentItem.value, standards: currentItemStandards.value }
    } catch (err) {
      console.error('[questionBankStore] fetchByIdWithStandards failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    myQuestions.value = []
    reviewQueue.value = []
    currentItem.value = null
    currentItemStandards.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    items,
    myQuestions,
    reviewQueue,
    currentItem,
    currentItemStandards,
    loading,
    error,
    // Computed
    isEmpty,
    myQuestionsEmpty,
    reviewQueueEmpty,
    // Basic CRUD
    fetchList,
    fetchById,
    fetchByIdWithStandards,
    create,
    update,
    remove,
    // Student workflow
    fetchMyQuestions,
    submitForReview,
    // Advisor workflow
    fetchReviewQueue,
    approveQuestion,
    rejectQuestion,
    // Utility
    reset
  }
})
