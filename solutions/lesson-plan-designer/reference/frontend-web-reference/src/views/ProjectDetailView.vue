<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectApi, projectContentApi, ossApi } from '../api/index'
import PageContainer from '../components/layout/PageContainer.vue'
import ProjectReflectionTab from '../components/project-detail/ProjectReflectionTab.vue'
import ProjectEvaluationTab from '../components/project-detail/ProjectEvaluationTab.vue'
import MarkdownSection from '../components/lesson-plan/MarkdownSection.vue'
import SectionComments from '../components/common/SectionComments.vue'
import { InlineEditText } from '../components/inline-edit'
import toast from '../utils/toast'

const route = useRoute()
const router = useRouter()

// Main tab navigation
const mainTabs = [
  { key: 'research', label: '项目研究' },
  { key: 'reflection', label: '项目反思' },
  { key: 'evaluation', label: '项目评价' }
]
const activeMainTab = ref('research')

// Sync tab with URL query param
watch(() => route.query.tab, (newTab) => {
  if (typeof newTab === 'string' && mainTabs.some(t => t.key === newTab)) {
    activeMainTab.value = newTab
  }
}, { immediate: true })

const setMainTab = (tabKey: string) => {
  activeMainTab.value = tabKey
  router.replace({ query: { ...route.query, tab: tabKey } })
}

// Project types
interface ProjectContent {
  id?: number
  projectId: number
  phase: string
  sectionType: string
  content?: string
  attachments?: Array<{
    ossId: string
    fileName: string
    fileType?: string
    fileSize?: number
    uploadTime?: string
  }>
}

interface Project {
  id: number
  title: string
  description?: string
  remark?: string
  phase?: string
  mentorName?: string
  createByName?: string
  type?: string
  status?: string
}

// Project data
const project = ref<Project | null>(null)
const contents = ref<ProjectContent[]>([])
const loading = ref(true)
const saving = ref(false)

// Original state for dirty tracking
const originalProject = ref<{ title: string; description?: string } | null>(null)
const originalContentState = ref<Record<string, string>>({})

// Computed isDirty: true if project header or any content has unsaved changes
const isDirty = computed(() => {
  if (!project.value || !originalProject.value) return false

  // Check project header fields
  const headerDirty =
    project.value.title !== originalProject.value.title ||
    project.value.description !== originalProject.value.description

  // Check content state vs original
  const contentDirty = Object.keys(subItemContentState.value).some(key => {
    return subItemContentState.value[key] !== (originalContentState.value[key] || '')
  })

  return headerDirty || contentDirty
})

// Phase navigation
const phases = [
  { key: 'PROPOSAL', label: '开题阶段', icon: 'M' },
  { key: 'RESEARCH', label: '研究阶段', icon: 'R' },
  { key: 'CONCLUSION', label: '结题阶段', icon: 'C' }
]

const activePhase = ref('PROPOSAL')

interface SubItem {
  key: string
  label: string
  icon: string
}

interface SectionDefinition {
  key: string
  label: string
  icon: string
  subItems: SubItem[]
}

