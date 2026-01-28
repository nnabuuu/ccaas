<script setup lang="ts">
/**
 * HomeworkAssessmentEditor - Editor for homework tasks with level distribution and design tips
 *
 * Manages homework tasks with summary statistics, level distribution visualization,
 * and intelligent design tips based on task composition and time requirements.
 *
 * @example
 * <HomeworkAssessmentEditor v-model="tasks" :available-objectives="objectives" :readonly="false" />
 */
import { computed, type PropType } from 'vue'
import HomeworkTaskCard from './HomeworkTaskCard.vue'
import type { HomeworkTask, LearningObjective } from '@/types'

type LevelKey = 'basic' | 'proficient' | 'advanced'

const props = defineProps({
  modelValue: { type: Array as PropType<HomeworkTask[]>, default: () => [] },
  availableObjectives: { type: Array as PropType<LearningObjective[]>, default: () => [] },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits<{
  'update:modelValue': [value: HomeworkTask[]]
}>()

const tasks = computed({
  get: () => props.modelValue || [],
  set: (val: HomeworkTask[]) => emit('update:modelValue', val)
})

const addTask = () => {
  const newTask: HomeworkTask = {
    id: Date.now(),
    name: '',
    description: '',
    type: 'practice',
    level: 'basic',
    isRequired: true,
    estimatedTime: 10,
    linkedObjectives: [],
    criteria: '',
    authenticity: null
  }
  tasks.value = [...tasks.value, newTask]
}

const updateTask = (index: number, updatedTask: HomeworkTask) => {
  tasks.value = tasks.value.map((t, i) =>
    i === index ? updatedTask : t
  )
}

const removeTask = (index: number) => {
  if (confirm('确定要删除这个作业任务吗？')) {
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

// Summary statistics
const totalTime = computed(() => {
  return tasks.value.reduce((sum, task) => sum + (task.estimatedTime || 0), 0)
})

const requiredCount = computed(() => {
  return tasks.value.filter(t => t.isRequired).length
})

const optionalCount = computed(() => {
  return tasks.value.filter(t => !t.isRequired).length
})

const levelDistribution = computed(() => {
  const counts: Record<LevelKey, number> = { basic: 0, proficient: 0, advanced: 0 }
  tasks.value.forEach(t => {
    const level = t.level as LevelKey
    if (counts[level] !== undefined) {
      counts[level]++
    }
  })
  return counts
})

const levelColors: Record<LevelKey, string> = {
  basic: '#10b981',
  proficient: '#3b82f6',
  advanced: '#8b5cf6'
}

const levelLabels: Record<LevelKey, string> = {
  basic: '基础',
  proficient: '熟练',
  advanced: '拓展'
}
</script>

<template>
  <div class="homework-assessment-editor">
    <!-- Summary Bar -->
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-value">{{ tasks.length }}</span>
        <span class="summary-label">作业任务</span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-value">{{ requiredCount }}</span>
        <span class="summary-label">必做</span>
      </div>
      <div class="summary-item">
        <span class="summary-value secondary">{{ optionalCount }}</span>
        <span class="summary-label">选做</span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-value">{{ totalTime }}</span>
        <span class="summary-label">分钟</span>
      </div>
      <div class="summary-divider"></div>
      <div class="level-distribution">
        <div
          v-for="(count, level) in levelDistribution"
          :key="level"
          class="level-item"
          :title="levelLabels[level]"
        >
          <span
            class="level-dot"
            :style="{ backgroundColor: levelColors[level] }"
          ></span>
          <span class="level-count">{{ count }}</span>
        </div>
      </div>
    </div>

    <!-- Tasks List -->
    <div v-if="tasks.length > 0" class="tasks-list">
      <HomeworkTaskCard
        v-for="(task, index) in tasks"
        :key="task.id"
        :task="task"
        :index="index"
        :available-objectives="availableObjectives"
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
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6"/>
          <path d="M9 16h6"/>
        </svg>
      </div>
      <p class="empty-text">暂无作业任务</p>
      <p class="empty-hint">添加作业任务来巩固学习成果</p>
    </div>

    <!-- Add Button -->
    <button v-if="!readonly" class="btn-add-task" @click="addTask">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      添加作业任务
    </button>

    <!-- Design Tips -->
    <div v-if="!readonly && tasks.length > 0" class="design-tips">
      <div class="tip-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        设计建议
      </div>
      <ul class="tip-list">
        <li v-if="levelDistribution.basic === 0">建议添加基础层次的作业，确保全体学生能完成</li>
        <li v-if="tasks.length > 0 && optionalCount === 0">可考虑添加选做任务，满足不同学生需求</li>
        <li v-if="totalTime > 45">作业总时长较长（{{ totalTime }}分钟），请确保符合"双减"要求</li>
        <li v-if="tasks.every(t => !t.linkedObjectives?.length)">建议将作业与学习目标关联，确保教-学-评一体化</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.homework-assessment-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
  border-radius: 10px;
  border: 1px solid #fde68a;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #d97706;
}

.summary-value.secondary {
  color: #92400e;
  font-size: 16px;
}

.summary-label {
  font-size: 12px;
  color: #92400e;
}

.summary-divider {
  width: 1px;
  height: 24px;
  background: #fde68a;
}

.level-distribution {
  display: flex;
  gap: 12px;
}

.level-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.level-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.level-count {
  font-size: 14px;
  font-weight: 600;
  color: #78716c;
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
  background: #fffbeb;
  border-radius: 12px;
  border: 2px dashed #fde68a;
}

.empty-icon {
  color: #fbbf24;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: #92400e;
  margin: 0 0 4px 0;
}

.empty-hint {
  font-size: 13px;
  color: #a16207;
  margin: 0;
}

.btn-add-task {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  background: white;
  border: 2px dashed #fde68a;
  border-radius: 10px;
  color: #92400e;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-task:hover {
  border-color: #f59e0b;
  color: #d97706;
  background: rgba(245, 158, 11, 0.05);
}

.btn-add-task svg {
  flex-shrink: 0;
}

.design-tips {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 12px 16px;
}

.tip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #0369a1;
  margin-bottom: 8px;
}

.tip-list {
  margin: 0;
  padding-left: 24px;
  font-size: 12px;
  color: #0c4a6e;
  line-height: 1.8;
}

.tip-list li {
  margin-bottom: 2px;
}
</style>
