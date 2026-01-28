<script setup lang="ts">
import { ref, computed, onMounted, type PropType } from 'vue'
import { projectReflectionApi } from '../../api/index'

interface Attachment {
  ossId: string
  fileName: string
}

interface ProjectReflection {
  id: number
  projectId: number
  phase: 'PROPOSAL' | 'RESEARCH' | 'CONCLUSION'
  content: string
  createTime?: string
  createByName?: string
  attachments?: Attachment[]
}

const props = defineProps({
  projectId: {
    type: [Number, String] as PropType<number | string>,
    required: true
  }
})

// Data
const reflections = ref<ProjectReflection[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingReflection = ref<ProjectReflection | null>(null)

// Form data
const formData = ref({
  phase: 'PROPOSAL',
  content: ''
})

// Phase labels
const phaseLabels: Record<string, string> = {
  PROPOSAL: '开题阶段',
  RESEARCH: '研究阶段',
  CONCLUSION: '结题阶段'
}

// Group reflections by phase
const reflectionsByPhase = computed(() => {
  const grouped: Record<string, ProjectReflection[]> = { PROPOSAL: [], RESEARCH: [], CONCLUSION: [] }
  reflections.value.forEach(r => {
    if (grouped[r.phase]) {
      grouped[r.phase].push(r)
    }
  })
  return grouped
})

// Fetch reflections
const fetchReflections = async () => {
  loading.value = true
  try {
    const res = await projectReflectionApi.getByProjectId(Number(props.projectId))
    const data = (res as { data?: ProjectReflection[] }).data || (res as unknown as ProjectReflection[])
    reflections.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to fetch reflections:', error)
  } finally {
    loading.value = false
  }
}

// Open add modal
const openAddModal = () => {
  editingReflection.value = null
  formData.value = { phase: 'PROPOSAL', content: '' }
  showModal.value = true
}

// Open edit modal
const openEditModal = (reflection: ProjectReflection) => {
  editingReflection.value = reflection
  formData.value = {
    phase: reflection.phase,
    content: reflection.content
  }
  showModal.value = true
}

// Save reflection
const saveReflection = async () => {
  try {
    const data: Partial<ProjectReflection> = {
      projectId: Number(props.projectId),
      phase: formData.value.phase as 'PROPOSAL' | 'RESEARCH' | 'CONCLUSION',
      content: formData.value.content
    }

    if (editingReflection.value) {
      data.id = editingReflection.value.id
      await projectReflectionApi.update(data)
    } else {
      await projectReflectionApi.create(data)
    }

    showModal.value = false
    await fetchReflections()
  } catch (error) {
    console.error('Failed to save reflection:', error)
  }
}

// Delete reflection
const deleteReflection = async (id: number) => {
  if (!confirm('确定要删除这条反思吗？')) return

  try {
    await projectReflectionApi.delete(id)
    await fetchReflections()
  } catch (error) {
    console.error('Failed to delete reflection:', error)
  }
}

// Format date
const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

onMounted(() => {
  fetchReflections()
})
</script>

<template>
  <div class="reflection-tab">
    <!-- Header -->
    <div class="tab-header">
      <h3>项目反思</h3>
      <button class="btn btn-primary" @click="openAddModal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加反思
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      加载中...
    </div>

    <!-- Timeline by phase -->
    <div v-else class="reflection-timeline">
      <div v-for="(phaseReflections, phase) in reflectionsByPhase" :key="phase" class="phase-group">
        <div class="phase-header">
          <span class="phase-dot"></span>
          <span class="phase-label">{{ phaseLabels[phase] }}</span>
          <span class="phase-count">{{ phaseReflections.length }}条</span>
        </div>

        <!-- Empty state -->
        <div v-if="phaseReflections.length === 0" class="empty-phase">
          暂无反思记录
        </div>

        <!-- Reflection cards -->
        <div v-else class="reflection-list">
          <div v-for="reflection in phaseReflections" :key="reflection.id" class="reflection-card">
            <div class="card-header">
              <div class="author-info">
                <span class="avatar">{{ reflection.createByName?.[0] || '学' }}</span>
                <span class="author-name">{{ reflection.createByName || '学生' }}</span>
                <span class="create-time">{{ formatDate(reflection.createTime) }}</span>
              </div>
              <div class="card-actions">
                <button class="icon-btn" @click="openEditModal(reflection)" title="编辑">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="icon-btn danger" @click="deleteReflection(reflection.id)" title="删除">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="card-content">
              {{ reflection.content || '暂无内容' }}
            </div>
            <!-- Attachments -->
            <div v-if="reflection.attachments?.length" class="card-attachments">
              <div v-for="att in reflection.attachments" :key="att.ossId" class="attachment-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                {{ att.fileName }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h4>{{ editingReflection ? '编辑反思' : '添加反思' }}</h4>
          <button class="close-btn" @click="showModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>阶段</label>
            <select v-model="formData.phase">
              <option value="PROPOSAL">开题阶段</option>
              <option value="RESEARCH">研究阶段</option>
              <option value="CONCLUSION">结题阶段</option>
            </select>
          </div>
          <div class="form-group">
            <label>反思内容</label>
            <textarea v-model="formData.content" rows="6" placeholder="请输入反思内容..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="saveReflection">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reflection-tab {
  padding: 24px 0;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.tab-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

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

.btn-primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
}

/* Timeline */
.reflection-timeline {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.phase-group {
  border-left: 2px solid #e5e7eb;
  padding-left: 20px;
  margin-left: 8px;
}

.phase-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
}

.phase-dot {
  position: absolute;
  left: -26px;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #3b82f6;
}

.phase-label {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}

.phase-count {
  font-size: 13px;
  color: #9ca3af;
}

.empty-phase {
  color: #9ca3af;
  font-size: 14px;
  padding: 12px 0;
}

/* Reflection cards */
.reflection-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reflection-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
}

.author-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.create-time {
  font-size: 13px;
  color: #9ca3af;
}

.card-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  padding: 4px;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
}

.icon-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.icon-btn.danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

.card-content {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  white-space: pre-wrap;
}

.card-attachments {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 13px;
  color: #374151;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}
</style>
