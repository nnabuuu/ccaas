<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageSidebar from '../components/PageSidebar.vue'
import { activityApi, projectApi } from '../api/index'
import { useAuthStore } from '../stores/core/authStore'
import type { Activity, Project, ActivityQuery } from '@/types'

interface StatusInfo {
  label: string
  class: string
}

interface ActivityWithExtras extends Activity {
  statusInfo?: StatusInfo
  dateRange?: string
  projects?: ProjectWithExtras[]
}

interface ProjectWithExtras extends Project {
  statusInfo?: StatusInfo
  phaseLabel?: string
  dateRange?: string
  name?: string
}

const router = useRouter()
const authStore = useAuthStore()
const activeSidebarIndex = ref(0)
const loading = ref(false)
const searchKeyword = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const selectedStatus = ref('')

const sidebarItems = [
  { label: '全部活动', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>' },
  { label: '我创建的', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' },
  { label: '我参与的', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { label: '我指导的', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="14" x2="12" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/></svg>' }
]

const statusOptions = [
  { value: '', label: '活动状态' },
  { value: 'active', label: '进行中' },
  { value: 'ended', label: '已结束' },
  { value: 'draft', label: '草稿' }
]

const activities = ref<ActivityWithExtras[]>([])
const standaloneProjects = ref<ProjectWithExtras[]>([])
const expandedActivities = ref(new Set<number>())

const formatDateRange = (startDate: string | undefined, endDate: string | undefined) => {
  const format = (d: string | undefined) => {
    if (!d) return ''
    const date = new Date(d)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
  }
  if (!startDate && !endDate) return ''
  return `${format(startDate)}-${format(endDate)}`
}

const getPhaseLabel = (phase: string | undefined) => {
  const phaseMap: Record<string, string> = {
    'PROPOSAL': '开题阶段',
    'RESEARCH': '研究阶段',
    'CONCLUSION': '结题阶段'
  }
  return phaseMap[phase || ''] || '开题阶段'
}

const getActivityStatusInfo = (activity: Activity) => {
  const statusMap: Record<string, StatusInfo> = {
    'draft': { label: '草稿', class: 'draft' },
    'active': { label: '进行中', class: 'ongoing' },
    'ended': { label: '已结束', class: 'ended' }
  }
  return statusMap[activity.status || ''] || { label: '草稿', class: 'draft' }
}

const getProjectStatusInfo = (project: Project) => {
  const now = new Date()
  const endDate = project.endDate ? new Date(project.endDate) : null
  const startDate = project.startDate ? new Date(project.startDate) : null

  if (project.status === 'completed' || project.status === 'archived') {
    return { label: '已完成', class: 'ended' }
  }
  if (endDate && endDate < now) {
    return { label: '已结束', class: 'ended' }
  }
  if (startDate && startDate > now) {
    return { label: '未开始', class: 'pending' }
  }
  return { label: '进行中', class: 'ongoing' }
}

const fetchData = async () => {
  loading.value = true
  try {
    // Handle role-based filters (我参与的, 我指导的)
    if (activeSidebarIndex.value === 2 || activeSidebarIndex.value === 3) {
      // 我参与的 = member role, 我指导的 = advisor role
      const role = activeSidebarIndex.value === 2 ? 'member' : 'advisor'
      const res = await projectApi.getMyProjects(role)
      const projRes = res as { data?: Project[] }
      const projectList = projRes.data || (res as unknown as Project[]) || []

      // Clear activities for role-based view, show all as standalone
      activities.value = []
      standaloneProjects.value = projectList.map((project: Project) => ({
        ...project,
        statusInfo: getProjectStatusInfo(project),
        phaseLabel: getPhaseLabel(project.phase),
        dateRange: formatDateRange(project.startDate, project.endDate)
      }))
    } else {
      // Normal activity-based view
      const activityParams: ActivityQuery = {
        pageNum: 1,
        pageSize: 50
      }
      if (searchKeyword.value) activityParams.title = searchKeyword.value
      if (selectedStatus.value) activityParams.status = selectedStatus.value

      // Add filter based on sidebar selection
      if (activeSidebarIndex.value === 1) {
        // 我创建的 - filter by creator
        activityParams.creatorId = authStore.userId ?? undefined
      }

      const [activityRes, standaloneRes] = await Promise.all([
        activityApi.getList(activityParams),
        projectApi.getStandalone()
      ])

      const actRes = activityRes as { data?: { rows?: Activity[] }; rows?: Activity[] }
      const activityList = actRes.data?.rows || actRes.rows || []
      activities.value = activityList.map((activity: Activity) => ({
        ...activity,
        statusInfo: getActivityStatusInfo(activity),
        dateRange: formatDateRange(activity.startDate, activity.endDate),
        projects: [] // Will be loaded on expand
      }))

      const projRes = standaloneRes as { data?: Project[] }
      const projectList = projRes.data || (standaloneRes as unknown as Project[]) || []
      standaloneProjects.value = projectList.map((project: Project) => ({
        ...project,
        statusInfo: getProjectStatusInfo(project),
        phaseLabel: getPhaseLabel(project.phase),
        dateRange: formatDateRange(project.startDate, project.endDate)
      }))
    }
  } catch (error) {
    console.error('Failed to fetch data:', error)
  } finally {
    loading.value = false
  }
}

const toggleActivity = async (activityId: number) => {
  if (expandedActivities.value.has(activityId)) {
    expandedActivities.value.delete(activityId)
    expandedActivities.value = new Set(expandedActivities.value)
  } else {
    expandedActivities.value.add(activityId)
    expandedActivities.value = new Set(expandedActivities.value)
    // Load projects for this activity if not already loaded
    const activity = activities.value.find(a => a.id === activityId)
    if (activity && (!activity.projects || activity.projects.length === 0)) {
      try {
        const res = await projectApi.getByActivityId(activityId)
        const projRes = res as { data?: Project[] }
        const projectList = projRes.data || (res as unknown as Project[]) || []
        activity.projects = projectList.map((project: Project) => ({
          ...project,
          statusInfo: getProjectStatusInfo(project),
          phaseLabel: getPhaseLabel(project.phase),
          dateRange: formatDateRange(project.startDate, project.endDate)
        }))
      } catch (error) {
        console.error('Failed to load projects for activity:', error)
      }
    }
  }
}

const handleViewActivityDetails = (activityId: number) => {
  router.push(`/activity/${activityId}`)
}

const handleViewProjectDetails = (projectId: number) => {
  router.push(`/project/${projectId}`)
}

const handleCreateActivity = () => {
  router.push('/activity/new')
}

const handleCreateProject = (activityId?: number) => {
  if (activityId) {
    router.push(`/project/new?activityId=${activityId}`)
  } else {
    router.push('/project/new')
  }
}

watch(searchKeyword, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    fetchData()
  }, 300)
})

watch([activeSidebarIndex, selectedStatus], () => {
  fetchData()
})

onMounted(() => {
  fetchData()
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
            <div class="search-box">
              <input
                type="text"
                class="form-input"
                placeholder="搜索活动或项目"
                v-model="searchKeyword"
              >
              <button class="search-btn" aria-label="搜索" @click="fetchData">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
            </div>
          </div>
          <button class="btn btn-primary" @click="handleCreateActivity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            创建活动
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <span>加载中...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="activities.length === 0 && standaloneProjects.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          <p>暂无活动或项目数据</p>
          <button class="btn btn-primary" @click="handleCreateActivity">创建第一个活动</button>
        </div>

        <div v-else class="list-container">
          <!-- Activities Section -->
          <div v-for="activity in activities" :key="activity.id" class="activity-card">
            <div class="activity-card-header" @click="toggleActivity(activity.id)">
              <div class="activity-title-row">
                <span :class="['status-badge', activity.statusInfo?.class]">{{ activity.statusInfo?.label }}</span>
                <h3 class="activity-title">{{ activity.title }}</h3>
                <svg
                  :class="['expand-icon', { expanded: expandedActivities.has(activity.id) }]"
                  width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div class="activity-actions" @click.stop>
                <button class="btn btn-outline-sm" @click="handleViewActivityDetails(activity.id)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  查看详情
                </button>
                <button
                  v-if="activity.status === 'active'"
                  class="btn btn-primary-sm"
                  @click="handleCreateProject(activity.id)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  创建项目
                </button>
              </div>
            </div>

            <div class="activity-card-body">
              <div v-if="activity.description" class="activity-intro">
                <span class="intro-text">{{ activity.description }}</span>
              </div>
              <div class="activity-meta">
                <div v-if="activity.dateRange" class="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>{{ activity.dateRange }}</span>
                </div>
              </div>
            </div>

            <!-- Expanded Projects List -->
            <div v-if="expandedActivities.has(activity.id)" class="projects-list">
              <div v-if="!activity.projects || activity.projects.length === 0" class="projects-empty">
                <span>暂无项目</span>
                <button
                  v-if="activity.status === 'active'"
                  class="btn btn-link"
                  @click="handleCreateProject(activity.id)"
                >
                  创建第一个项目
                </button>
              </div>
              <div
                v-for="project in activity.projects"
                :key="project.id"
                class="project-item"
                @click="handleViewProjectDetails(project.id)"
              >
                <div class="project-item-header">
                  <span :class="['phase-tag', project.phase?.toLowerCase() || 'proposal']">
                    {{ project.phaseLabel }}
                  </span>
                  <span class="project-item-title">{{ project.title || project.name || '未命名项目' }}</span>
                </div>
                <div class="project-item-meta">
                  <span v-if="project.dateRange" class="meta-text">{{ project.dateRange }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Standalone Projects Section -->
          <div v-if="standaloneProjects.length > 0" class="standalone-section">
            <h4 class="section-title">独立项目</h4>
            <div v-for="project in standaloneProjects" :key="project.id" class="project-card">
              <div class="project-card-header">
                <div class="project-title-row">
                  <span :class="['phase-tag', project.phase?.toLowerCase() || 'proposal']">
                    {{ project.phaseLabel }}
                  </span>
                  <h3 class="project-title">{{ project.title || project.name || '未命名项目' }}</h3>
                </div>
                <button class="btn btn-outline-sm" @click="handleViewProjectDetails(project.id)">
                  查看详情
                </button>
              </div>
              <div v-if="project.description" class="project-card-body">
                <span class="intro-text">{{ project.description }}</span>
              </div>
            </div>
          </div>

          <!-- Create Standalone Project Button -->
          <div class="create-standalone">
            <button class="btn btn-outline" @click="handleCreateProject()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              创建独立项目
            </button>
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.form-select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  color: #374151;
  background: #fff;
  min-width: 120px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box .form-input {
  padding: 8px 12px;
  padding-right: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  min-width: 200px;
}

.search-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px;
}

.search-btn:hover {
  color: #3b82f6;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Activity Card Styles */
.activity-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.activity-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.activity-card-header:hover {
  background: #f9fafb;
}

.activity-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.activity-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.expand-icon {
  color: #9ca3af;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.activity-card-body {
  padding: 0 20px 16px;
}

.activity-intro {
  margin-bottom: 8px;
  font-size: 14px;
  color: #6b7280;
}

.activity-meta {
  display: flex;
  gap: 16px;
}

.activity-actions {
  display: flex;
  gap: 8px;
}

/* Projects List inside Activity */
.projects-list {
  border-top: 1px solid #f3f4f6;
  padding: 12px 20px;
  background: #fafafa;
}

.projects-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  color: #9ca3af;
  font-size: 14px;
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.project-item:last-child {
  margin-bottom: 0;
}

.project-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.project-item-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.project-item-meta {
  font-size: 12px;
  color: #9ca3af;
}

/* Standalone Projects Section */
.standalone-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.project-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
}

.project-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-title {
  font-size: 15px;
  font-weight: 500;
  color: #111827;
  margin: 0;
}

.project-card-body {
  margin-top: 8px;
  font-size: 14px;
  color: #6b7280;
}

.create-standalone {
  margin-top: 16px;
  text-align: center;
}

/* Status Badge Styles */
.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.ongoing {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge.ended {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.draft {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-badge.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

/* Phase Tag Styles */
.phase-tag {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.phase-tag.proposal {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.phase-tag.research {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.phase-tag.conclusion {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

/* Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-outline {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.btn-outline:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.btn-outline-sm {
  padding: 6px 12px;
  font-size: 13px;
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #374151;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-outline-sm:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.btn-primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-primary-sm {
  padding: 6px 12px;
  font-size: 13px;
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-primary-sm:hover {
  background: #2563eb;
}

.btn-link {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

/* Meta Styles */
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

.intro-text {
  color: #6b7280;
  line-height: 1.5;
}

/* Loading & Empty States */
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
  margin: 0;
}

@media (max-width: 768px) {
  .page-content {
    flex-direction: column;
  }

  .filter-bar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .activity-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .activity-actions {
    width: 100%;
  }

  .activity-actions .btn-outline-sm,
  .activity-actions .btn-primary-sm {
    flex: 1;
    justify-content: center;
  }
}
</style>
