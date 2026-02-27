<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageSidebar from '../components/PageSidebar.vue'
import { lessonPlanApi, gradeApi } from '../api/index'
import toast from '../utils/toast'
import type { LessonPlan, Grade, LessonPlanQuery } from '@/types'

interface GradeOption {
  value: string | number
  label: string
}

interface LessonPlanItem {
  id: number
  title: string
  tags: string[]
  author: string
  org: string
  time: string
  status: string | null
}

interface LessonPlanWithExtras extends LessonPlan {
  createByName?: string
  authorName?: string
  deptName?: string
  organizationName?: string
  gradeName?: string
  name?: string
  textbookVersion?: string
  semester?: number
  chapter?: string
}

const router = useRouter()

const activeSidebarIndex = ref(0)
const loading = ref(false)
const searchKeyword = ref('')
const selectedGrade = ref<string | number>('')
const selectedSubject = ref('')
const grades = ref<GradeOption[]>([])

const sidebarItems = [
  { label: '全部教案', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { label: '我的收藏', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { label: '我的分享', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' }
]

const lessonPlans = ref<LessonPlanItem[]>([])

const subjects = [
  { value: '', label: '全部学科' },
  { value: '语文', label: '语文' },
  { value: '数学', label: '数学' },
  { value: '英语', label: '英语' },
  { value: '物理', label: '物理' },
  { value: '化学', label: '化学' },
  { value: '生物', label: '生物' },
  { value: '历史', label: '历史' },
  { value: '地理', label: '地理' }
]

const formatDate = (dateStr: string | undefined) => {
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

const buildTags = (item: LessonPlanWithExtras) => {
  const tags: string[] = []
  if (item.textbookVersion) tags.push(item.textbookVersion)
  if (item.subject) tags.push(item.subject)
  if (item.gradeName) tags.push(item.gradeName)
  if (item.semester) tags.push(item.semester === 1 ? '上册' : '下册')
  if (item.chapter) tags.push(item.chapter)
  return tags
}

const fetchLessonPlans = async () => {
  loading.value = true
  try {
    const params: LessonPlanQuery = {
      pageNum: 1,
      pageSize: 20
    }
    if (searchKeyword.value) params.title = searchKeyword.value
    if (selectedGrade.value) params.gradeLevel = Number(selectedGrade.value)
    if (selectedSubject.value) params.subject = selectedSubject.value

    const response = await lessonPlanApi.getList(params)
    const data = response as { data?: { rows?: LessonPlanWithExtras[] }; rows?: LessonPlanWithExtras[] }
    lessonPlans.value = (data.data?.rows || data.rows || []).map((item: LessonPlanWithExtras) => ({
      id: item.id,
      title: item.title || item.name || '',
      tags: buildTags(item),
      author: item.createByName || item.authorName || '未知',
      org: item.deptName || item.organizationName || '',
      time: formatDate(item.createTime),
      status: String(item.status) === '1' ? 'published' : null
    }))
  } catch (error) {
    console.error('Failed to fetch lesson plans:', error)
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
  if (!confirm('确定要删除这个教案吗？')) return
  try {
    await lessonPlanApi.delete(id)
    toast.success('删除成功')
    await fetchLessonPlans()
  } catch (error: unknown) {
    const err = error as Error
    console.error('Failed to delete lesson plan:', err)
    toast.error('删除失败：' + err.message)
  }
}

const handleCreate = () => {
  router.push('/lesson-plan/new')
}

watch([selectedGrade, selectedSubject], () => {
  fetchLessonPlans()
})

onMounted(() => {
  fetchLessonPlans()
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
        <!-- Filters -->
        <div class="filter-bar">
          <div class="filter-group">
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
            <div class="search-box">
              <input
                type="text"
                class="form-input"
                placeholder="搜索教案..."
                v-model="searchKeyword"
                @keyup.enter="fetchLessonPlans"
                style="padding-right: 2.5rem;"
              >
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="fetchLessonPlans" style="cursor: pointer;">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
          </div>
          <button class="btn btn-primary" @click="handleCreate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            创建教案
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <span>加载中...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="lessonPlans.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <p>暂无教案数据</p>
        </div>

        <!-- List -->
        <div v-else class="list-container">
          <div v-for="item in lessonPlans" :key="item.id" class="list-card" @click="router.push(`/lesson-plan/${item.id}`)">
            <div class="card-header">
              <h3 class="card-title">
                <router-link :to="`/lesson-plan/${item.id}`" @click.stop>{{ item.title }}</router-link>
              </h3>
              <div class="card-actions">
                <button class="action-btn danger" @click.stop="handleDelete(item.id)">删除</button>
              </div>
            </div>
            <div class="card-tags">
              <span v-for="(tag, index) in item.tags" :key="index" class="tag-text">
                {{ tag }}
                <span v-if="index < item.tags.length - 1" class="tag-divider">|</span>
              </span>
              <span v-if="item.status === 'published'" class="status-badge published">已发布</span>
            </div>
            <div class="card-footer">
              <div class="author-info">
                <div class="author-avatar"></div>
                <span class="author-name">{{ item.author }}</span>
                <span v-if="item.org" class="author-org">{{ item.org }}</span>
              </div>
              <span class="card-time">{{ item.time }}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
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
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
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
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}

.list-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: #3b82f6;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 500;
}

.card-title a {
  color: #3b82f6;
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

.card-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tag-text {
  font-size: 14px;
  color: #4b5563;
}

.tag-divider {
  color: #d1d5db;
  margin: 0 4px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

@media (max-width: 768px) {
  .page-content {
    flex-direction: column;
  }
}
</style>
