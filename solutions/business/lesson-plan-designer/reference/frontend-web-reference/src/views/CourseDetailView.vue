<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  scheduleApi,
  lessonPlanApi,
  courseReflectionApi,
  lessonPlanEvaluationApi,
  teachingEvaluationApi
} from '../api/index'
import LessonPlanSelector from '../components/LessonPlanSelector.vue'
import { LessonPlanViewer } from '../components/lesson-plan'
import EvaluationCard from '../components/course-detail/EvaluationCard.vue'
import EvaluationForm from '../components/course-detail/EvaluationForm.vue'
import VideoPlayer from '../components/course-detail/VideoPlayer.vue'
import StarRating from '../components/StarRating.vue'
import { ossApi } from '../api/index'
import toast from '../utils/toast'
import {
  InlineEditText,
  InlineEditDate,
  InlineEditTimeRange
} from '../components/inline-edit'
import { PageContainer, BaseModal } from '../components/layout'
import type { Schedule, LessonPlan, CourseReflection, LessonPlanEvaluation, TeachingEvaluation } from '@/types'

// API response types for full schedule data
interface FullScheduleResponse {
  schedule: Schedule
  lessonPlan: LessonPlan | null
  reflection: CourseReflection | null
  lessonPlanEvaluations: LessonPlanEvaluation[]
  teachingEvaluations: TeachingEvaluation[]
}

const route = useRoute()
const router = useRouter()

// Tab state
const activeTab = ref('design') // design, reflection, lessonEval, teachingEval
const tabs = [
  { key: 'design', label: '教学设计' },
  { key: 'reflection', label: '教学反思' },
  { key: 'lessonEval', label: '教案评价' },
  { key: 'teachingEval', label: '授课评价' }
]

// Extended schedule type with additional view properties
interface ExtendedSchedule extends Schedule {
  lessonPlanSnapshot?: string
  // Display fields that may be joined from related entities
  title?: string
  courseName?: string
  schoolName?: string
  gradeName?: string
  className?: string
}

// Data state
const course = ref<ExtendedSchedule | null>(null)
const loading = ref(true)
const showDropdown = ref(false)
const linkedLessonPlan = ref<LessonPlan | null>(null)
const loadingLessonPlan = ref(false)

// Course Reflection state
const reflection = ref<CourseReflection | null>(null)
const reflectionContent = ref('')
const savingReflection = ref(false)

// Evaluations state
const lessonPlanEvaluations = ref<LessonPlanEvaluation[]>([])
const teachingEvaluations = ref<TeachingEvaluation[]>([])

// Link modal state
const showLinkModal = ref(false)
const selectedLessonPlanId = ref<number | undefined>(undefined)
const linking = ref(false)

// Edit mode state (for future inline editing feature)
const isEditingLessonPlan = ref(false)
const editedLessonPlan = ref<Partial<LessonPlan>>({})
const showSaveDialog = ref(false)
const saveMode = ref<'snapshot' | 'base'>('snapshot')
const savingLessonPlan = ref(false)

// Confirm modal state
const confirmAction = ref<{ type: 'delete' | 'reset_lesson_plan' } | null>(null)

// Evaluation form state
const showEvalForm = ref(false)
const evalFormType = ref<'lesson' | 'teaching'>('lesson')
const evalForm = ref({
  score1: 0,
  score2: 0,
  score3: 0,
  score4: 0,
  score5: 0,
  comment: ''
})
const submittingEval = ref(false)

// Video state
const videoPlayerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)
const uploadingVideo = ref(false)
const isVideoPlaying = ref(false)

const courseId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? Number(id) : Number(id[0])
})


