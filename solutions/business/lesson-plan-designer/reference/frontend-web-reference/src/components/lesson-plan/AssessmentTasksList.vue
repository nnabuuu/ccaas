<script setup lang="ts">
/**
 * AssessmentTasksList - List editor for assessment tasks linked to sub-tasks
 *
 * Manages formative/diagnostic/summative assessments with methods and criteria.
 * Supports linking to parent task's sub-tasks for granular evaluation tracking.
 *
 * @example
 * <AssessmentTasksList v-model="assessments" :available-sub-tasks="subTasks" :readonly="false" />
 */
import { computed, type PropType } from 'vue'
import type { AssessmentTask, SubTask } from '@/types'

const props = defineProps({
  modelValue: { type: Array as PropType<AssessmentTask[]>, default: () => [] },
  availableSubTasks: { type: Array as PropType<SubTask[]>, default: () => [] },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits<{
  'update:modelValue': [value: AssessmentTask[]]
}>()

const assessments = computed({
  get: () => props.modelValue || [],
  set: (val: AssessmentTask[]) => emit('update:modelValue', val)
})

const assessmentTypes = [
  { value: 'formative' as const, label: '形成性评价', color: '#10b981' },
  { value: 'diagnostic' as const, label: '诊断性评价', color: '#f59e0b' },
  { value: 'summative' as const, label: '总结性评价', color: '#6366f1' }
]

const assessmentMethods = [
  { value: 'observation' as const, label: '观察' },
  { value: 'questioning' as const, label: '问答' },
  { value: 'product' as const, label: '作品' },
  { value: 'test' as const, label: '测验' }
]

const addAssessment = () => {
  assessments.value = [...assessments.value, {
    id: Date.now(),
    type: 'formative',
    method: 'observation',
    criteria: '',
    linkedSubTaskId: null
  }]
}

const removeAssessment = (id: number) => {
  assessments.value = assessments.value.filter(a => a.id !== id)
}

const updateAssessment = (id: number, field: keyof AssessmentTask, value: unknown) => {
  assessments.value = assessments.value.map(a =>
    a.id === id ? { ...a, [field]: value } : a
  )
}

const getTypeInfo = (type: string) => {
  return assessmentTypes.find(t => t.value === type) || assessmentTypes[0]
}

const getMethodLabel = (method: string): string => {
  return assessmentMethods.find(m => m.value === method)?.label || method
}

const getSubTaskName = (subTaskId: number | null): string | null => {
  if (!subTaskId) return null
  const task = props.availableSubTasks.find(t => t.id === subTaskId)
  return task?.name || `子任务 ${subTaskId}`
}
</script>

<template>
  <div class="assessments-list">
    <div class="assessments-header">
      <span class="assessments-title">评价任务</span>
      <span class="assessments-count">{{ assessments.length }} 项</span>
    </div>

    <div v-if="assessments.length > 0" class="assessments-items">
      <div
        v-for="assessment in assessments"
        :key="assessment.id"
        class="assessment-item"
      >
        <div class="assessment-header">
          <span
            class="type-badge"
            :style="{ backgroundColor: getTypeInfo(assessment.type).color + '20', color: getTypeInfo(assessment.type).color }"
          >
            {{ getTypeInfo(assessment.type).label }}
          </span>
          <span class="method-badge">{{ getMethodLabel(assessment.method) }}</span>
          <span v-if="getSubTaskName(assessment.linkedSubTaskId)" class="linked-subtask">
            → {{ getSubTaskName(assessment.linkedSubTaskId) }}
          </span>
          <button
            v-if="!readonly"
            class="btn-remove"
            @click="removeAssessment(assessment.id)"
          >×</button>
        </div>

        <div class="assessment-content">
          <template v-if="!readonly">
            <div class="assessment-selectors">
              <select
                :value="assessment.type"
                @change="updateAssessment(assessment.id, 'type', ($event.target as HTMLSelectElement).value)"
                class="type-select"
              >
                <option v-for="t in assessmentTypes" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>

              <select
                :value="assessment.method"
                @change="updateAssessment(assessment.id, 'method', ($event.target as HTMLSelectElement).value)"
                class="method-select"
              >
                <option v-for="m in assessmentMethods" :key="m.value" :value="m.value">
                  {{ m.label }}
                </option>
              </select>

              <select
                :value="assessment.linkedSubTaskId || ''"
                @change="updateAssessment(assessment.id, 'linkedSubTaskId', ($event.target as HTMLSelectElement).value ? parseInt(($event.target as HTMLSelectElement).value) : null)"
                class="subtask-select"
              >
                <option value="">不关联子任务</option>
                <option
                  v-for="(task, index) in availableSubTasks"
                  :key="task.id"
                  :value="task.id"
                >
                  子任务{{ index + 1 }}: {{ task.name || '未命名' }}
                </option>
              </select>
            </div>

            <textarea
              :value="assessment.criteria"
              @input="updateAssessment(assessment.id, 'criteria', ($event.target as HTMLTextAreaElement).value)"
              placeholder="评价标准/量规（支持 Markdown 格式）"
              rows="3"
              class="criteria-input"
            />
          </template>
          <template v-else>
            <div v-if="assessment.criteria" class="criteria-text">
              {{ assessment.criteria }}
            </div>
            <div v-else class="no-criteria">暂无评价标准</div>
          </template>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      暂无评价任务
    </div>

    <button v-if="!readonly" class="btn-add-assessment" @click="addAssessment">
      + 添加评价任务
    </button>
  </div>
</template>

<style scoped>
.assessments-list {
  background: #fefce8;
  border-radius: 8px;
  padding: 12px;
}

.assessments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.assessments-title {
  font-size: 13px;
  font-weight: 600;
  color: #a16207;
}

.assessments-count {
  font-size: 12px;
  color: #ca8a04;
}

.assessments-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assessment-item {
  background: white;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 12px;
}

.assessment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.type-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.method-badge {
  padding: 2px 8px;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 12px;
  font-size: 11px;
}

.linked-subtask {
  font-size: 11px;
  color: #64748b;
  margin-left: auto;
}

.btn-remove {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  margin-left: auto;
}

.btn-remove:hover {
  color: #ef4444;
}

.assessment-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assessment-selectors {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.type-select,
.method-select,
.subtask-select {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  background: white;
}

.type-select:focus,
.method-select:focus,
.subtask-select:focus {
  outline: none;
  border-color: #f59e0b;
}

.subtask-select {
  flex: 1;
  min-width: 150px;
}

.criteria-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.criteria-input:focus {
  outline: none;
  border-color: #f59e0b;
}

.criteria-text {
  font-size: 13px;
  color: #334155;
  line-height: 1.6;
  white-space: pre-wrap;
}

.no-criteria {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}

.empty-state {
  text-align: center;
  padding: 16px;
  color: #ca8a04;
  font-size: 13px;
}

.btn-add-assessment {
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  background: none;
  border: 1px dashed #fde68a;
  border-radius: 6px;
  color: #a16207;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-assessment:hover {
  border-color: #f59e0b;
  color: #d97706;
}
</style>
