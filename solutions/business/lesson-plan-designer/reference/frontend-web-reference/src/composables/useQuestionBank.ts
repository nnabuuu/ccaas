/**
 * useQuestionBank - Shared composable for question bank views
 *
 * Centralizes duplicated logic across QuestionBank views:
 * - Question type label mapping
 * - Difficulty label/stars mapping
 * - Approval status info mapping
 * - Permission checks (canEdit, canSubmit, canDelete)
 * - Author name resolution
 * - Date formatting
 * - Option parsing
 * - Filter option constants
 * - Shared interfaces (CurriculumFilter, QuestionFormData)
 */
import type { QuestionBankItem, ApprovalStatus } from '@/types'

// ---------------------------------------------------------------------------
// Shared Interfaces
// ---------------------------------------------------------------------------

export interface CurriculumFilter {
  selectedCurriculumId: { value: number | null }
  clearFilter: () => void
}

export interface QuestionFormData {
  id?: number
  title: string
  content: string
  questionType: 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'
  subject: string
  gradeLevel: number
  difficulty: number
  options: string[]
  answer: string
  explanation: string
  tags: string
  approvalStatus?: ApprovalStatus
}

export interface StatusTab {
  value: ApprovalStatus | 'all'
  label: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUESTION_TYPE_MAP: Record<string, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  true_false: '判断题',
  fill_blank: '填空题',
  essay: '问答题'
}

const DIFFICULTY_LABELS = ['', '很简单', '简单', '中等', '较难', '困难']

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  draft: { label: '草稿', class: 'draft' },
  submitted: { label: '待审核', class: 'pending' },
  approved: { label: '已通过', class: 'approved' },
  needs_revision: { label: '需修改', class: 'revision' }
}

export const SUBJECT_OPTIONS = [
  { value: '', label: '全部科目' },
  { value: '语文', label: '语文' },
  { value: '数学', label: '数学' },
  { value: '英语', label: '英语' },
  { value: '物理', label: '物理' },
  { value: '化学', label: '化学' }
]

export const DIFFICULTY_OPTIONS = [
  { value: '', label: '全部难度' },
  { value: '1', label: '很简单' },
  { value: '2', label: '简单' },
  { value: '3', label: '中等' },
  { value: '4', label: '较难' },
  { value: '5', label: '困难' }
]

export const STATUS_TABS: StatusTab[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'needs_revision', label: '需修改' }
]

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useQuestionBank() {
  // --- Label / Display helpers ---

  /** Map question type key to Chinese label */
  const getQuestionTypeLabel = (type?: string): string => {
    return QUESTION_TYPE_MAP[type || ''] || type || ''
  }

  /** Map difficulty number (1-5) to Chinese label */
  const getDifficultyLabel = (difficulty?: number): string => {
    return DIFFICULTY_LABELS[difficulty || 3] || '中等'
  }

  /** Get the number of stars to display for a difficulty value */
  const getDifficultyStars = (difficulty?: number): number => {
    return difficulty || 3
  }

  /** Get status badge label and CSS class */
  const getStatusInfo = (status?: ApprovalStatus): { label: string; class: string } => {
    return STATUS_MAP[status || 'draft'] || STATUS_MAP.draft
  }

  /** Resolve the display name of a question's author */
  const getAuthorName = (question: QuestionBankItem): string => {
    return question.createByName || '未知作者'
  }

  // --- Date formatting ---

  /** Format an ISO date string to a localized Chinese date-time string */
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /** Format an ISO date string to a short localized Chinese date */
  const formatDateShort = (dateStr?: string): string => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }

  // --- Permission checks ---

  /** Whether the question can be edited (draft or needs_revision) */
  const canEdit = (question: QuestionBankItem): boolean => {
    return question.approvalStatus === 'draft' || question.approvalStatus === 'needs_revision'
  }

  /** Whether the question can be submitted for review (draft or needs_revision) */
  const canSubmit = (question: QuestionBankItem): boolean => {
    return question.approvalStatus === 'draft' || question.approvalStatus === 'needs_revision'
  }

  /** Whether the question can be deleted (draft only) */
  const canDelete = (question: QuestionBankItem): boolean => {
    return question.approvalStatus === 'draft'
  }

  // --- Data helpers ---

  /** Parse a JSON options string into a string array */
  const parseOptions = (options?: string): string[] => {
    if (!options) return []
    try {
      return JSON.parse(options)
    } catch {
      return []
    }
  }

  return {
    // Label / display helpers
    getQuestionTypeLabel,
    getDifficultyLabel,
    getDifficultyStars,
    getStatusInfo,
    getAuthorName,

    // Date formatting
    formatDate,
    formatDateShort,

    // Permission checks
    canEdit,
    canSubmit,
    canDelete,

    // Data helpers
    parseOptions
  }
}