// Fetch all data
const fetchCourse = async () => {
  loading.value = true
  try {
    // Fetch full schedule data with all relations
    const response = await scheduleApi.getFullById(courseId.value)
    const responseData = response as { data?: FullScheduleResponse }
    const data = responseData.data || (response as unknown as FullScheduleResponse)

    course.value = data.schedule as ExtendedSchedule
    linkedLessonPlan.value = data.lessonPlan
    reflection.value = data.reflection
    reflectionContent.value = data.reflection?.content || ''

    // Set evaluations
    lessonPlanEvaluations.value = data.lessonPlanEvaluations || []
    teachingEvaluations.value = data.teachingEvaluations || []

  } catch (error) {
    console.error('Failed to fetch course:', error)
    // Fallback to basic fetch
    try {
      const basicResponse = await scheduleApi.getById(courseId.value)
      course.value = (basicResponse.data || basicResponse) as ExtendedSchedule
      if (course.value?.lessonPlanId) {
        fetchLinkedLessonPlan(course.value.lessonPlanId)
      }
    } catch (e) {
      console.error('Failed to fetch basic course:', e)
    }
  } finally {
    loading.value = false
  }
}

const fetchLinkedLessonPlan = async (lessonPlanId: number) => {
  loadingLessonPlan.value = true
  try {
    const response = await lessonPlanApi.getById(lessonPlanId)
    const responseData = response as { data?: LessonPlan }
    linkedLessonPlan.value = responseData.data || (response as unknown as LessonPlan)
  } catch (error) {
    console.error('Failed to fetch lesson plan:', error)
    linkedLessonPlan.value = null
  } finally {
    loadingLessonPlan.value = false
  }
}

const fetchReflection = async () => {
  try {
    const response = await courseReflectionApi.getByScheduleId(courseId.value)
    const responseData = response as { data?: CourseReflection }
    reflection.value = responseData.data || (response as unknown as CourseReflection)
    reflectionContent.value = reflection.value?.content || ''
  } catch (error) {
    console.error('Failed to fetch reflection:', error)
  }
}

const fetchEvaluations = async () => {
  try {
    const [lpResponse, teResponse] = await Promise.all([
      lessonPlanEvaluationApi.getByScheduleId(courseId.value),
      teachingEvaluationApi.getByScheduleId(courseId.value)
    ])
    // API returns single object, convert to array for display
    lessonPlanEvaluations.value = lpResponse.data ? [lpResponse.data] : []
    teachingEvaluations.value = teResponse.data ? [teResponse.data] : []
  } catch (error) {
    console.error('Failed to fetch evaluations:', error)
  }
}

// Actions - Inline Edit Handler
const updateScheduleField = async (field: string, value: unknown) => {
  try {
    await scheduleApi.update({
      id: courseId.value,
      [field]: value
    })
    // Update local state
    if (course.value) {
      (course.value as Record<string, unknown>)[field] = value
    }
  } catch (error) {
    console.error(`Failed to update ${field}:`, error)
    throw error // Re-throw to let inline edit component handle the error
  }
}

// Update time range (both startTime and endTime)
const updateTimeRange = async ({ startTime, endTime }: { startTime: string; endTime: string }) => {
  try {
    await scheduleApi.update({
      id: courseId.value,
      startTime,
      endTime,
      // Also update timeSlot for backwards compatibility
      timeSlot: `${startTime}~${endTime}`
    })
    // Update local state
    if (course.value) {
      course.value.startTime = startTime
      course.value.endTime = endTime
      course.value.timeSlot = `${startTime}~${endTime}`
    }
  } catch (error) {
    console.error('Failed to update time range:', error)
    throw error
  }
}

// Legacy edit handler - now just opens dropdown for delete option
const handleEdit = () => {
  showDropdown.value = false
  // Edit is now done inline, this button can be removed or repurposed
}

const handleDelete = async () => {
  showDropdown.value = false
  confirmAction.value = { type: 'delete' }
}

const openLinkModal = () => {
  selectedLessonPlanId.value = course.value?.lessonPlanId ?? undefined
  showLinkModal.value = true
}

const closeLinkModal = () => {
  showLinkModal.value = false
  selectedLessonPlanId.value = undefined
}

const linkLessonPlan = async () => {
  if (!selectedLessonPlanId.value) return
  linking.value = true
  try {
    await scheduleApi.update({
      id: courseId.value,
      lessonPlanId: selectedLessonPlanId.value
    })
    toast.success('教案关联成功')
    closeLinkModal()
    await fetchCourse()
  } catch (error) {
    console.error('Failed to link lesson plan:', error)
    toast.error('关联失败：' + ((error as Error).message || '未知错误'))
  } finally {
    linking.value = false
  }
}

