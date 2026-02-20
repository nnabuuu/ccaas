<script setup lang="ts">
/**
 * PreparationTasksEditor - Editor for pre-class preparation tasks linked to learning objectives
 *
 * Manages preparation tasks with dropdown linking to available learning objectives.
 * Each task displays associated objective tags and supports add/remove operations.
 *
 * @example
 * <PreparationTasksEditor v-model="tasks" :available-objectives="objectives" :readonly="false" />
 */
import { ref, computed, type PropType } from 'vue'
import type { PreparationTask, LearningObjective } from '@/types'

const props = defineProps({
  modelValue: { type: Array as PropType<PreparationTask[]>, default: () => [] },
  availableObjectives: { type: Array as PropType<LearningObjective[]>, default: () => [] },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits<{
  'update:modelValue': [value: PreparationTask[]]
}>()

// Local copy for editing
const tasks = computed({
  get: () => props.modelValue || [],
  set: (val: PreparationTask[]) => emit('update:modelValue', val)
})

// Track which task has dropdown open
const openDropdownId = ref<number | null>(null)

const addTask = () => {
  const newId = Date.now()
  tasks.value = [...tasks.value, {
    id: newId,
    content: '',
    linkedObjectives: []
  }]
}

const removeTask = (id: number) => {
  tasks.value = tasks.value.filter(task => task.id !== id)
}

const updateTaskContent = (id: number, content: string) => {
  tasks.value = tasks.value.map(task =>
    task.id === id ? { ...task, content } : task
  )
}

const toggleObjective = (taskId: number, objectiveId: number) => {
  tasks.value = tasks.value.map(task => {
    if (task.id !== taskId) return task
    const linked = task.linkedObjectives || []
    const exists = linked.includes(objectiveId)
    return {
      ...task,
      linkedObjectives: exists
        ? linked.filter(id => id !== objectiveId)
        : [...linked, objectiveId]
    }
  })
}

const isObjectiveLinked = (taskId: number, objectiveId: number): boolean => {
  const task = tasks.value.find(t => t.id === taskId)
  return task?.linkedObjectives?.includes(objectiveId) || false
}

const getObjectiveLabel = (objectiveId: number): string => {
  const obj = props.availableObjectives.find(o => o.id === objectiveId)
  if (!obj) return `目标 ${objectiveId}`
  // Truncate long content
  const content = obj.content || ''
  return content.length > 30 ? content.slice(0, 30) + '...' : content
}

const getObjectiveIndex = (objectiveId: number): number | string => {
  const index = props.availableObjectives.findIndex(o => o.id === objectiveId)
  return index >= 0 ? index + 1 : '?'
}

const toggleDropdown = (id: number) => {
  openDropdownId.value = openDropdownId.value === id ? null : id
}

const closeDropdown = () => {
  openDropdownId.value = null
}
</script>

<template>
  <div class="preparation-tasks-editor">
    <!-- Tasks List -->
    <div v-if="tasks.length > 0" class="tasks-list">
      <div
        v-for="(task, index) in tasks"
        :key="task.id"
        class="task-item"
      >
        <div class="task-header">
          <span class="task-number">任务 {{ index + 1 }}</span>
          <button
            v-if="!readonly"
            class="btn-remove"
            @click="removeTask(task.id)"
            title="删除任务"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Content Input -->
        <div class="task-content">
          <textarea
            v-if="!readonly"
            :value="task.content"
            @input="updateTaskContent(task.id, ($event.target as HTMLTextAreaElement).value)"
            placeholder="请输入准备任务内容..."
            rows="2"
            class="task-textarea"
          />
          <p v-else class="task-text">{{ task.content || '暂无内容' }}</p>
        </div>

        <!-- Linked Objectives -->
        <div class="linked-objectives">
          <div class="linked-label">关联学习目标：</div>

          <!-- Tags for linked objectives -->
          <div class="objective-tags">
            <span
              v-for="objId in task.linkedObjectives"
              :key="objId"
              class="objective-tag"
            >
              <span class="tag-index">目标{{ getObjectiveIndex(objId) }}</span>
              <span class="tag-content">{{ getObjectiveLabel(objId) }}</span>
              <button
                v-if="!readonly"
                class="tag-remove"
                @click="toggleObjective(task.id, objId)"
              >×</button>
            </span>
            <span v-if="!task.linkedObjectives?.length" class="no-links">
              暂未关联
            </span>
          </div>

          <!-- Add objective dropdown -->
          <div v-if="!readonly" class="add-objective">
            <button
              class="btn-add-link"
              @click="toggleDropdown(task.id)"
              :disabled="availableObjectives.length === 0"
            >
              + 关联目标
            </button>

            <div
              v-if="openDropdownId === task.id"
              class="objective-dropdown"
              @mouseleave="closeDropdown"
            >
              <template v-if="availableObjectives.length > 0">
                <label
                  v-for="(obj, objIndex) in availableObjectives"
                  :key="obj.id"
                  class="dropdown-item"
                >
                  <input
                    type="checkbox"
                    :checked="isObjectiveLinked(task.id, obj.id)"
                    @change="toggleObjective(task.id, obj.id)"
                  />
                  <span class="item-index">目标{{ objIndex + 1 }}</span>
                  <span class="item-label">{{ obj.content || '(空)' }}</span>
                </label>
              </template>
              <div v-else class="no-items">
                暂无学习目标
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p>暂无课前准备任务</p>
    </div>

    <!-- Add Button -->
    <button v-if="!readonly" class="btn-add-task" @click="addTask">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      添加准备任务
    </button>
  </div>
</template>

<style scoped>
.preparation-tasks-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-number {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.btn-remove {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-remove:hover {
  background: #fee2e2;
  color: #ef4444;
}

.task-content {
  margin-bottom: 12px;
}

.task-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
}

.task-textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.task-text {
  color: #334155;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.linked-objectives {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.linked-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.objective-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.objective-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.tag-index {
  font-weight: 600;
}

.tag-content {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  margin-left: 2px;
  opacity: 0.7;
}

.tag-remove:hover {
  opacity: 1;
}

.no-links {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}

.add-objective {
  position: relative;
}

.btn-add-link {
  background: none;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-link:hover:not(:disabled) {
  border-color: #7c3aed;
  color: #7c3aed;
}

.btn-add-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.objective-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 300px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 100;
  padding: 8px 0;
}

.dropdown-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #f8fafc;
}

.dropdown-item input[type="checkbox"] {
  margin-top: 2px;
  flex-shrink: 0;
}

.item-index {
  font-size: 12px;
  font-weight: 600;
  color: #7c3aed;
  flex-shrink: 0;
}

.item-label {
  font-size: 13px;
  color: #334155;
  line-height: 1.4;
}

.no-items {
  padding: 12px;
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
  text-align: center;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 14px;
}

.btn-add-task {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-task:hover {
  border-color: #7c3aed;
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.05);
}
</style>
