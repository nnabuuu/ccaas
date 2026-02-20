<script setup lang="ts">
/**
 * QuestionEditor - Form component for creating/editing question bank items
 *
 * Features:
 * - Question content editor (textarea/markdown)
 * - Question type selector
 * - Options builder for choice questions
 * - Answer and explanation fields
 * - Difficulty slider (1-5)
 * - Curriculum standard multi-select
 * - Subject and grade level selectors
 *
 * @example
 * <QuestionEditor
 *   v-model="questionData"
 *   :selected-standards="selectedStandardIds"
 *   @update:selected-standards="handleStandardsChange"
 *   @save="handleSave"
 *   @cancel="handleCancel"
 * />
 */
import { ref, computed, watch, onMounted } from 'vue'
import { curriculumStandardApi } from '@/api'
import type { QuestionBankItem, CurriculumStandard, ApprovalStatus } from '@/types'

type QuestionType = QuestionBankItem['questionType']

interface QuestionFormData {
  id?: number
  title: string
  content: string
  questionType: QuestionType
  subject: string
  gradeLevel: number
  difficulty: number
  options: string[]
  answer: string
  explanation: string
  tags: string
  approvalStatus?: ApprovalStatus
  metadata?: Record<string, unknown>
}

interface Props {
  modelValue?: Partial<QuestionFormData>
  selectedStandards?: number[]
  loading?: boolean
  mode?: 'create' | 'edit'
}

interface Emits {
  (e: 'update:modelValue', value: QuestionFormData): void
  (e: 'update:selectedStandards', value: number[]): void
  (e: 'save', data: QuestionFormData, standardIds: number[]): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  selectedStandards: () => [],
  loading: false,
  mode: 'create'
})

const emit = defineEmits<Emits>()

// Form state
const form = ref<QuestionFormData>({
  title: '',
  content: '',
  questionType: 'single_choice',
  subject: '',
  gradeLevel: 1,
  difficulty: 3,
  options: ['', '', '', ''],
  answer: '',
  explanation: '',
  tags: '',
  metadata: {}
})

const localSelectedStandards = ref<number[]>([])

// Curriculum standards data
const allStandards = ref<CurriculumStandard[]>([])
const standardsLoading = ref(false)
const showStandardsModal = ref(false)

// Question type options
const questionTypeOptions: { value: QuestionType; label: string }[] = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'true_false', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'essay', label: '问答题' }
]

// Subject options
const subjectOptions = [
  '语文', '数学', '英语', '物理', '化学', '生物',
  '历史', '地理', '政治', '体育', '音乐', '美术',
  '信息技术', '综合实践'
]