// Lesson Plan Editing
const startEditingLessonPlan = () => {
  if (!linkedLessonPlan.value) return
  // Initialize with snapshot if exists, otherwise use base lesson plan
  const snapshot = course.value?.lessonPlanSnapshot
    ? JSON.parse(course.value.lessonPlanSnapshot)
    : null

  editedLessonPlan.value = {
    objectives: snapshot?.objectives || linkedLessonPlan.value.objectives || '',
    content: snapshot?.content || linkedLessonPlan.value.content || '',
    teachingMethods: snapshot?.teachingMethods || linkedLessonPlan.value.teachingMethods || '',
    materialsNeeded: snapshot?.materialsNeeded || linkedLessonPlan.value.materialsNeeded || '',
    assessmentMethods: snapshot?.assessmentMethods || linkedLessonPlan.value.assessmentMethods || ''
  }
  isEditingLessonPlan.value = true
}

const cancelEditingLessonPlan = () => {
  isEditingLessonPlan.value = false
}

const openSaveDialog = () => {
  showSaveDialog.value = true
  saveMode.value = 'snapshot'
}

const closeSaveDialog = () => {
  showSaveDialog.value = false
}

const saveLessonPlan = async () => {
  savingLessonPlan.value = true
  try {
    if (saveMode.value === 'snapshot') {
      // Save as snapshot (only for this course)
      await scheduleApi.saveSnapshot({
        id: courseId.value,
        lessonPlanSnapshot: JSON.stringify(editedLessonPlan.value)
      })
      toast.success('本次修改已保存')
    } else {
      // Update base lesson plan
      if (!linkedLessonPlan.value) return
      await lessonPlanApi.update({
        id: linkedLessonPlan.value.id,
        ...editedLessonPlan.value
      })
      toast.success('教案已更新')
    }
    closeSaveDialog()
    isEditingLessonPlan.value = false
    await fetchCourse()
  } catch (error: unknown) {
    console.error('Failed to save lesson plan:', error)
    const err = error as Error
    toast.error('保存失败：' + (err.message || '未知错误'))
  } finally {
    savingLessonPlan.value = false
  }
}

const resetToBase = async () => {
  confirmAction.value = { type: 'reset_lesson_plan' }
}

const executeConfirmAction = async () => {
  if (!confirmAction.value) return
  const actionType = confirmAction.value.type
  confirmAction.value = null
  if (actionType === 'delete') {
    try {
      await scheduleApi.delete(courseId.value)
      toast.success('删除成功')
      router.push('/course')
    } catch (error) {
      console.error('Failed to delete course:', error)
      toast.error('删除失败：' + (error as Error).message)
    }
  } else if (actionType === 'reset_lesson_plan') {
    try {
      await scheduleApi.clearSnapshot(courseId.value)
      toast.success('已重置为原教案')
      await fetchCourse()
    } catch (error) {
      console.error('Failed to reset snapshot:', error)
      toast.error('重置失败')
    }
  }
}

// Reflection
const saveReflection = async () => {
  savingReflection.value = true
  try {
    if (reflection.value?.id) {
      await courseReflectionApi.update({
        id: reflection.value.id,
        content: reflectionContent.value,
        status: 'draft'
      })
    } else {
      const response = await courseReflectionApi.create({
        scheduleId: courseId.value,
        content: reflectionContent.value,
        status: 'draft'
      })
      const responseData = response as { data?: CourseReflection }
      reflection.value = responseData.data || (response as unknown as CourseReflection)
    }
    toast.success('反思已保存')
  } catch (error) {
    console.error('Failed to save reflection:', error)
    toast.error('保存失败')
  } finally {
    savingReflection.value = false
  }
}

const publishReflection = async () => {
  if (!reflectionContent.value.trim()) {
    toast.warning('请先填写反思内容')
    return
  }
  savingReflection.value = true
  try {
    if (reflection.value?.id) {
      await courseReflectionApi.update({
        id: reflection.value.id,
        content: reflectionContent.value,
        status: 'published'
      })
    } else {
      const response = await courseReflectionApi.create({
        scheduleId: courseId.value,
        content: reflectionContent.value,
        status: 'published'
      })
      const responseData = response as { data?: CourseReflection }
      reflection.value = responseData.data || (response as unknown as CourseReflection)
    }
    if (reflection.value) {
      reflection.value.status = 'published'
    }
    toast.success('反思已发布')
  } catch (error) {
    console.error('Failed to publish reflection:', error)
    toast.error('发布失败')
  } finally {
    savingReflection.value = false
  }
}

