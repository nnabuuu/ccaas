<script setup lang="ts">
/**
 * CourseRequirementsPanel - Collapsible panel for selecting curriculum standards (deprecated)
 *
 * DEPRECATED: Use CourseRequirementsEditor instead.
 * Provides expand/collapse behavior with tabbed interface for content and academic requirements.
 *
 * @example
 * <CourseRequirementsPanel :subject="subject" :grade-level="grade" v-model:content-ids="contentIds" />
 */
import { ref, computed, watch, type PropType } from 'vue'
import { curriculumStandardApi } from '../../api/index'
import type { CurriculumStandard } from '@/types'

const props = defineProps({
  subject: { type: String, required: true },
  /** Education stage (学段): 义务教育阶段第一学段, etc. */
  stage: { type: String, required: true },
  contentIds: { type: Array as PropType<number[]>, default: () => [] },
  academicIds: { type: Array as PropType<number[]>, default: () => [] }
})

const emit = defineEmits<{
  'update:contentIds': [value: number[]]
  'update:academicIds': [value: number[]]
}>()

// State
const expanded = ref(false)
const loading = ref(false)
const contentStandards = ref<CurriculumStandard[]>([])
const academicStandards = ref<CurriculumStandard[]>([])
const activeTab = ref<'content' | 'academic'>('content')

// Selected IDs (local copy for immediate UI feedback)
const selectedContentIds = ref<number[]>([...props.contentIds])
const selectedAcademicIds = ref<number[]>([...props.academicIds])

// Sync with props
watch(() => props.contentIds, (val) => { selectedContentIds.value = [...val] }, { deep: true })
watch(() => props.academicIds, (val) => { selectedAcademicIds.value = [...val] }, { deep: true })

// Fetch standards
const fetchStandards = async () => {
  loading.value = true
  try {
    const [contentRes, academicRes] = await Promise.all([
      curriculumStandardApi.getList({
        subject: props.subject,
        stage: props.stage,
        standardType: '内容要求',
        pageSize: 100
      }),
      curriculumStandardApi.getList({
        subject: props.subject,
        stage: props.stage,
        standardType: '学业要求',
        pageSize: 100
      })
    ])
    contentStandards.value = contentRes.rows || []
    academicStandards.value = academicRes.rows || []
  } catch (error) {
    console.error('Failed to fetch standards:', error)
  } finally {
    loading.value = false
  }
}

// Refetch when subject or stage changes
watch([() => props.subject, () => props.stage], () => {
  if (expanded.value) {
    fetchStandards()
  }
})

// Toggle expand/collapse
const toggleExpanded = () => {
  expanded.value = !expanded.value
  if (expanded.value && contentStandards.value.length === 0) {
    fetchStandards()
  }
}

// Toggle selection
const toggleContent = (id: number) => {
  const idx = selectedContentIds.value.indexOf(id)
  if (idx === -1) {
    selectedContentIds.value.push(id)
  } else {
    selectedContentIds.value.splice(idx, 1)
  }
  emit('update:contentIds', [...selectedContentIds.value])
}

const toggleAcademic = (id: number) => {
  const idx = selectedAcademicIds.value.indexOf(id)
  if (idx === -1) {
    selectedAcademicIds.value.push(id)
  } else {
    selectedAcademicIds.value.splice(idx, 1)
  }
  emit('update:academicIds', [...selectedAcademicIds.value])
}

// Computed
const selectedCount = computed(() =>
  selectedContentIds.value.length + selectedAcademicIds.value.length
)

const selectedContentStandards = computed(() =>
  contentStandards.value.filter(s => selectedContentIds.value.includes(s.id))
)

const selectedAcademicStandards = computed(() =>
  academicStandards.value.filter(s => selectedAcademicIds.value.includes(s.id))
)

