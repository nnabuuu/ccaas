<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { scheduleApi } from '../api/index'
import { useSchoolStore } from '../stores/domain/schoolStore'
import LessonPlanSelector from '../components/LessonPlanSelector.vue'
import toast from '../utils/toast'
import PageContainer from '../components/layout/PageContainer.vue'

const router = useRouter()
const schoolStore = useSchoolStore()

const submitting = ref(false)

const today = new Date().toISOString().split('T')[0]

const form = ref({
  courseName: '',
  scheduleDate: today,
  startTime: '08:00',
  endTime: '09:40',
  location: '',
  subject: '数学'
})

const selectedLessonPlanId = ref<number | undefined>(undefined)

const subjects = [
  '语文', '数学', '英语', '物理', '化学', '生物',
  '历史', '地理', '信息科技', '道德与法治', '科学', '音乐', '美术', '体育'
]

const schoolId = computed(() => schoolStore.currentSchoolId)

const canSubmit = computed(() => {
  return form.value.courseName.trim() &&
    form.value.scheduleDate &&
    form.value.startTime &&
    form.value.endTime &&
    form.value.subject &&
    schoolId.value
})

const submit = async () => {
  if (!schoolId.value) {
    toast.error('请先在顶部导航栏选择学校')
    return
  }

  submitting.value = true
  try {
    const payload = {
      courseName: form.value.courseName.trim(),
      scheduleDate: form.value.scheduleDate,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      location: form.value.location.trim() || undefined,
      subject: form.value.subject,
      lessonPlanId: selectedLessonPlanId.value || undefined,
      schoolId: schoolId.value,
      status: 'active' as const
    }

    const response = await scheduleApi.create(payload)
    const responseData = response as { data?: { id: number }; id?: number }
    const result = responseData.data || responseData

    toast.success('课程创建成功')
    router.push(`/course/${result.id}`)
  } catch (error) {
    console.error('Failed to create course:', error)
    toast.error('创建失败：' + ((error as Error).message || '未知错误'))
  } finally {
    submitting.value = false
  }
}

const cancel = () => { router.push('/course') }
</script>

<template>
  <PageContainer variant="fluid">
    <div class="breadcrumb">
      <router-link to="/home">首页</router-link>
      <span class="sep">&gt;</span>
      <router-link to="/course">课程</router-link>
      <span class="sep">&gt;</span>
      <span class="current">创建课程</span>
    </div>

    <div class="wizard-card">
        <div class="wizard-header">
          <h1>创建新课程</h1>
          <button class="close-btn" aria-label="关闭" @click="cancel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="step-content">
          <!-- School info -->
          <div v-if="schoolStore.currentSchool" class="school-info">
            <span class="school-label">当前学校：</span>
            <span class="school-value">{{ schoolStore.currentSchoolName }}</span>
          </div>
          <div v-else class="warning-box">请先在顶部导航栏选择学校</div>

          <div class="form-group">
            <label class="form-label">课程名称 <span class="required">*</span></label>
            <input v-model="form.courseName" type="text" class="form-input" placeholder="例如：数学第一课" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">日期 <span class="required">*</span></label>
              <input v-model="form.scheduleDate" type="date" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">时间 <span class="required">*</span></label>
              <div class="time-row">
                <input v-model="form.startTime" type="time" class="form-input" />
                <span>-</span>
                <input v-model="form.endTime" type="time" class="form-input" />
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">教室/地点</label>
              <input v-model="form.location" type="text" class="form-input" placeholder="例如：301教室" />
            </div>
            <div class="form-group">
              <label class="form-label">学科 <span class="required">*</span></label>
              <select v-model="form.subject" class="form-select">
                <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <!-- Lesson Plan Association (optional, inline) -->
          <div class="form-group">
            <label class="form-label">关联教案 <span class="optional">(可选，可稍后添加)</span></label>
            <LessonPlanSelector v-model="selectedLessonPlanId" :subject="form.subject" />
          </div>

          <div class="form-actions">
            <button class="btn-secondary" @click="cancel">取消</button>
            <button class="btn-primary" @click="submit" :disabled="!canSubmit || submitting">
              {{ submitting ? '创建中...' : '创建课程' }}
            </button>
          </div>
        </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #6b7280; margin-bottom: 24px; }
.breadcrumb a { color: #6b7280; text-decoration: none; }
.breadcrumb a:hover { color: #3b82f6; }
.breadcrumb .sep { color: #9ca3af; }
.breadcrumb .current { color: #1f2937; }

.wizard-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1);
}

.wizard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.wizard-header h1 { font-size: 20px; font-weight: 600; margin: 0; }

.close-btn { background: none; border: none; color: #9ca3af; cursor: pointer; padding: 4px; }
.close-btn:hover { color: #6b7280; }

.step-content { display: flex; flex-direction: column; gap: 20px; }

.school-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.school-label { font-size: 14px; color: #64748b; }
.school-value { font-size: 14px; font-weight: 500; color: #0369a1; }

.optional { color: #9ca3af; font-weight: 400; }

.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-label { font-size: 14px; font-weight: 500; color: #374151; }
.required { color: #ef4444; }

.form-input, .form-select {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.time-row { display: flex; align-items: center; gap: 8px; }
.time-row .form-input { flex: 1; }
.time-row span { color: #9ca3af; }

.warning-box {
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 14px;
  color: #92400e;
  text-align: center;
}

.form-actions { display: flex; gap: 12px; margin-top: 12px; }

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary { background: #3b82f6; color: white; border: none; }
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }

.btn-secondary { background: white; color: #374151; border: 1px solid #e5e7eb; }
.btn-secondary:hover:not(:disabled) { background: #f9fafb; }

@media (max-width: 560px) {
  .form-row { grid-template-columns: 1fr; }
  .form-actions.three { flex-wrap: wrap; }
}
</style>
