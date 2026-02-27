<script setup lang="ts">
/**
 * QuestionEditView - Edit existing question bank item
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuestionBankStore } from '@/stores/domain/questionBankStore'
import QuestionEditor from '@/components/question-bank/QuestionEditor.vue'
import { useQuestionBank } from '@/composables/useQuestionBank'
import type { QuestionFormData } from '@/composables/useQuestionBank'

const router = useRouter()
const route = useRoute()
const store = useQuestionBankStore()
const { canEdit: canEditQuestion } = useQuestionBank()

const selectedStandards = ref<number[]>([])
const notFound = ref(false)

const questionId = computed(() => Number(route.params.id))

const questionData = computed<Partial<QuestionFormData>>(() => {
  if (!store.currentItem) return {}
  const item = store.currentItem
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    questionType: item.questionType,
    subject: item.subject || '',
    gradeLevel: item.gradeLevel || 1,
    difficulty: item.difficulty || 3,
    options: item.options ? JSON.parse(item.options) : ['', '', '', ''],
    answer: item.answer || '',
    explanation: item.explanation || '',
    tags: item.tags || '',
    approvalStatus: item.approvalStatus
  }
})

const canEdit = computed(() => {
  if (!store.currentItem) return false
  return canEditQuestion(store.currentItem)
})

const loadQuestion = async () => {
  try {
    await store.fetchByIdWithStandards(questionId.value)
    selectedStandards.value = store.currentItemStandards.map(s => s.id)
    if (!canEdit.value) {
      // Redirect to view mode if not editable
      router.replace(`/question/${questionId.value}`)
    }
  } catch (err) {
    console.error('[QuestionEditView] Failed to load question:', err)
    notFound.value = true
  }
}

const handleSave = async (data: QuestionFormData, standardIds: number[]) => {
  try {
    const updateData = {
      id: questionId.value,
      ...data,
      options: data.options ? JSON.stringify(data.options.filter(o => o.trim())) : undefined,
      curriculumStandardIds: standardIds
    }
    await store.update(updateData)
    router.push('/question-bank/my')
  } catch (err) {
    console.error('[QuestionEditView] Failed to update question:', err)
  }
}

const handleCancel = () => {
  router.back()
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
    <div v-else-if="store.loading && !store.currentItem" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- Edit Form -->
    <template v-else>
      <div class="page-header">
        <button class="btn-back" @click="handleCancel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <path d="m12 19-7-7 7-7"/>
          </svg>
        </button>
        <div class="header-text">
          <h1 class="page-title">编辑题目</h1>
          <p class="page-subtitle">修改题目内容</p>
        </div>
      </div>

      <div class="page-content">
        <QuestionEditor
          :model-value="questionData"
          v-model:selected-standards="selectedStandards"
          :loading="store.loading"
          mode="edit"
          @save="handleSave"
          @cancel="handleCancel"
        />
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

.btn-primary {
  background: var(--primary, #3b82f6);
  border: 1px solid var(--primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}
</style>
