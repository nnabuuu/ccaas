<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { projectApi, activityApi } from '../api/index'
import { useAuthStore } from '../stores/core/authStore'
import PageContainer from '../components/layout/PageContainer.vue'
import type { Activity, Project, AxiosErrorShape } from '@/types'

interface FormErrors {
  title?: string
  endDate?: string
  submit?: string
}

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const loading = ref(false)
const loadingActivities = ref(false)
const activities = ref<Activity[]>([])

// Get activityId from query params if present
const activityIdFromRoute = computed(() => route.query.activityId ? Number(route.query.activityId) : null)

const form = ref({
  code: '',
  title: '',
  description: '',
  type: 'research' as Project['type'],
  startDate: '',
  endDate: '',
  activityId: null as number | null
})

// Generate project code based on type and timestamp
const generateCode = () => {
  const prefix = form.value.type === 'research' ? 'RES' :
                 form.value.type === 'teaching' ? 'TCH' :
                 form.value.type === 'practice' ? 'PRC' : 'OTH'
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6)
  return `${prefix}-${timestamp}`
}

const errors = ref<FormErrors>({})

const typeOptions = [
  { value: 'research', label: '研究型项目' },
  { value: 'teaching', label: '教学型项目' },
  { value: 'practice', label: '实践型项目' },
  { value: 'other', label: '其他' }
]

const validate = () => {
  errors.value = {}
  if (!form.value.title?.trim()) {
    errors.value.title = '请输入项目名称'
  }
  if (form.value.startDate && form.value.endDate) {
    if (new Date(form.value.startDate) > new Date(form.value.endDate)) {
      errors.value.endDate = '结束日期不能早于开始日期'
    }
  }
  return Object.keys(errors.value).length === 0
}

const fetchActivities = async () => {
  loadingActivities.value = true
  try {
    const res = await activityApi.getList({ status: 'active', pageSize: 100 })
    activities.value = res.rows || []
  } catch (error) {
    console.error('Failed to fetch activities:', error)
  } finally {
    loadingActivities.value = false
  }
}

const handleSubmit = async () => {
  if (!validate()) return

  loading.value = true
  try {
    const data = {
      code: form.value.code || generateCode(),
      title: form.value.title.trim(),
      description: form.value.description?.trim() || undefined,
      type: form.value.type,
      status: 'draft' as const,
      phase: 'PROPOSAL' as const,
      startDate: form.value.startDate || undefined,
      endDate: form.value.endDate || undefined,
      activityId: form.value.activityId || undefined,
      creatorId: authStore.userId ?? undefined
    }

    const response = await projectApi.create(data)
    const newProject = response.data

    // Navigate to project detail
    router.push(`/project/${newProject.id}`)
  } catch (err: unknown) {
    console.error('Failed to create project:', err)
    const axiosError = err as AxiosErrorShape
    errors.value.submit = axiosError.response?.data?.msg || '创建项目失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/projects')
}

onMounted(() => {
  fetchActivities()
  // Set activityId from route if present
  if (activityIdFromRoute.value) {
    form.value.activityId = activityIdFromRoute.value
  }
})
</script>

<template>
  <PageContainer variant="fluid">
    <div class="page-header">
      <h1 class="page-title">创建新项目</h1>
      <p class="page-subtitle">填写项目基本信息，开始您的研究之旅</p>
    </div>

    <div class="form-container">
      <form @submit.prevent="handleSubmit" class="project-form">
        <div class="form-group">
          <label class="form-label required">项目名称</label>
          <input
            v-model="form.title"
            type="text"
            class="form-input"
            :class="{ error: errors.title }"
            placeholder="请输入项目名称"
          >
          <span v-if="errors.title" class="error-message">{{ errors.title }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">项目简介</label>
          <textarea
            v-model="form.description"
            class="form-textarea"
            placeholder="请输入项目简介"
            rows="4"
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">项目类型</label>
            <select v-model="form.type" class="form-select">
              <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">所属活动</label>
            <select v-model="form.activityId" class="form-select" :disabled="loadingActivities">
              <option :value="null">独立项目（不关联活动）</option>
              <option v-for="activity in activities" :key="activity.id" :value="activity.id">
                {{ activity.title }}
              </option>
            </select>
            <span class="form-hint">可选择将项目归属到某个活动中</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">开始时间</label>
            <input
              v-model="form.startDate"
              type="date"
              class="form-input"
            >
          </div>
          <div class="form-group">
            <label class="form-label">结束时间</label>
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
            <span v-else>创建项目</span>
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

.project-form {
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

.form-select:disabled {
  background: #f9fafb;
  cursor: not-allowed;
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