const triggerAiReflection = async () => {
  try {
    await courseReflectionApi.triggerAiGeneration(courseId.value)
    toast.success('AI反思生成已触发')
    await fetchReflection()
  } catch (error) {
    console.error('Failed to trigger AI reflection:', error)
    toast.error('触发失败')
  }
}

// Evaluations
const openEvalForm = (type: 'lesson' | 'teaching') => {
  evalFormType.value = type
  evalForm.value = { score1: 0, score2: 0, score3: 0, score4: 0, score5: 0, comment: '' }
  showEvalForm.value = true
}

const closeEvalForm = () => {
  showEvalForm.value = false
}

interface EvalFormData {
  objectiveDesignScore?: number
  contentOrganizationScore?: number
  taskDesignScore?: number
  homeworkDesignScore?: number
  resourcePreparationScore?: number
  introductionScore?: number
  processControlScore?: number
  interactionScore?: number
  timeManagementScore?: number
  visualAidsScore?: number
  comment?: string
}

const handleEvalFormSubmit = async (data: EvalFormData) => {
  submittingEval.value = true
  try {
    if (evalFormType.value === 'lesson') {
      await lessonPlanEvaluationApi.create({
        scheduleId: courseId.value,
        lessonPlanId: linkedLessonPlan.value?.id,
        objectiveDesignScore: data.objectiveDesignScore,
        contentOrganizationScore: data.contentOrganizationScore,
        taskDesignScore: data.taskDesignScore,
        homeworkDesignScore: data.homeworkDesignScore,
        resourcePreparationScore: data.resourcePreparationScore,
        comment: data.comment,
        status: 'submitted'
      })
    } else {
      await teachingEvaluationApi.create({
        scheduleId: courseId.value,
        introductionScore: data.introductionScore,
        processControlScore: data.processControlScore,
        interactionScore: data.interactionScore,
        timeManagementScore: data.timeManagementScore,
        visualAidsScore: data.visualAidsScore,
        comment: data.comment,
        status: 'submitted'
      })
    }
    toast.success('评价已提交')
    closeEvalForm()
    await fetchEvaluations()
  } catch (error) {
    console.error('Failed to submit evaluation:', error)
    toast.error('提交失败')
  } finally {
    submittingEval.value = false
  }
}

// Video upload
interface OssUploadResponse {
  url: string
  fileName: string
  ossId: string
}

const handleVideoUpload = async (file: File) => {
  uploadingVideo.value = true
  try {
    // Upload to OSS
    const response = await ossApi.upload(file)
    const responseData = response as { data?: OssUploadResponse }
    const unwrapped = response as unknown as OssUploadResponse
    const videoUrl = responseData.data?.url || unwrapped.url

    // Update schedule with video URL
    await scheduleApi.update({
      id: courseId.value,
      videoUrl: videoUrl
    })

    // Update local state
    if (course.value) {
      course.value.videoUrl = videoUrl
    }
    toast.success('Video uploaded successfully')
  } catch (error: unknown) {
    console.error('Failed to upload video:', error)
    const err = error as Error
    toast.error('Video upload failed: ' + (err.message || 'Unknown error'))
  } finally {
    uploadingVideo.value = false
  }
}

// Handle tab switch - enable mini player if video is playing
const handleTabChange = (newTab: string) => {
  if (isVideoPlaying.value && videoPlayerRef.value) {
    videoPlayerRef.value.enableMiniPlayer?.()
  }
  activeTab.value = newTab
}

// Helpers
const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '.')
}

interface TimeSlotItem {
  scheduleDate?: string
  startTime?: string
  endTime?: string
  startDate?: string
  timeSlot?: string
}

