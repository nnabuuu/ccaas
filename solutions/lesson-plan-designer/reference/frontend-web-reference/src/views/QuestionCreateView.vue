<script setup lang="ts">
/**
 * QuestionCreateView - Create new question bank item
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestionBankStore } from '@/stores/domain/questionBankStore'
import QuestionEditor from '@/components/question-bank/QuestionEditor.vue'

interface QuestionFormData {
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
}

const router = useRouter()
const store = useQuestionBankStore()

const selectedStandards = ref<number[]>([])

const handleSave = async (data: QuestionFormData, standardIds: number[]) => {
  try {
    // Convert options array to JSON string for API
    const createData = {
      ...data,
      options: data.options ? JSON.stringify(data.options.filter(o => o.trim())) : undefined,
      approvalStatus: 'draft' as const,
      curriculumStandardIds: standardIds
    }
    await store.create(createData)
    router.push('/question-bank/my')
  } catch (err) {
    console.error('[QuestionCreateView] Failed to create question:', err)
  }
}

const handleCancel = () => {
  router.back()
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <button class="btn-back" @click="handleCancel">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5"/>
          <path d="m12 19-7-7 7-7"/>
        </svg>
      </button>
      <div class="header-text">
        <h1 class="page-title">创建题目</h1>
        <p class="page-subtitle">添加新题目到您的题库</p>
      </div>
    </div>

    <div class="page-content">
      <QuestionEditor
        v-model:selected-standards="selectedStandards"
        :loading="store.loading"
        mode="create"
        @save="handleSave"
        @cancel="handleCancel"
      />
    </div>
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
  margin-bottom: 32px;
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
}

.btn-back:hover {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--gray-500, #6b7280);
  margin: 0;
}

.page-content {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 12px;
  padding: 24px;
  width: 100%;
}
</style>