// Section definitions per phase - each sub-item is editable with its own key using dot notation
// Icons: question (问题), document (文献), clipboard (综述), list (步骤), target (成果), chart (数据)
const phaseSections: Record<string, SectionDefinition[]> = {
  PROPOSAL: [
    { key: 'research_question', label: '研究问题', icon: 'question', subItems: [
      { key: 'question', label: '问题', icon: 'question' },
      { key: 'literature', label: '文献', icon: 'document' },
      { key: 'literature_review', label: '文献综述', icon: 'clipboard' }
    ]},
    { key: 'research_steps', label: '研究步骤', icon: 'steps', subItems: [
      { key: 'step_plan', label: '步骤安排', icon: 'list' },
      { key: 'research_route', label: '研究路线', icon: 'route' }
    ]},
    { key: 'expected_outcomes', label: '预期成果', icon: 'target', subItems: [
      { key: 'outcome_1', label: '成果一', icon: 'target' }
    ]},
    { key: 'process', label: '研究过程', icon: 'process', subItems: [
      { key: 'schedule', label: '时程安排', icon: 'calendar' },
      { key: 'process_diagram', label: '研究过程图', icon: 'diagram' }
    ]},
    { key: 'proposal_report', label: '开题报告', icon: 'report', subItems: [
      { key: 'draft_report', label: '报告草稿', icon: 'draft' },
      { key: 'final_report', label: '最终报告', icon: 'final' }
    ]}
  ],
  RESEARCH: [
    { key: 'research_progress', label: '研究进展', icon: 'progress', subItems: [
      { key: 'progress_log', label: '进展记录', icon: 'log' }
    ]},
    { key: 'data_collection', label: '数据收集', icon: 'data', subItems: [
      { key: 'data_log', label: '数据记录', icon: 'chart' }
    ]},
    { key: 'analysis', label: '分析过程', icon: 'analysis', subItems: [
      { key: 'analysis_log', label: '分析记录', icon: 'analyze' }
    ]}
  ],
  CONCLUSION: [
    { key: 'draft_result', label: '成果草稿', icon: 'draft', subItems: [
      { key: 'draft_1', label: '报告草稿一', icon: 'draft' },
      { key: 'student_submit', label: '学生提交', icon: 'upload' },
      { key: 'teacher_review', label: '教师批阅', icon: 'review' }
    ]},
    { key: 'final_result', label: '最终成果', icon: 'final', subItems: [
      { key: 'final_files', label: '文件、图片、视频、音频等', icon: 'files' }
    ]}
  ]
}

const currentSections = computed(() => phaseSections[activePhase.value] || [])

// Expanded sections
const expandedSections = ref<Record<string, boolean>>({})

// Get content for a section (or sub-item) - uses dot notation for sectionType
const getSectionContent = (sectionKey: string, subItemKey: string | null = null): ProjectContent | undefined => {
  const contentKey = subItemKey ? `${sectionKey}.${subItemKey}` : sectionKey
  return contents.value.find(c => c.phase === activePhase.value && c.sectionType === contentKey)
}

// Get content value for a sub-item
const getSubItemContent = (sectionKey: string, subItemKey: string) => {
  const content = getSectionContent(sectionKey, subItemKey)
  return content?.content || ''
}

// Local state for sub-item content (for MarkdownSection v-model)
const subItemContentState = ref<Record<string, string>>({})

// Initialize/get local content state for a sub-item
const getLocalSubItemContent = (sectionKey: string, subItemKey: string) => {
  const key = `${sectionKey}.${subItemKey}`
  if (subItemContentState.value[key] === undefined) {
    subItemContentState.value[key] = getSubItemContent(sectionKey, subItemKey)
  }
  return subItemContentState.value[key]
}

// Update local content state
const updateLocalSubItemContent = (sectionKey: string, subItemKey: string, value: string) => {
  const key = `${sectionKey}.${subItemKey}`
  subItemContentState.value[key] = value
}

// Toggle section expansion
const toggleSection = (sectionKey: string) => {
  expandedSections.value[sectionKey] = !expandedSections.value[sectionKey]
}

// Fetch project data
const fetchProject = async () => {
  loading.value = true
  try {
    const projectId = Number(route.params.id)
    const [projectRes, contentRes] = await Promise.all([
      projectApi.getById(projectId),
      projectContentApi.getByProjectId(projectId)
    ])

    const projectData = projectRes as unknown as { data?: Project } & Project
    const contentData = contentRes as unknown as { data?: ProjectContent[] } & ProjectContent[]
    project.value = (projectData.data || projectData) as Project
    contents.value = (contentData.data || contentData || []) as ProjectContent[]

    // Store original state for dirty tracking
    if (project.value) {
      originalProject.value = {
        title: project.value.title,
        description: project.value.description || project.value.remark
      }

      // Set active phase based on project's current phase
      if (project.value.phase) {
        activePhase.value = project.value.phase
      }
    }

    // Expand all sections by default
    currentSections.value.forEach(section => {
      expandedSections.value[section.key] = true
    })

    // Initialize local content state from fetched content
    subItemContentState.value = {}
    originalContentState.value = {}
    contents.value.forEach(c => {
      subItemContentState.value[c.sectionType] = c.content || ''
      originalContentState.value[c.sectionType] = c.content || ''
    })
  } catch (error) {
    console.error('Failed to fetch project:', error)
  } finally {
    loading.value = false
  }
}