const formatTimeSlot = (item: TimeSlotItem | null): string => {
  if (!item) return ''
  if (item.scheduleDate && item.startTime && item.endTime) {
    return `${formatDate(item.scheduleDate)} ${item.startTime}~${item.endTime}`
  }
  if (item.startDate && item.timeSlot) {
    return `${formatDate(item.startDate)} ${item.timeSlot}`
  }
  return item.timeSlot || ''
}

const getDayOfWeekLabel = (day: number | undefined): string => {
  const days = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return day !== undefined ? days[day] || '' : ''
}

const getEffectiveLessonPlan = () => {
  if (!linkedLessonPlan.value) return null
  if (course.value?.lessonPlanSnapshot) {
    try {
      const snapshot = JSON.parse(course.value.lessonPlanSnapshot)
      return { ...linkedLessonPlan.value, ...snapshot, isSnapshot: true }
    } catch (e) {
      return linkedLessonPlan.value
    }
  }
  return linkedLessonPlan.value
}

const hasSnapshot = computed(() => !!course.value?.lessonPlanSnapshot)

const effectiveLessonPlan = computed(() => getEffectiveLessonPlan())

onMounted(() => {
  fetchCourse()
})
</script>

<template>
  <PageContainer variant="fluid">
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <router-link to="/home">首页</router-link>
      <span class="separator">&gt;</span>
      <router-link to="/course">全部课程</router-link>
      <span class="separator">&gt;</span>
      <span class="current">课程详情</span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- Course Detail -->
    <template v-else-if="course">
      <!-- Compact Header -->
      <div class="course-header-card">
        <div class="header-main">
          <div class="header-info">
            <div class="title-row">
              <InlineEditText
                :model-value="course.courseName || course.title || ''"
                variant="title"
                placeholder="输入课程名称"
                @save="(value) => updateScheduleField('courseName', value)"
              />
              <div class="header-actions">
                <div class="dropdown">
                  <button class="btn btn-icon btn-sm" aria-label="更多操作" @click="showDropdown = !showDropdown">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="1"/>
                      <circle cx="19" cy="12" r="1"/>
                      <circle cx="5" cy="12" r="1"/>
                    </svg>
                  </button>
                  <div v-if="showDropdown" class="dropdown-menu">
                    <button class="dropdown-item danger" @click="handleDelete">删除课程</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="meta-row">
              <span class="meta-item meta-item--editable">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <InlineEditDate
                  :model-value="course.scheduleDate || course.startDate || ''"
                  placeholder="选择日期"
                  @save="(value) => updateScheduleField('scheduleDate', value)"
                />
                <span v-if="course.dayOfWeek" class="day-of-week">{{ getDayOfWeekLabel(course.dayOfWeek) }}</span>
              </span>
              <span class="meta-item meta-item--editable">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <InlineEditTimeRange
                  :start-time="course.startTime || ''"
                  :end-time="course.endTime || ''"
                  placeholder="选择时间"
                  @save="updateTimeRange"
                />
              </span>
              <span class="meta-item meta-item--editable">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <InlineEditText
                  :model-value="course.location || ''"
                  placeholder="输入地点"
                  @save="(value) => updateScheduleField('location', value)"
                />
              </span>
            </div>

            <div class="meta-row">
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                {{ course.schoolName || '未指定学校' }}
                <template v-if="course.gradeName"> · {{ course.gradeName }}</template>
                <template v-if="course.className"> · {{ course.className }}</template>
              </span>
            </div>
          </div>

          <!-- Video Area (Compact Preview) -->
          <div class="video-area-compact">
            <VideoPlayer
              ref="videoPlayerRef"
              :videoUrl="course.videoUrl"
              :title="course.courseName || course.title"
              @upload="handleVideoUpload"
              @update:playing="isVideoPlaying = $event"
            />
            <div v-if="uploadingVideo" class="upload-overlay">
              <span>Uploading...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="tabs-container">
        <div class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['tab', { active: activeTab === tab.key }]"
            @click="handleTabChange(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- 教学设计 Tab -->
        <div v-if="activeTab === 'design'" class="tab-panel">
          <div v-if="!linkedLessonPlan && !loadingLessonPlan" class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p>暂无关联教案</p>
            <button class="btn btn-primary" @click="openLinkModal">关联教案</button>
          </div>

          <div v-else-if="loadingLessonPlan" class="loading-state">加载中...</div>

          <!-- View Mode -->
          <template v-else-if="linkedLessonPlan && !isEditingLessonPlan">
            <div class="design-header">
              <div class="design-title">
                <span>基于教案：</span>
                <router-link :to="`/lesson-plan/${linkedLessonPlan.id}`" class="link">
                  {{ linkedLessonPlan.title }}
                </router-link>
                <span v-if="hasSnapshot" class="snapshot-badge">已修改</span>
              </div>
              <div class="design-actions">
                <button v-if="hasSnapshot" class="btn btn-text btn-sm" @click="resetToBase">重置为原教案</button>
                <router-link :to="`/lesson-plan/${linkedLessonPlan.id}`" class="btn btn-outline btn-sm">查看原教案</router-link>
              </div>
            </div>

            <!-- Use shared LessonPlanViewer for consistent display -->
            <LessonPlanViewer
              :lesson-plan="effectiveLessonPlan"
              :hide-outline="true"
              :compact="true"
            />
          </template>
        </div>

        <!-- 教学反思 Tab -->
        <div v-if="activeTab === 'reflection'" class="tab-panel">
          <div class="reflection-section">
            <div class="section-header-row">
              <h3>我的反思</h3>
              <div class="section-actions">
                <button class="btn btn-text btn-sm" @click="saveReflection" :disabled="savingReflection">
                  {{ savingReflection ? '保存中...' : '保存草稿' }}
                </button>
                <button class="btn btn-primary btn-sm" @click="publishReflection" :disabled="savingReflection">
                  发布
                </button>
              </div>
            </div>
            <textarea
              v-model="reflectionContent"
              class="reflection-textarea"
              placeholder="请写下你对本次课程的反思..."
              rows="10"
            />
            <div v-if="reflection?.status === 'published'" class="status-badge published">已发布</div>
          </div>

          <div class="ai-section">
            <div class="ai-header">
              <span class="ai-icon">🤖</span>
              <span>AI反思</span>
              <span v-if="reflection?.aiStatus === 'completed'" class="ai-time">生成于 {{ formatDate(reflection.aiGeneratedAt) }}</span>
            </div>
            <div v-if="reflection?.aiStatus === 'not_started' || !reflection?.aiStatus" class="ai-placeholder">
              <p>课程结束后将自动生成AI反思</p>
              <button class="btn btn-outline btn-sm" @click="triggerAiReflection">手动触发生成</button>
            </div>
            <div v-else-if="reflection?.aiStatus === 'in_progress'" class="ai-loading">
              <span>AI反思生成中...</span>
            </div>
            <div v-else-if="reflection?.aiContent" class="ai-content">
              {{ reflection.aiContent }}
            </div>
          </div>
        </div>

        <!-- 教案评价 Tab -->
        <div v-if="activeTab === 'lessonEval'" class="tab-panel">
          <div class="eval-header">
            <div>
              <span v-if="linkedLessonPlan">评价教案：{{ linkedLessonPlan.title }}</span>
              <span v-else>暂无关联教案</span>
            </div>
            <button class="btn btn-primary btn-sm" @click="openEvalForm('lesson')" :disabled="!linkedLessonPlan">
              提交评价
            </button>
          </div>

          <div v-if="lessonPlanEvaluations.length === 0" class="empty-state small">
            <p>暂无评价记录</p>
          </div>

          <div v-else class="eval-list">
            <EvaluationCard
              v-for="eval_ in lessonPlanEvaluations"
              :key="eval_.id"
              :evaluation="eval_"
              type="lesson"
            />
          </div>
        </div>

        <!-- 授课评价 Tab -->
        <div v-if="activeTab === 'teachingEval'" class="tab-panel">
          <div class="eval-header">
            <div>授课表现评价</div>
            <button class="btn btn-primary btn-sm" @click="openEvalForm('teaching')">
              提交评价
            </button>
          </div>

          <div v-if="teachingEvaluations.length === 0" class="empty-state small">
            <p>暂无评价记录</p>
          </div>

          <div v-else class="eval-list">
            <EvaluationCard
              v-for="eval_ in teachingEvaluations"
              :key="eval_.id"
              :evaluation="eval_"
              type="teaching"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Link LessonPlan Modal -->
    <BaseModal
      v-model:visible="showLinkModal"
      :title="linkedLessonPlan ? '更换教案' : '关联教案'"
      size="md"
      @close="closeLinkModal"
    >
      <p class="modal-hint">为「{{ course?.courseName || course?.title }}」选择一个教案</p>
      <LessonPlanSelector v-model="selectedLessonPlanId" :subject="course?.subject" />
      <template #footer>
        <button class="btn-secondary" @click="closeLinkModal">取消</button>
        <button class="btn btn-primary" @click="linkLessonPlan" :disabled="!selectedLessonPlanId || linking">
          {{ linking ? '关联中...' : '确认关联' }}
        </button>
      </template>
    </BaseModal>

    <!-- Save Dialog -->
    <BaseModal
      v-model:visible="showSaveDialog"
      title="保存修改"
      size="sm"
      @close="closeSaveDialog"
    >
      <div class="save-options">
        <label class="save-option" :class="{ selected: saveMode === 'snapshot' }">
          <input type="radio" v-model="saveMode" value="snapshot" />
          <div class="option-content">
            <strong>仅保存本次修改</strong>
            <span>修改只应用于当前课程</span>
          </div>
        </label>
        <label class="save-option" :class="{ selected: saveMode === 'base' }">
          <input type="radio" v-model="saveMode" value="base" />
          <div class="option-content">
            <strong>同步更新原教案</strong>
            <span>修改将更新「{{ linkedLessonPlan?.title }}」教案</span>
          </div>
        </label>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeSaveDialog">取消</button>
        <button class="btn btn-primary" @click="saveLessonPlan" :disabled="savingLessonPlan">
          {{ savingLessonPlan ? '保存中...' : '确认保存' }}
        </button>
      </template>
    </BaseModal>

    <!-- Evaluation Form Modal -->
    <BaseModal
      v-model:visible="showEvalForm"
      :title="evalFormType === 'lesson' ? '教案评价' : '授课评价'"
      size="lg"
      :closable="false"
      @close="closeEvalForm"
    >
      <EvaluationForm
        :type="evalFormType"
        :lessonPlanTitle="linkedLessonPlan?.title"
        @submit="handleEvalFormSubmit"
        @cancel="closeEvalForm"
      />
    </BaseModal>

    <!-- Confirm Modal -->
    <BaseModal
      :visible="!!confirmAction"
      :title="confirmAction?.type === 'delete' ? '确认删除' : '确认重置'"
      size="sm"
      @close="confirmAction = null"
    >
      <p v-if="confirmAction?.type === 'delete'">确定要删除这个课程吗？此操作不可撤销。</p>
      <p v-else-if="confirmAction?.type === 'reset_lesson_plan'">确定要重置为原教案内容吗？本次修改将丢失。</p>
      <template #footer>
        <button class="btn btn-secondary" @click="confirmAction = null">取消</button>
        <button
          class="btn"
          :style="confirmAction?.type === 'delete' ? 'background: #ef4444; border-color: #ef4444; color: white;' : 'background: #3b82f6; border-color: #3b82f6; color: white;'"
          @click="executeConfirmAction"
        >
          {{ confirmAction?.type === 'delete' ? '确认删除' : '确认重置' }}
        </button>
      </template>
    </BaseModal>
  </PageContainer>
