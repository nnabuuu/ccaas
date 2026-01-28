<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { activityApi, projectApi } from '../api/index'
import { PageContainer, BaseModal } from '../components/layout'
import type { Activity, Project, AxiosErrorShape } from '../types'

interface ProjectWithExtras extends Project {
  phaseLabel?: string
  dateRange?: string
}

const route = useRoute()
const router = useRouter()

// Data
const activity = ref<Activity | null>(null)
const projects = ref<ProjectWithExtras[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)

// Edit state
const isEditingTitle = ref(false)
const isEditingDescription = ref(false)
const editForm = ref({
  title: '',
  description: '',
  status: '',
  startDate: '',
  endDate: ''
})

// Delete confirmation
const showDeleteConfirm = ref(false)
const deleting = ref(false)

// Computed
const activityId = computed(() => Number(route.params.id))

const statusInfo = computed(() => {
  if (!activity.value) return { label: '', class: '' }
  const statusMap: Record<string, { label: string; class: string }> = {
    'draft': { label: '草稿', class: 'draft' },
    'active': { label: '进行中', class: 'ongoing' },
    'ended': { label: '已结束', class: 'ended' }
  }
  return statusMap[activity.value.status || 'draft'] || { label: '草稿', class: 'draft' }
})

const dateRange = computed(() => {
  if (!activity.value) return ''
  const format = (d: string | undefined) => {
    if (!d) return ''
    const date = new Date(d)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
  }
  const start = format(activity.value.startDate)
  const end = format(activity.value.endDate)
  if (!start && !end) return ''
  return `${start} - ${end}`
})

const statusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '进行中' },
  { value: 'ended', label: '已结束' }
]

// Methods
const fetchActivity = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await activityApi.getById(activityId.value)
    const resData = res as { data?: Activity }
    activity.value = resData.data || (res as unknown as Activity)

    // Initialize edit form
    editForm.value = {
      title: activity.value.title || '',
      description: activity.value.description || '',
      status: activity.value.status || 'draft',
      startDate: activity.value.startDate || '',
      endDate: activity.value.endDate || ''
    }

    // Fetch projects
    await fetchProjects()
  } catch (err) {
    console.error('Failed to fetch activity:', err)
    const axiosError = err as AxiosErrorShape
    if (axiosError.response?.status === 404) {
      error.value = 'not_found'
    } else {
      error.value = 'error'
    }
  } finally {
    loading.value = false
  }
}

const fetchProjects = async () => {
  try {
    const res = await projectApi.getByActivityId(activityId.value)
    const data = (res as { data?: Project[] }).data || (res as unknown as Project[]) || []
    projects.value = data.map((project: Project) => ({
      ...project,
      phaseLabel: getPhaseLabel(project.phase),
      dateRange: formatProjectDateRange(project)
    }))
  } catch (err) {
    console.error('Failed to fetch projects:', err)
    projects.value = []
  }
}

const getPhaseLabel = (phase: string | undefined) => {
  const phaseMap: Record<string, string> = {
    'PROPOSAL': '开题阶段',
    'RESEARCH': '研究阶段',
    'CONCLUSION': '结题阶段'
  }
  return phaseMap[phase || ''] || '开题阶段'
}

const formatProjectDateRange = (project: Project) => {
  const format = (d: string | undefined) => {
    if (!d) return ''
    const date = new Date(d)
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
  }
  if (!project.startDate && !project.endDate) return ''
  return `${format(project.startDate)} - ${format(project.endDate)}`
}

const goBack = () => {
  router.push('/projects')
}

const goHome = () => {
  router.push('/home')
}

const startEditTitle = () => {
  if (!activity.value) return
  editForm.value.title = activity.value.title
  isEditingTitle.value = true
}

const cancelEditTitle = () => {
  if (!activity.value) return
  editForm.value.title = activity.value.title
  isEditingTitle.value = false
}

const saveTitle = async () => {
  if (!activity.value || !editForm.value.title.trim()) return
  saving.value = true
  try {
    await activityApi.update({
      id: activity.value.id,
      title: editForm.value.title.trim(),
      description: activity.value.description || undefined,
      status: activity.value.status,
      startDate: activity.value.startDate || undefined,
      endDate: activity.value.endDate || undefined,
      creatorId: activity.value.creatorId
    })
    activity.value.title = editForm.value.title.trim()
    isEditingTitle.value = false
  } catch (err) {
    console.error('Failed to save title:', err)
  } finally {
    saving.value = false
  }
}

const startEditDescription = () => {
  if (!activity.value) return
  editForm.value.description = activity.value.description || ''
  isEditingDescription.value = true
}

const cancelEditDescription = () => {
  if (!activity.value) return
  editForm.value.description = activity.value.description || ''
  isEditingDescription.value = false
}

