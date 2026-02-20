<script setup lang="ts">
/**
 * StandardsDisplay - Display of selected curriculum standards with optional edit mode
 *
 * Fetches and displays curriculum standards grouped by type (content/academic).
 * Watches for changes in ID arrays and refetches standards automatically.
 *
 * In read-only mode (default): Shows standards with click-to-edit empty state.
 * In editable mode: Shows count header, edit button, and remove buttons on tags.
 *
 * @example
 * <!-- Read-only mode -->
 * <StandardsDisplay :content-ids="contentIds" :academic-ids="academicIds" :subject="subject" :stage="stage" />
 *
 * @example
 * <!-- Editable mode -->
 * <StandardsDisplay :content-ids="contentIds" :academic-ids="academicIds" :subject="subject" :stage="stage" editable @edit="openModal" @remove="handleRemove" />
 */
import { ref, computed, watch, type PropType } from 'vue'
import { curriculumStandardApi } from '../../api/index'
import type { CurriculumStandard, CurriculumStandardQuery } from '@/types'

const props = defineProps({
  contentIds: { type: Array as PropType<number[]>, default: () => [] },
  academicIds: { type: Array as PropType<number[]>, default: () => [] },
  subject: { type: String, default: '' },
  /** Education stage (学段): 义务教育阶段第一学段, etc. */
  stage: { type: String, default: '' },
  /** Enable edit mode with remove buttons and edit header */
  editable: { type: Boolean, default: false }
})

const emit = defineEmits<{
  'click-empty': []
  'edit': []
  'remove': [payload: { id: number; type: 'content' | 'academic' }]
}>()

// State
const loading = ref(false)
const contentStandards = ref<CurriculumStandard[]>([])
const academicStandards = ref<CurriculumStandard[]>([])

const hasAny = computed(() =>
  contentStandards.value.length > 0 || academicStandards.value.length > 0
)

const totalCount = computed(() =>
  contentStandards.value.length + academicStandards.value.length
)

// Fetch standards by IDs
const fetchStandards = async () => {
  if (props.contentIds.length === 0 && props.academicIds.length === 0) {
    contentStandards.value = []
    academicStandards.value = []
    return
  }

  loading.value = true
  try {
    const params: CurriculumStandardQuery = { pageSize: 500 }
    if (props.subject) params.subject = props.subject
    if (props.stage) params.stage = props.stage

    const response = await curriculumStandardApi.getList(params)
    const data = response as { data?: { rows?: CurriculumStandard[] }; rows?: CurriculumStandard[] }
    const all = data.data?.rows || data.rows || []

    contentStandards.value = all.filter(s => props.contentIds.includes(s.id))
    academicStandards.value = all.filter(s => props.academicIds.includes(s.id))
  } catch (err) {
    console.error('Failed to fetch standards:', err)
  } finally {
    loading.value = false
  }
}

// Watch using JSON stringification to detect deep changes in arrays
// This is more reliable than deep: true for detecting array content changes
watch(
  () => JSON.stringify([props.contentIds, props.academicIds]),
  fetchStandards,
  { immediate: true }
)

const handleRemove = (id: number, type: 'content' | 'academic') => {
  emit('remove', { id, type })
}

const handleEmptyClick = () => {
  if (props.editable) {
    emit('edit')
  } else {
    emit('click-empty')
  }
}
</script>

<template>
  <div class="standards-display">
    <!-- Loading -->
    <div v-if="loading" class="loading">加载中...</div>

    <!-- Empty State -->
    <div
      v-else-if="!hasAny"
      class="empty-state"
      :class="{ 'empty-clickable': !editable, 'empty-editable': editable }"
      @click="handleEmptyClick"
    >
      <span class="empty-text">暂无选择的课程要求</span>
      <button v-if="editable" class="add-btn" @click.stop="emit('edit')">
        + 选择课程要求
      </button>
      <span v-else class="empty-hint">点击添加</span>
    </div>

    <!-- Standards Display -->
    <template v-else>
      <!-- Header with count and edit button (editable mode) -->
      <div v-if="editable" class="list-header">
        <span class="count-label">已选择 {{ totalCount }} 项</span>
        <button class="edit-btn" @click.stop="emit('edit')">修改</button>
      </div>

      <!-- Content Standards -->
      <div v-if="contentStandards.length > 0" class="standards-group">
        <div class="group-label">内容要求</div>
        <div class="tags-container">
          <span
            v-for="std in contentStandards"
            :key="std.id"
            class="standard-tag"
            :title="std.level1 ? `${std.level1}: ${std.level3 || std.title || std.content}` : (std.level3 || std.title || std.content)"
          >
            <span v-if="std.contentDomain" class="domain-badge">{{ std.contentDomain }}</span>
            {{ std.title || std.level3 || std.content || '无内容' }}
            <button
              v-if="editable"
              class="remove-btn"
              @click.stop="handleRemove(std.id, 'content')"
            >&times;</button>
          </span>
        </div>
      </div>

      <!-- Academic Standards -->
      <div v-if="academicStandards.length > 0" class="standards-group">
        <div class="group-label">学业要求</div>
        <div class="tags-container">
          <span
            v-for="std in academicStandards"
            :key="std.id"
            class="standard-tag"
            :title="std.level1 ? `${std.level1}: ${std.level3 || std.title || std.content}` : (std.level3 || std.title || std.content)"
          >
            <span v-if="std.contentDomain" class="domain-badge">{{ std.contentDomain }}</span>
            {{ std.title || std.level3 || std.content || '无内容' }}
            <button
              v-if="editable"
              class="remove-btn"
              @click.stop="handleRemove(std.id, 'academic')"
            >&times;</button>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.standards-display {
  width: 100%;
}

.loading {
  padding: 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  font-style: italic;
}

/* Empty State Styles */
.empty-state {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
}

.empty-text {
  color: #94a3b8;
  font-size: 14px;
}

.empty-hint {
  font-size: 12px;
  color: #cbd5e1;
  margin-left: 8px;
}

/* Read-only empty state - clickable */
.empty-clickable {
  flex-direction: column;
  gap: 4px;
  text-align: center;
  cursor: pointer;
  border: 1px dashed #e2e8f0;
  transition: all 0.2s;
}

.empty-clickable:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}

.empty-clickable:hover .empty-hint {
  color: #64748b;
}

/* Editable empty state */
.empty-editable {
  gap: 12px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

/* Add button (editable empty state) */
.add-btn {
  padding: 6px 12px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-btn:hover {
  background: #1d4ed8;
}

/* Header with count and edit button */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.count-label {
  font-size: 13px;
  color: #64748b;
}

.edit-btn {
  padding: 4px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #2563eb;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn:hover {
  background: #f8fafc;
  border-color: #2563eb;
}

/* Standards Groups */
.standards-group {
  margin-bottom: 16px;
}

.standards-group:last-child {
  margin-bottom: 0;
}

.group-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Standard Tags */
.standard-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #334155;
  cursor: default;
  transition: background 0.2s;
}

.standard-tag:hover {
  background: #e2e8f0;
}

.domain-badge {
  font-size: 10px;
  padding: 1px 4px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 3px;
  margin-right: 2px;
}

/* Remove button */
.remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin-left: 2px;
  border-radius: 50%;
  transition: all 0.2s;
}

.remove-btn:hover {
  background: #ef4444;
  color: white;
}
</style>