</template>

<style scoped>

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 20px;
}

.breadcrumb a {
  color: #6b7280;
  text-decoration: none;
}

.breadcrumb a:hover {
  color: #3b82f6;
}

.breadcrumb .separator {
  color: #9ca3af;
}

.breadcrumb .current {
  color: #1f2937;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 48px;
  color: #6b7280;
}

/* Compact Header */
.course-header-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 20px;
  margin-bottom: 16px;
}

.header-main {
  display: flex;
  gap: 20px;
}

.header-info {
  flex: 1;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.course-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 8px;
}

/* Editable meta items - inline edit components inside */
.meta-item--editable {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-item--editable > svg {
  flex-shrink: 0;
}

.day-of-week {
  color: #6b7280;
  margin-left: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
}

.meta-item svg {
  color: #9ca3af;
}

/* Video Area */
.video-area-compact {
  width: 320px;
  flex-shrink: 0;
  position: relative;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  border-radius: 8px;
  font-size: 14px;
}

/* Tabs */
.tabs-container {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  margin-bottom: 16px;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  flex: 1;
  padding: 14px 20px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
}

.tab:hover {
  color: #3b82f6;
}

.tab.active {
  color: #3b82f6;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #3b82f6;
}

/* Tab Content */
.tab-content {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  min-height: 400px;
}

.tab-panel {
  padding: 24px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: #9ca3af;
  gap: 16px;
}

.empty-state.small {
  padding: 32px;
}

.empty-state svg {
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* Design Tab */
.design-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 20px;
}

.design-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
}

