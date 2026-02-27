<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageSidebar from '../components/PageSidebar.vue'
import LessonPlanSelector from '../components/LessonPlanSelector.vue'
import { BaseModal } from '../components/layout'
import { scheduleApi, gradeApi } from '../api/index'
import toast from '../utils/toast'
import type { Schedule, ScheduleQuery, Grade } from '@/types'

interface CourseItem {
  id: number
  title: string
  tags: string[]
  hasLessonPlan: boolean
  lessonPlanId: number | null
  time: string
  school: string
  grade: string
  class: string
  subject: string
  author: string
  org: string
  updateTime: string
  status: string | null
}

interface GradeOption {
  value: number | string
  label: string
}

const router = useRouter()

const activeSidebarIndex = ref(0)
const loading = ref(false)
const selectedStatus = ref<string | number>('')
const selectedGrade = ref<string | number>('')
const selectedSubject = ref('')
const grades = ref<GradeOption[]>([])

// Link modal state
const showLinkModal = ref(false)
const linkingCourse = ref<CourseItem | null>(null)
const selectedLessonPlanId = ref<number | undefined>(undefined)
const linking = ref(false)

const sidebarItems = [
  { label: '全部课程', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
  { label: '我的课程', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' }
]

const courses = ref<CourseItem[]>([])

const statusOptions = [
  { value: '', label: '全部' },
  { value: '0', label: '待提交' },
  { value: '1', label: '已提交' }
]

const subjects = [
  { value: '', label: '全部学科' },
  { value: '语文', label: '语文' },
  { value: '数学', label: '数学' },
  { value: '英语', label: '英语' },
  { value: '物理', label: '物理' },
  { value: '化学', label: '化学' }
]

const formatDateTime = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\//g, '.')
}

interface ScheduleWithExtras extends Schedule {
  schoolName?: string
  gradeName?: string
  className?: string
  createByName?: string
  teacherName?: string
  deptName?: string
  hasVideo?: boolean
  title?: string
  favorited?: boolean
}

const formatTimeSlot = (item: ScheduleWithExtras) => {
  if (item.scheduleDate && item.startTime && item.endTime) {
    const date = new Date(item.scheduleDate)
    const dateStr = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
    return `${dateStr} ${item.startTime}~${item.endTime}`
  }
  return item.timeSlot || ''
}

const buildTags = (item: ScheduleWithExtras) => {
  const tags: string[] = []
  if (item.lessonPlanId) tags.push('教案')
  if (item.hasVideo) tags.push('视频')
  return tags
}

const fetchCourses = async () => {
  loading.value = true
  try {
    const params: ScheduleQuery = {
      pageNum: 1,
      pageSize: 20
    }
    if (selectedStatus.value) params.status = selectedStatus.value
    if (selectedGrade.value) params.gradeId = Number(selectedGrade.value)
    if (selectedSubject.value) params.subject = selectedSubject.value

    const response = await scheduleApi.getList(params)
    const data = response as { data?: { rows?: ScheduleWithExtras[] }; rows?: ScheduleWithExtras[] }
    courses.value = (data.data?.rows || data.rows || []).map((item: ScheduleWithExtras) => ({
      id: item.id,
      title: item.courseName || item.title || '未命名课程',
      tags: buildTags(item),
      hasLessonPlan: !!item.lessonPlanId,
      lessonPlanId: item.lessonPlanId ?? null,
      time: formatTimeSlot(item),
      school: item.schoolName || '',
      grade: item.gradeName || '',
      class: item.className || '',
      subject: item.subject || '',
      author: item.createByName || item.teacherName || '未知',
      org: item.deptName || '',
      updateTime: formatDateTime(item.updateTime || item.createTime),
      status: String(item.status) === '1' ? 'submitted' : null
    }))
  } catch (error) {
    console.error('Failed to fetch courses:', error)
  } finally {
    loading.value = false
  }
}

interface GradeWithName extends Grade {
  name?: string
}

const fetchGrades = async () => {
  try {
    const response = await gradeApi.getList({ pageSize: 100 })
    const data = response as { data?: { rows?: GradeWithName[] }; rows?: GradeWithName[] }
    grades.value = [
      { value: '', label: '全部年级' },
      ...(data.data?.rows || data.rows || []).map((g: GradeWithName) => ({
        value: g.id,
        label: g.name || g.gradeName
      }))
    ]
  } catch (error) {
    console.error('Failed to fetch grades:', error)
    grades.value = [{ value: '', label: '全部年级' }]
  }
}

const handleDelete = async (id: number) => {
  if (!confirm('确定要删除这个课程吗？')) return
  try {
    await scheduleApi.delete(id)
    toast.success('删除成功')
    await fetchCourses()
  } catch (error: unknown) {
    const err = error as Error
    console.error('Failed to delete course:', err)
    toast.error('删除失败：' + err.message)
  }
}

const handleCreate = () => {
  router.push('/course/new')
}

const openLinkModal = (course: CourseItem) => {
  linkingCourse.value = course
  selectedLessonPlanId.value = undefined
  showLinkModal.value = true
}

const closeLinkModal = () => {
  showLinkModal.value = false
  linkingCourse.value = null
  selectedLessonPlanId.value = undefined
}

const linkLessonPlan = async () => {
  if (!selectedLessonPlanId.value || !linkingCourse.value) return
  linking.value = true
  try {
    await scheduleApi.update({
      id: linkingCourse.value.id,
      lessonPlanId: selectedLessonPlanId.value
    })
    toast.success('教案关联成功')
    closeLinkModal()
    await fetchCourses()
  } catch (error: unknown) {
    const err = error as Error
    console.error('Failed to link lesson plan:', err)
    toast.error('关联失败：' + (err.message || '未知错误'))
  } finally {
    linking.value = false
  }
}

watch([selectedStatus, selectedGrade, selectedSubject], () => {
  fetchCourses()
})

onMounted(() => {
  fetchCourses()
  fetchGrades()
})
</script>

<template>
  <div class="page-container">
    <div class="page-content">
      <PageSidebar
        :items="sidebarItems"
        :active-index="activeSidebarIndex"
        @select="activeSidebarIndex = $event"
      />

      <main class="page-main">
        <div class="filter-bar">
          <div class="filter-group">
            <select class="form-select" v-model="selectedStatus">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <select class="form-select" v-model="selectedGrade">
              <option v-for="grade in grades" :key="grade.value" :value="grade.value">
                {{ grade.label }}
              </option>
            </select>
            <select class="form-select" v-model="selectedSubject">
              <option v-for="subject in subjects" :key="subject.value" :value="subject.value">
                {{ subject.label }}
              </option>
            </select>
          </div>
          <button type="button" class="btn btn-primary" @click="handleCreate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            创建课程
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <span>加载中...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="courses.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>暂无课程数据</p>
        </div>

        <div v-else class="list-container">
          <div v-for="course in courses" :key="course.id" class="list-card" @click="router.push(`/course/${course.id}`)">
            <div class="card-header">
              <h3 class="card-title">
                <router-link :to="`/course/${course.id}`">{{ course.title }}</router-link>
                <span class="tag-group">
                  <span v-if="course.hasLessonPlan" class="tag-pill">教案</span>
                  <span v-else class="tag-pill warning" @click.stop="openLinkModal(course)">未关联教案</span>
                  <span v-for="tag in course.tags.filter(t => t !== '教案')" :key="tag" :class="['tag-pill', { video: tag === '视频' }]">{{ tag }}</span>
                </span>
              </h3>
              <div class="card-actions">
                <button class="action-btn danger" @click.stop="handleDelete(course.id)">删除</button>
              </div>
            </div>
            <div v-if="course.time" class="card-meta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {{ course.time }}
            </div>
            <div class="card-tags">
              <span v-if="course.school" class="tag tag-blue">{{ course.school }}</span>
              <template v-if="course.grade">
                <span v-if="course.school" class="tag-divider">|</span>
                <span class="tag-text">{{ course.grade }}</span>
              </template>
              <template v-if="course.class">
                <span class="tag-divider">|</span>
                <span class="tag-text">{{ course.class }}</span>
              </template>
              <template v-if="course.subject">
                <span class="tag-divider">|</span>
                <span class="tag-text">{{ course.subject }}</span>
              </template>
              <span v-if="course.status === 'submitted'" class="status-badge submitted">已提交</span>
            </div>
            <div class="card-footer">
              <div class="author-info">
                <div class="author-avatar"></div>
                <span class="author-name">{{ course.author }}</span>
                <span v-if="course.org" class="author-org">{{ course.org }}</span>
              </div>
              <span class="card-time">{{ course.updateTime }}</span>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Link LessonPlan Modal -->
    <BaseModal
      v-model:visible="showLinkModal"
      title="关联教案"
      size="md"
      @close="closeLinkModal"
    >
      <p class="modal-hint">为「{{ linkingCourse?.title }}」选择一个教案</p>
      <LessonPlanSelector v-model="selectedLessonPlanId" :subject="linkingCourse?.subject" />
      <template #footer>
        <button class="btn-secondary" @click="closeLinkModal">取消</button>
        <button class="btn-primary" @click="linkLessonPlan" :disabled="!selectedLessonPlanId || linking">
          {{ linking ? '关联中...' : '确认关联' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
}

.page-content {
  display: flex;
  gap: 24px;
}

.page-main {
  flex: 1;
  min-width: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  gap: 12px;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
}

.list-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: #3b82f6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title a {
  color: #3b82f6;
}

.tag-group {
  display: flex;
  gap: 8px;
}

.tag-pill {
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 4px;
  font-size: 12px;
}

.tag-pill.video {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.card-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 0;
  background: none;
  border: none;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
}

.action-btn:hover {
  color: #3b82f6;
}

.action-btn.danger:hover {
  color: #ef4444;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 12px;
}

.card-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.tag-text {
  font-size: 14px;
  color: #4b5563;
}

.tag-divider {
  color: #d1d5db;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f59e0b;
}

.author-name,
.author-org {
  padding: 4px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 14px;
  color: #4b5563;
}

.card-time {
  font-size: 14px;
  color: #9ca3af;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: #9ca3af;
  gap: 16px;
}

.empty-state svg {
  color: #d1d5db;
}

.empty-state p {
  font-size: 16px;
}

/* Form styles */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-textarea {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
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

/* Warning badge */
.tag-pill.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  cursor: pointer;
}

.tag-pill.warning:hover {
  background: rgba(245, 158, 11, 0.2);
}

/* Modal hint (BaseModal provides the wrapper) */

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

.btn-primary {
  padding: 8px 16px;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  color: white;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .page-content {
    flex-direction: column;
  }
}
</style>
