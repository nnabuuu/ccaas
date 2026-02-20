<script setup lang="ts">
/**
 * LearningTasksEditor - Editor for learning process tasks with summary statistics
 *
 * Manages a list of learning tasks with add/remove/reorder capabilities.
 * Displays summary bar with task count, sub-tasks, assessments, and total duration.
 *
 * @example
 * <LearningTasksEditor v-model="tasks" :available-requirements="requirements" :readonly="false" />
 */
import { computed, type PropType } from 'vue'
import LearningTaskCard from './LearningTaskCard.vue'
import type { LearningTask, CourseRequirement, SubTask } from '@/types'

const props = defineProps({
  modelValue: { type: Array as PropType<LearningTask[]>, default: () => [] },
  availableRequirements: { type: Array as PropType<CourseRequirement[]>, default: () => [] },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits<{
  'update:modelValue': [value: LearningTask[]]
}>()

const tasks = computed({
  get: () => props.modelValue || [],
  set: (val: LearningTask[]) => emit('update:modelValue', val)
})

const addTask = () => {
  const newTask: LearningTask = {
    id: Date.now(),
    name: '',
    description: '',
    duration: 10,
    type: 'individual',
    linkedRequirements: [],
    subTasks: [],
    assessmentTasks: []
  }
  tasks.value = [...tasks.value, newTask]
}

const updateTask = (index: number, updatedTask: LearningTask) => {
  tasks.value = tasks.value.map((t, i) =>
    i === index ? updatedTask : t
  )
}

const removeTask = (index: number) => {
  if (confirm('确定要删除这个学习任务吗？')) {
    tasks.value = tasks.value.filter((_, i) => i !== index)
  }
}

const moveTask = (index: number, direction: number) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= tasks.value.length) return
  const arr = [...tasks.value]
  const [item] = arr.splice(index, 1)
  arr.splice(newIndex, 0, item)
  tasks.value = arr
}

const totalDuration = computed(() => {
  return tasks.value.reduce((sum, task) => {
    const taskDuration = task.duration || 0
    const subTasksDuration = (task.subTasks || []).reduce((s: number, t: SubTask) => s + (t.duration || 0), 0)
    return sum + (taskDuration || subTasksDuration)
  }, 0)
})

const totalSubTasks = computed(() => {
  return tasks.value.reduce((sum, task) => sum + (task.subTasks?.length || 0), 0)
})

const totalAssessments = computed(() => {
  return tasks.value.reduce((sum, task) => sum + (task.assessmentTasks?.length || 0), 0)
})
</script>

<template>
  <div class="learning-tasks-editor">
    <!-- Summary Bar -->
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-value">{{ tasks.length }}</span>
        <span class="summary-label">学习任务</span>
      </div>
      <div class="summary-item">
        <span class="summary-value">{{ totalSubTasks }}</span>
        <span class="summary-label">子任务</span>
      </div>
      <div class="summary-item">
        <span class="summary-value">{{ totalAssessments }}</span>
        <span class="summary-label">评价任务</span>
      </div>
      <div class="summary-item">
        <span class="summary-value">{{ totalDuration }}</span>
        <span class="summary-label">分钟</span>
      </div>
    </div>

    <!-- Tasks List -->
    <div v-if="tasks.length > 0" class="tasks-list">
      <LearningTaskCard
        v-for="(task, index) in tasks"
        :key="task.id"
        :task="task"
        :index="index"
        :available-requirements="availableRequirements"
        :readonly="readonly"
        :can-move-up="index > 0"
        :can-move-down="index < tasks.length - 1"
        @update="updateTask(index, $event)"
        @remove="removeTask(index)"
        @move="moveTask(index, $event)"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6"/>
          <path d="M9 13h6"/>
          <path d="M9 17h4"/>
        </svg>
      </div>
      <p class="empty-text">暂无学习任务</p>
      <p class="empty-hint">添加学习任务来组织教学活动</p>
    </div>

    <!-- Add Button -->
    <button v-if="!readonly" class="btn-add-task" @click="addTask">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      添加学习任务
    </button>
  </div>
</template>

<style scoped>
.learning-tasks-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-bar {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border-radius: 10px;
  border: 1px solid #e0e7ff;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #2563eb;
}

.summary-label {
  font-size: 12px;
  color: #64748b;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
}

.empty-icon {
  color: #cbd5e1;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 4px 0;
}

.empty-hint {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.btn-add-task {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  background: white;
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
  color: #64748b;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-task:hover {
  border-color: #2563eb;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.05);
}

.btn-add-task svg {
  flex-shrink: 0;
}
</style>
