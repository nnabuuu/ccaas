<script setup lang="ts">
/**
 * LessonPlanSelector - Searchable lesson plan selector with radio-style selection
 *
 * @example
 * <LessonPlanSelector v-model="selectedPlanId" subject="数学" :gradeLevel="3" @select="handlePlanSelect" />
 */
import { ref, watch, onMounted } from 'vue'
import { lessonPlanApi } from '../api/index'
import type { LessonPlan, LessonPlanQuery } from '@/types'

const props = defineProps({
  modelValue: { type: Number, default: null },
  subject: { type: String, default: '' },
  gradeLevel: { type: Number, default: null }
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  'select': [plan: LessonPlan]
}>()

const searchQuery = ref('')
const lessonPlans = ref<LessonPlan[]>([])
const loading = ref(false)
const selectedId = ref<number | null>(props.modelValue)
const showAllSubjects = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

const fetchLessonPlans = async () => {
  loading.value = true
  try {
    const params: LessonPlanQuery = { pageNum: 1, pageSize: 20 }
    if (searchQuery.value) params.title = searchQuery.value
    // Only filter by subject if showAllSubjects is false and subject is provided
    if (!showAllSubjects.value && props.subject) params.subject = props.subject
    if (props.gradeLevel) params.gradeLevel = props.gradeLevel

    const response = await lessonPlanApi.getList(params)
    const data = response as { data?: { rows?: LessonPlan[] }; rows?: LessonPlan[] }
    lessonPlans.value = data.data?.rows || data.rows || []
  } catch (error) {
    console.error('Failed to fetch lesson plans:', error)
    lessonPlans.value = []
  } finally {
    loading.value = false
  }
}

const toggleShowAllSubjects = () => {
  showAllSubjects.value = !showAllSubjects.value
  fetchLessonPlans()
}

const handleSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(fetchLessonPlans, 300)
}

const selectPlan = (plan: LessonPlan) => {
  selectedId.value = plan.id
  emit('update:modelValue', plan.id)
  emit('select', plan)
}

const getGradeLabel = (level: number) => {
  const labels = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  return level <= 9 ? `${labels[level]}年级` : `${level}年级`
}

const truncate = (text: string | undefined, len = 80) => {
  if (!text) return ''
  return text.length > len ? text.slice(0, len) + '...' : text
}

watch(() => props.modelValue, (val) => { selectedId.value = val })
watch(() => props.subject, fetchLessonPlans)
watch(() => props.gradeLevel, fetchLessonPlans)

onMounted(fetchLessonPlans)
</script>

<template>
  <div class="lesson-plan-selector">
    <!-- Filter controls -->
    <div class="filter-controls">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索教案..."
          class="search-input"
          @input="handleSearch"
        />
      </div>
      <label v-if="subject" class="subject-toggle">
        <input type="checkbox" v-model="showAllSubjects" @change="fetchLessonPlans" />
        <span class="toggle-label">显示所有学科</span>
      </label>
    </div>

    <!-- Current filter hint -->
    <div v-if="subject && !showAllSubjects" class="filter-hint">
      当前仅显示「{{ subject }}」学科的教案
    </div>

    <div v-if="loading" class="loading-state">加载中...</div>

    <div v-else-if="lessonPlans.length === 0" class="empty-state">
      <p>未找到匹配的教案</p>
      <p class="hint">尝试修改搜索条件或先创建教案</p>
    </div>

    <div v-else class="plan-list">
      <div
        v-for="plan in lessonPlans"
        :key="plan.id"
        :class="['plan-item', { selected: selectedId === plan.id }]"
        @click="selectPlan(plan)"
      >
        <div class="plan-radio">
          <span :class="['radio-dot', { active: selectedId === plan.id }]"></span>
        </div>
        <div class="plan-content">
          <div class="plan-header">
            <span class="plan-title">{{ plan.title }}</span>
            <span class="plan-meta">{{ plan.subject }} · {{ getGradeLabel(plan.gradeLevel) }}</span>
          </div>
          <div v-if="plan.objectives" class="plan-objectives">
            {{ truncate(plan.objectives) }}
          </div>
        </div>
        <span v-if="selectedId === plan.id" class="selected-badge">已选择</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lesson-plan-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  position: relative;
  flex: 1;
}

.subject-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  color: #6b7280;
}

.subject-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.toggle-label {
  user-select: none;
}

.filter-hint {
  font-size: 12px;
  color: #9ca3af;
  padding: 6px 10px;
  background: #f9fafb;
  border-radius: 6px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.loading-state, .empty-state {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

.empty-state .hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.plan-list {
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.plan-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.15s;
}

.plan-item:last-child {
  border-bottom: none;
}

.plan-item:hover {
  background: #f9fafb;
}

.plan-item.selected {
  background: #eff6ff;
}

.plan-radio {
  padding-top: 2px;
}

.radio-dot {
  display: block;
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-radius: 50%;
  transition: all 0.15s;
}

.radio-dot.active {
  border-color: #3b82f6;
  background: #3b82f6;
  box-shadow: inset 0 0 0 3px white;
}

.plan-content {
  flex: 1;
  min-width: 0;
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-title {
  font-weight: 500;
  color: #1f2937;
}

.plan-meta {
  font-size: 12px;
  color: #6b7280;
}

.plan-objectives {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1.4;
}

.selected-badge {
  font-size: 12px;
  color: #3b82f6;
  white-space: nowrap;
}
</style>