// Save section content (or sub-item content) - uses dot notation for sectionType
const saveSectionContent = async (sectionKey: string, content: string, subItemKey: string | null = null) => {
  if (!project.value) return
  saving.value = true
  try {
    const contentKey = subItemKey ? `${sectionKey}.${subItemKey}` : sectionKey
    const existing = getSectionContent(sectionKey, subItemKey) as { id?: number; content?: string } | undefined
    const data: Record<string, unknown> = {
      projectId: project.value.id,
      phase: activePhase.value,
      sectionType: contentKey,
      content: content
    }

    if (existing) {
      data.id = existing.id
      await projectContentApi.update(data)
      // Update the existing content in local state
      existing.content = content
    } else {
      const res = await projectContentApi.create(data) as unknown as { data?: ProjectContent } & ProjectContent
      contents.value.push((res.data || res) as ProjectContent)
    }
  } catch (error) {
    console.error('Failed to save content:', error)
  } finally {
    saving.value = false
  }
}

// Handle sub-item content change from MarkdownSection
const handleSubItemContentChange = (sectionKey: string, subItemKey: string, value: string) => {
  updateLocalSubItemContent(sectionKey, subItemKey, value)
}

// Save sub-item content on blur
const saveSubItemContent = async (sectionKey: string, subItemKey: string) => {
  const key = `${sectionKey}.${subItemKey}`
  const content = subItemContentState.value[key] || ''
  await saveSectionContent(sectionKey, content, subItemKey)
}

// File upload
const handleFileUpload = async (sectionKey: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const uploadRes = await ossApi.upload(file) as { data?: { ossId?: string; fileName?: string }; ossId?: string; fileName?: string }
    const attachment = {
      ossId: uploadRes.data?.ossId || uploadRes.ossId,
      fileName: uploadRes.data?.fileName || file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadTime: new Date().toISOString()
    }

    const existing = getSectionContent(sectionKey) as { id?: number } | undefined
    if (existing?.id && project.value) {
      await projectContentApi.addAttachment(existing.id, attachment)
      // Refresh content
      const contentRes = await projectContentApi.getByProjectId(project.value.id) as unknown as { data?: ProjectContent[] } & ProjectContent[]
      contents.value = (contentRes.data || contentRes || []) as ProjectContent[]
    }
  } catch (error) {
    console.error('Failed to upload file:', error)
  }
}

// Navigate back
const goBack = () => {
  router.push('/projects')
}

// Navigate home
const goHome = () => {
  router.push('/home')
}

// Handle inline field update (for InlineEditText)
const handleFieldUpdate = async (field: string, value: string) => {
  if (!project.value) return
  if (field === 'title') {
    project.value.title = value
  } else if (field === 'description') {
    project.value.description = value
    project.value.remark = value
  }
}

