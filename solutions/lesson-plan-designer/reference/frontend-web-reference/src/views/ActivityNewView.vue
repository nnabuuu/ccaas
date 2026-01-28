<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { activityApi } from '../api/index'
import { useAuthStore } from '../stores/core/authStore'
import PageContainer from '../components/layout/PageContainer.vue'
import type { AxiosErrorShape } from '@/types'

interface FormErrors {
  title?: string
  endDate?: string
  submit?: string
}

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)

const form = ref({
  title: '',
  description: '',
  status: 'draft' as const,
  startDate: '',
  endDate: ''
})

const errors = ref<FormErrors>({})

const statusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '进行中' }
]

const validate = () => {
  errors.value = {}
  if (!form.value.title?.trim()) {
    errors.value.title = '请输入活动名称'
  }
  if (form.value.startDate && form.value.endDate) {
    if (new Date(form.value.startDate) > new Date(form.value.endDate)) {
      errors.value.endDate = '结束日期不能早于开始日期'
    }
  }
  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validate()) return

  loading.value = true
  try {
    await activityApi.create({
      title: form.value.title.trim(),
      description: form.value.description?.trim() || undefined,
      status: form.value.status,
      startDate: form.value.startDate || undefined,
      endDate: form.value.endDate || undefined
    })

    // Navigate back to projects page
    router.push('/projects')
  } catch (error: unknown) {
    console.error('Failed to create activity:', error)
    const axiosError = error as AxiosErrorShape
    errors.value.submit = axiosError.response?.data?.msg || '创建活动失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/projects')
}
</script>

<template>
  <PageContainer variant="fluid">
    <div class="page-header">
      <h1 class="page-title">创建新活动</h1>
      <p class="page-subtitle">活动是项目的容器，可以将相关项目组织在一起</p>
    </div>

    <div class="form-container">
      <form @submit.prevent="handleSubmit" class="activity-form">
        <div class="form-group">
          <label class="form-label required">活动名称</label>
          <input
            v-model="form.title"
            type="text"
            class="form-input"
            :class="{ error: errors.title }"
            placeholder="例如：2024科创课题研究"
          >
          <span v-if="errors.title" class="error-message">{{ errors.title }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">活动描述</label>
          <textarea
            v-model="form.description"
            class="form-textarea"
            placeholder="描述活动的目标、内容和要求"
            rows="4"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">活动状态</label>
          <select v-model="form.status" class="form-select">
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <span class="form-hint">草稿状态的活动仅创建者可见，发布后其他用户才能看到</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">开始日期</label>
            <input
              v-model="form.startDate"
              type="date"
              class="form-input"
            >
          </div>
          <div class="form-group">
            <label class="form-label">结束日期</label>
            <input
              v-model="form.endDate"
              type="date"
              class="form-input"
              :class="{ error: errors.endDate }"
            >
            <span v-if="errors.endDate" class="error-message">{{ errors.endDate }}</span>
          </div>
        </div>

        <div v-if="errors.submit" class="error-alert">
          {{ errors.submit }}
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="handleCancel">
            取消
          </button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">创建中...</span>
            <span v-else>创建活动</span>
          </button>
        </div>
      </form>
    </div>
  </PageContainer>
</template>

<style scoped>

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px 0;
}

.page-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.form-container {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 32px;
}

.activity-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-input.error {
  border-color: #ef4444;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-select {
  background: #fff;
}

.form-hint {
  font-size: 12px;
  color: #9ca3af;
}

.error-message {
  font-size: 12px;
  color: #ef4444;
}

.error-alert {
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

.btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
