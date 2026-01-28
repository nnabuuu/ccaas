<script setup lang="ts">
/**
 * StandardsSelectionModal - Full-screen modal for selecting curriculum standards
 *
 * Tabbed interface for selecting content and academic requirements using accordion groups.
 * Features local state management with confirm/cancel actions and selection summary.
 * Uses stage-based filtering (学段) instead of grade-level filtering.
 *
 * @example
 * <StandardsSelectionModal v-model:visible="modalVisible" :subject="subject" :stage="stage" @confirm="handleConfirm" />
 */
import { ref, computed, watch, type PropType } from 'vue'
import { curriculumStandardApi } from '../../api/index'
import { BaseModal } from '../layout'
import StandardsAccordion from './StandardsAccordion.vue'
import type { CurriculumStandard, CurriculumStandardTreeByStageQuery, CurriculumStandardTreeNode } from '@/types'

const props = defineProps({
  visible: { type: Boolean, default: false },
  subject: { type: String, default: '' },
  /** Education stage (学段): 义务教育阶段第一学段, 义务教育阶段第二学段, etc. */
  stage: { type: String, default: '' },
  contentIds: { type: Array as PropType<number[]>, default: () => [] },
  academicIds: { type: Array as PropType<number[]>, default: () => [] }
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'confirm': [payload: { contentIds: number[]; academicIds: number[] }]
}>()

// Local state for selections (copy of props, confirmed on save)
const localContentIds = ref<number[]>([...props.contentIds])
const localAcademicIds = ref<number[]>([...props.academicIds])

// Tab and loading state
const activeTab = ref('content')
const loading = ref(false)
const contentStandards = ref<CurriculumStandard[]>([])
const academicStandards = ref<CurriculumStandard[]>([])
const expandedGroups = ref<{ content: Record<string, boolean>; academic: Record<string, boolean> }>({ content: {}, academic: {} })

// Sync local state when props change
watch(() => props.contentIds, (val) => { localContentIds.value = [...val] }, { deep: true })
watch(() => props.academicIds, (val) => { localAcademicIds.value = [...val] }, { deep: true })

/**
 * Flatten tree nodes to extract all leaf standards, preserving hierarchy metadata.
 * The tree structure is: ContentDomain → Level1 → Level2 → Standards
 * We preserve contentDomain and level1 on each extracted standard for context display.
 */
const flattenTreeToStandards = (nodes: CurriculumStandardTreeNode[]): CurriculumStandard[] => {
  const result: CurriculumStandard[] = []

  const processNode = (
    node: CurriculumStandardTreeNode,
    inheritedContentDomain?: string,
    inheritedLevel1?: string
  ) => {
    // Determine the current hierarchy level based on node properties
    const currentContentDomain = node.contentDomain || inheritedContentDomain
    const currentLevel1 = node.level1 || inheritedLevel1

    if (node.isLeaf && node.id > 0) {
      // Preserve hierarchy metadata on the extracted standard
      const standardWithContext: CurriculumStandard = {
        ...node,
        contentDomain: currentContentDomain,
        level1: currentLevel1
      }
      result.push(standardWithContext)
    }
    if (node.children) {
      node.children.forEach(child => processNode(child, currentContentDomain, currentLevel1))
    }
  }

  nodes.forEach(node => processNode(node))
  return result
}

// Fetch standards when modal opens or subject/stage changes
const fetchStandards = async () => {
  loading.value = true
  try {
    const contentParams: CurriculumStandardTreeByStageQuery = {
      subject: props.subject || undefined,
      stage: props.stage || undefined,
      standardType: '内容要求'
    }
    const academicParams: CurriculumStandardTreeByStageQuery = {
      subject: props.subject || undefined,
      stage: props.stage || undefined,
      standardType: '学业要求'
    }

    const [contentRes, academicRes] = await Promise.all([
      curriculumStandardApi.getTreeByStage(contentParams),
      curriculumStandardApi.getTreeByStage(academicParams)
    ])

    // Flatten tree structure to get leaf standards for selection
    contentStandards.value = flattenTreeToStandards(contentRes.data || [])
    academicStandards.value = flattenTreeToStandards(academicRes.data || [])

    initializeExpandedGroups()
  } catch (error) {
    console.error('Failed to fetch standards:', error)
  } finally {
    loading.value = false
  }
}

// Fetch standards when modal opens or subject/stage changes
watch([() => props.visible, () => props.subject, () => props.stage], async ([visible]) => {
  if (visible) {
    await fetchStandards()
  }
}, { immediate: true })

const initializeExpandedGroups = () => {
  // Reset expanded groups
  expandedGroups.value = { content: {}, academic: {} }

  // For content standards: expand groups containing selected items, or first group if none selected
  if (contentStandards.value.length > 0) {
    const selectedContentDomains = new Set(
      contentStandards.value
        .filter(s => localContentIds.value.includes(s.id))
        .map(s => s.contentDomain || s.subcategory || '其他')
    )

    if (selectedContentDomains.size > 0) {
      // Expand all groups that contain selected standards
      selectedContentDomains.forEach(domain => {
        expandedGroups.value.content[domain] = true
      })
    } else {
      // No selections - expand first group
      const first = contentStandards.value[0]?.contentDomain || contentStandards.value[0]?.subcategory || '其他'
      expandedGroups.value.content[first] = true
    }
  }

  // For academic standards: expand groups containing selected items, or first group if none selected
  if (academicStandards.value.length > 0) {
    const selectedAcademicDomains = new Set(
      academicStandards.value
        .filter(s => localAcademicIds.value.includes(s.id))
        .map(s => s.contentDomain || s.subcategory || '其他')
    )

    if (selectedAcademicDomains.size > 0) {
      // Expand all groups that contain selected standards
      selectedAcademicDomains.forEach(domain => {
        expandedGroups.value.academic[domain] = true
      })
    } else {
      // No selections - expand first group
      const first = academicStandards.value[0]?.contentDomain || academicStandards.value[0]?.subcategory || '其他'
      expandedGroups.value.academic[first] = true
    }
  }
}

// Accordion handlers
const handleToggleGroup = (groupName: string, type: 'content' | 'academic') => {
  expandedGroups.value[type][groupName] = !expandedGroups.value[type][groupName]
}

const handleToggleStandard = (id: number, type: 'content' | 'academic') => {
  const ids = type === 'content' ? localContentIds : localAcademicIds
  const index = ids.value.indexOf(id)
  if (index === -1) {
    ids.value.push(id)
  } else {
    ids.value.splice(index, 1)
  }
}

const handleToggleSelectAll = (groupName: string, type: 'content' | 'academic') => {
  const standards = type === 'content' ? contentStandards.value : academicStandards.value
  const ids = type === 'content' ? localContentIds : localAcademicIds
  const groupStandards = standards.filter(s => (s.subcategory || '其他') === groupName)
  const groupIds = groupStandards.map(s => s.id)
  const allSelected = groupIds.every(id => ids.value.includes(id))

  if (allSelected) {
    ids.value = ids.value.filter(id => !groupIds.includes(id))
  } else {
    ids.value = [...new Set([...ids.value, ...groupIds])]
  }
}

// Modal actions
const handleClose = () => {
  emit('update:visible', false)
}

const handleConfirm = () => {
  emit('confirm', {
    contentIds: [...localContentIds.value],
    academicIds: [...localAcademicIds.value]
  })
  emit('update:visible', false)
}

const handleReset = () => {
  localContentIds.value = []
  localAcademicIds.value = []
}

// Selection counts
const contentCount = computed(() => localContentIds.value.length)
const academicCount = computed(() => localAcademicIds.value.length)
const totalCount = computed(() => contentCount.value + academicCount.value)
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="standards-modal-overlay" @click.self="handleClose">
      <div class="standards-modal-container">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">选择课程要求</h2>
          <span class="modal-subtitle">{{ subject || '未设置学科' }} · {{ stage || '未设置学段' }}</span>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <!-- Tabs -->
        <div class="modal-tabs">
          <button
            :class="['tab-btn', { active: activeTab === 'content' }]"
            @click="activeTab = 'content'"
          >
            内容要求
            <span v-if="contentCount" class="tab-badge">{{ contentCount }}</span>
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'academic' }]"
            @click="activeTab = 'academic'"
          >
            学业要求
            <span v-if="academicCount" class="tab-badge">{{ academicCount }}</span>
          </button>
        </div>

        <!-- Content -->
        <div class="modal-body">
          <div v-if="loading" class="loading">加载中...</div>

          <StandardsAccordion
            v-else-if="activeTab === 'content'"
            :standards="contentStandards"
            :selected-ids="localContentIds"
            :expanded-groups="expandedGroups.content"
            empty-message="暂无该学科和年级的内容要求"
            @toggle-group="(g) => handleToggleGroup(g, 'content')"
            @toggle-standard="(id) => handleToggleStandard(id, 'content')"
            @toggle-select-all="(g) => handleToggleSelectAll(g, 'content')"
          />

          <StandardsAccordion
            v-else
            :standards="academicStandards"
            :selected-ids="localAcademicIds"
            :expanded-groups="expandedGroups.academic"
            empty-message="暂无该学科和年级的学业要求"
            @toggle-group="(g) => handleToggleGroup(g, 'academic')"
            @toggle-standard="(id) => handleToggleStandard(id, 'academic')"
            @toggle-select-all="(g) => handleToggleSelectAll(g, 'academic')"
          />
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div class="selection-summary">
            已选择 <strong>{{ totalCount }}</strong> 项
            <span v-if="totalCount > 0">(内容要求 {{ contentCount }}, 学业要求 {{ academicCount }})</span>
          </div>
          <div class="footer-actions">
            <button class="btn-text" @click="handleReset">清空选择</button>
            <button class="btn-secondary" @click="handleClose">取消</button>
            <button class="btn-primary" @click="handleConfirm">确认选择</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.standards-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex !important;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  visibility: visible !important;
  opacity: 1 !important;
}

.standards-modal-container {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  visibility: visible !important;
  opacity: 1 !important;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.modal-subtitle {
  font-size: 14px;
  color: #64748b;
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #0f172a;
}

.modal-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.tab-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #f8fafc;
}

.tab-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.tab-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.tab-btn:not(.active) .tab-badge {
  background: #e2e8f0;
  color: #64748b;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  min-height: 300px;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #9ca3af;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.selection-summary {
  font-size: 14px;
  color: #64748b;
}

.selection-summary strong {
  color: #2563eb;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn-text {
  background: none;
  border: none;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
}

.btn-text:hover {
  color: #ef4444;
}

.btn-primary {
  padding: 10px 20px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  padding: 10px 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #334155;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #f8fafc;
}
</style>
