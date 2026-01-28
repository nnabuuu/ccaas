<script setup lang="ts">
/**
 * StandardsAccordion - Accordion component for hierarchical curriculum standards display
 *
 * Groups standards by subcategory with expand/collapse functionality.
 * Supports checkbox selection and "select all" per group.
 *
 * @example
 * <StandardsAccordion :standards="standards" :selected-ids="selectedIds" :expanded-groups="groups" @toggle-standard="handleToggle" />
 */
import { computed, type PropType } from 'vue'
import type { CurriculumStandard } from '@/types'

const props = defineProps({
  standards: { type: Array as PropType<CurriculumStandard[]>, required: true },
  selectedIds: { type: Array as PropType<number[]>, required: true },
  expandedGroups: { type: Object as PropType<Record<string, boolean>>, required: true },
  emptyMessage: { type: String, default: '暂无数据' }
})

const emit = defineEmits<{
  'toggle-group': [groupName: string]
  'toggle-standard': [id: number]
  'toggle-select-all': [groupName: string]
}>()

// Predefined order for content domains (from math curriculum)
const CONTENT_DOMAIN_ORDER = ['数与代数', '图形与几何', '统计与概率', '综合与实践']

// Group standards by contentDomain (primary hierarchy from new schema)
const groupedStandards = computed(() => {
  const groups: Record<string, CurriculumStandard[]> = {}
  for (const std of props.standards) {
    const key = std.contentDomain || std.subcategory || '其他'
    if (!groups[key]) groups[key] = []
    groups[key].push(std)
  }
  return groups
})

// Sort groups by predefined order, then alphabetically for unknown domains
const groupNames = computed(() => {
  const names = Object.keys(groupedStandards.value)
  return names.sort((a, b) => {
    const indexA = CONTENT_DOMAIN_ORDER.indexOf(a)
    const indexB = CONTENT_DOMAIN_ORDER.indexOf(b)
    // Known domains come first in defined order
    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    // Unknown domains sorted alphabetically
    return a.localeCompare(b)
  })
})

const isExpanded = (groupName: string) => props.expandedGroups[groupName] === true

const isSelected = (id: number) => props.selectedIds.includes(id)

const getSelectionCount = (groupName: string) => {
  const standards = groupedStandards.value[groupName] || []
  const selected = standards.filter(s => props.selectedIds.includes(s.id)).length
  return { selected, total: standards.length }
}

const isAllSelected = (groupName: string) => {
  const { selected, total } = getSelectionCount(groupName)
  return total > 0 && selected === total
}
</script>

<template>
  <div class="standards-accordion">
    <div v-if="groupNames.length === 0" class="standards-empty">
      {{ emptyMessage }}
    </div>

    <div v-for="groupName in groupNames" :key="groupName" class="accordion-group">
      <!-- Accordion Header -->
      <div class="accordion-header" @click="emit('toggle-group', groupName)">
        <span class="accordion-icon">{{ isExpanded(groupName) ? '▼' : '▶' }}</span>
        <span class="accordion-title">{{ groupName }}</span>
        <span class="accordion-count">
          {{ getSelectionCount(groupName).selected }}/{{ getSelectionCount(groupName).total }}
        </span>
        <button
          type="button"
          class="select-all-btn"
          @click.stop="emit('toggle-select-all', groupName)"
        >
          {{ isAllSelected(groupName) ? '取消全选' : '全选' }}
        </button>
      </div>

      <!-- Accordion Content -->
      <div v-show="isExpanded(groupName)" class="accordion-content">
        <label
          v-for="standard in groupedStandards[groupName]"
          :key="standard.id"
          class="standard-item"
          :class="{ selected: isSelected(standard.id) }"
        >
          <input
            type="checkbox"
            :checked="isSelected(standard.id)"
            @change="emit('toggle-standard', standard.id)"
          />
          <div class="standard-content">
            <div class="standard-header">
              <span class="standard-title">{{ standard.title }}</span>
              <span v-if="standard.level1" class="standard-context-badge">{{ standard.level1 }}</span>
            </div>
            <div class="standard-desc">{{ standard.description }}</div>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.standards-accordion {
  max-height: 500px;
  overflow-y: auto;
}

.standards-empty {
  padding: 24px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

.accordion-group {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
}

.accordion-group:last-child {
  margin-bottom: 0;
}

.accordion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.accordion-header:hover {
  background: #f1f5f9;
}

.accordion-icon {
  font-size: 10px;
  color: #64748b;
  width: 12px;
}

.accordion-title {
  flex: 1;
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.accordion-count {
  font-size: 13px;
  color: #64748b;
  padding: 2px 8px;
  background: #e2e8f0;
  border-radius: 10px;
}

.select-all-btn {
  padding: 4px 12px;
  font-size: 12px;
  color: #2563eb;
  background: white;
  border: 1px solid #2563eb;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.select-all-btn:hover {
  background: #2563eb;
  color: white;
}

.accordion-content {
  padding: 8px;
  background: white;
  border-top: 1px solid #e2e8f0;
}

.standard-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.standard-item:last-child {
  margin-bottom: 0;
}

.standard-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.standard-item.selected {
  background: rgba(37, 99, 235, 0.05);
  border-color: #2563eb;
}

.standard-item input[type="checkbox"] {
  margin-top: 4px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.standard-content {
  flex: 1;
  min-width: 0;
}

.standard-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.standard-title {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.standard-context-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 4px;
  white-space: nowrap;
}

.standard-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}
</style>