// Grade level options (1-12)
const gradeLevelOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}年级`
}))

// Difficulty labels
const difficultyLabels = ['很简单', '简单', '中等', '较难', '困难']

// Computed
const isChoiceQuestion = computed(() =>
  ['single_choice', 'multiple_choice'].includes(form.value.questionType)
)

const isTrueFalse = computed(() => form.value.questionType === 'true_false')

const canSave = computed(() =>
  form.value.title.trim() &&
  form.value.content.trim() &&
  form.value.subject &&
  (
    !isChoiceQuestion.value ||
    form.value.options.filter(o => o.trim()).length >= 2
  )
)

// Group standards by category
const groupedStandards = computed(() => {
  const groups: Record<string, CurriculumStandard[]> = {}
  for (const std of allStandards.value) {
    const category = std.category || '其他'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(std)
  }
  return groups
})

// Selected standards display
const selectedStandardsDisplay = computed(() => {
  return allStandards.value.filter(s => localSelectedStandards.value.includes(s.id))
})

// Watch props changes
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    form.value = {
      ...form.value,
      ...newVal,
      options: newVal.options
        ? (typeof newVal.options === 'string' ? JSON.parse(newVal.options) : newVal.options)
        : ['', '', '', '']
    }
  }
}, { immediate: true, deep: true })

watch(() => props.selectedStandards, (newVal) => {
  localSelectedStandards.value = [...(newVal || [])]
}, { immediate: true })

// Methods
const loadCurriculumStandards = async () => {
  standardsLoading.value = true
  try {
    const params: { subject?: string } = {}
    if (form.value.subject) {
      params.subject = form.value.subject
    }
    const response = await curriculumStandardApi.getList({ ...params, pageSize: 1000 })
    allStandards.value = response.rows || []
  } catch (err) {
    console.error('[QuestionEditor] Failed to load curriculum standards:', err)
  } finally {
    standardsLoading.value = false
  }
}

const addOption = () => {
  if (form.value.options.length < 10) {
    form.value.options.push('')
  }
}

const removeOption = (index: number) => {
  if (form.value.options.length > 2) {
    form.value.options.splice(index, 1)
    // Update answer if it references a removed option
    if (form.value.answer === String.fromCharCode(65 + index)) {
      form.value.answer = ''
    }
  }
}

const toggleStandard = (id: number) => {
  const index = localSelectedStandards.value.indexOf(id)
  if (index === -1) {
    localSelectedStandards.value.push(id)
  } else {
    localSelectedStandards.value.splice(index, 1)
  }
  emit('update:selectedStandards', localSelectedStandards.value)
}

const removeStandard = (id: number) => {
  const index = localSelectedStandards.value.indexOf(id)
  if (index !== -1) {
    localSelectedStandards.value.splice(index, 1)
    emit('update:selectedStandards', localSelectedStandards.value)
  }
}

const handleSave = () => {
  if (!canSave.value) return
  emit('save', { ...form.value }, [...localSelectedStandards.value])
}

const handleCancel = () => {
  emit('cancel')
}

// Lifecycle
onMounted(() => {
  loadCurriculumStandards()
})

// Reload standards when subject changes
watch(() => form.value.subject, () => {
  loadCurriculumStandards()
})
</script>

<template>
  <div class="question-editor">
    <form @submit.prevent="handleSave">
      <!-- Title -->
      <div class="form-group">
        <label class="form-label required">题目标题</label>
        <input
          v-model="form.title"
          type="text"
          class="form-input"
          placeholder="输入题目标题"
          required
        />
      </div>

      <!-- Question Type & Subject Row -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">题目类型</label>
          <select v-model="form.questionType" class="form-select">
            <option v-for="opt in questionTypeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label required">学科</label>
          <select v-model="form.subject" class="form-select" required>
            <option value="">请选择学科</option>
            <option v-for="subj in subjectOptions" :key="subj" :value="subj">
              {{ subj }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">年级</label>
          <select v-model="form.gradeLevel" class="form-select">
            <option v-for="grade in gradeLevelOptions" :key="grade.value" :value="grade.value">
              {{ grade.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Content -->
      <div class="form-group">
        <label class="form-label required">题目内容</label>
        <textarea
          v-model="form.content"
          class="form-textarea"
          rows="4"
          placeholder="输入题目内容"
          required
        />
      </div>

      <!-- Options (for choice questions) -->
      <div v-if="isChoiceQuestion" class="form-group">
        <label class="form-label required">选项</label>
        <div class="options-list">
          <div v-for="(_, index) in form.options" :key="index" class="option-item">
            <span class="option-label">{{ String.fromCharCode(65 + index) }}.</span>
            <input
              v-model="form.options[index]"
              type="text"
              class="form-input"
              :placeholder="`选项 ${String.fromCharCode(65 + index)}`"
            />
            <button
              v-if="form.options.length > 2"
              type="button"
              class="btn-icon btn-remove"
              @click="removeOption(index)"
              title="删除选项"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <button
            v-if="form.options.length < 10"
            type="button"
            class="btn btn-outline btn-sm"
            @click="addOption"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加选项
          </button>
        </div>
      </div>

      <!-- Answer -->
      <div class="form-group">
        <label class="form-label">答案</label>
        <template v-if="isChoiceQuestion">
          <div class="answer-choices">
            <label
              v-for="(_, index) in form.options"
              :key="index"
              class="answer-choice"
              :class="{ selected: form.answer.includes(String.fromCharCode(65 + index)) }"
            >
              <input
                v-if="form.questionType === 'single_choice'"
                type="radio"
                :value="String.fromCharCode(65 + index)"
                v-model="form.answer"
                class="sr-only"
              />
              <input
                v-else
                type="checkbox"
                :value="String.fromCharCode(65 + index)"
                v-model="form.answer"
                class="sr-only"
              />
              {{ String.fromCharCode(65 + index) }}
            </label>
          </div>
        </template>
        <template v-else-if="isTrueFalse">
          <div class="answer-choices">
            <label class="answer-choice" :class="{ selected: form.answer === 'true' }">
              <input type="radio" value="true" v-model="form.answer" class="sr-only" />
              正确
            </label>
            <label class="answer-choice" :class="{ selected: form.answer === 'false' }">
              <input type="radio" value="false" v-model="form.answer" class="sr-only" />
              错误
            </label>
          </div>
        </template>
        <template v-else>
          <textarea
            v-model="form.answer"
            class="form-textarea"
            rows="3"
            placeholder="输入参考答案"
          />
        </template>
      </div>

      <!-- Explanation -->
      <div class="form-group">
        <label class="form-label">解析</label>
        <textarea
          v-model="form.explanation"
          class="form-textarea"
          rows="3"
          placeholder="输入题目解析（可选）"
        />
      </div>

      <!-- Difficulty -->
      <div class="form-group">
        <label class="form-label">难度</label>
        <div class="difficulty-slider">
          <input
            type="range"
            v-model.number="form.difficulty"
            min="1"
            max="5"
            step="1"
            class="slider"
          />
          <span class="difficulty-label">{{ difficultyLabels[form.difficulty - 1] }}</span>
        </div>
      </div>

      <!-- Tags -->
      <div class="form-group">
        <label class="form-label">标签</label>
        <input
          v-model="form.tags"
          type="text"
          class="form-input"
          placeholder="输入标签，用逗号分隔"
        />
      </div>

      <!-- Curriculum Standards -->
      <div class="form-group">
        <label class="form-label">关联课标</label>
        <div class="standards-section">
          <div v-if="selectedStandardsDisplay.length > 0" class="selected-standards">
            <span
              v-for="std in selectedStandardsDisplay"
              :key="std.id"
              class="standard-tag"
            >
              {{ std.standardCode }}: {{ std.title || std.description }}
              <button type="button" class="tag-remove" @click="removeStandard(std.id)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </span>
          </div>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            @click="showStandardsModal = true"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            选择课标
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button type="button" class="btn btn-outline" @click="handleCancel">
          取消
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!canSave || loading"
        >
          <span v-if="loading">保存中...</span>
          <span v-else>{{ mode === 'create' ? '创建题目' : '保存修改' }}</span>
        </button>
      </div>
    </form>

    <!-- Standards Selection Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showStandardsModal" class="modal-overlay" @click.self="showStandardsModal = false">
          <div class="modal-content standards-modal">
            <div class="modal-header">
              <h3>选择课程标准</h3>
              <button class="btn-icon" @click="showStandardsModal = false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div v-if="standardsLoading" class="loading-state">
                加载中...
              </div>
              <div v-else-if="allStandards.length === 0" class="empty-state">
                暂无课程标准数据
              </div>
              <div v-else class="standards-list">
                <div v-for="(standards, category) in groupedStandards" :key="category" class="standards-group">
                  <h4 class="group-title">{{ category }}</h4>
                  <div class="group-items">
                    <label
                      v-for="std in standards"
                      :key="std.id"
                      class="standard-item"
                      :class="{ selected: localSelectedStandards.includes(std.id) }"
                    >
                      <input
                        type="checkbox"
                        :checked="localSelectedStandards.includes(std.id)"
                        @change="toggleStandard(std.id)"
                        class="sr-only"
                      />
                      <span class="standard-code">{{ std.standardCode }}</span>
                      <span class="standard-desc">{{ std.title || std.description }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showStandardsModal = false">
                取消
              </button>
              <button class="btn btn-primary" @click="showStandardsModal = false">
                确定 ({{ localSelectedStandards.length }} 项)
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.question-editor {
  width: 100%;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700, #374151);
  margin-bottom: 6px;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--gray-300, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  color: var(--gray-900, #111827);
  background: var(--white, #ffffff);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

/* Options List */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.option-label {
  font-weight: 500;
  color: var(--gray-600, #4b5563);
  min-width: 24px;
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

.btn-remove:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* Answer Choices */
.answer-choices {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.answer-choice {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  padding: 0 16px;
  border: 2px solid var(--gray-300, #d1d5db);
  border-radius: 8px;
  font-weight: 500;
  color: var(--gray-600, #4b5563);
  cursor: pointer;
  transition: all 0.15s;
}

.answer-choice:hover {
  border-color: var(--primary, #3b82f6);
}

.answer-choice.selected {
  background: var(--primary, #3b82f6);
  border-color: var(--primary, #3b82f6);
  color: white;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* Difficulty Slider */
.difficulty-slider {
  display: flex;
  align-items: center;
  gap: 16px;
}

.slider {
  flex: 1;
  max-width: 200px;
  height: 6px;
  appearance: none;
  background: var(--gray-200, #e5e7eb);
  border-radius: 3px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--primary, #3b82f6);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.difficulty-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-600, #4b5563);
  min-width: 60px;
}

/* Standards Section */
.standards-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selected-standards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.standard-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary, #3b82f6);
  border-radius: 4px;
  font-size: 13px;
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
}

.tag-remove:hover {
  opacity: 1;
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

.btn-outline {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-300, #d1d5db);
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

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--gray-200, #e5e7eb);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.modal-content {
  background: var(--white, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--gray-200, #e5e7eb);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--gray-200, #e5e7eb);
}

/* Standards Modal */
.standards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.standards-group {
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-600, #4b5563);
  padding: 10px 14px;
  background: var(--gray-50, #f9fafb);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-items {
  padding: 8px;
}

.standard-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.standard-item:hover {
  background: var(--gray-50, #f9fafb);
}

.standard-item.selected {
  background: rgba(59, 130, 246, 0.1);
}

.standard-code {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary, #3b82f6);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.standard-desc {
  font-size: 13px;
  color: var(--gray-700, #374151);
  line-height: 1.4;
}

.loading-state,
.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--gray-500, #6b7280);
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
  transform: scale(0.95);
  opacity: 0;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