// Group standards by subcategory
const groupBySubcategory = (standards: CurriculumStandard[]): Record<string, CurriculumStandard[]> => {
  const groups: Record<string, CurriculumStandard[]> = {}
  standards.forEach(s => {
    const key = s.subcategory || '其他'
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

const contentGroups = computed(() => groupBySubcategory(contentStandards.value))
const academicGroups = computed(() => groupBySubcategory(academicStandards.value))
</script>

<template>
  <div class="course-requirements-panel">
    <!-- Collapsed View: Show selected items as tags -->
    <div class="collapsed-view" @click="toggleExpanded">
      <div class="collapsed-header">
        <span class="collapsed-label">
          <template v-if="selectedCount > 0">
            已选择 {{ selectedCount }} 项课程要求
          </template>
          <template v-else>
            点击选择课程要求
          </template>
        </span>
        <span class="expand-icon" :class="{ expanded }">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </div>

      <!-- Selected tags preview (when collapsed) -->
      <div v-if="!expanded && selectedCount > 0" class="selected-preview" @click.stop>
        <div v-if="selectedContentStandards.length > 0" class="preview-group">
          <span class="preview-label">内容:</span>
          <span v-for="s in selectedContentStandards.slice(0, 3)" :key="s.id" class="preview-tag">
            {{ s.title }}
          </span>
          <span v-if="selectedContentStandards.length > 3" class="preview-more">
            +{{ selectedContentStandards.length - 3 }}
          </span>
        </div>
        <div v-if="selectedAcademicStandards.length > 0" class="preview-group">
          <span class="preview-label">学业:</span>
          <span v-for="s in selectedAcademicStandards.slice(0, 3)" :key="s.id" class="preview-tag">
            {{ s.title }}
          </span>
          <span v-if="selectedAcademicStandards.length > 3" class="preview-more">
            +{{ selectedAcademicStandards.length - 3 }}
          </span>
        </div>
      </div>
    </div>

    <!-- Expanded View: Selection Panel -->
    <div v-if="expanded" class="expanded-view">
      <!-- Tabs -->
      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'content' }]"
          @click="activeTab = 'content'"
        >
          内容要求
          <span v-if="selectedContentIds.length" class="tab-count">{{ selectedContentIds.length }}</span>
        </button>
        <button
          :class="['tab', { active: activeTab === 'academic' }]"
          @click="activeTab = 'academic'"
        >
          学业要求
          <span v-if="selectedAcademicIds.length" class="tab-count">{{ selectedAcademicIds.length }}</span>
        </button>
      </div>

      <!-- Content -->
      <div class="panel-content">
        <div v-if="loading" class="loading">加载中...</div>

        <!-- Content Standards -->
        <template v-else-if="activeTab === 'content'">
          <div v-if="contentStandards.length === 0" class="empty">
            暂无该学科和年级的内容要求
          </div>
          <div v-else class="standards-list">
            <div v-for="(items, group) in contentGroups" :key="group" class="standards-group">
              <div class="group-header">{{ group }}</div>
              <label
                v-for="item in items"
                :key="item.id"
                class="standard-item"
                :class="{ selected: selectedContentIds.includes(item.id) }"
              >
                <input
                  type="checkbox"
                  :checked="selectedContentIds.includes(item.id)"
                  @change="toggleContent(item.id)"
                />
                <div class="item-content">
                  <span class="item-title">{{ item.title }}</span>
                  <span class="item-desc">{{ item.description }}</span>
                </div>
              </label>
            </div>
          </div>
        </template>

        <!-- Academic Standards -->
        <template v-else>
          <div v-if="academicStandards.length === 0" class="empty">
            暂无该学科和年级的学业要求
          </div>
          <div v-else class="standards-list">
            <div v-for="(items, group) in academicGroups" :key="group" class="standards-group">
              <div class="group-header">{{ group }}</div>
              <label
                v-for="item in items"
                :key="item.id"
                class="standard-item"
                :class="{ selected: selectedAcademicIds.includes(item.id) }"
              >
                <input
                  type="checkbox"
                  :checked="selectedAcademicIds.includes(item.id)"
                  @change="toggleAcademic(item.id)"
                />
                <div class="item-content">
                  <span class="item-title">{{ item.title }}</span>
                  <span class="item-desc">{{ item.description }}</span>
                </div>
              </label>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="panel-footer">
        <span class="selection-info">
          已选择 {{ selectedCount }} 项
        </span>
        <button class="done-btn" @click="expanded = false">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.course-requirements-panel {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: white;
}

.collapsed-view {
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.collapsed-view:hover {
  background: #f8fafc;
}

.collapsed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.collapsed-label {
  font-size: 14px;
  color: #64748b;
}

.expand-icon {
  color: #94a3b8;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.selected-preview {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.preview-label {
  font-size: 12px;
  color: #94a3b8;
  min-width: 36px;
}

.preview-tag {
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 12px;
  color: #334155;
}

.preview-more {
  font-size: 12px;
  color: #64748b;
}

/* Expanded View */
.expanded-view {
  border-top: 1px solid #e2e8f0;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.tab {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.tab:hover {
  color: #334155;
}

.tab.active {
  color: #2563eb;
  background: white;
  box-shadow: inset 0 -2px 0 #2563eb;
}

.tab-count {
  padding: 2px 8px;
  background: #2563eb;
  color: white;
  border-radius: 10px;
  font-size: 12px;
}

.tab:not(.active) .tab-count {
  background: #cbd5e1;
  color: #64748b;
}

.panel-content {
  max-height: 300px;
  overflow-y: auto;
  padding: 16px;
}

.loading, .empty {
  padding: 32px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.standards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.standards-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-header {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f1f5f9;
}

.standard-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.standard-item:hover {
  background: #f8fafc;
}

.standard-item.selected {
  background: #eff6ff;
}

.standard-item input[type="checkbox"] {
  margin-top: 2px;
  width: 18px;
  height: 18px;
  accent-color: #2563eb;
  cursor: pointer;
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
}

.item-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.4;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.selection-info {
  font-size: 13px;
  color: #64748b;
}

.done-btn {
  padding: 8px 20px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.done-btn:hover {
  background: #1d4ed8;
}
</style>