const saveDescription = async () => {
  if (!activity.value) return
  saving.value = true
  try {
    await activityApi.update({
      id: activity.value.id,
      title: activity.value.title,
      description: editForm.value.description.trim() || undefined,
      status: activity.value.status,
      startDate: activity.value.startDate || undefined,
      endDate: activity.value.endDate || undefined,
      creatorId: activity.value.creatorId
    })
    activity.value.description = editForm.value.description.trim() || undefined
    isEditingDescription.value = false
  } catch (err) {
    console.error('Failed to save description:', err)
  } finally {
    saving.value = false
  }
}

const handleViewProject = (projectId: number) => {
  router.push(`/project/${projectId}`)
}

const handleCreateProject = () => {
  router.push(`/project/new?activityId=${activityId.value}`)
}

const confirmDelete = () => {
  showDeleteConfirm.value = true
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
}

const executeDelete = async () => {
  deleting.value = true
  try {
    await activityApi.delete(activityId.value)
    router.push('/projects')
  } catch (err) {
    console.error('Failed to delete activity:', err)
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
  }
}

onMounted(() => {
  fetchActivity()
})
</script>

<template>
  <PageContainer variant="medium">
    <div class="activity-detail-page">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error State: Not Found -->
    <div v-else-if="error === 'not_found'" class="error-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4"/>
        <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
      </svg>
      <h2>活动不存在</h2>
      <p>您访问的活动可能已被删除或不存在</p>
      <button class="btn btn-primary" @click="goBack">返回项目列表</button>
    </div>

    <!-- Error State: Generic -->
    <div v-else-if="error === 'error'" class="error-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4"/>
        <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
      </svg>
      <h2>加载失败</h2>
      <p>无法加载活动信息，请稍后重试</p>
      <button class="btn btn-primary" @click="fetchActivity">重试</button>
    </div>

    <!-- Activity Content -->
    <div v-else-if="activity" class="activity-content">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <a href="#" @click.prevent="goHome">首页</a>
        <span class="separator">&gt;</span>
        <a href="#" @click.prevent="goBack">全部项目</a>
        <span class="separator">&gt;</span>
        <span class="current">活动详情</span>
      </div>

      <!-- Header -->
      <div class="activity-header">
        <div class="header-left">
          <div class="title-row">
            <!-- Title Display/Edit -->
            <div v-if="!isEditingTitle" class="title-display">
              <h1 class="activity-title">{{ activity.title }}</h1>
              <button class="edit-btn" @click="startEditTitle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                修改活动
              </button>
            </div>
            <div v-else class="title-edit">
              <input
                v-model="editForm.title"
                type="text"
                class="title-input"
                @keyup.enter="saveTitle"
                @keyup.escape="cancelEditTitle"
                autofocus
              />
              <div class="edit-actions">
                <button class="btn-icon" @click="saveTitle" :disabled="saving">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <button class="btn-icon" @click="cancelEditTitle">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="activity-meta">
            <div class="meta-item">
              <span :class="['status-badge', statusInfo.class]">{{ statusInfo.label }}</span>
            </div>
            <div v-if="dateRange" class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{{ dateRange }}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline btn-danger" @click="confirmDelete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            删除活动
          </button>
        </div>
      </div>

      <!-- Description Section -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">活动简介</h2>
          <button v-if="!isEditingDescription" class="btn-link" @click="startEditDescription">
            编辑
          </button>
        </div>

        <div v-if="!isEditingDescription" class="description-display">
          <p v-if="activity.description">{{ activity.description }}</p>
          <p v-else class="placeholder">暂无简介，点击编辑添加</p>
        </div>
        <div v-else class="description-edit">
          <textarea
            v-model="editForm.description"
            class="description-textarea"
            placeholder="请输入活动简介..."
            rows="4"
          ></textarea>
          <div class="edit-actions">
            <button class="btn btn-secondary btn-sm" @click="cancelEditDescription">取消</button>
            <button class="btn btn-primary btn-sm" @click="saveDescription" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Projects Section -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">项目列表</h2>
          <button class="btn btn-primary btn-sm" @click="handleCreateProject">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            创建项目
          </button>
        </div>

        <div v-if="projects.length === 0" class="empty-projects">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p>暂无项目</p>
          <button class="btn btn-primary" @click="handleCreateProject">创建第一个项目</button>
        </div>

        <div v-else class="projects-grid">
          <div
            v-for="project in projects"
            :key="project.id"
            class="project-card"
            @click="handleViewProject(project.id)"
          >
            <div class="project-card-header">
              <span :class="['phase-tag', project.phase?.toLowerCase() || 'proposal']">
                {{ project.phaseLabel }}
              </span>
              <span class="project-title">{{ project.title || '未命名项目' }}</span>
            </div>
            <div v-if="project.description" class="project-description">
              {{ project.description }}
            </div>
            <div v-if="project.dateRange" class="project-meta">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {{ project.dateRange }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <BaseModal
      v-model:visible="showDeleteConfirm"
      title="确认删除"
      size="sm"
      @close="cancelDelete"
    >
      <p>确定要删除活动「{{ activity?.title }}」吗？</p>
      <p v-if="projects.length > 0" class="warning-text">
        该活动包含 {{ projects.length }} 个项目，删除后这些项目将变为独立项目。
      </p>
      <template #footer>
        <button class="btn btn-secondary" @click="cancelDelete">取消</button>
        <button class="btn btn-danger" @click="executeDelete" :disabled="deleting">
          {{ deleting ? '删除中...' : '确认删除' }}
        </button>
      </template>
    </BaseModal>
    </div>
  </PageContainer>
</template>

<style scoped>
.activity-detail-page {
  /* PageContainer handles responsive centering */
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  color: #6b7280;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  color: #6b7280;
  gap: 16px;
  text-align: center;
}

.error-state svg {
  color: #d1d5db;
}

.error-state h2 {
  font-size: 20px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.error-state p {
  font-size: 14px;
  margin: 0;
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 20px;
}

.breadcrumb a {
  color: #3b82f6;
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.breadcrumb .separator {
  color: #d1d5db;
}

.breadcrumb .current {
  color: #374151;
}

/* Activity Header */
.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--detail-header-border);
}

.header-left {
  flex: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.title-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.activity-title {
  font-size: var(--detail-header-title-size);
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
}

.edit-btn:hover {
  background: #f9fafb;
}

.title-edit {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.title-input {
  flex: 1;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  padding: 4px 12px;
  outline: none;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #6b7280;
}

.meta-item svg {
  color: #9ca3af;
}

.header-actions {
  flex-shrink: 0;
}

/* Status Badge */
.status-badge {
  padding: var(--detail-badge-padding);
  border-radius: var(--detail-badge-radius);
  font-size: var(--detail-badge-font-size);
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.ongoing {
  background: var(--status-active-bg);
  color: var(--status-active-color);
}

.status-badge.ended {
  background: var(--status-ended-bg);
  color: var(--status-ended-color);
}

.status-badge.draft {
  background: var(--status-draft-bg);
  color: var(--status-draft-color);
}

/* Section */
.section {
  background: var(--detail-card-bg);
  border: 1px solid var(--detail-card-border);
  border-radius: var(--detail-card-radius);
  padding: var(--detail-card-padding);
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

/* Description */
.description-display p {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

.description-display .placeholder {
  color: #9ca3af;
  font-style: italic;
}

.description-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
}

.description-textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Projects */
.empty-projects {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #9ca3af;
  gap: 12px;
}

.empty-projects svg {
  color: #d1d5db;
}

.empty-projects p {
  font-size: 14px;
  margin: 0;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.project-card {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.project-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.project-title {
  font-size: 15px;
  font-weight: 500;
  color: #111827;
}

.project-description {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

/* Phase Tag */
.phase-tag {
  padding: 3px 10px;
  border-radius: var(--detail-badge-radius);
  font-size: 11px;
  font-weight: 500;
}

.phase-tag.proposal {
  background: var(--phase-proposal-bg);
  color: var(--phase-proposal-color);
}

.phase-tag.research {
  background: var(--phase-research-bg);
  color: var(--phase-research-color);
}

.phase-tag.conclusion {
  background: var(--phase-conclusion-bg);
  color: var(--phase-conclusion-color);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--detail-btn-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: var(--detail-btn-primary-bg);
  border: 1px solid var(--detail-btn-primary-bg);
  color: #fff;
}

.btn-primary:hover {
  background: var(--detail-btn-primary-hover);
  border-color: var(--detail-btn-primary-hover);
}

.btn-secondary {
  background: #fff;
  border: 1px solid var(--detail-btn-secondary-border);
  color: #374151;
}

.btn-secondary:hover {
  background: var(--detail-btn-secondary-hover-bg);
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

.btn-danger {
  background: #ef4444;
  border: 1px solid #ef4444;
  color: #fff;
}

.btn-danger:hover {
  background: #dc2626;
  border-color: #dc2626;
}

.btn-outline.btn-danger {
  background: #fff;
  border: 1px solid #fca5a5;
  color: #ef4444;
}

.btn-outline.btn-danger:hover {
  background: rgba(239, 68, 68, 0.05);
  border-color: #ef4444;
}

.btn-link {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal body content (BaseModal provides the wrapper) */
.modal-body-content p {
  font-size: 14px;
  color: #374151;
  margin: 0 0 12px 0;
}

.modal-body-content p:last-child {
  margin-bottom: 0;
}

.warning-text {
  color: #f59e0b !important;
  background: rgba(245, 158, 11, 0.1);
  padding: 12px;
  border-radius: 6px;
}

/* Responsive */
@media (max-width: 768px) {
  .activity-header {
    flex-direction: column;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    width: 100%;
    justify-content: center;
  }

  .projects-grid {
    grid-template-columns: 1fr;
  }

  .activity-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