.design-title .link {
  color: #3b82f6;
  text-decoration: none;
}

.design-title .link:hover {
  text-decoration: underline;
}

.snapshot-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.design-actions {
  display: flex;
  gap: 8px;
}

.lesson-plan-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.content-section {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-label::before {
  content: '📎';
}

.section-text {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Edit Mode */
.lesson-plan-edit {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.edit-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.edit-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
}

.edit-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Reflection Tab */
.reflection-section {
  margin-bottom: 24px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header-row h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.reflection-textarea {
  width: 100%;
  padding: 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
}

.reflection-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.status-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.published {
  background: #d1fae5;
  color: #065f46;
}

/* AI Section */
.ai-section {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 16px;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 500;
  color: #0369a1;
}

.ai-icon {
  font-size: 18px;
}

.ai-time {
  font-size: 12px;
  color: #6b7280;
  margin-left: auto;
}

.ai-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #6b7280;
}

.ai-placeholder p {
  margin: 0;
  font-size: 14px;
}

.ai-loading {
  padding: 20px;
  text-align: center;
  color: #0369a1;
}

.ai-content {
  font-size: 14px;
  color: #1f2937;
  line-height: 1.6;
}

/* Evaluation Tab */
.eval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 20px;
  font-size: 14px;
  color: #6b7280;
}

.eval-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.eval-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.eval-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.reviewer {
  font-weight: 500;
  color: #374151;
}

.score {
  font-weight: 600;
  color: #3b82f6;
}

.eval-dimensions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.dimension {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  font-size: 13px;
}

.dim-label {
  color: #6b7280;
}

.dim-score {
  font-weight: 500;
  color: #374151;
}

.eval-comment {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.5;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

/* Evaluation Form */
.eval-form {
  padding: 16px 0;
}

.eval-dimension {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #f3f4f6;
}

.dim-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dim-name {
  font-weight: 500;
  color: #1f2937;
}

.dim-desc {
  font-size: 12px;
  color: #9ca3af;
}

.star-rating {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star {
  background: none;
  border: none;
  font-size: 24px;
  color: #d1d5db;
  cursor: pointer;
  padding: 0;
  transition: color 0.1s;
}

.star:hover,
.star.filled {
  color: #fbbf24;
}

.score-display {
  margin-left: 12px;
  font-size: 14px;
  color: #6b7280;
  min-width: 40px;
}

.eval-comment-section {
  margin-top: 20px;
}

.eval-comment-section label {
  display: block;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.eval-comment-section textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}

.eval-comment-section textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: #3b82f6;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-outline {
  background: white;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

.btn-outline:hover {
  background: #eff6ff;
}

.btn-text {
  background: none;
  color: #6b7280;
  padding: 6px 12px;
}

.btn-text:hover {
  color: #3b82f6;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #6b7280;
}

.btn-icon:hover {
  background: #f3f4f6;
}

.btn-secondary {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

/* Dropdown */
.dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  min-width: 120px;
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  background: none;
  border: none;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.dropdown-item:hover {
  background: #f3f4f6;
}

.dropdown-item.danger {
  color: #ef4444;
}

/* Modal content styles (BaseModal provides the wrapper) */

.modal-hint {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

/* Save Options */
.save-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.save-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.save-option:hover {
  border-color: #3b82f6;
}

.save-option.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.save-option input {
  margin-top: 4px;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-content strong {
  color: #1f2937;
}

.option-content span {
  font-size: 13px;
  color: #6b7280;
}

.link {
  color: #3b82f6;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
</style>