// Save all pending changes (header + content)
const handleSaveAll = async () => {
  if (!project.value || !originalProject.value) return
  saving.value = true
  try {
    // Save project header if changed
    const headerDirty =
      project.value.title !== originalProject.value.title ||
      project.value.description !== originalProject.value.description

    if (headerDirty) {
      const data = {
        id: project.value.id,
        title: project.value.title,
        description: project.value.description,
        remark: project.value.description
      }
      await projectApi.update(data)
    }

    // Save all changed content sections
    const contentPromises: Promise<unknown>[] = []
    for (const key of Object.keys(subItemContentState.value)) {
      const currentValue = subItemContentState.value[key] || ''
      const originalValue = originalContentState.value[key] || ''
      if (currentValue !== originalValue) {
        const existing = contents.value.find((c: ProjectContent) => c.sectionType === key && c.phase === activePhase.value) as { id?: number } | undefined
        const data: Record<string, unknown> = {
          projectId: project.value.id,
          phase: activePhase.value,
          sectionType: key,
          content: currentValue
        }
        if (existing) {
          data.id = existing.id
          contentPromises.push(projectContentApi.update(data))
        } else {
          contentPromises.push(projectContentApi.create(data))
        }
      }
    }

    if (contentPromises.length > 0) {
      await Promise.all(contentPromises)
    }

    // Update original state after successful save
    originalProject.value = {
      title: project.value.title,
      description: project.value.description
    }
    originalContentState.value = { ...subItemContentState.value }

    toast.success('保存成功')
  } catch (error) {
    console.error('Failed to save:', error)
    toast.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

// Cancel all changes and revert to original state
const handleCancelAll = () => {
  if (!project.value || !originalProject.value) return
  if (!confirm('确定要取消所有未保存的更改吗？')) return

  // Revert project header
  project.value.title = originalProject.value.title
  project.value.description = originalProject.value.description
  project.value.remark = originalProject.value.description

  // Revert content state
  subItemContentState.value = { ...originalContentState.value }

  toast.info('已取消更改')
}

// Watch for phase changes
watch(activePhase, () => {
  currentSections.value.forEach((section: SectionDefinition) => {
    if (expandedSections.value[section.key] === undefined) {
      expandedSections.value[section.key] = true
    }
  })
})

onMounted(() => {
  fetchProject()
})
</script>

<template>
  <PageContainer variant="wide">
    <div class="project-detail-page">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <span>加载中...</span>
      </div>

      <template v-else-if="project">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <a href="#" @click.prevent="goHome">首页</a>
        <span class="separator">&gt;</span>
        <a href="#" @click.prevent="goBack">全部项目</a>
        <span class="separator">&gt;</span>
        <span class="current">项目详情</span>
      </div>

      <!-- Project Header -->
      <div :class="['project-header', { editing: isDirty }]">
        <div class="header-left">
          <div class="header-title-area">
            <div class="title-row">
              <InlineEditText
                :model-value="project.title || ''"
                variant="title"
                placeholder="输入项目名称"
                @save="(value) => handleFieldUpdate('title', value)"
              />
              <span v-if="isDirty" class="editing-badge">编辑中</span>
            </div>
            <div class="project-meta">
              <div class="meta-item">
                <span class="meta-label">项目介绍：</span>
                <span class="meta-value">{{ project.description || project.remark || '暂无介绍' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">指导教师：</span>
                <div class="avatar-group">
                  <span class="avatar">{{ project.mentorName?.[0] || '教' }}</span>
                  <span class="name">{{ project.mentorName || '未指定' }}</span>
                </div>
              </div>
              <div class="meta-item">
                <span class="meta-label">参与人员：</span>
                <div class="avatar-group">
                  <span class="avatar">{{ project.createByName?.[0] || '学' }}</span>
                  <span class="name">{{ project.createByName || '创建者' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <!-- Save/Cancel when dirty -->
          <template v-if="isDirty">
            <button class="btn btn-secondary" @click="handleCancelAll">取消</button>
            <button class="btn btn-primary" @click="handleSaveAll" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </template>
          <!-- Preview button (always shown) -->
          <button class="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            预览
          </button>
        </div>
      </div>

      <!-- Main Tab Navigation -->
      <div class="main-tab-nav">
        <button
          v-for="tab in mainTabs"
          :key="tab.key"
          :class="['main-tab-btn', { active: activeMainTab === tab.key }]"
          @click="setMainTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Research Tab Content -->
      <div v-if="activeMainTab === 'research'" class="content-layout">
        <!-- Phase Sidebar -->
        <aside class="phase-sidebar">
          <h3 class="sidebar-title">项目阶段</h3>
          <div class="phase-list">
            <div
              v-for="phase in phases"
              :key="phase.key"
              :class="['phase-item', { active: activePhase === phase.key, completed: phases.findIndex(p => p.key === activePhase) > phases.indexOf(phase) }]"
              @click="activePhase = phase.key"
            >
              <div class="phase-icon">
                <svg v-if="phase.key === 'PROPOSAL'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                <svg v-else-if="phase.key === 'RESEARCH'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <span class="phase-label">{{ phase.label }}</span>
              <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            <!-- Section sub-items for active phase -->
            <template v-if="activePhase">
              <div
                v-for="section in currentSections"
                :key="section.key"
                class="section-nav-item"
                @click="toggleSection(section.key)"
              >
                <span class="section-bullet"></span>
                <span :class="['section-nav-label', { active: expandedSections[section.key] }]">
                  {{ section.label }}
                </span>
              </div>
            </template>
          </div>
        </aside>

        <!-- Section Content -->
        <main class="section-content">
          <div v-for="section in currentSections" :key="section.key" class="content-section">
            <div class="section-header" @click="toggleSection(section.key)">
              <div class="section-title">
                <svg v-if="section.icon === 'question'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <svg v-else-if="section.icon === 'steps'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <svg v-else-if="section.icon === 'target'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>{{ section.label }}</span>
              </div>
              <svg :class="['toggle-icon', { expanded: expandedSections[section.key] }]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            <div v-if="expandedSections[section.key]" class="section-body">
              <!-- Editable Sub-items with distinct icons and markdown editor -->
              <div v-for="subItem in section.subItems" :key="subItem.key" class="sub-item">
                <div class="sub-item-header">
                  <!-- Question icon -->
                  <svg v-if="subItem.icon === 'question'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <!-- Document icon -->
                  <svg v-else-if="subItem.icon === 'document'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <!-- Clipboard icon -->
                  <svg v-else-if="subItem.icon === 'clipboard'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>
                  <!-- List icon -->
                  <svg v-else-if="subItem.icon === 'list'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  <!-- Route icon -->
                  <svg v-else-if="subItem.icon === 'route'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="6" cy="19" r="3"/>
                    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
                    <circle cx="18" cy="5" r="3"/>
                  </svg>
                  <!-- Target icon -->
                  <svg v-else-if="subItem.icon === 'target'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2"/>
                  </svg>
                  <!-- Calendar icon -->
                  <svg v-else-if="subItem.icon === 'calendar'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <!-- Diagram icon -->
                  <svg v-else-if="subItem.icon === 'diagram'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <!-- Chart icon -->
                  <svg v-else-if="subItem.icon === 'chart'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  <!-- Upload icon -->
                  <svg v-else-if="subItem.icon === 'upload'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <!-- Review icon -->
                  <svg v-else-if="subItem.icon === 'review'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <!-- Default file icon -->
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>{{ subItem.label }}</span>
                </div>
                <div class="sub-item-editor">
                  <MarkdownSection
                    :id="`${section.key}-${subItem.key}`"
                    :model-value="subItemContentState[`${section.key}.${subItem.key}`] || ''"
                    @update:model-value="handleSubItemContentChange(section.key, subItem.key, $event)"
                    @blur="saveSubItemContent(section.key, subItem.key)"
                    :placeholder="`请输入${subItem.label}，支持 Markdown 格式...`"
                    :readonly="false"
                    hide-title
                  />
                </div>

                <!-- Comments for this sub-item -->
                <div v-if="getSectionContent(section.key, subItem.key)?.id" class="sub-item-comments">
                  <SectionComments
                    target-type="project_content"
                    :target-id="getSectionContent(section.key, subItem.key)?.id || 0"
                    :allow-reply="true"
                  />
                </div>
              </div>

              <!-- Attachments -->
              <div class="attachments-section">
                <div v-if="getSectionContent(section.key)?.attachments?.length" class="attachment-list">
                  <div v-for="att in getSectionContent(section.key)?.attachments ?? []" :key="att.ossId" class="attachment-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span>{{ att.fileName }}</span>
                  </div>
                </div>
                <label class="upload-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  选择文件
                  <input type="file" @change="handleFileUpload(section.key, $event)" hidden>
                </label>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="submit-section">
            <button class="btn btn-primary btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              提交项目
            </button>
          </div>
        </main>
      </div>

      <!-- Reflection Tab Content -->
      <ProjectReflectionTab v-if="activeMainTab === 'reflection'" :project-id="project.id" />

      <!-- Evaluation Tab Content -->
      <ProjectEvaluationTab v-if="activeMainTab === 'evaluation'" :project-id="project.id" />
      </template>
    </div>
  </PageContainer>
</template>

<style scoped>
.project-detail-page {
  /* PageContainer handles responsive centering */
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  color: #9ca3af;
}

/* Main Tab Navigation */
.main-tab-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0;
}

.main-tab-btn {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 15px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.main-tab-btn:hover {
  color: #3b82f6;
}

.main-tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
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

/* Project Header */
.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding: 20px;
  border-bottom: 1px solid var(--detail-header-border);
  border-radius: 8px;
  transition: background-color 0.2s, border-color 0.2s;
}

.project-header.editing {
  background: #eff6ff;
  border-bottom-color: #bfdbfe;
}

.header-title-area {
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.editing-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
}

.project-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.meta-label {
  color: #6b7280;
}

.meta-value {
  color: #374151;
}

.avatar-group {
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

.avatar.small {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

.avatar.blue {
  background: #60a5fa;
}

.name {
  color: #374151;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--detail-btn-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-outline {
  background: #fff;
  border: 1px solid var(--detail-btn-primary-bg);
  color: var(--detail-btn-primary-bg);
}

.btn-outline:hover {
  background: rgba(59, 130, 246, 0.05);
}

.btn-primary {
  background: var(--detail-btn-primary-bg);
  border: 1px solid var(--detail-btn-primary-bg);
  color: #fff;
}

.btn-primary:hover {
  background: var(--detail-btn-primary-hover);
}

.btn-secondary {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-secondary:disabled,
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-lg {
  padding: 12px 32px;
  font-size: 16px;
}

/* Content Layout */
.content-layout {
  display: flex;
  gap: 24px;
}

/* Phase Sidebar */
.phase-sidebar {
  width: 200px;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin: 0 0 16px 0;
}

.phase-list {
  display: flex;
  flex-direction: column;
}

.phase-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.phase-item:hover {
  background: #f3f4f6;
}

.phase-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.phase-item.completed .phase-icon {
  background: #22c55e;
}

.phase-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-item.active .phase-icon {
  background: #3b82f6;
}

.phase-label {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.expand-icon {
  color: #9ca3af;
}

.section-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 8px 56px;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
}

.section-nav-item:hover {
  color: #3b82f6;
}

.section-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d1d5db;
}

.section-nav-label.active {
  color: #3b82f6;
  font-weight: 500;
}

/* Section Content */
.section-content {
  flex: 1;
  min-width: 0;
}

.content-section {
  background: var(--detail-card-bg);
  border: 1px solid var(--detail-card-border);
  border-radius: var(--detail-card-radius);
  margin-bottom: 16px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f9fafb;
  cursor: pointer;
}

.section-header:hover {
  background: #f3f4f6;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 500;
  color: #374151;
}

.section-title svg {
  color: #3b82f6;
}

.toggle-icon {
  color: #9ca3af;
  transition: transform 0.2s;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.section-body {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.sub-item {
  margin-bottom: 12px;
}

.sub-item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.sub-item-header svg {
  color: #3b82f6;
  flex-shrink: 0;
}

.sub-item-editor {
  margin-bottom: 12px;
}

.sub-item-comments {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

/* Override MarkdownSection margins for project detail view */
.sub-item-editor :deep(.markdown-section) {
  margin-bottom: 0;
  margin-left: 0;
  margin-right: 0;
  padding: 0;
}

.sub-item-editor :deep(.md-editor-custom) {
  min-height: 120px;
}

/* Content Editor */
.content-editor {
  margin-bottom: 16px;
}

.content-editor textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
}

.content-editor textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Attachments */
.attachments-section {
  margin-bottom: 16px;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
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

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

/* Comments */
.comment-section {
  border-top: 1px solid #f3f4f6;
  padding-top: 12px;
}

.comment-input,
.comment-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.comment-input input,
.comment-placeholder input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 13px;
}

.comment-input input:focus,
.comment-placeholder input:focus {
  outline: none;
  border-color: #3b82f6;
}

.comment-actions {
  display: flex;
  gap: 12px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #9ca3af;
}

/* Submit Section */
.submit-section {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

@media (max-width: 768px) {
  .content-layout {
    flex-direction: column;
  }

  .phase-sidebar {
    width: 100%;
  }

  .project-header {
    flex-direction: column;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
